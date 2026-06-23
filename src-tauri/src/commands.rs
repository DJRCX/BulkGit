use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Semaphore;

use crate::git_worker;
use crate::scanner;
use crate::types::{ChangedFile, ConflictFile, OperationPhase, RepoProgress, RepoStatus, ScanConfig};

/// Scan root directories for Git repositories and return their paths.
#[tauri::command]
#[specta::specta]
pub async fn scan_repositories(config: ScanConfig) -> Result<Vec<String>, String> {
    let paths = tokio::task::spawn_blocking(move || scanner::scan_repositories(&config))
        .await
        .map_err(|e| e.to_string())?;

    Ok(paths
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect())
}

/// Get the full Git status for a single repository.
#[tauri::command]
#[specta::specta]
pub async fn get_repo_status(path: String) -> Result<RepoStatus, String> {
    if !git_worker::is_safe_path(&path) {
        return Err("Path is not a safe Git repository".to_string());
    }
    Ok(git_worker::get_repo_status(&path).await)
}

/// Get status for multiple repositories in parallel (bounded concurrency).
#[tauri::command]
#[specta::specta]
pub async fn get_repos_status(paths: Vec<String>) -> Result<Vec<RepoStatus>, String> {
    for path in &paths {
        if !git_worker::is_safe_path(path) {
            return Err(format!("Path is not a safe Git repository: {}", path));
        }
    }
    let semaphore = Arc::new(Semaphore::new(12));
    let mut handles = Vec::with_capacity(paths.len());

    for path in paths {
        let sem = Arc::clone(&semaphore);
        let handle = tokio::spawn(async move {
            let _permit = sem.acquire().await.ok();
            git_worker::get_repo_status(&path).await
        });
        handles.push(handle);
    }

    let mut results = Vec::with_capacity(handles.len());
    for h in handles {
        if let Ok(status) = h.await {
            results.push(status);
        }
    }

    Ok(results)
}

/// Run `git fetch` on multiple repos with concurrency limit, streaming progress via events.
#[tauri::command]
#[specta::specta]
pub async fn fetch_repos(
    app: AppHandle,
    paths: Vec<String>,
    concurrency: Option<u32>,
) -> Result<(), String> {
    for path in &paths {
        if !git_worker::is_safe_path(path) {
            return Err(format!("Path is not a safe Git repository: {}", path));
        }
    }
    let limit = concurrency.unwrap_or(4).clamp(1, 20) as usize;
    let semaphore = Arc::new(Semaphore::new(limit));
    let mut handles = Vec::with_capacity(paths.len());

    for path in paths {
        let sem = Arc::clone(&semaphore);
        let app_handle = app.clone();

        let handle = tokio::spawn(async move {
            let name = extract_name(&path);

            // Emit queued
            emit_progress(&app_handle, &path, &name, OperationPhase::Queued, None);

            let _permit = sem.acquire().await.ok();

            // Emit fetching
            emit_progress(&app_handle, &path, &name, OperationPhase::Fetching, None);

            // Run git fetch via spawn_blocking
            let path_clone = path.clone();
            let result = tokio::time::timeout(
                std::time::Duration::from_secs(30),
                tokio::task::spawn_blocking(move || git_worker::git_fetch(&path_clone)),
            )
            .await;

            match result {
                Ok(Ok(Ok(_))) => {
                    emit_progress(&app_handle, &path, &name, OperationPhase::Success, None);
                }
                Ok(Ok(Err(e))) => {
                    let msg = e.to_string();
                    let phase = if msg.contains("auth") || msg.contains("credential") {
                        OperationPhase::AuthRequired
                    } else {
                        OperationPhase::Failed
                    };
                    emit_progress(&app_handle, &path, &name, phase, Some(msg));
                }
                _ => {
                    emit_progress(
                        &app_handle,
                        &path,
                        &name,
                        OperationPhase::Failed,
                        Some("Timeout or task error".to_string()),
                    );
                }
            }
        });

        handles.push(handle);
    }

    for h in handles {
        let _ = h.await;
    }

    Ok(())
}

