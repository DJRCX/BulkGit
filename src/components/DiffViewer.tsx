import { parseDiff } from "./diffParser";

interface DiffViewerProps {
  diffText: string;
  filePath: string;
}

export function DiffViewer({ diffText, filePath }: DiffViewerProps) {
  if (!diffText.trim()) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-48 border border-dashed border-[var(--border)] rounded-lg bg-[var(--muted)]/20">
        <span className="text-[12px] text-[var(--muted-foreground)]">
          No changes detected in this file.
        </span>
      </div>
    );
  }

  const parsedLines = parseDiff(diffText);

  return (
    <div className="flex flex-col border border-[var(--border)] rounded-md overflow-hidden bg-[var(--card)] font-mono text-[12px] leading-relaxed shadow-sm">
      {/* File Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--muted)] border-b border-[var(--border)]">
        <span className="font-semibold text-[var(--foreground)] truncate">{filePath}</span>
        <span className="text-[10px] text-[var(--muted-foreground)] uppercase">diff</span>
      </div>

      {/* Diff Table */}
      <div className="overflow-x-auto select-text max-h-[400px] overflow-y-auto">
        <table className="w-full border-collapse">
          <tbody>
            {parsedLines.map((line, idx) => {
              const isAdded = line.type === "added";
              const isDeleted = line.type === "deleted";
              const isHunk = line.type === "hunk";
              const isHeader = line.type === "header";

              let bgClass = "hover:bg-[var(--hover-bg)]";
              let textClass = "text-[var(--foreground)]";
              let indicator = " ";

              if (isAdded) {
                bgClass = "bg-emerald-950/20 hover:bg-emerald-950/30";
                textClass = "text-emerald-400";
                indicator = "+";
              } else if (isDeleted) {
                bgClass = "bg-rose-950/20 hover:bg-rose-950/30";
                textClass = "text-rose-400";
                indicator = "-";
              } else if (isHunk) {
                bgClass =
                  "bg-blue-950/10 text-blue-400 border-y border-[var(--border)]/30 font-semibold";
              } else if (isHeader) {
                bgClass = "bg-[var(--muted)]/50 text-[var(--muted-foreground)]";
              }

              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: diff lines are static rendering and ordering is fixed
                <tr key={`diff-line-${idx}`} className={`${bgClass} transition-colors group`}>
                  {/* Left Line Number */}
                  <td className="w-10 px-2 py-0.5 text-right border-r border-[var(--border)]/40 text-[var(--muted-foreground)]/50 select-none">
                    {line.leftLineNum ?? ""}
                  </td>
                  {/* Right Line Number */}
                  <td className="w-10 px-2 py-0.5 text-right border-r border-[var(--border)]/40 text-[var(--muted-foreground)]/50 select-none">
                    {line.rightLineNum ?? ""}
                  </td>
                  {/* Plus/Minus Indicator */}
                  <td className="w-6 text-center select-none font-semibold text-[11px] opacity-70">
                    {indicator}
                  </td>
                  {/* Line Content */}
                  <td className={`px-3 py-0.5 whitespace-pre break-all ${textClass}`}>
                    {line.content}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
