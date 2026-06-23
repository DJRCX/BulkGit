use chrono::{DateTime, TimeZone, Utc};
use git2::{BranchType, Repository, StatusOptions};
use std::path::Path;
use std::time::Duration;
use tokio::time::timeout;

use crate::types::{AppError, ChangedFile, ConflictFile, FileChanges, RepoStatus, SyncStatus};

/// Parse the full Git status for a single repository.
/// Enforces a 10-second timeout on any remote network operations.
pub async fn get_repo_status(path: &str) -> RepoStatus {
    let path_str = path.to_string();
    let name = extract_repo_name(path);

    match timeout(Duration::from_secs(10), async {
        tokio::task::spawn_blocking(move || parse_status(&path_str))
            .await
            .map_err(|e| AppError::Scan(e.to_string()))?
    })
    .await
    {
        Ok(Ok(status)) => status,
        Ok(Err(e)) => {
            let msg = e.to_string();
            if msg.contains("auth") || msg.contains("credential") || msg.contains("authentication")
            {
                let mut s = RepoStatus::error(path.to_string(), name, msg);
                s.sync_status = SyncStatus::AuthRequired;
                s
            } else {
                RepoStatus::error(path.to_string(), name, msg)
            }
        }
        Err(_) => {
            let mut s = RepoStatus::error(
                path.to_string(),
                name,
                "Operation timed out (10s)".to_string(),
            );
            s.sync_status = SyncStatus::Error;
            s
        }
    }
}

fn parse_status(path: &str) -> Result<RepoStatus, AppError> {
    let repo = Repository::open(path)?;
    let name = extract_repo_name(path);

    // --- Current branch ---
    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => {
            // Unborn branch (empty repo)
            return Ok(RepoStatus {
                path: path.to_string(),
                name,
                branch: "main".to_string(),
                tracking_branch: None,
                ahead: 0,
                behind: 0,
                changes: FileChanges::default(),
                last_commit_hash: None,
                last_commit_message: None,
                last_commit_author: None,
                last_commit_time: None,
                sync_status: SyncStatus::Synced,
                error_message: None,
            });
        }
    };

    let branch_name = head.shorthand().unwrap_or("HEAD").to_string();

    // --- Local file changes ---
    let mut status_opts = StatusOptions::new();
    status_opts
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);

    let statuses = repo.statuses(Some(&mut status_opts))?;
    let mut changes = FileChanges::default();

    for entry in statuses.iter() {
        let s = entry.status();
        if s.is_index_new()
            || s.is_index_modified()
            || s.is_index_deleted()
            || s.is_index_renamed()
            || s.is_index_typechange()
        {
            changes.staged += 1;
        }
        if s.is_wt_modified() || s.is_wt_deleted() || s.is_wt_typechange() || s.is_wt_renamed() {
            changes.unstaged += 1;
        }
        if s.is_wt_new() {
            changes.untracked += 1;
        }
    }

    // --- Last commit info ---
    let (last_commit_hash, last_commit_message, last_commit_author, last_commit_time) =
        if let Ok(commit) = repo.head().and_then(|h| h.peel_to_commit()) {
            let hash = format!("{:.7}", commit.id());
            let message = commit.summary().unwrap_or("").to_string();
            let author = commit.author().name().unwrap_or("").to_string();
            let time = {
                let ts = commit.time().seconds();
                let dt: DateTime<Utc> = Utc.timestamp_opt(ts, 0).single().unwrap_or_default();
                dt.format("%Y-%m-%dT%H:%M:%SZ").to_string()
            };
            (Some(hash), Some(message), Some(author), Some(time))
        } else {
            (None, None, None, None)
        };

    // --- Ahead/behind vs tracking branch ---
    let (tracking_branch, ahead, behind, sync_status) =
        compute_sync_status(&repo, &branch_name, &head)?;

    Ok(RepoStatus {
        path: path.to_string(),
        name,
        branch: branch_name,
        tracking_branch,
        ahead,
        behind,
        changes,
        last_commit_hash,
        last_commit_message,
        last_commit_author,
        last_commit_time,
        sync_status,
        error_message: None,
    })
}

