export interface DiffLine {
  type: "added" | "deleted" | "unchanged" | "header" | "hunk";
  content: string;
  leftLineNum?: number;
  rightLineNum?: number;
}

export function parseDiff(diffText: string): DiffLine[] {
  const lines = diffText.split(/\r?\n/);
  const parsed: DiffLine[] = [];
  let leftLineNum = 0;
  let rightLineNum = 0;

  for (const line of lines) {
    if (
      line.startsWith("---") ||
      line.startsWith("+++") ||
      line.startsWith("index ") ||
      line.startsWith("diff ")
    ) {
      parsed.push({ type: "header", content: line });
    } else if (line.startsWith("@@")) {
      parsed.push({ type: "hunk", content: line });
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        leftLineNum = Number.parseInt(match[1], 10);
        rightLineNum = Number.parseInt(match[2], 10);
      }
    } else if (line.startsWith("+")) {
      parsed.push({
        type: "added",
        content: line.slice(1),
        rightLineNum: rightLineNum++,
      });
    } else if (line.startsWith("-")) {
      parsed.push({
        type: "deleted",
        content: line.slice(1),
        leftLineNum: leftLineNum++,
      });
    } else {
      // Don't add empty trailing line of the file split
      if (line === "" && parsed.length === lines.length - 1) {
        continue;
      }
      const content = line.startsWith(" ") ? line.slice(1) : line;
      parsed.push({
        type: "unchanged",
        content,
        leftLineNum: leftLineNum++,
        rightLineNum: rightLineNum++,
      });
    }
  }
  return parsed;
}
