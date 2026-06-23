import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { CommandBar } from "./components/CommandBar";
import { QueuePanel } from "./components/QueuePanel";
import { RepoCard } from "./components/RepoCard";
import { RepoDetailsPanel } from "./components/RepoDetailsPanel";
import { Sidebar } from "./components/Sidebar";
import { SkeletonCard } from "./components/SkeletonCard";
import { SystemCheck } from "./components/SystemCheck";
import { useKeyboard } from "./hooks/useKeyboard";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useTauriEvents } from "./hooks/useTauriEvents";
import { useVirtual } from "./hooks/useVirtual";
import { type RepoStatus, useFilteredRepos, useStore } from "./store/store";

export default function App() {
  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const breakpoint = useMediaQuery();

  const {
    setRepos,
    scanPaths,
    pollingEnabled,
    theme,
    rangeSelect,
    gitAvailable,
    detailsPanelOpen,
    skipStartupCheck,
    setSkipStartupCheck,
  } = useStore(
    useShallow((s) => ({
      setRepos: s.setRepos,
      scanPaths: s.scanPaths,
      pollingEnabled: s.pollingEnabled,
      theme: s.theme,
      rangeSelect: s.rangeSelect,
      gitAvailable: s.gitAvailable,
      detailsPanelOpen: s.detailsPanelOpen,
      skipStartupCheck: s.skipStartupCheck,
      setSkipStartupCheck: s.setSkipStartupCheck,
    }))
  );

  // Whether the startup check dialog should be shown this session
  const [showStartupCheck, setShowStartupCheck] = useState(!skipStartupCheck);
  // Warning banner: user skipped check but deps are missing
  const [showDepWarning, setShowDepWarning] = useState(false);

  function handleStartupCheckClose(skipInFuture: boolean) {
    setSkipStartupCheck(skipInFuture);
    setShowStartupCheck(false);
    // Show warning banner if git is not available after closing
    if (gitAvailable === false) setShowDepWarning(true);
  }

  // Sync theme on mount
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const { sidebarOpen, toggleSidebar } = useStore(
    useShallow((s) => ({
      sidebarOpen: s.sidebarOpen,
      toggleSidebar: s.toggleSidebar,
    }))
  );

  // ── Data fetching ─────────────────────────────────────────────────
  const { isFetching, refetch } = useQuery<RepoStatus[]>({
    queryKey: ["repos", scanPaths],
    queryFn: async () => {
      if (scanPaths.length === 0) return [];
      // 1. Discover repo paths
      const paths = await invoke<string[]>("scan_repositories", {
        config: {
          root_paths: scanPaths,
          max_depth: 8,
          exclude_patterns: ["node_modules", ".cargo", "target"],
        },
      });
      // 2. Bulk fetch status
      const statuses = await invoke<RepoStatus[]>("get_repos_status", {
        paths,
      });
      setRepos(statuses);
      return statuses;
    },
    refetchInterval: pollingEnabled ? 30_000 : false,
    enabled: scanPaths.length > 0,
  });

  // Tauri event listener for queue progress
  useTauriEvents();

  // Keyboard shortcuts
  useKeyboard(useCallback(() => searchRef.current?.focus(), []));

  const filteredRepos = useFilteredRepos();

  const { startIndex, endIndex, offset, totalHeight } = useVirtual({
    containerRef,
    totalCount: filteredRepos.length,
    rowHeight: 40,
    buffer: 5,
  });

  const visibleRepos = filteredRepos.slice(startIndex, endIndex);

  // ── Shift-click range selection ──────────────────────────────────
  const lastClickedRef = useRef<string | null>(null);

  function handleGridClick(e: React.MouseEvent, path: string) {
    if (e.shiftKey && lastClickedRef.current) {
      rangeSelect(lastClickedRef.current, path);
    } else {
      lastClickedRef.current = path;
    }
  }

  const isLoading = isFetching && filteredRepos.length === 0;

  // ── Empty state ──────────────────────────────────────────────────
  const isEmpty = !isFetching && scanPaths.length === 0;
  const noResults = !isLoading && scanPaths.length > 0 && filteredRepos.length === 0;

  return (
    <div className="flex h-full overflow-hidden" style={{ background: "var(--background)" }}>
      {/* Static Sidebar for larger viewports */}
      {breakpoint !== "compact" && <Sidebar />}

      {/* Drawer Sidebar for compact/small viewports */}
      <AnimatePresence>
        {breakpoint === "compact" && sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={toggleSidebar}
              className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm"
              aria-hidden="true"
            />
            {/* Sliding Drawer Container */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="fixed inset-y-0 left-0 z-30 flex shadow-2xl"
              style={{ background: "var(--card)" }}
            >
              <Sidebar />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Command bar */}
        <CommandBar
          searchRef={searchRef}
          onFocusSearch={() => searchRef.current?.focus()}
          onRefresh={() => refetch()}
          isRefreshing={isFetching}
          breakpoint={breakpoint}
        />

        {/* Repo grid */}
        <main ref={containerRef} className="flex-1 overflow-y-auto" aria-busy={isLoading}>
          {/* Polling indicator */}
          {isFetching && filteredRepos.length > 0 && (
            <div
              className="h-0.5 w-full animate-pulse"
              style={{
                background: "linear-gradient(90deg, transparent, #3b82f6, transparent)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.5s infinite linear",
              }}
              aria-hidden="true"
            />
          )}

          {/* Loading skeletons */}
          {isLoading && (
            // biome-ignore lint/a11y/useSemanticElements: status role is standard for loading state
            <div role="status" aria-live="polite" aria-label="Loading repositories">
              {Array.from({ length: 12 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeletons are static placeholders
                <SkeletonCard key={`skeleton-${i}`} />
              ))}
            </div>
          )}

          {/* Empty — no scan paths */}
          {isEmpty && (
            // biome-ignore lint/a11y/useSemanticElements: status role is appropriate here
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col items-center justify-center h-full gap-4 p-8"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "var(--muted)" }}
                aria-hidden="true"
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--muted-foreground)"
                  strokeWidth="1.5"
                  role="img"
                  aria-label="No scan paths"
                >
                  <title>No scan paths</title>
                  <path d="M3 7h18M3 12h18M3 17h18" strokeLinecap="round" />
                </svg>
              </div>
              <div className="text-center">
                <h1 className="text-[15px] font-semibold text-[var(--foreground)] mb-1">
                  No scan paths configured
                </h1>
                <p className="text-[13px] text-[var(--muted-foreground)] max-w-xs">
                  Click <strong>Scan</strong> in the toolbar to add a root directory. All Git repos
                  inside will be discovered automatically.
                </p>
              </div>
            </div>
          )}

          {/* No results from filter */}
          {noResults && (
            // biome-ignore lint/a11y/useSemanticElements: status role is appropriate here
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col items-center justify-center h-full gap-3"
            >
              <p className="text-[13px] text-[var(--muted-foreground)]">
                No repositories match your filter.
              </p>
            </div>
          )}

          {/* Repo list */}
          {!isLoading && (
            <ul
              aria-label="Repository list"
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                height: totalHeight,
                position: "relative",
              }}
            >
              <div style={{ transform: `translateY(${offset}px)` }}>
                <LayoutGroup>
                  <AnimatePresence initial={false}>
                    {visibleRepos.map((repo, idx) => {
                      const absoluteIdx = startIndex + idx;
                      return (
                        <motion.li
                          key={repo.path}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{
                            delay: Math.min(absoluteIdx * 0.02, 0.3),
                            duration: 0.15,
                          }}
                          onClick={(e) => handleGridClick(e, repo.path)}
                        >
                          <RepoCard repo={repo} />
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </LayoutGroup>
              </div>
            </ul>
          )}
        </main>
      </div>

      {/* Queue panel */}
      <QueuePanel />

      {/* Slide-over Repo Details Panel */}
      <AnimatePresence>{detailsPanelOpen && <RepoDetailsPanel />}</AnimatePresence>

      {/* Dep warning banner */}
      {showDepWarning && (
        <div
          className="fixed top-0 left-0 right-0 z-40 flex items-center gap-2 px-4 py-2 bg-amber-900/80 backdrop-blur-sm border-b border-amber-700/50 text-[11px] text-amber-200"
          role="alert"
        >
          <AlertTriangle size={13} className="flex-shrink-0 text-amber-400" aria-hidden="true" />
          <span className="flex-1">
            <strong>Git CLI not found.</strong> Some BulkGit features may not work correctly.{" "}
            <a
              href="https://git-scm.com/downloads"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-white"
            >
              Install Git
            </a>
          </span>
          <button
            type="button"
            onClick={() => setShowDepWarning(false)}
            className="p-0.5 rounded hover:bg-amber-700/50 transition-colors"
            aria-label="Dismiss"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Startup System Check Dialog */}
      {showStartupCheck && <SystemCheck onClose={handleStartupCheckClose} />}
    </div>
  );
}