fn compute_sync_status(
    repo: &Repository,
    branch_name: &str,
    head: &git2::Reference,
) -> Result<(Option<String>, u32, u32, SyncStatus), AppError> {
    // Try to find the upstream tracking branch
    let local_branch = repo.find_branch(branch_name, BranchType::Local);
    let upstream = local_branch.ok().and_then(|b| b.upstream().ok());

    let tracking_name = upstream
        .as_ref()
        .and_then(|u| u.name().ok().flatten().map(|s| s.to_string()));

    if let (Some(upstream_branch), Some(local_oid)) = (upstream, head.target()) {
        if let Some(upstream_oid) = upstream_branch.get().target() {
            let (ahead, behind) = repo.graph_ahead_behind(local_oid, upstream_oid)?;
            let ahead = ahead as u32;
            let behind = behind as u32;

            let status = match (ahead, behind) {
                (0, 0) => SyncStatus::Synced,
                (a, 0) if a > 0 => SyncStatus::Ahead,
                (0, b) if b > 0 => SyncStatus::Behind,
                _ => SyncStatus::Diverged,
            };

            return Ok((tracking_name, ahead, behind, status));
        }
    }

    Ok((None, 0, 0, SyncStatus::NoRemote))
}

pub fn git_fetch(path: &str) -> Result<(), git2::Error> {
    let repo = git2::Repository::open(path)?;
    let remotes = repo.remotes()?;
    let remote_name = remotes.get(0).unwrap_or("origin");
    let mut remote = repo.find_remote(remote_name)?;
    let mut fetch_opts = get_fetch_options()?;
    remote.fetch(&[] as &[&str], Some(&mut fetch_opts), None)?;
    Ok(())
}

pub fn git_pull(path: &str) -> Result<(), git2::Error> {
    let repo = git2::Repository::open(path)?;

    // Check if repository is clean before pulling
    let mut status_opts = git2::StatusOptions::new();
    status_opts.include_untracked(false).include_ignored(false);
    let statuses = repo.statuses(Some(&mut status_opts))?;
    let is_dirty = statuses.iter().any(|entry| {
        let s = entry.status();
        !s.is_ignored() && !s.is_wt_new()
    });
    if is_dirty {
        return Err(git2::Error::from_str(
            "Cannot pull: repository has uncommitted changes",
        ));
    }

    let head = repo.head()?;
    let branch_name = head.shorthand().unwrap_or("main").to_string();

    // Find the upstream tracking branch properly using Git config
    let local_branch = repo.find_branch(&branch_name, git2::BranchType::Local)?;
    let upstream = local_branch.upstream()?;
    let upstream_oid = upstream
        .get()
        .target()
        .ok_or_else(|| git2::Error::from_str("upstream reference has no target"))?;

    let upstream_commit = repo.find_annotated_commit(upstream_oid)?;
    let (analysis, _) = repo.merge_analysis(&[&upstream_commit])?;

    if analysis.is_up_to_date() {
        return Ok(());
    }

    if analysis.is_fast_forward() {
        let mut ref_handle = repo.find_reference(&format!("refs/heads/{}", branch_name))?;
        ref_handle.set_target(upstream_oid, "pull: Fast-forward")?;
        repo.set_head(&format!("refs/heads/{}", branch_name))?;
        let mut checkout_opts = git2::build::CheckoutBuilder::default();
        repo.checkout_head(Some(&mut checkout_opts))?;
        return Ok(());
    }

    Err(git2::Error::from_str(
        "Cannot fast-forward: merge commit or conflicts required",
    ))
}

fn get_remote_callbacks() -> Result<git2::RemoteCallbacks<'static>, git2::Error> {
    let mut callbacks = git2::RemoteCallbacks::new();
    callbacks.credentials(|_url, username_from_url, allowed_types| {
        if allowed_types.contains(git2::CredentialType::SSH_KEY) {
            let user = username_from_url.unwrap_or("git");
            git2::Cred::ssh_key_from_agent(user)
        } else if allowed_types.contains(git2::CredentialType::USER_PASS_PLAINTEXT) {
            git2::Cred::credential_helper(&git2::Config::open_default()?, _url, username_from_url)
        } else {
            Err(git2::Error::from_str("no supported credential type"))
        }
    });
    Ok(callbacks)
}

