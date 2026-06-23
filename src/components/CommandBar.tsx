import { useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  ArrowDownToLine,
  ChevronDown,
  Download,
  FolderOpen,
  GitBranch,
  GitCommit,
  Menu,
  Moon,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Upload,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { commands } from "../bindings";
import type { Breakpoint } from "../hooks/useMediaQuery";
import { useStore } from "../store/store";

interface CommandBarProps {
  onFocusSearch: (el: HTMLInputElement | null) => void;
  searchRef: React.RefObject<HTMLInputElement>;
  onRefresh: () => void;
  isRefreshing: boolean;
  breakpoint: Breakpoint;
}

export function CommandBar({ searchRef, onRefresh, isRefreshing, breakpoint }: CommandBarProps) {
  const queryClient = useQueryClient();
  const {
    searchQuery,
    setSearchQuery,
    selectedPaths,
    clearSelection,
    theme,
    setTheme,
    concurrency,
    toggleQueue,
    upsertQueueItem,
    addScanPath,
    pollingEnabled,
    togglePolling,
    sidebarOpen,
    toggleSidebar,
  } = useStore(
    useShallow((s) => ({
      searchQuery: s.searchQuery,
      setSearchQuery: s.setSearchQuery,
      selectedPaths: s.selectedPaths,
      clearSelection: s.clearSelection,
      theme: s.theme,
      setTheme: s.setTheme,
      concurrency: s.concurrency,
      toggleQueue: s.toggleQueue,
      upsertQueueItem: s.upsertQueueItem,
      addScanPath: s.addScanPath,
      pollingEnabled: s.pollingEnabled,
      togglePolling: s.togglePolling,
      sidebarOpen: s.sidebarOpen,
      toggleSidebar: s.toggleSidebar,
    }))
  );

  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // Close theme menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setThemeMenuOpen(false);
      }
    }
    if (themeMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [themeMenuOpen]);

  function handleThemeKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setThemeMenuOpen(false);
    }
  }

  const themesList: { value: typeof theme; label: string; icon: typeof Moon }[] = [
    { value: "amoled dark", label: "AMOLED Dark", icon: Moon },
    { value: "tokyo night", label: "Tokyo Night", icon: Sparkles },
    { value: "tokyo night light", label: "Tokyo Night Light", icon: Sun },
  ];

  const [bulkCommitMsg, setBulkCommitMsg] = useState("");
  const [isBulkOperating, setIsBulkOperating] = useState(false);

  async function handleBulkStash() {
    if (selCount === 0) return;
    setIsBulkOperating(true);
    const paths = Array.from(selectedPaths);
    const promises = paths.map(async (path) => {
      const res = await commands.stashRepo(path);
      if (res.status === "error") {
        console.error(`Failed to stash ${path}: ${res.error}`);
      }
    });
    await Promise.all(promises);
    setIsBulkOperating(false);
    clearSelection();
    queryClient.invalidateQueries({ queryKey: ["repos"] });
  }

  async function handleBulkBranchSwitch() {
    if (selCount === 0) return;
    const branchName = window.prompt(
      "Enter branch name to checkout across all selected repositories:"
    );
    if (!branchName?.trim()) return;
    setIsBulkOperating(true);
    const paths = Array.from(selectedPaths);
    const promises = paths.map(async (path) => {
      const res = await commands.checkoutBranch(path, branchName.trim());
      if (res.status === "error") {
        console.error(`Failed to checkout branch in ${path}: ${res.error}`);
      }
    });
    await Promise.all(promises);
    setIsBulkOperating(false);
    clearSelection();
    queryClient.invalidateQueries({ queryKey: ["repos"] });
  }

  async function handleBulkCommitPush() {
    if (selCount === 0 || !bulkCommitMsg.trim()) return;
    setIsBulkOperating(true);
    const paths = Array.from(selectedPaths);
    const promises = paths.map(async (path) => {
      const res = await commands.commitAndPush(path, bulkCommitMsg.trim());
      if (res.status === "error") {
        console.error(`Failed to commit & push in ${path}: ${res.error}`);
      }
    });
    await Promise.all(promises);
    setBulkCommitMsg("");
    setIsBulkOperating(false);
    clearSelection();
    queryClient.invalidateQueries({ queryKey: ["repos"] });
  }

  const selCount = selectedPaths.size;

  async function handleFetchSelected() {
    if (selCount === 0) return;
    toggleQueue();
    const paths = Array.from(selectedPaths);
    for (const p of paths) {
      upsertQueueItem({
        path: p,
        name: p.split(/[\\/]/).pop() ?? p,
        phase: "queued",
        message: null,
      });
    }
    await invoke("fetch_repos", { paths, concurrency });
  }

  async function handlePullSelected() {
    if (selCount === 0) return;
    toggleQueue();
    const paths = Array.from(selectedPaths);
    for (const p of paths) {
      upsertQueueItem({
        path: p,
        name: p.split(/[\\/]/).pop() ?? p,
        phase: "queued",
        message: null,
      });
    }
    await invoke("pull_repos", { paths, concurrency });
  }

  async function handleAddPath() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select directory to scan",
    });
    if (selected) addScanPath(selected);
  }

  return (
    <header
      className="sticky top-0 z-10 flex items-center gap-2 px-3 border-b border-[var(--border)]"
      style={{
        height: 48,
        background: "var(--header-bg)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      aria-label="Command bar"
    >
      {/* Mobile Hamburger Menu Button */}
      {breakpoint === "compact" && (
        <button
          id="mobile-sidebar-toggle"
          type="button"
          onClick={toggleSidebar}
          className="p-1.5 -ml-1 rounded hover:bg-[var(--hover-bg)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex-shrink-0"
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          <Menu size={16} aria-hidden="true" />
        </button>
      )}
      {/* Left: scan path button + search */}
      <button
        id="add-scan-path-btn"
        type="button"
        onClick={handleAddPath}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--hover-bg)] transition-colors flex-shrink-0"
        title="Add scan path (root directory)"
      >
        <FolderOpen size={14} aria-hidden="true" />
        <span className="hidden sm:inline">Scan</span>
      </button>

      <div className="relative flex-1 max-w-xs">
        <Search
          size={13}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none"
          aria-hidden="true"
        />
        <input
          ref={searchRef}
          id="repo-search"
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search repos… (Ctrl+F)"
          className={clsx(
            "w-full h-7 pl-7 pr-3 rounded-md text-[13px]",
            "bg-[var(--muted)] border border-[var(--border)] text-[var(--foreground)]",
            "placeholder:text-[var(--muted-foreground)]",
            "focus:outline-none focus:border-blue-500 transition-colors"
          )}
          aria-label="Search repositories"
        />
      </div>

      {/* Centre: contextual bulk actions */}
      <AnimatePresence>
        {selCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="flex items-center gap-1.5"
          >
            <span className="text-[11px] text-[var(--muted-foreground)] px-1">
              {selCount} selected
            </span>
            <button
              id="fetch-selected-btn"
              type="button"
              onClick={handleFetchSelected}
              disabled={isBulkOperating}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] bg-[var(--muted)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--foreground)] transition-colors disabled:opacity-50"
              title="Fetch selected repos"
            >
              <ArrowDownToLine size={13} aria-hidden="true" />
              Fetch
            </button>
            <button
              id="pull-selected-btn"
              type="button"
              onClick={handlePullSelected}
              disabled={isBulkOperating}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] bg-[var(--muted)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--foreground)] transition-colors disabled:opacity-50"
              title="Pull selected repos"
            >
              <Download size={13} aria-hidden="true" />
              Pull
            </button>
            <button
              id="stash-selected-btn"
              type="button"
              onClick={handleBulkStash}
              disabled={isBulkOperating}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] bg-[var(--muted)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--foreground)] transition-colors disabled:opacity-50"
              title="Stash changes in selected repos"
            >
              <Archive size={13} aria-hidden="true" />
              Stash
            </button>
            <button
              id="branch-switch-selected-btn"
              type="button"
              onClick={handleBulkBranchSwitch}
              disabled={isBulkOperating}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] bg-[var(--muted)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--foreground)] transition-colors disabled:opacity-50"
              title="Switch branch in selected repos"
            >
              <GitBranch size={13} aria-hidden="true" />
              Branch
            </button>

            {/* Bulk Commit & Push Input */}
            <div className="flex items-center gap-1 border border-[var(--border)] bg-[var(--muted)] rounded-md pl-2 pr-1 h-7">
              <GitCommit size={13} className="text-[var(--muted-foreground)]" />
              <input
                type="text"
                placeholder="Bulk commit & push..."
                value={bulkCommitMsg}
                onChange={(e) => setBulkCommitMsg(e.target.value)}
                disabled={isBulkOperating}
                className="w-32 bg-transparent text-[11px] outline-none text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] h-full"
              />
              <button
                type="button"
                onClick={handleBulkCommitPush}
                disabled={isBulkOperating || !bulkCommitMsg.trim()}
                className="p-1 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 transition-colors"
                title="Commit and push changes for all selected repos"
              >
                <Upload size={11} />
              </button>
            </div>

            <button
              id="clear-selection-btn"
              type="button"
              onClick={clearSelection}
              className="p-1 rounded hover:bg-[var(--hover-bg)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              title="Clear selection (Esc)"
            >
              <XCircle size={14} aria-hidden="true" />
              <span className="sr-only">Clear selection</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right: refresh, queue, theme */}
      <div className="flex items-center gap-1 ml-auto">
        <button
          id="refresh-btn"
          type="button"
          onClick={onRefresh}
          className={clsx(
            "p-1.5 rounded hover:bg-[var(--hover-bg)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors",
            isRefreshing && "text-blue-400"
          )}
          title={pollingEnabled ? "Auto-refresh on (30s)" : "Auto-refresh off"}
          aria-label="Refresh status"
        >
          <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} aria-hidden="true" />
        </button>

        <button
          id="toggle-polling-btn"
          type="button"
          onClick={togglePolling}
          className={clsx(
            "px-2 py-0.5 rounded text-[11px] font-mono transition-colors",
            pollingEnabled
              ? "bg-green-900/40 text-green-400 hover:bg-green-900/60"
              : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--hover-bg)]"
          )}
          title="Toggle 30s auto-poll"
        >
          {pollingEnabled ? "LIVE" : "OFF"}
        </button>

        <button
          id="queue-toggle-btn"
          type="button"
          onClick={toggleQueue}
          className="p-1.5 rounded hover:bg-[var(--hover-bg)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          title="Toggle queue panel (Ctrl+J)"
          aria-label="Toggle operation queue"
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
        </button>

        <div ref={themeMenuRef} className="relative">
          <button
            id="theme-dropdown-btn"
            type="button"
            onClick={() => setThemeMenuOpen(!themeMenuOpen)}
            onKeyDown={handleThemeKeyDown}
            className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-[var(--hover-bg)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex-shrink-0"
            title="Select theme"
            aria-expanded={themeMenuOpen}
            aria-haspopup="true"
            aria-label={`Select theme (Current theme: ${theme})`}
          >
            {theme === "amoled dark" && <Moon size={14} aria-hidden="true" />}
            {theme === "tokyo night" && (
              <Sparkles size={14} className="text-blue-400" aria-hidden="true" />
            )}
            {theme === "tokyo night light" && (
              <Sun size={14} className="text-amber-500" aria-hidden="true" />
            )}
            <ChevronDown size={10} className="text-[var(--muted-foreground)]" aria-hidden="true" />
          </button>

          <AnimatePresence>
            {themeMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.1 }}
                className="absolute right-0 mt-1.5 w-44 rounded-md border border-[var(--border)] shadow-lg overflow-hidden py-1 z-30"
                style={{ background: "var(--card)" }}
                role="menu"
                aria-label="Theme options"
              >
                {themesList.map((t) => {
                  const IconComp = t.icon;
                  const isActive = theme === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      role="menuitem"
                      aria-current={isActive ? "true" : undefined}
                      onClick={() => {
                        setTheme(t.value);
                        setThemeMenuOpen(false);
                      }}
                      className={clsx(
                        "w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left transition-colors",
                        isActive
                          ? "bg-[var(--muted)] text-[var(--foreground)] font-medium"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)]"
                      )}
                    >
                      <IconComp
                        size={12}
                        className={clsx(isActive ? "text-blue-400" : "text-current")}
                        aria-hidden="true"
                      />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