/// Run `git pull` on multiple repos with concurrency limit, streaming progress via events.
#[tauri::command]
#[specta::specta]
pub async fn pull_repos(
    app: AppHandle,
    paths: Vec<String>,
    concurrency: Option<u32>,
) -> Result<(), String> {
    for path in &paths {
        if !git_worker::is_safe_path(path) {
            return Err(format!("Path is not a safe Git repository: {}", path));
        }
    }
    let limit = concurrency.unwrap_or(4).clamp(1, 20) as usize;
    let semaphore = Arc::new(Semaphore::new(limit));
    let mut handles = Vec::with_capacity(paths.len());

    for path in paths {
        let sem = Arc::clone(&semaphore);
        let app_handle = app.clone();

        let handle = tokio::spawn(async move {
            let name = extract_name(&path);

            emit_progress(&app_handle, &path, &name, OperationPhase::Queued, None);

            let _permit = sem.acquire().await.ok();

            emit_progress(&app_handle, &path, &name, OperationPhase::Fetching, None);

            let path_clone = path.clone();
            let fetch_result = tokio::time::timeout(
                std::time::Duration::from_secs(30),
                tokio::task::spawn_blocking(move || git_worker::git_fetch(&path_clone)),
            )
            .await;

            match fetch_result {
                Ok(Ok(Ok(_))) => {}
                Ok(Ok(Err(e))) => {
                    let msg = e.to_string();
                    let phase = if msg.contains("auth") || msg.contains("credential") {
                        OperationPhase::AuthRequired
                    } else {
                        OperationPhase::Failed
                    };
                    emit_progress(&app_handle, &path, &name, phase, Some(msg));
                    return;
                }
                _ => {
                    emit_progress(
                        &app_handle,
                        &path,
                        &name,
                        OperationPhase::Failed,
                        Some("Fetch timeout".to_string()),
                    );
                    return;
                }
            }

            emit_progress(&app_handle, &path, &name, OperationPhase::Pulling, None);

            let path_clone2 = path.clone();
            let pull_result = tokio::time::timeout(
                std::time::Duration::from_secs(10),
                tokio::task::spawn_blocking(move || git_worker::git_pull(&path_clone2)),
            )
            .await;

            match pull_result {
                Ok(Ok(Ok(_))) => {
                    emit_progress(&app_handle, &path, &name, OperationPhase::Success, None);
                }
                Ok(Ok(Err(e))) => {
                    emit_progress(
                        &app_handle,
                        &path,
                        &name,
                        OperationPhase::Failed,
                        Some(e.to_string()),
                    );
                }
                _ => {
                    emit_progress(
                        &app_handle,
                        &path,
                        &name,
                        OperationPhase::Failed,
                        Some("Pull timeout".to_string()),
                    );
                }
            }
        });

        handles.push(handle);
    }

    for h in handles {
        let _ = h.await;
    }

    Ok(())
}

// ── Internal helpers ─────────────────────────────────────────────────────────

fn emit_progress(
    app: &AppHandle,
    path: &str,
    name: &str,
    phase: OperationPhase,
    message: Option<String>,
) {
    let payload = RepoProgress {
        path: path.to_string(),
        name: name.to_string(),
        phase,
        message,
    };
    let _ = app.emit("repo_progress", payload);
}