fn get_fetch_options() -> Result<git2::FetchOptions<'static>, git2::Error> {
    let mut fetch_opts = git2::FetchOptions::new();
    fetch_opts.remote_callbacks(get_remote_callbacks()?);
    fetch_opts.download_tags(git2::AutotagOption::Unspecified);
    Ok(fetch_opts)
}

pub fn get_changed_files(path: &str) -> Result<Vec<ChangedFile>, AppError> {
    if !is_safe_path(path) {
        return Err(AppError::Scan("Path is not a safe Git repository".to_string()));
    }
    let repo = Repository::open(path)?;
    let mut status_opts = StatusOptions::new();
    status_opts
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);

    let statuses = repo.statuses(Some(&mut status_opts))?;
    let mut files = Vec::new();

    for entry in statuses.iter() {
        let status = entry.status();
        let file_path = entry.path().unwrap_or("").to_string();

        let status_str = if status.is_index_new() {
            "staged_added"
        } else if status.is_index_modified() {
            "staged_modified"
        } else if status.is_index_deleted() {
            "staged_deleted"
        } else if status.is_index_renamed() {
            "staged_renamed"
        } else if status.is_index_typechange() {
            "staged_typechange"
        } else if status.is_wt_modified() {
            "unstaged_modified"
        } else if status.is_wt_deleted() {
            "unstaged_deleted"
        } else if status.is_wt_typechange() {
            "unstaged_typechange"
        } else if status.is_wt_renamed() {
            "unstaged_renamed"
        } else if status.is_wt_new() {
            "untracked"
        } else {
            continue;
        };

        files.push(ChangedFile {
            path: file_path,
            status: status_str.to_string(),
        });
    }

    Ok(files)
}

pub fn get_file_diff(repo_path: &str, file_path: &str, is_staged: bool, is_untracked: bool) -> Result<String, AppError> {
    if !is_safe_path(repo_path) {
        return Err(AppError::Scan("Path is not a safe Git repository".to_string()));
    }
    let repo = Repository::open(repo_path)?;

    if is_untracked {
        let full_path = Path::new(repo_path).join(file_path);
        let content = match std::fs::read_to_string(&full_path) {
            Ok(c) => c,
            Err(_) => return Ok(String::new()),
        };
        let mut diff_str = String::new();
        diff_str.push_str(&format!("--- a/{}\n+++ b/{}\n@@ -0,0 +1,{} @@\n", file_path, file_path, content.lines().count()));
        for line in content.lines() {
            diff_str.push('+');
            diff_str.push_str(line);
            diff_str.push('\n');
        }
        return Ok(diff_str);
    }

    let mut diff_opts = git2::DiffOptions::new();
    diff_opts.pathspec(file_path);

    let diff = if is_staged {
        let head_tree = repo.head()
            .and_then(|h| h.peel_to_tree())
            .ok();
        repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut diff_opts))?
    } else {
        repo.diff_index_to_workdir(None, Some(&mut diff_opts))?
    };

    let mut diff_str = String::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        let origin = line.origin();
        let content = std::str::from_utf8(line.content()).unwrap_or("");
        match origin {
            '+' | '-' | ' ' => {
                diff_str.push(origin);
                diff_str.push_str(content);
            }
            _ => {
                diff_str.push_str(content);
            }
        }
        true
    })?;

    Ok(diff_str)
}

pub fn get_merge_conflicts(repo_path: &str) -> Result<Vec<ConflictFile>, AppError> {
    if !is_safe_path(repo_path) {
        return Err(AppError::Scan("Path is not a safe Git repository".to_string()));
    }
    let repo = Repository::open(repo_path)?;
    let index = repo.index()?;
    let conflicts = index.conflicts()?;
    let mut conflict_files = Vec::new();

    for c in conflicts {
        let conflict = c?;
        let path_bytes = conflict.our.as_ref()
            .or(conflict.their.as_ref())
            .or(conflict.ancestor.as_ref())
            .map(|e| e.path.clone())
            .unwrap_or_default();
        let file_path = String::from_utf8_lossy(&path_bytes).into_owned();

        let base_content = if let Some(ancestor) = conflict.ancestor {
            read_blob_content(&repo, ancestor.id).unwrap_or_default()
        } else {
            String::new()
        };

        let our_content = if let Some(our) = conflict.our {
            read_blob_content(&repo, our.id).unwrap_or_default()
        } else {
            String::new()
        };

        let their_content = if let Some(their) = conflict.their {
            read_blob_content(&repo, their.id).unwrap_or_default()
        } else {
            String::new()
        };

        conflict_files.push(ConflictFile {
            path: file_path,
            our_content,
            their_content,
            base_content,
        });
    }

    Ok(conflict_files)
}

