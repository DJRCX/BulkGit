import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownToLine, CheckCircle2, Clock, Loader2, Lock, X, XCircle } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { type OperationPhase, useStore } from "../store/store";

const PHASE_ICONS: Record<OperationPhase, React.ReactNode> = {
  queued: <Clock size={12} className="text-[var(--muted-foreground)]" aria-hidden="true" />,
  fetching: <Loader2 size={12} className="animate-spin text-blue-400" aria-hidden="true" />,
  pulling: (
    <ArrowDownToLine
      size={12}
      className="animate-pulse text-[var(--status-updating)]"
      aria-hidden="true"
    />
  ),
  success: <CheckCircle2 size={12} className="text-[var(--status-synced)]" aria-hidden="true" />,
  failed: <XCircle size={12} className="text-[var(--status-error)]" aria-hidden="true" />,
  auth_required: <Lock size={12} className="text-[var(--status-error)]" aria-hidden="true" />,
};

const PHASE_LABELS: Record<OperationPhase, string> = {
  queued: "Queued",
  fetching: "Fetching…",
  pulling: "Pulling…",
  success: "Done",
  failed: "Failed",
  auth_required: "Auth Required",
};

const PHASE_BAR_COLOR: Record<OperationPhase, string> = {
  queued: "var(--muted)",
  fetching: "#3b82f6",
  pulling: "var(--status-updating)",
  success: "var(--status-synced)",
  failed: "var(--status-error)",
  auth_required: "var(--status-error)",
};

const PHASE_PROGRESS: Record<OperationPhase, number> = {
  queued: 0,
  fetching: 35,
  pulling: 70,
  success: 100,
  failed: 100,
  auth_required: 100,
};

export function QueuePanel() {
  const { queue, clearQueue, queueOpen, toggleQueue, concurrency, setConcurrency } = useStore(
    useShallow((s) => ({
      queue: s.queue,
      clearQueue: s.clearQueue,
      queueOpen: s.queueOpen,
      toggleQueue: s.toggleQueue,
      concurrency: s.concurrency,
      setConcurrency: s.setConcurrency,
    }))
  );

  const activeCount = queue.filter((q) => q.phase === "fetching" || q.phase === "pulling").length;

  return (
    <AnimatePresence>
      {queueOpen && (
        <motion.aside
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="flex flex-col border-l border-[var(--border)] flex-shrink-0 overflow-hidden"
          style={{ width: 300, background: "var(--card)" }}
          role="log"
          aria-live="polite"
          aria-label="Operation queue"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-medium text-[var(--foreground)]">Queue</span>
              {activeCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-blue-600 text-white">
                  {activeCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {queue.length > 0 && (
                <button
                  type="button"
                  onClick={clearQueue}
                  className="text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-1.5 py-0.5 rounded hover:bg-[var(--hover-bg)] transition-colors"
                  aria-label="Clear queue"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={toggleQueue}
                className="p-1 rounded hover:bg-[var(--hover-bg)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                aria-label="Close queue panel"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Concurrency slider */}
          <div className="flex items-center gap-3 px-3 py-2 border-b border-[var(--border)]">
            <span className="text-[11px] text-[var(--muted-foreground)] flex-shrink-0">
              Parallel
            </span>
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              className="flex-1 accent-blue-500"
              aria-label={`Concurrency: ${concurrency}`}
            />
            <span className="text-[11px] font-mono text-[var(--foreground)] w-4 text-right flex-shrink-0">
              {concurrency}
            </span>
          </div>

          {/* Queue items */}
          <ul
            className="flex-1 overflow-y-auto"
            aria-label="Queue items"
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            <AnimatePresence initial={false}>
              {queue.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-32 gap-2"
                >
                  <CheckCircle2
                    size={24}
                    className="text-[var(--muted-foreground)]"
                    aria-hidden="true"
                  />
                  <p className="text-[12px] text-[var(--muted-foreground)]">
                    No operations running
                  </p>
                </motion.div>
              ) : (
                queue.map((item) => (
                  <motion.li
                    key={item.path}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="px-3 py-2 border-b border-[var(--border)]"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      {PHASE_ICONS[item.phase]}
                      <span
                        className="text-[12px] font-medium text-[var(--foreground)] truncate flex-1"
                        title={item.path}
                      >
                        {item.name}
                      </span>
                      <span
                        className={clsx(
                          "text-[10px] flex-shrink-0",
                          item.phase === "success"
                            ? "text-[var(--status-synced)]"
                            : item.phase === "failed" || item.phase === "auth_required"
                              ? "text-[var(--status-error)]"
                              : "text-[var(--muted-foreground)]"
                        )}
                      >
                        {PHASE_LABELS[item.phase]}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-[2px] w-full rounded-full bg-[var(--muted)] overflow-hidden">
                      <motion.div
                        animate={{
                          width: `${PHASE_PROGRESS[item.phase]}%`,
                        }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: PHASE_BAR_COLOR[item.phase],
                        }}
                        aria-hidden="true"
                      />
                    </div>

                    {/* Error message */}
                    {item.message &&
                      (item.phase === "failed" || item.phase === "auth_required") && (
                        <p className="mt-1 text-[10px] text-[var(--status-error)] truncate font-mono">
                          {item.message}
                        </p>
                      )}
                  </motion.li>
                ))
              )}
            </AnimatePresence>
          </ul>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
