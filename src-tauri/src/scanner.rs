use rayon::prelude::*;
use std::path::PathBuf;
use walkdir::WalkDir;

use crate::types::ScanConfig;

/// Discover all Git repositories under the given root paths.
/// Uses rayon for parallel scanning across multiple roots and their subdirectories.
pub fn scan_repositories(config: &ScanConfig) -> Vec<PathBuf> {
    let max_depth = config.max_depth.unwrap_or(8) as usize;
    let excludes: Vec<String> = config
        .exclude_patterns
        .clone()
        .unwrap_or_else(|| vec!["node_modules".into(), ".cargo".into(), "target".into()]);

    let mut all_repos: Vec<PathBuf> = config
        .root_paths
        .par_iter()
        .flat_map(|root| find_repos_in_parallel(root, max_depth, &excludes))
        .collect();

    // Deduplicate and sort for stable ordering
    all_repos.sort();
    all_repos.dedup();
    all_repos
}

fn find_repos_in_parallel(root: &str, max_depth: usize, excludes: &[String]) -> Vec<PathBuf> {
    let root_path = PathBuf::from(root);
    // Check if the root itself is a repo
    if root_path.join(".git").exists() {
        return vec![root_path];
    }
    if max_depth == 0 {
        return vec![];
    }

    let entries: Vec<PathBuf> = match std::fs::read_dir(&root_path) {
        Ok(read_dir) => read_dir
            .filter_map(|res| {
                if let Ok(entry) = res {
                    let path = entry.path();
                    if path.is_dir() {
                        let name = entry.file_name().to_string_lossy().into_owned();
                        if name != ".git" && !excludes.iter().any(|ex| name == *ex) {
                            return Some(path);
                        }
                    }
                }
                None
            })
            .collect(),
        Err(_) => vec![],
    };

    entries
        .into_par_iter()
        .flat_map(|path| find_repos_in(&path, max_depth - 1, excludes))
        .collect()
}

fn find_repos_in(root: &std::path::Path, max_depth: usize, excludes: &[String]) -> Vec<PathBuf> {
    let mut repos = Vec::new();

    let walker = WalkDir::new(root)
        .max_depth(max_depth)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            // Skip excluded directory names
            if e.file_type().is_dir() {
                let name = e.file_name().to_string_lossy();
                // Don't descend into .git itself or excluded dirs
                if name == ".git" {
                    return false;
                }
                return !excludes.iter().any(|ex| name.as_ref() == ex);
            }
            true
        });

    for entry in walker.flatten() {
        if entry.file_type().is_dir() {
            let path = entry.path();
            // A directory is a git repo if it contains a .git subdirectory or file
            if path.join(".git").exists() {
                repos.push(path.to_path_buf());
            }
        }
    }

    repos
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn create_git_repo(path: &PathBuf) {
        fs::create_dir_all(path.join(".git")).unwrap();
    }

    fn create_excluded_dir(path: &PathBuf) {
        fs::create_dir_all(path).unwrap();
    }

    #[test]
    fn test_discovers_git_repos() {
        let dir = std::env::temp_dir().join(format!("scanner_test_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        create_git_repo(&dir.join("repo1"));
        create_git_repo(&dir.join("nested").join("repo2"));
        // Non-repo dir (no .git)
        create_excluded_dir(&dir.join("not_a_repo"));

        let config = ScanConfig {
            root_paths: vec![dir.to_string_lossy().to_string()],
            max_depth: Some(5),
            exclude_patterns: None,
        };

        let repos = scan_repositories(&config);
        let paths: Vec<&PathBuf> = repos.iter().collect();

        assert!(paths.iter().any(|p| p.ends_with("repo1")));
        assert!(paths.iter().any(|p| p.ends_with("repo2")));
        assert!(!paths.iter().any(|p| p.ends_with("nested")));
        assert!(!paths.iter().any(|p| p.ends_with("not_a_repo")));
        assert_eq!(paths.len(), 2);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_excludes_patterns() {
        let dir = std::env::temp_dir().join(format!("scanner_exclude_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        create_git_repo(&dir.join("project"));
        create_git_repo(&dir.join("node_modules")); // This should be excluded
        create_git_repo(&dir.join("target")); // This should be excluded

        let config = ScanConfig {
            root_paths: vec![dir.to_string_lossy().to_string()],
            max_depth: Some(5),
            exclude_patterns: Some(vec!["node_modules".to_string(), "target".to_string()]),
        };

        let repos = scan_repositories(&config);
        assert!(repos.iter().any(|p| p.ends_with("project")));
        assert!(!repos.iter().any(|p| p.ends_with("node_modules")));
        assert!(!repos.iter().any(|p| p.ends_with("target")));

        let _ = fs::remove_dir_all(&dir);
    }
}