pub fn resolve_conflict(repo_path: &str, file_path: &str, content: &str) -> Result<(), AppError> {
    if !is_safe_path(repo_path) {
        return Err(AppError::Scan("Path is not a safe Git repository".to_string()));
    }
    let repo = Repository::open(repo_path)?;
    let path = Path::new(repo_path).join(file_path);
    std::fs::write(&path, content)?;

    let mut index = repo.index()?;
    index.add_path(Path::new(file_path))?;
    index.write()?;
    Ok(())
}

/// Read the raw UTF-8 content of a blob identified by its OID.
fn read_blob_content(repo: &Repository, id: git2::Oid) -> Result<String, AppError> {
    let blob = repo.find_blob(id)?;
    Ok(String::from_utf8_lossy(blob.content()).into_owned())
}

pub fn stash_repo(path: &str) -> Result<(), AppError> {
    if !is_safe_path(path) {
        return Err(AppError::Scan("Path is not a safe Git repository".to_string()));
    }
    let mut repo = Repository::open(path)?;

    // Determine dirtiness in an inner block so the borrow of `repo` ends
    // before we call `stash_save`, which requires a mutable borrow.
    let is_dirty = {
        let mut status_opts = StatusOptions::new();
        status_opts.include_untracked(true).include_ignored(false);
        let statuses = repo.statuses(Some(&mut status_opts))?;
        statuses.iter().any(|entry| !entry.status().is_ignored())
    };

    if !is_dirty {
        return Ok(());
    }

    let sig = repo.signature().unwrap_or_else(|_| {
        git2::Signature::now("BulkGit", "bulkgit@example.com").unwrap()
    });

    repo.stash_save(&sig, "BulkGit Auto Stash", Some(git2::StashFlags::INCLUDE_UNTRACKED))?;
    Ok(())
}

pub fn commit_and_push(path: &str, message: &str) -> Result<(), AppError> {
    if !is_safe_path(path) {
        return Err(AppError::Scan("Path is not a safe Git repository".to_string()));
    }
    let repo = Repository::open(path)?;

    let mut index = repo.index()?;
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
    index.write()?;

    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;

    let sig = repo.signature().unwrap_or_else(|_| {
        git2::Signature::now("BulkGit", "bulkgit@example.com").unwrap()
    });

    let head = repo.head();
    let mut parents = Vec::new();
    if let Ok(ref head_ref) = head {
        if let Ok(parent_commit) = head_ref.peel_to_commit() {
            parents.push(parent_commit);
        }
    }
    let parent_refs: Vec<&git2::Commit> = parents.iter().collect();

    repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        message,
        &tree,
        &parent_refs,
    )?;

    let head_ref = repo.head()?;
    let branch_name = head_ref.shorthand().ok_or_else(|| git2::Error::from_str("HEAD has no branch name"))?;

    let mut remote = match repo.find_remote("origin") {
        Ok(r) => r,
        Err(_) => {
            return Err(AppError::Scan("Changes committed, but failed to push: no remote 'origin' configured".to_string()));
        }
    };

    let mut push_opts = git2::PushOptions::new();
    let callbacks = get_remote_callbacks()?;
    push_opts.remote_callbacks(callbacks);

    let refspec = format!("refs/heads/{}:refs/heads/{}", branch_name, branch_name);
    remote.push(&[refspec.as_str()], Some(&mut push_opts))?;

    Ok(())
}