fn extract_name(path: &str) -> String {
    std::path::Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

/// Get all local branches for a repository.
#[tauri::command]
#[specta::specta]
pub async fn get_repo_branches(path: String) -> Result<Vec<String>, String> {
    if !git_worker::is_safe_path(&path) {
        return Err("Path is not a safe Git repository".to_string());
    }
    let path_clone = path.clone();
    tokio::task::spawn_blocking(move || {
        git_worker::get_repo_branches(&path_clone)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Safely check out a local branch.
#[tauri::command]
#[specta::specta]
pub async fn checkout_branch(path: String, branch_name: String) -> Result<(), String> {
    if !git_worker::is_safe_path(&path) {
        return Err("Path is not a safe Git repository".to_string());
    }
    let path_clone = path.clone();
    let branch_clone = branch_name.clone();
    tokio::task::spawn_blocking(move || {
        git_worker::checkout_branch(&path_clone, &branch_clone)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Get all changed files for a repository.
#[tauri::command]
#[specta::specta]
pub async fn get_changed_files(path: String) -> Result<Vec<ChangedFile>, String> {
    let path_clone = path.clone();
    tokio::task::spawn_blocking(move || {
        git_worker::get_changed_files(&path_clone)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Get unified diff for a single file.
#[tauri::command]
#[specta::specta]
pub async fn get_file_diff(
    repo_path: String,
    file_path: String,
    is_staged: bool,
    is_untracked: bool,
) -> Result<String, String> {
    let repo_clone = repo_path.clone();
    let file_clone = file_path.clone();
    tokio::task::spawn_blocking(move || {
        git_worker::get_file_diff(&repo_clone, &file_clone, is_staged, is_untracked)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Get all merge conflict files for a repository with their contents.
#[tauri::command]
#[specta::specta]
pub async fn get_merge_conflicts(repo_path: String) -> Result<Vec<ConflictFile>, String> {
    let repo_clone = repo_path.clone();
    tokio::task::spawn_blocking(move || {
        git_worker::get_merge_conflicts(&repo_clone)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Write resolution content to file and mark it as resolved (git add).
#[tauri::command]
#[specta::specta]
pub async fn resolve_conflict(
    repo_path: String,
    file_path: String,
    content: String,
) -> Result<(), String> {
    let repo_clone = repo_path.clone();
    let file_clone = file_path.clone();
    let content_clone = content.clone();
    tokio::task::spawn_blocking(move || {
        git_worker::resolve_conflict(&repo_clone, &file_clone, &content_clone)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Stash local uncommitted changes.
#[tauri::command]
#[specta::specta]
pub async fn stash_repo(path: String) -> Result<(), String> {
    let path_clone = path.clone();
    tokio::task::spawn_blocking(move || {
        git_worker::stash_repo(&path_clone)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Commit staged changes and push to origin.
#[tauri::command]
#[specta::specta]
pub async fn commit_and_push(path: String, message: String) -> Result<(), String> {
    let path_clone = path.clone();
    let message_clone = message.clone();
    tokio::task::spawn_blocking(move || {
        git_worker::commit_and_push(&path_clone, &message_clone)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Verify if system Git CLI is available. Returns (available, version_string).
#[tauri::command]
#[specta::specta]
pub async fn check_system_git() -> Result<bool, String> {
    let output = tokio::process::Command::new("git")
        .arg("--version")
        .output()
        .await;
    Ok(output.is_ok() && output.unwrap().status.success())
}

/// Check if an SSH agent is running and has loaded keys.
/// Uses `ssh-add -l` which works on Linux, macOS, and Windows (OpenSSH ≥ Win10 1803).
/// Returns Ok(true) if agent is reachable, Ok(false) if not found or no keys.
#[tauri::command]
#[specta::specta]
pub async fn check_ssh_agent() -> Result<bool, String> {
    let result = tokio::process::Command::new("ssh-add")
        .arg("-l")
        .output()
        .await;

    match result {
        Ok(out) => {
            // Exit code 0 = has keys, exit code 1 = no keys (but agent running), 2 = agent not running
            Ok(out.status.code().map_or(false, |c| c == 0 || c == 1))
        }
        // Binary not found — SSH not installed at all
        Err(_) => Ok(false),
    }
}

/// Log frontend React errors directly to a file for debugging
#[tauri::command]
#[specta::specta]
pub fn log_frontend_error(error: String, stack: String) {
    let log_path = "/home/djrcx/Work/BulkGit/react-error.log";
    let log_content = format!("Error: {}\nStack:\n{}", error, stack);
    let _ = std::fs::write(log_path, log_content);
}
