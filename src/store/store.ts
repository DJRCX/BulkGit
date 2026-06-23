import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

// ── Types mirroring Rust structs ───────────────────────────────────
export type SyncStatus =
  | "synced"
  | "ahead"
  | "behind"
  | "diverged"
  | "updating"
  | "auth_required"
  | "error"
  | "no_remote"
  | "unknown";

export type OperationPhase =
  | "queued"
  | "fetching"
  | "pulling"
  | "success"
  | "failed"
  | "auth_required";

export interface FileChanges {
  staged: number;
  unstaged: number;
  untracked: number;
}

export interface RepoStatus {
  path: string;
  name: string;
  branch: string;
  tracking_branch: string | null;
  ahead: number;
  behind: number;
  changes: FileChanges;
  last_commit_hash: string | null;
  last_commit_message: string | null;
  last_commit_author: string | null;
  last_commit_time: string | null;
  sync_status: SyncStatus;
  error_message: string | null;
}

export interface QueueItem {
  path: string;
  name: string;
  phase: OperationPhase;
  message: string | null;
}

export interface WorkspaceGroup {
  id: string;
  name: string;
  paths: string[];
}

const VALID_THEMES = new Set<AppState["theme"]>([
  "amoled dark",
  "tokyo night",
  "tokyo night light",
]);
const VALID_SYNC_FILTERS = new Set<SyncStatus | "all">([
  "all",
  "synced",
  "ahead",
  "behind",
  "diverged",
  "updating",
  "auth_required",
  "error",
  "no_remote",
  "unknown",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTheme(value: unknown): value is AppState["theme"] {
  return typeof value === "string" && VALID_THEMES.has(value as AppState["theme"]);
}

function isSyncFilter(value: unknown): value is SyncStatus | "all" {
  return typeof value === "string" && VALID_SYNC_FILTERS.has(value as SyncStatus | "all");
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function workspaceGroups(value: unknown): WorkspaceGroup[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") {
      return [];
    }

    return [
      {
        id: item.id,
        name: item.name,
        paths: stringArray(item.paths),
      },
    ];
  });
}

function mergePersistedState(persistedState: unknown, currentState: AppState): AppState {
  const persisted = isRecord(persistedState) ? persistedState : {};
  const concurrency =
    typeof persisted.concurrency === "number" && Number.isFinite(persisted.concurrency)
      ? Math.min(Math.max(Math.round(persisted.concurrency), 1), 20)
      : currentState.concurrency;
  const theme = isTheme(persisted.theme) ? persisted.theme : currentState.theme;
  const filterStatus = isSyncFilter(persisted.filterStatus)
    ? persisted.filterStatus
    : currentState.filterStatus;

  return {
    ...currentState,
    scanPaths: stringArray(persisted.scanPaths),
    concurrency,
    theme,
    filterStatus,
    groups: workspaceGroups(persisted.groups),
    sidebarOpen:
      typeof persisted.sidebarOpen === "boolean" ? persisted.sidebarOpen : currentState.sidebarOpen,
    pollingEnabled:
      typeof persisted.pollingEnabled === "boolean"
        ? persisted.pollingEnabled
        : currentState.pollingEnabled,
    skipStartupCheck:
      typeof persisted.skipStartupCheck === "boolean"
        ? persisted.skipStartupCheck
        : currentState.skipStartupCheck,
    selectedPaths: new Set(),
    queue: [],
    repos: [],
    activeGroupId: typeof persisted.activeGroupId === "string" ? persisted.activeGroupId : null,
  };
}

// ── Store shape ────────────────────────────────────────────────────
interface AppState {
  // Repos
  repos: RepoStatus[];
  setRepos: (repos: RepoStatus[]) => void;
  upsertRepo: (repo: RepoStatus) => void;

  // Scan paths
  scanPaths: string[];
  setScanPaths: (paths: string[]) => void;
  addScanPath: (path: string) => void;
  removeScanPath: (path: string) => void;