pub fn is_safe_path(path: &str) -> bool {
    let p = Path::new(path);
    p.is_absolute() && p.exists() && p.is_dir() && p.join(".git").exists()
}

pub fn get_repo_branches(path: &str) -> Result<Vec<String>, AppError> {
    if !is_safe_path(path) {
        return Err(AppError::Scan("Path is not a safe Git repository".to_string()));
    }
    let repo = Repository::open(path)?;
    let branches = repo.branches(Some(BranchType::Local))?;
    let mut names = Vec::new();
    for entry in branches {
        let (branch, _) = entry?;
        if let Some(name) = branch.name()? {
            names.push(name.to_string());
        }
    }
    names.sort();
    Ok(names)
}

pub fn checkout_branch(path: &str, branch_name: &str) -> Result<(), AppError> {
    if !is_safe_path(path) {
        return Err(AppError::Scan("Path is not a safe Git repository".to_string()));
    }
    let repo = Repository::open(path)?;

    // Check if repository is clean before checking out (excluding ignored or untracked changes)
    let mut status_opts = git2::StatusOptions::new();
    status_opts.include_untracked(false).include_ignored(false);
    let statuses = repo.statuses(Some(&mut status_opts))?;
    let is_dirty = statuses.iter().any(|entry| {
        let s = entry.status();
        s.is_index_new()
            || s.is_index_modified()
            || s.is_index_deleted()
            || s.is_index_renamed()
            || s.is_index_typechange()
            || s.is_wt_modified()
            || s.is_wt_deleted()
            || s.is_wt_typechange()
            || s.is_wt_renamed()
    });
    if is_dirty {
        return Err(AppError::Scan(
            "Cannot checkout: repository has uncommitted changes".to_string(),
        ));
    }

    let branch = repo.find_branch(branch_name, BranchType::Local)?;
    let target = branch.get().peel_to_commit()?;
    let obj = target.as_object();

    let mut checkout_opts = git2::build::CheckoutBuilder::default();
    checkout_opts.safe();

    // Checkout the tree of the target commit first
    repo.checkout_tree(obj, Some(&mut checkout_opts))?;

    // Then update HEAD to point to the local branch reference
    let ref_name = format!("refs/heads/{}", branch_name);
    repo.set_head(&ref_name)?;

    Ok(())
}

fn extract_repo_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[tokio::test]
    async fn test_nonexistent_path_returns_error() {
        let status = get_repo_status("/nonexistent/path/to/repo").await;
        assert!(matches!(status.sync_status, SyncStatus::Error));
    }

    #[test]
    fn test_is_safe_path_valid_and_invalid() {
        let temp_dir = std::env::temp_dir().join(format!("git_worker_test_safe_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);
        assert!(!is_safe_path(temp_dir.to_str().unwrap()));

        fs::create_dir_all(&temp_dir).unwrap();
        assert!(!is_safe_path(temp_dir.to_str().unwrap())); // No .git yet

        // Init repository
        Repository::init(&temp_dir).unwrap();
        assert!(is_safe_path(temp_dir.to_str().unwrap())); // Safe git repo!

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_get_repo_branches_and_checkout() {
        let temp_dir = std::env::temp_dir().join(format!("git_worker_test_branches_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        let repo = Repository::init(&temp_dir).unwrap();

        // Create a signature
        let sig = repo.signature().unwrap_or_else(|_| {
            git2::Signature::now("Test User", "test@example.com").unwrap()
        });

        // We need a commit to create branches, so create an initial commit
        let tree_id = repo.index().unwrap().write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let commit_id = repo.commit(Some("HEAD"), &sig, &sig, "Initial commit", &tree, &[]).unwrap();
        let commit = repo.find_commit(commit_id).unwrap();

        // Create another branch "feature"
        repo.branch("feature", &commit, false).unwrap();

        // Get branches
        let branches = get_repo_branches(temp_dir.to_str().unwrap()).unwrap();
        assert_eq!(branches, vec!["feature".to_string(), "master".to_string()]);

        // Checkout feature
        checkout_branch(temp_dir.to_str().unwrap(), "feature").unwrap();

        // Verify head shorthand
        let head = repo.head().unwrap();
        assert_eq!(head.shorthand().unwrap(), "feature");

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
