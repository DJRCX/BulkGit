import { useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Circle,
  GitBranch,
  Info,
  Loader2,
  Lock,
  RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { commands } from "../bindings";
import { type RepoStatus, type SyncStatus, useStore } from "../store/store";
import { formatDistanceToNow } from "../utils/time";
import { CustomTooltip } from "./CustomTooltip";

interface RepoCardProps {
  repo: RepoStatus;
  style?: React.CSSProperties;
}

const STATUS_COLORS: Record<SyncStatus, string> = {
  synced: "var(--status-synced)",
  ahead: "var(--status-ahead)",
  behind: "var(--status-behind)",
  diverged: "var(--status-diverged)",
  updating: "var(--status-updating)",
  auth_required: "var(--status-error)",
  error: "var(--status-error)",
  no_remote: "var(--muted-foreground)",
  unknown: "var(--muted-foreground)",
};

const STATUS_LABELS: Record<SyncStatus, string> = {
  synced: "Synced",
  ahead: "Ahead",
  behind: "Behind",
  diverged: "Diverged",
  updating: "Updating",
  auth_required: "Auth Required",
  error: "Error",
  no_remote: "No Remote",
  unknown: "Scanning…",
};

export function RepoCard({ repo, style }: RepoCardProps) {
  const queryClient = useQueryClient();
  const { selectedPaths, toggleSelection, upsertRepo, setActiveRepoPath, setDetailsPanelOpen } =
    useStore(
      useShallow((s) => ({
        selectedPaths: s.selectedPaths,
        toggleSelection: s.toggleSelection,
        upsertRepo: s.upsertRepo,
        setActiveRepoPath: s.setActiveRepoPath,
        setDetailsPanelOpen: s.setDetailsPanelOpen,
      }))
    );

  const [isOpen, setIsOpen] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleDropdownToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    setIsOpen(true);
    setIsLoadingBranches(true);
    setErrorMessage(null);
    const res = await commands.getRepoBranches(repo.path);
    setIsLoadingBranches(false);
    if (res.status === "ok") {
      setBranches(res.data);
    } else {
      setErrorMessage(res.error);
    }
  };

  const handleSelectBranch = async (e: React.MouseEvent, branchName: string) => {
    e.stopPropagation();
    if (branchName === repo.branch) {
      setIsOpen(false);
      return;
    }
    setIsOpen(false);

    // Set status to updating locally
    upsertRepo({
      ...repo,
      sync_status: "updating",
      error_message: null,
    });

    const res = await commands.checkoutBranch(repo.path, branchName);
    if (res.status === "error") {
      // Revert status and show error message
      upsertRepo({
        ...repo,
        sync_status: "error",
        error_message: res.error,
      });
    } else {
      // Trigger a store refresh
      queryClient.invalidateQueries({ queryKey: ["repos"] });
    }
  };

  const handleDropdownKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      e.stopPropagation();
    }
  };

  const isSelected = selectedPaths.has(repo.path);
  const isUpdating = repo.sync_status === "updating";
  const isError = repo.sync_status === "error" || repo.sync_status === "auth_required";
  const statusColor = STATUS_COLORS[repo.sync_status];

  function handleClick(e: React.MouseEvent) {
    if (e.shiftKey) {
      // Shift-click handled by parent grid via rangeSelect
      return;
    }
    toggleSelection(repo.path);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggleSelection(repo.path);
    }
  }

  function handleRetry() {
    upsertRepo({ ...repo, sync_status: "unknown", error_message: null });
  }

  const hasChanges =
    repo.changes.staged > 0 || repo.changes.unstaged > 0 || repo.changes.untracked > 0;

  // Synthesize a descriptive screen reader label. Omit status statistics when they are zero.
  const labelParts = [];
  labelParts.push(`Repository: ${repo.name}`);
  labelParts.push(`Branch: ${repo.branch || "HEAD"}`);
  labelParts.push(`Status: ${STATUS_LABELS[repo.sync_status]}`);

  if (repo.ahead > 0) {
    labelParts.push(`${repo.ahead} commit${repo.ahead > 1 ? "s" : ""} ahead`);
  }
  if (repo.behind > 0) {
    labelParts.push(`${repo.behind} commit${repo.behind > 1 ? "s" : ""} behind`);
  }

  if (hasChanges) {
    const changeParts = [];
    if (repo.changes.staged > 0) changeParts.push(`${repo.changes.staged} staged`);
    if (repo.changes.unstaged > 0) changeParts.push(`${repo.changes.unstaged} unstaged`);
    if (repo.changes.untracked > 0) changeParts.push(`${repo.changes.untracked} untracked`);
    labelParts.push(`Changes: ${changeParts.join(", ")}`);
  }

  if (repo.last_commit_time) {
    labelParts.push(`Last commit ${formatDistanceToNow(repo.last_commit_time)}`);
    if (repo.last_commit_author) {
      labelParts.push(`by ${repo.last_commit_author}`);
    }
  }

  if (isSelected) {
    labelParts.push("Selected");
  }

  const synthesizedAriaLabel = labelParts.join(". ");

  return (
    <motion.div
      layout
      whileHover={{ backgroundColor: "var(--hover-bg)" }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-selected={isSelected}
      aria-label={synthesizedAriaLabel}
      className={clsx(
        "relative flex items-center gap-3 px-3 cursor-pointer select-none",
        "border-b border-[var(--border)] transition-colors duration-150",
        "focus-visible:outline-none focus-visible:shadow-focus",
        isSelected && "bg-[var(--selected-row-bg)] border-l-2 border-l-blue-500",
        isUpdating && "opacity-70"
      )}
      style={{ height: 40, ...style }}
    >
      {/* Checkbox */}
      <div
        className={clsx(
          "w-3.5 h-3.5 rounded-sm border flex-shrink-0 flex items-center justify-center transition-all duration-150",
          isSelected ? "bg-blue-500 border-blue-500" : "border-[var(--border)] bg-transparent"
        )}
        aria-hidden="true"
      >
        {isSelected && (
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none" role="img" aria-label="Checked">
            <title>Checked</title>
            <path
              d="M1 3L3 5L7 1"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {/* Status dot */}
      <div
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: statusColor }}
        aria-hidden="true"
      />

      {/* Branch Selector Dropdown */}
      <div className="relative flex-shrink-0" ref={dropdownRef} onKeyDown={handleDropdownKeyDown}>
        <CustomTooltip content="Switch branch">
          <button
            type="button"
            onClick={handleDropdownToggle}
            disabled={isUpdating}
            className={clsx(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono transition-colors",
              "border border-[var(--border)] hover:bg-[var(--hover-bg)] focus-visible:shadow-focus",
              isOpen ? "bg-[var(--selected-row-bg)] border-blue-500" : "bg-transparent",
              isUpdating && "opacity-50 cursor-not-allowed"
            )}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
          >
            <GitBranch size={12} style={{ color: statusColor }} className="flex-shrink-0" />
            <span className="truncate max-w-[100px] text-[var(--foreground)]">
              {repo.branch || "HEAD"}
            </span>
            <ChevronDown
              size={11}
              className={clsx(
                "text-xs text-[var(--muted-foreground)] transition-transform",
                isOpen && "transform rotate-180"
              )}
            />
          </button>
        </CustomTooltip>

        {isOpen && (
          <div
            className={clsx(
              "absolute left-0 mt-1 w-48 max-h-48 overflow-y-auto rounded-md shadow-lg border border-[var(--border)] z-50",
              "bg-[var(--card)] py-1 focus:outline-none"
            )}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {isLoadingBranches ? (
              <div className="flex items-center justify-center py-3 gap-2 text-xs text-[var(--muted-foreground)]">
                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                Loading branches...
              </div>
            ) : errorMessage ? (
              <div className="px-3 py-2 text-xs text-[var(--status-error)] max-w-full break-words">
                {errorMessage}
              </div>
            ) : branches.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
                No local branches
              </div>
            ) : (
              branches.map((branchName) => (
                <button
                  key={branchName}
                  type="button"
                  onClick={(e) => handleSelectBranch(e, branchName)}
                  className={clsx(
                    "w-full text-left px-3 py-1.5 text-xs font-mono transition-colors flex items-center justify-between",
                    "hover:bg-[var(--hover-bg)]",
                    branchName === repo.branch
                      ? "text-blue-500 font-semibold"
                      : "text-[var(--foreground)]"
                  )}
                >
                  <span className="truncate">{branchName}</span>
                  {branchName === repo.branch && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Ahead / behind */}
      <div className="flex items-center gap-1.5 flex-shrink-0" aria-hidden="true">
        {repo.ahead > 0 && (
          <CustomTooltip
            content={`${repo.ahead} commit${repo.ahead > 1 ? "s" : ""} ahead of remote`}
          >
            <span className="flex items-center gap-0.5 text-[11px] font-mono text-[var(--status-ahead)]">
              <ArrowUp size={10} />
              {repo.ahead} ahead
            </span>
          </CustomTooltip>
        )}
        {repo.behind > 0 && (
          <CustomTooltip
            content={`${repo.behind} commit${repo.behind > 1 ? "s" : ""} behind remote`}
          >
            <span className="flex items-center gap-0.5 text-[11px] font-mono text-[var(--status-behind)]">
              <ArrowDown size={10} />
              {repo.behind} behind
            </span>
          </CustomTooltip>
        )}
      </div>

      {/* File changes */}
      {hasChanges && (
        <div className="flex items-center gap-1.5 flex-shrink-0" aria-hidden="true">
          {repo.changes.staged > 0 && (
            <CustomTooltip
              content={`${repo.changes.staged} staged file${repo.changes.staged > 1 ? "s" : ""}`}
            >
              <span className="flex items-center gap-0.5 text-[11px] font-mono text-[var(--status-synced)]">
                <Circle size={6} fill="var(--status-synced)" />
                {repo.changes.staged} staged
              </span>
            </CustomTooltip>
          )}
          {repo.changes.unstaged > 0 && (
            <CustomTooltip
              content={`${repo.changes.unstaged} unstaged file${repo.changes.unstaged > 1 ? "s" : ""}`}
            >
              <span className="flex items-center gap-0.5 text-[11px] font-mono text-[var(--status-ahead)]">
                <Circle size={6} fill="var(--status-ahead)" />
                {repo.changes.unstaged} unstaged
              </span>
            </CustomTooltip>
          )}
          {repo.changes.untracked > 0 && (
            <CustomTooltip
              content={`${repo.changes.untracked} untracked file${repo.changes.untracked > 1 ? "s" : ""}`}
            >
              <span className="flex items-center gap-0.5 text-[11px] font-mono text-[#6b7280]">
                <Circle size={6} fill="#6b7280" />
                {repo.changes.untracked} untracked
              </span>
            </CustomTooltip>
          )}
        </div>
      )}

      {/* Repo name — primary identifier */}
      <span
        className="font-medium text-[13px] text-[var(--foreground)] truncate flex-1 min-w-0"
        aria-hidden="true"
      >
        {repo.name}
      </span>

      {/* Right side: last commit */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-auto" aria-hidden="true">
        {repo.last_commit_author && (
          <span className="text-[11px] text-[var(--muted-foreground)] truncate max-w-[80px] hidden md:block">
            {repo.last_commit_author}
          </span>
        )}
        {repo.last_commit_time && (
          <span className="text-[11px] text-[var(--muted-foreground)] flex-shrink-0 hidden sm:block">
            {formatDistanceToNow(repo.last_commit_time)}
          </span>
        )}
        {isError && (
          <CustomTooltip
            content={
              repo.sync_status === "auth_required"
                ? "Auth required — click to retry"
                : (repo.error_message ?? "Error")
            }
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRetry();
              }}
              className="p-0.5 rounded text-[var(--status-error)] hover:text-[var(--foreground)] transition-colors"
              aria-label="Retry"
            >
              {repo.sync_status === "auth_required" ? (
                <Lock size={12} />
              ) : (
                <AlertCircle size={12} />
              )}
            </button>
          </CustomTooltip>
        )}
        {isUpdating && (
          <RefreshCw size={11} className="animate-spin text-[var(--status-updating)]" />
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActiveRepoPath(repo.path);
            setDetailsPanelOpen(true);
          }}
          className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--hover-bg)] transition-colors ml-1"
          title="Inspect repository changes"
          aria-label={`Inspect repository ${repo.name}`}
        >
          <Info size={13} />
        </button>
      </div>

      {/* Updating progress bar overlay */}
      {isUpdating && (
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--status-updating)] opacity-60"
          style={{
            background: "linear-gradient(90deg, transparent, var(--status-updating), transparent)",
            animation: "shimmer 1.5s infinite linear",
            backgroundSize: "200% 100%",
          }}
          aria-hidden="true"
        />
      )}
    </motion.div>
  );
}
