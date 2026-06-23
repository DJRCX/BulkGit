import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Key,
  RefreshCw,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { commands } from "../bindings";
import { useStore } from "../store/store";

interface DepStatus {
  checking: boolean;
  ok: boolean | null;
}

interface SystemCheckProps {
  onClose: (skipInFuture: boolean) => void;
}

export function SystemCheck({ onClose }: SystemCheckProps) {
  const setGitAvailable = useStore((s) => s.setGitAvailable);
  const setSshAvailable = useStore((s) => s.setSshAvailable);

  const [git, setGit] = useState<DepStatus>({ checking: true, ok: null });
  const [ssh, setSsh] = useState<DepStatus>({ checking: true, ok: null });
  const [skipOnStartup, setSkipOnStartup] = useState(false);
  const [showSkipWarning, setShowSkipWarning] = useState(false);
  const ranOnce = useRef(false);

  const runChecks = useCallback(async () => {
    setGit({ checking: true, ok: null });
    setSsh({ checking: true, ok: null });

    const [gitRes, sshRes] = await Promise.all([
      commands.checkSystemGit(),
      commands.checkSshAgent(),
    ]);

    const gitOk = gitRes.status === "ok" ? gitRes.data : false;
    const sshOk = sshRes.status === "ok" ? sshRes.data : false;

    setGit({ checking: false, ok: gitOk });
    setSsh({ checking: false, ok: sshOk });
    setGitAvailable(gitOk);
    setSshAvailable(sshOk);
  }, [setGitAvailable, setSshAvailable]);

  useEffect(() => {
    if (!ranOnce.current) {
      ranOnce.current = true;
      runChecks();
    }
  }, [runChecks]);

  const allOk = git.ok === true && ssh.ok === true;
  const hasIssues = git.ok === false || ssh.ok === false;

  function handleContinue() {
    if (skipOnStartup && hasIssues) {
      setShowSkipWarning(true);
      return;
    }
    onClose(skipOnStartup);
  }

  function confirmSkipWithIssues() {
    onClose(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      // biome-ignore lint/a11y/useSemanticElements: Using styled div instead of dialog element
      role="dialog"
      aria-modal="true"
      aria-label="Dependency Check"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />

      {/* Panel — slides up from bottom */}
      <div className="relative w-full max-w-lg mx-4 mb-4 sm:mb-0 border border-[var(--border)] rounded-2xl bg-[var(--card)] shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[var(--border)]">
          <div className="flex items-start gap-3">
            <img src="/logo.png" alt="BulkGit" className="w-9 h-9 rounded-lg flex-shrink-0" />
            <div>
              <h2 className="text-[15px] font-bold text-[var(--foreground)]">
                BulkGit — System Requirements
              </h2>
              <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">
                Checking your environment before launch
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onClose(skipOnStartup)}
            className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--hover-bg)] transition-colors"
            aria-label="Close"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        {/* Dependency rows */}
        <div className="px-5 py-4 space-y-3">
          <DepRow
            icon={<GitBranch size={15} aria-hidden="true" />}
            name="Git CLI"
            description={
              git.ok
                ? "Git is installed and available in PATH."
                : "Required for terminal operations and SSH key authentication."
            }
            status={git}
            downloadUrl="https://git-scm.com/downloads"
            downloadLabel="Download Git"
          />
          <DepRow
            icon={<Key size={15} aria-hidden="true" />}
            name="SSH Agent"
            description={
              ssh.ok
                ? "SSH agent is running and has keys loaded."
                : "Optional but required for SSH-based private repositories."
            }
            status={ssh}
            downloadUrl="https://docs.github.com/en/authentication/connecting-to-github-with-ssh"
            downloadLabel="Setup SSH Keys"
            optional
          />

          {/* WebView — always ok since the app is running */}
          <div className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/10">
            <CheckCircle2
              size={15}
              className="text-emerald-500 mt-0.5 flex-shrink-0"
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-[var(--foreground)]">
                  WebView Runtime
                </span>
                <StatusBadge ok={true} />
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                Native WebView loaded successfully — no action needed.
              </p>
            </div>
          </div>
        </div>

        {/* SSH tip */}
        <div className="mx-5 mb-4 p-3 rounded-xl bg-blue-950/30 border border-blue-900/40 text-[11px] text-[var(--muted-foreground)] leading-relaxed">
          <span className="font-semibold text-blue-300 block mb-1">💡 Private Repo Tip</span>
          For private repos via SSH, run{" "}
          <code className="font-mono bg-[var(--muted)] px-1 rounded text-[10px]">
            ssh-add ~/.ssh/id_ed25519
          </code>{" "}
          in your terminal to load your key into the agent.
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex flex-col gap-3">
          {/* Skip warning */}
          {showSkipWarning && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-950/30 border border-amber-700/40 text-[11px]">
              <AlertTriangle
                size={14}
                className="text-amber-400 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="flex-1">
                <p className="font-semibold text-amber-300 mb-1">Some requirements are not met</p>
                <p className="text-[var(--muted-foreground)]">
                  BulkGit may not work correctly. Are you sure you want to skip?
                </p>
              </div>
            </div>
          )}

          {/* Skip checkbox */}
          <label className="flex items-center gap-2 cursor-pointer select-none group">
            <input
              type="checkbox"
              checked={skipOnStartup}
              onChange={(e) => {
                setSkipOnStartup(e.target.checked);
                setShowSkipWarning(false);
              }}
              className="w-3.5 h-3.5 accent-blue-500 cursor-pointer"
              id="skip-startup-check"
            />
            <span className="text-[12px] text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors">
              Don't show this on startup
            </span>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runChecks}
              disabled={git.checking || ssh.checking}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--hover-bg)] transition-colors disabled:opacity-50"
            >
              <RefreshCw
                size={11}
                className={git.checking || ssh.checking ? "animate-spin" : ""}
                aria-hidden="true"
              />
              Re-check
            </button>

            {showSkipWarning ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowSkipWarning(false)}
                  className="flex-1 px-4 py-1.5 rounded-lg text-[11px] font-semibold border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--hover-bg)] transition-colors"
                >
                  Go Back
                </button>
                <button
                  type="button"
                  onClick={confirmSkipWithIssues}
                  className="flex-1 px-4 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors"
                >
                  Skip Anyway
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleContinue}
                className={`flex-1 px-4 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-colors ${
                  allOk ? "bg-emerald-600 hover:bg-emerald-500" : "bg-blue-600 hover:bg-blue-500"
                }`}
              >
                {allOk ? "✓ All Good — Continue" : "Continue Anyway"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

interface DepRowProps {
  icon: React.ReactNode;
  name: string;
  description: string;
  status: DepStatus;
  downloadUrl: string;
  downloadLabel: string;
  optional?: boolean;
}

function DepRow({
  icon,
  name,
  description,
  status,
  downloadUrl,
  downloadLabel,
  optional,
}: DepRowProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/10">
      {/* Status icon */}
      <div className="flex-shrink-0 mt-0.5">
        {status.checking ? (
          <RefreshCw size={15} className="text-blue-400 animate-spin" aria-hidden="true" />
        ) : status.ok ? (
          <CheckCircle2 size={15} className="text-emerald-500" aria-hidden="true" />
        ) : (
          <AlertTriangle
            size={15}
            className={optional ? "text-amber-400" : "text-red-400"}
            aria-hidden="true"
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[12px] font-semibold text-[var(--foreground)] flex items-center gap-1.5">
            {icon}
            {name}
            {optional && (
              <span className="text-[9px] font-normal text-[var(--muted-foreground)] border border-[var(--border)] px-1 rounded">
                optional
              </span>
            )}
          </span>
          {!status.checking && <StatusBadge ok={status.ok} optional={optional} />}
        </div>

        <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5 leading-relaxed">
          {description}
        </p>

        {!status.checking && !status.ok && (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-blue-400 hover:text-blue-300 hover:underline font-medium transition-colors"
          >
            {downloadLabel}
            <ExternalLink size={10} aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ ok, optional }: { ok: boolean | null; optional?: boolean }) {
  if (ok === null) return null;
  if (ok) {
    return (
      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold bg-emerald-950 text-emerald-400 border border-emerald-900/50">
        OK
      </span>
    );
  }
  return (
    <span
      className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold border ${
        optional
          ? "bg-amber-950 text-amber-400 border-amber-900/50"
          : "bg-red-950 text-red-400 border-red-900/50"
      }`}
    >
      {optional ? "MISSING" : "REQUIRED"}
    </span>
  );
}
