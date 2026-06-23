import { useState } from "react";
import { commands } from "../bindings";

interface MergeResolverProps {
  repoPath: string;
  filePath: string;
  ourContent: string;
  theirContent: string;
  baseContent: string;
  onResolve: () => void;
  onCancel: () => void;
}

export function MergeResolver({
  repoPath,
  filePath,
  ourContent,
  theirContent,
  onResolve,
  onCancel,
}: MergeResolverProps) {
  const [resolvedContent, setResolvedContent] = useState<string>(ourContent);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUseOurs = () => {
    setResolvedContent(ourContent);
  };

  const handleUseTheirs = () => {
    setResolvedContent(theirContent);
  };

  const handleUseCombined = () => {
    setResolvedContent(`<<<<<<< Ours\n${ourContent}\n=======\n${theirContent}\n>>>>>>> Theirs`);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    const res = await commands.resolveConflict(repoPath, filePath, resolvedContent);
    setIsSaving(false);
    if (res.status === "ok") {
      onResolve();
    } else {
      setErrorMessage(res.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--background)] p-4 overflow-hidden border-l border-[var(--border)] shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
        <div>
          <h2 className="text-[14px] font-bold text-[var(--foreground)]">Resolve Merge Conflict</h2>
          <p className="text-[11px] text-[var(--muted-foreground)] font-mono truncate max-w-lg">
            {filePath}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-[12px] bg-[var(--muted)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--hover-bg)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1.5 rounded-md text-[12px] bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {isSaving ? "Saving..." : "Mark Resolved"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-3 px-3 py-2 bg-red-950/20 border border-red-500/30 text-red-400 rounded text-xs">
          {errorMessage}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 bg-[var(--muted)]/30 p-1.5 rounded-md border border-[var(--border)]/40">
        <span className="text-[11px] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider pl-1.5">
          Resolution Presets:
        </span>
        <button
          type="button"
          onClick={handleUseOurs}
          className="px-2 py-0.5 rounded text-[11px] bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 transition-colors font-medium"
        >
          Use Ours (Left)
        </button>
        <button
          type="button"
          onClick={handleUseTheirs}
          className="px-2 py-0.5 rounded text-[11px] bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 border border-amber-500/20 transition-colors font-medium"
        >
          Use Theirs (Right)
        </button>
        <button
          type="button"
          onClick={handleUseCombined}
          className="px-2 py-0.5 rounded text-[11px] bg-[var(--muted)] hover:bg-[var(--hover-bg)] text-[var(--foreground)] border border-[var(--border)] transition-colors"
        >
          Insert Both with Markers
        </button>
      </div>

      {/* Three pane editor layout */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
        {/* Left: Ours */}
        <div className="flex flex-col min-h-0 border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--card)]">
          <div className="px-3 py-1.5 bg-blue-950/20 text-blue-400 border-b border-[var(--border)] font-semibold text-[11px] uppercase select-none">
            Ours (Current Branch)
          </div>
          <textarea
            readOnly
            value={ourContent}
            className="flex-1 p-3 bg-transparent text-[12px] font-mono leading-relaxed outline-none resize-none overflow-y-auto text-[var(--foreground)] opacity-85 cursor-not-allowed select-text"
          />
        </div>

        {/* Center: Result Editor */}
        <div className="flex flex-col min-h-0 border border-blue-500/40 rounded-lg overflow-hidden bg-[var(--card)] shadow-inner">
          <div className="px-3 py-1.5 bg-blue-600 text-white font-semibold text-[11px] uppercase select-none flex items-center justify-between">
            <span>Result Editor (Edit manually)</span>
            <span className="text-[9px] bg-blue-500 px-1 py-0.5 rounded">Active</span>
          </div>
          <textarea
            value={resolvedContent}
            onChange={(e) => setResolvedContent(e.target.value)}
            placeholder="Type your resolved code here..."
            className="flex-1 p-3 bg-transparent text-[12px] font-mono leading-relaxed outline-none resize-none overflow-y-auto text-[var(--foreground)]"
          />
        </div>

        {/* Right: Theirs */}
        <div className="flex flex-col min-h-0 border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--card)]">
          <div className="px-3 py-1.5 bg-amber-950/20 text-amber-400 border-b border-[var(--border)] font-semibold text-[11px] uppercase select-none">
            Theirs (Incoming Branch)
          </div>
          <textarea
            readOnly
            value={theirContent}
            className="flex-1 p-3 bg-transparent text-[12px] font-mono leading-relaxed outline-none resize-none overflow-y-auto text-[var(--foreground)] opacity-85 cursor-not-allowed select-text"
          />
        </div>
      </div>
    </div>
  );
}
