import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  ChevronRight,
  FileCode,
  FolderOpen,
  GitCommit,
  Info,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { type ChangedFile, type ConflictFile, commands } from "../bindings";
import { useStore } from "../store/store";
import { DiffViewer } from "./DiffViewer";
import { MergeResolver } from "./MergeResolver";

export function RepoDetailsPanel() {
  const queryClient = useQueryClient();
  const { activeRepoPath, detailsPanelOpen, setDetailsPanelOpen, setActiveRepoPath } = useStore(
    useShallow((s) => ({
      activeRepoPath: s.activeRepoPath,
      detailsPanelOpen: s.detailsPanelOpen,
      setDetailsPanelOpen: s.setDetailsPanelOpen,
      setActiveRepoPath: s.setActiveRepoPath,
    }))
  );

  const [files, setFiles] = useState<ChangedFile[]>([]);
  const [conflicts, setConflicts] = useState<ConflictFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Commit Form State
  const [commitMessage, setCommitMessage] = useState("");
  const [isCommitSaving, setIsCommitSaving] = useState(false);

  // Active file view state
  const [selectedFile, setSelectedFile] = useState<ChangedFile | null>(null);
  const [selectedFileDiff, setSelectedFileDiff] = useState<string>("");
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);

  // Active conflict resolution state
  const [activeConflict, setActiveConflict] = useState<ConflictFile | null>(null);

  // Fetch changes & conflicts
  const fetchRepoDetails = useCallback(async () => {
    if (!activeRepoPath) return;
    setIsLoading(true);
    setErrorMessage(null);

    const changedRes = await commands.getChangedFiles(activeRepoPath);
    const conflictRes = await commands.getMergeConflicts(activeRepoPath);

    setIsLoading(false);

    if (changedRes.status === "ok") {
      setFiles(changedRes.data);
    } else {
      setErrorMessage(changedRes.error);
    }

    if (conflictRes.status === "ok") {
      setConflicts(conflictRes.data);
    }
  }, [activeRepoPath]);

  useEffect(() => {
    if (activeRepoPath && detailsPanelOpen) {
      fetchRepoDetails();
      setSelectedFile(null);
      setSelectedFileDiff("");
      setActiveConflict(null);
    }
  }, [activeRepoPath, detailsPanelOpen, fetchRepoDetails]);

  // Handle file click to load diff
  const handleFileClick = async (file: ChangedFile) => {
    if (!activeRepoPath) return;
    setSelectedFile(file);
    setIsLoadingDiff(true);
    setSelectedFileDiff("");

    const isStaged = file.status.startsWith("staged");
    const isUntracked = file.status === "untracked";

    const res = await commands.getFileDiff(activeRepoPath, file.path, isStaged, isUntracked);
    setIsLoadingDiff(false);
    if (res.status === "ok") {
      setSelectedFileDiff(res.data);
    } else {
      setSelectedFileDiff(`Error loading diff: ${res.error}`);
    }
  };

  // Stash Repo
  const handleStash = async () => {
    if (!activeRepoPath) return;
    setIsLoading(true);
    const res = await commands.stashRepo(activeRepoPath);
    setIsLoading(false);
    if (res.status === "ok") {
      fetchRepoDetails();
      setSelectedFile(null);
      setSelectedFileDiff("");
      // Trigger a store refresh
      queryClient.invalidateQueries({ queryKey: ["repos"] });
    } else {
      setErrorMessage(res.error);
    }
  };

  // Commit and Push
  const handleCommitPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath || !commitMessage.trim()) return;
    setIsCommitSaving(true);
    setErrorMessage(null);

    const res = await commands.commitAndPush(activeRepoPath, commitMessage.trim());
    setIsCommitSaving(false);

    if (res.status === "ok") {
      setCommitMessage("");
      fetchRepoDetails();
      setSelectedFile(null);
      setSelectedFileDiff("");
      // Trigger a store refresh
      queryClient.invalidateQueries({ queryKey: ["repos"] });
    } else {
      setErrorMessage(res.error);
    }
  };

  const handleClose = () => {
    setDetailsPanelOpen(false);
    setActiveRepoPath(null);
  };

  if (!detailsPanelOpen || !activeRepoPath) return null;

  const repoName = activeRepoPath.split(/[\\/]/).pop() ?? activeRepoPath;

  return (
    <motion.aside
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
      className="fixed inset-y-0 right-0 z-40 flex flex-col w-96 max-w-full border-l border-[var(--border)] shadow-2xl overflow-hidden"
      style={{ background: "var(--card)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--header-bg)]">
        <div className="flex items-center gap-2">
          <FolderOpen size={14} className="text-blue-400" />
          <h2 className="text-[13px] font-bold text-[var(--foreground)] truncate max-w-[200px]">
            {repoName}
          </h2>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="p-1 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--hover-bg)] transition-colors"
          title="Close panel"
        >
          <X size={15} />
        </button>
      </div>

      {/* Content Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {errorMessage && (
          <div className="p-3 bg-red-950/20 border border-red-500/30 text-red-400 rounded text-[11px] leading-relaxed">
            <span className="font-semibold block mb-0.5">Operation Error</span>
            {errorMessage}
          </div>
        )}

        {/* Sync / Refresh */}
        <div className="flex items-center justify-between">
          <span
            className="text-[11px] font-mono text-[var(--muted-foreground)] truncate max-w-[200px]"
            title={activeRepoPath}
          >
            {activeRepoPath}
          </span>
          <button
            type="button"
            onClick={fetchRepoDetails}
            disabled={isLoading}
            className="p-1 rounded hover:bg-[var(--hover-bg)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            title="Refresh changes"
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin text-blue-400" : ""} />
          </button>
        </div>

        {/* Merge Conflicts Section */}
        {conflicts.length > 0 && (
          <div className="p-3 bg-amber-950/10 border border-amber-500/30 rounded-lg space-y-2">
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-amber-400">
              <AlertTriangle size={14} />
              <span>{conflicts.length} Merge Conflicts</span>
            </div>
            <p className="text-[10px] text-[var(--muted-foreground)] leading-relaxed">
              Resolve conflicting changes before staging and committing.
            </p>
            <div className="space-y-1.5 pt-1">
              {conflicts.map((conflict) => (
                <div
                  key={conflict.path}
                  className="flex items-center justify-between bg-[var(--card)] border border-[var(--border)] rounded px-2.5 py-1.5 text-[11px]"
                >
                  <span
                    className="font-mono text-[var(--foreground)] truncate max-w-[150px]"
                    title={conflict.path}
                  >
                    {conflict.path.split("/").pop()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveConflict(conflict)}
                    className="px-2 py-0.5 bg-amber-500 text-black hover:bg-amber-400 rounded text-[10px] font-semibold transition-colors"
                  >
                    Resolve
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Commit & Push Form */}
        {files.length > 0 && conflicts.length === 0 && (
          <form
            onSubmit={handleCommitPush}
            className="p-3 bg-[var(--muted)]/20 border border-[var(--border)] rounded-lg space-y-3"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--foreground)] select-none">
              <GitCommit size={13} className="text-blue-400" />
              <span>Commit & Push Changes</span>
            </div>
            <textarea
              required
              rows={2}
              placeholder="Commit message..."
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              className="w-full p-2 rounded border border-[var(--border)] bg-[var(--card)] text-[12px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-blue-500 transition-colors"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleStash}
                disabled={isLoading || isCommitSaving}
                className="flex-1 px-3 py-1.5 rounded bg-[var(--muted)] hover:bg-[var(--border)] text-[var(--foreground)] border border-[var(--border)] text-[11px] font-semibold transition-colors flex items-center justify-center gap-1"
                title="Stash uncommitted changes"
              >
                <Archive size={12} />
                Stash
              </button>
              <button
                type="submit"
                disabled={isCommitSaving || !commitMessage.trim()}
                className="flex-1 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition-colors flex items-center justify-center gap-1"
              >
                {isCommitSaving ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Pushing...
                  </>
                ) : (
                  <>
                    Commit & Push
                    <ArrowRight size={11} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Changed Files List */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider select-none">
            Changed Files ({files.length})
          </div>
          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-[var(--border)] rounded-lg text-[11px] text-[var(--muted-foreground)] italic bg-[var(--muted)]/10">
              <Info size={14} className="mb-1 text-[var(--muted-foreground)]/60" />
              No uncommitted changes.
            </div>
          ) : (
            <div className="border border-[var(--border)] rounded-md divide-y divide-[var(--border)] max-h-48 overflow-y-auto">
              {files.map((file) => {
                let statusBadge = "M";
                let badgeColor = "text-amber-400 bg-amber-950/20";
                if (file.status.includes("added") || file.status === "untracked") {
                  statusBadge = "A";
                  badgeColor = "text-emerald-400 bg-emerald-950/20";
                } else if (file.status.includes("deleted")) {
                  statusBadge = "D";
                  badgeColor = "text-rose-400 bg-rose-950/20";
                }

                return (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => handleFileClick(file)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] transition-colors hover:bg-[var(--hover-bg)] ${
                      selectedFile?.path === file.path ? "bg-[var(--selected-row-bg)]" : ""
                    }`}
                  >
                    <FileCode size={13} className="text-[var(--muted-foreground)] flex-shrink-0" />
                    <span
                      className="flex-1 truncate font-mono text-[var(--foreground)]"
                      title={file.path}
                    >
                      {file.path}
                    </span>
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold ${badgeColor} flex-shrink-0 select-none`}
                    >
                      {statusBadge}
                    </span>
                    <ChevronRight
                      size={10}
                      className="text-[var(--muted-foreground)] flex-shrink-0"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Diff Visualizer (Inline in panel) */}
        {selectedFile && (
          <div className="space-y-2 pt-2 border-t border-[var(--border)]">
            <div className="flex items-center justify-between text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider select-none">
              <span>File Diff</span>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="text-[10px] text-blue-400 hover:underline hover:text-blue-300 font-semibold"
              >
                Close diff
              </button>
            </div>
            {isLoadingDiff ? (
              <div className="flex items-center justify-center p-8 gap-2 text-xs text-[var(--muted-foreground)] bg-[var(--muted)]/10 border border-[var(--border)] rounded-lg">
                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                Loading file diff...
              </div>
            ) : (
              <DiffViewer diffText={selectedFileDiff} filePath={selectedFile.path} />
            )}
          </div>
        )}
      </div>

      {/* Conflict Resolution Modal Overlay */}
      {activeConflict && (
        <MergeResolver
          repoPath={activeRepoPath}
          filePath={activeConflict.path}
          ourContent={activeConflict.our_content}
          theirContent={activeConflict.their_content}
          baseContent={activeConflict.base_content}
          onResolve={() => {
            setActiveConflict(null);
            fetchRepoDetails();
            // Trigger a store refresh
            queryClient.invalidateQueries({ queryKey: ["repos"] });
          }}
          onCancel={() => setActiveConflict(null)}
        />
      )}
    </motion.aside>
  );
}