  // Selection
  selectedPaths: Set<string>;
  toggleSelection: (path: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  rangeSelect: (fromPath: string, toPath: string) => void;

  // Filter / search
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterStatus: SyncStatus | "all";
  setFilterStatus: (s: SyncStatus | "all") => void;

  // Queue
  queue: QueueItem[];
  upsertQueueItem: (item: QueueItem) => void;
  clearQueue: () => void;

  // Concurrency slider
  concurrency: number;
  setConcurrency: (n: number) => void;

  // UI state
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  queueOpen: boolean;
  toggleQueue: () => void;
  theme: "amoled dark" | "tokyo night" | "tokyo night light";
  toggleTheme: () => void;
  setTheme: (t: "amoled dark" | "tokyo night" | "tokyo night light") => void;

  // Workspace groups
  groups: WorkspaceGroup[];
  addGroup: (name: string) => void;
  removeGroup: (id: string) => void;
  addPathToGroup: (groupId: string, path: string) => void;
  activeGroupId: string | null;
  setActiveGroup: (id: string | null) => void;

  // Polling
  pollingEnabled: boolean;
  togglePolling: () => void;

  // New features UI state
  activeRepoPath: string | null;
  setActiveRepoPath: (path: string | null) => void;
  detailsPanelOpen: boolean;
  setDetailsPanelOpen: (open: boolean) => void;
  gitAvailable: boolean | null;
  setGitAvailable: (avail: boolean | null) => void;
  sshAvailable: boolean | null;
  setSshAvailable: (avail: boolean | null) => void;
  skipStartupCheck: boolean;
  setSkipStartupCheck: (skip: boolean) => void;
}

// ── Derived helpers ────────────────────────────────────────────────
function filterRepos(
  repos: RepoStatus[],
  query: string,
  status: SyncStatus | "all",
  activeGroupId: string | null,
  groups: WorkspaceGroup[]
): RepoStatus[] {
  let filtered = repos;

  if (activeGroupId) {
    const group = groups.find((g) => g.id === activeGroupId);
    if (group) {
      filtered = filtered.filter((r) => group.paths.includes(r.path));
    }
  }

  if (status !== "all") {
    if (status === "error") {
      filtered = filtered.filter(
        (r) => r.sync_status === "error" || r.sync_status === "auth_required"
      );
    } else {
      filtered = filtered.filter((r) => r.sync_status === status);
    }
  }

  if (query.trim()) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.path.toLowerCase().includes(q) ||
        r.branch.toLowerCase().includes(q)
    );
  }

  return filtered;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Repos
      repos: [],
      setRepos: (repos) => set({ repos }),
      upsertRepo: (repo) =>
        set((s) => {
          const idx = s.repos.findIndex((r) => r.path === repo.path);
          if (idx === -1) return { repos: [...s.repos, repo] };
          const next = [...s.repos];
          next[idx] = repo;
          return { repos: next };
        }),

      // Scan paths
      scanPaths: [],
      setScanPaths: (paths) => set({ scanPaths: paths }),
      addScanPath: (path) =>
        set((s) => (s.scanPaths.includes(path) ? s : { scanPaths: [...s.scanPaths, path] })),
      removeScanPath: (path) => set((s) => ({ scanPaths: s.scanPaths.filter((p) => p !== path) })),

      // Selection
      selectedPaths: new Set(),
      toggleSelection: (path) =>
        set((s) => {
          const next = new Set(s.selectedPaths);
          if (next.has(path)) next.delete(path);
          else next.add(path);
          return { selectedPaths: next };
        }),
      selectAll: () =>
        set((s) => {
          const visible = filterRepos(
            s.repos,
            s.searchQuery,
            s.filterStatus,
            s.activeGroupId,
            s.groups
          );
          return { selectedPaths: new Set(visible.map((r) => r.path)) };
        }),
      clearSelection: () => set({ selectedPaths: new Set() }),
      rangeSelect: (fromPath, toPath) =>
        set((s) => {
          const visible = filterRepos(
            s.repos,
            s.searchQuery,
            s.filterStatus,
            s.activeGroupId,
            s.groups
          );
          const fromIdx = visible.findIndex((r) => r.path === fromPath);
          const toIdx = visible.findIndex((r) => r.path === toPath);
          if (fromIdx === -1 || toIdx === -1) return s;
          const [start, end] = [Math.min(fromIdx, toIdx), Math.max(fromIdx, toIdx)];
          const next = new Set(s.selectedPaths);
          for (let i = start; i <= end; i++) {
            next.add(visible[i]?.path);
          }
          return { selectedPaths: next };
        }),

      // Filter
      searchQuery: "",
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      filterStatus: "all",
      setFilterStatus: (filterStatus) => set({ filterStatus }),

      // Queue
      queue: [],
      upsertQueueItem: (item) =>
        set((s) => {
          const idx = s.queue.findIndex((q) => q.path === item.path);
          if (idx === -1) return { queue: [...s.queue, item] };
          const next = [...s.queue];
          next[idx] = item;
          return { queue: next };
        }),
      clearQueue: () => set({ queue: [] }),

      // Concurrency
      concurrency: 4,
      setConcurrency: (concurrency) => set({ concurrency }),

      // UI
      sidebarOpen: true,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      queueOpen: false,
      toggleQueue: () => set((s) => ({ queueOpen: !s.queueOpen })),
      theme: "amoled dark",
      toggleTheme: () =>
        set((s) => {
          let next: AppState["theme"];
          if (s.theme === "amoled dark") {
            next = "tokyo night";
          } else if (s.theme === "tokyo night") {
            next = "tokyo night light";
          } else {
            next = "amoled dark";
          }
          document.documentElement.setAttribute("data-theme", next);
          return { theme: next };
        }),
      setTheme: (theme) =>
        set(() => {
          document.documentElement.setAttribute("data-theme", theme);
          return { theme };
        }),

      // Groups
      groups: [],
      addGroup: (name) =>
        set((s) => ({
          groups: [...s.groups, { id: crypto.randomUUID(), name, paths: [] }],
        })),
      removeGroup: (id) => set((s) => ({ groups: s.groups.filter((g) => g.id !== id) })),
      addPathToGroup: (groupId, path) =>
        set((s) => ({
          groups: s.groups.map((g) =>
            g.id === groupId && !g.paths.includes(path) ? { ...g, paths: [...g.paths, path] } : g
          ),
        })),
      activeGroupId: null,
      setActiveGroup: (activeGroupId) => set({ activeGroupId }),

      // Polling
      pollingEnabled: true,
      togglePolling: () => set((s) => ({ pollingEnabled: !s.pollingEnabled })),

      // New features UI state
      activeRepoPath: null,
      setActiveRepoPath: (activeRepoPath) => set({ activeRepoPath }),
      detailsPanelOpen: false,
      setDetailsPanelOpen: (detailsPanelOpen) =>
        set(
          detailsPanelOpen
            ? { detailsPanelOpen, sidebarOpen: false, queueOpen: false }
            : { detailsPanelOpen }
        ),
      gitAvailable: null,
      setGitAvailable: (gitAvailable) => set({ gitAvailable }),
      sshAvailable: null,
      setSshAvailable: (sshAvailable) => set({ sshAvailable }),
      skipStartupCheck: false,
      setSkipStartupCheck: (skipStartupCheck) => set({ skipStartupCheck }),
    }),
    {
      name: "bulkgit",
      version: 1,
      merge: mergePersistedState,
      partialize: (s) => ({
        scanPaths: s.scanPaths,
        concurrency: s.concurrency,
        theme: s.theme,
        groups: s.groups,
        sidebarOpen: s.sidebarOpen,
        pollingEnabled: s.pollingEnabled,
        filterStatus: s.filterStatus,
        activeGroupId: s.activeGroupId,
        skipStartupCheck: s.skipStartupCheck,
      }),
    }
  )
);

// ── Selector: filtered repos for display ───────────────────────────
export function useFilteredRepos() {
  return useStore(
    useShallow((s) =>
      filterRepos(s.repos, s.searchQuery, s.filterStatus, s.activeGroupId, s.groups)
    )
  );
}
