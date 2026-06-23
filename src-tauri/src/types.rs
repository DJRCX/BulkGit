use serde::{Deserialize, Serialize};
use specta::Type;

/// Sync status of a repository relative to its remote tracking branch
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "snake_case")]
pub enum SyncStatus {
    /// Local is in sync with remote
    Synced,
    /// Local has commits remote doesn't
    Ahead,
    /// Remote has commits local doesn't
    Behind,
    /// Both local and remote have diverged commits
    Diverged,
    /// Currently fetching/pulling
    Updating,
    /// Auth credentials required
    AuthRequired,
    /// Operation failed
    Error,
    /// No remote tracking branch configured
    NoRemote,
    /// Repository not yet scanned
    Unknown,
}

/// Local file changes summary
#[derive(Debug, Clone, Serialize, Deserialize, Default, Type)]
pub struct FileChanges {
    pub staged: u32,
    pub unstaged: u32,
    pub untracked: u32,
}

/// Full status snapshot for a single repository
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RepoStatus {
    pub path: String,
    pub name: String,
    pub branch: String,
    pub tracking_branch: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub changes: FileChanges,
    pub last_commit_hash: Option<String>,
    pub last_commit_message: Option<String>,
    pub last_commit_author: Option<String>,
    pub last_commit_time: Option<String>,
    pub sync_status: SyncStatus,
    pub error_message: Option<String>,
}

impl RepoStatus {
    pub fn error(path: String, name: String, message: String) -> Self {
        Self {
            path,
            name,
            branch: String::new(),
            tracking_branch: None,
            ahead: 0,
            behind: 0,
            changes: FileChanges::default(),
            last_commit_hash: None,
            last_commit_message: None,
            last_commit_author: None,
            last_commit_time: None,
            sync_status: SyncStatus::Error,
            error_message: Some(message),
        }
    }
}

/// Progress event streamed per repository during bulk operations
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RepoProgress {
    pub path: String,
    pub name: String,
    pub phase: OperationPhase,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Type)]
#[serde(rename_all = "snake_case")]
pub enum OperationPhase {
    Queued,
    Fetching,
    Pulling,
    Success,
    Failed,
    AuthRequired,
}

/// Scan configuration from frontend
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ScanConfig {
    pub root_paths: Vec<String>,
    pub max_depth: Option<u32>,
    pub exclude_patterns: Option<Vec<String>>,
}

/// Application-level error type
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Git error: {0}")]
    Git(#[from] git2::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Scan error: {0}")]
    Scan(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// A changed file in a repository
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ChangedFile {
    pub path: String,
    pub status: String,
}

/// A file with conflicts and its Ours/Theirs/Base content
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ConflictFile {
    pub path: String,
    pub our_content: String,
    pub their_content: String,
    pub base_content: String,
}

