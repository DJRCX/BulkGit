import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  GitBranch,
  PanelLeft,
  PanelLeftClose,
  Plus,
  ShieldCheck,
  Star,
  Tag,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { type SyncStatus, useStore } from "../store/store";
import { SystemCheck } from "./SystemCheck";

const STATUS_FILTERS: { label: string; value: SyncStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Synced", value: "synced" },
  { label: "Ahead", value: "ahead" },
  { label: "Behind", value: "behind" },
  { label: "Diverged", value: "diverged" },
  { label: "Error", value: "error" },
];

const STATUS_DOT: Record<SyncStatus | "all", string> = {
  all: "var(--muted-foreground)",
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

export function Sidebar() {
  const {
    sidebarOpen,
    toggleSidebar,
    filterStatus,
    setFilterStatus,
    repos,
    groups,
    addGroup,
    removeGroup,
    activeGroupId,
    setActiveGroup,
    scanPaths,
    removeScanPath,
    setSkipStartupCheck,
  } = useStore(
    useShallow((s) => ({
      sidebarOpen: s.sidebarOpen,
      toggleSidebar: s.toggleSidebar,
      filterStatus: s.filterStatus,
      setFilterStatus: s.setFilterStatus,
      repos: s.repos,
      groups: s.groups,
      addGroup: s.addGroup,
      removeGroup: s.removeGroup,
      activeGroupId: s.activeGroupId,
      setActiveGroup: s.setActiveGroup,
      scanPaths: s.scanPaths,
      removeScanPath: s.removeScanPath,
      setSkipStartupCheck: s.setSkipStartupCheck,
    }))
  );

  const [recheckOpen, setRecheckOpen] = useState(false);

  const [statusOpen, setStatusOpen] = useState(true);
  const [groupsOpen, setGroupsOpen] = useState(true);
  const [pathsOpen, setPathsOpen] = useState(false);

  // Counts per status
  const counts = repos.reduce<Record<string, number>>((acc, r) => {
    acc[r.sync_status] = (acc[r.sync_status] ?? 0) + 1;
    return acc;
  }, {});

  function handleAddGroup() {
    const name = window.prompt("Group name:");
    if (name?.trim()) addGroup(name.trim());
  }

  if (!sidebarOpen) {
    return (
      <motion.aside
        initial={false}
        animate={{ width: 40 }}
        className="flex flex-col items-center pt-2 border-r border-[var(--border)] flex-shrink-0"
        style={{ background: "var(--card)" }}
        aria-label="Sidebar collapsed"
      >
        <button
          type="button"
          onClick={toggleSidebar}
          className="p-2 rounded hover:bg-[var(--hover-bg)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          title="Expand sidebar (Ctrl+B)"
          aria-label="Expand sidebar"
        >
          <PanelLeft size={15} aria-hidden="true" />
        </button>
      </motion.aside>
    );
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: 240 }}
      className="flex flex-col border-r border-[var(--border)] flex-shrink-0 overflow-hidden"
      style={{ background: "var(--card)" }}
      role="complementary"
      aria-label="Workspaces sidebar"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-1.5">
          <GitBranch size={13} className="text-[var(--muted-foreground)]" aria-hidden="true" />
          <span className="text-[12px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
            Workspaces
          </span>
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          className="p-1 rounded hover:bg-[var(--hover-bg)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          title="Collapse sidebar (Ctrl+B)"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose size={13} aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Status filters */}
        <Section
          label="Filter by Status"
          icon={<Star size={12} aria-hidden="true" />}
          open={statusOpen}
          onToggle={() => setStatusOpen((v) => !v)}
        >
          <div role="tree" aria-label="Status filters">
            {STATUS_FILTERS.map(({ label, value }) => {
              const count =
                value === "all"
                  ? repos.length
                  : value === "error"
                    ? (counts.error ?? 0) + (counts.auth_required ?? 0)
                    : (counts[value] ?? 0);
              return (
                <button
                  key={value}
                  type="button"
                  aria-selected={filterStatus === value}
                  onClick={() => {
                    setFilterStatus(value);
                    setActiveGroup(null);
                  }}
                  className={clsx(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-[12px] transition-colors",
                    filterStatus === value && activeGroupId === null
                      ? "bg-[var(--selected-row-bg)] text-[var(--foreground)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)]"
                  )}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: STATUS_DOT[value] }}
                    aria-hidden="true"
                  />
                  <span className="flex-1 text-left">{label}</span>
                  {count > 0 && (
                    <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Groups */}
        <Section
          label="Groups"
          icon={<Tag size={12} aria-hidden="true" />}
          open={groupsOpen}
          onToggle={() => setGroupsOpen((v) => !v)}
          action={
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAddGroup();
              }}
              className="p-0.5 rounded hover:bg-[var(--hover-bg)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              title="Add group"
              aria-label="Add group"
            >
              <Plus size={11} aria-hidden="true" />
            </button>
          }
        >
          {groups.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-[var(--muted-foreground)] italic">
              No groups yet
            </p>
          ) : (
            groups.map((g) => {
              return (
                <div
                  key={g.id}
                  className={clsx(
                    "group flex items-center gap-2 px-3 py-1.5 text-[12px] cursor-pointer transition-colors",
                    activeGroupId === g.id
                      ? "bg-[var(--selected-row-bg)] text-[var(--foreground)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)]"
                  )}
                  onClick={() => {
                    setActiveGroup(activeGroupId === g.id ? null : g.id);
                    setFilterStatus("all");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      setActiveGroup(activeGroupId === g.id ? null : g.id);
                      setFilterStatus("all");
                    }
                  }}
                  // biome-ignore lint/a11y/noNoninteractiveTabindex: custom treeitem needs tabIndex for keyboard focus
                  tabIndex={0}
                  role="treeitem"
                  aria-selected={activeGroupId === g.id}
                >
                  <Folder size={12} aria-hidden="true" />
                  <span className="flex-1 truncate">{g.name}</span>
                  <span className="text-[10px] font-mono">{g.paths.length}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeGroup(g.id);
                      if (activeGroupId === g.id) setActiveGroup(null);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 transition-all"
                    title="Remove group"
                    aria-label={`Remove group ${g.name}`}
                  >
                    <Trash2 size={10} aria-hidden="true" />
                  </button>
                </div>
              );
            })
          )}
        </Section>

        {/* Scan paths */}
        <Section
          label="Scan Paths"
          icon={<Folder size={12} aria-hidden="true" />}
          open={pathsOpen}
          onToggle={() => setPathsOpen((v) => !v)}
        >
          {scanPaths.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-[var(--muted-foreground)] italic">
              No paths configured
            </p>
          ) : (
            scanPaths.map((p) => (
              <div
                key={p}
                className="group flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[var(--muted-foreground)] hover:bg-[var(--hover-bg)] transition-colors"
              >
                <span className="flex-1 truncate font-mono" title={p}>
                  {p}
                </span>
                <button
                  type="button"
                  onClick={() => removeScanPath(p)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 transition-all"
                  title="Remove path"
                  aria-label={`Remove scan path ${p}`}
                >
                  <Trash2 size={10} aria-hidden="true" />
                </button>
              </div>
            ))
          )}
        </Section>
      </div>

      {/* Footer: total count + re-check */}
      <div className="px-3 py-2 border-t border-[var(--border)] flex items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--muted-foreground)]">
          {repos.length} repositories
        </span>
        <button
          type="button"
          onClick={() => {
            setSkipStartupCheck(false);
            setRecheckOpen(true);
          }}
          className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--hover-bg)] px-2 py-1 rounded transition-colors"
          title="Re-check system dependencies"
        >
          <ShieldCheck size={11} aria-hidden="true" />
          Re-check Deps
        </button>
      </div>

      {recheckOpen && (
        <SystemCheck
          onClose={(skipInFuture) => {
            setSkipStartupCheck(skipInFuture);
            setRecheckOpen(false);
          }}
        />
      )}
    </motion.aside>
  );
}

// ── Collapsible section ────────────────────────────────────────────
interface SectionProps {
  label: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  action?: React.ReactNode;
}

function Section({ label, icon, open, onToggle, children, action }: SectionProps) {
  return (
    <div className="border-b border-[var(--border)]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown size={10} aria-hidden="true" />
        ) : (
          <ChevronRight size={10} aria-hidden="true" />
        )}
        {icon}
        <span className="flex-1 text-left">{label}</span>
        {action}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            style={{ overflow: "hidden" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
