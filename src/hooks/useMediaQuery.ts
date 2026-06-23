import { useEffect, useState } from "react";

export type Breakpoint = "compact" | "medium" | "full";

function getBreakpoint(width: number): Breakpoint {
  if (width < 900) return "compact";
  if (width < 1200) return "medium";
  return "full";
}

/** Reactive window breakpoint hook. */
export function useMediaQuery(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() => getBreakpoint(window.innerWidth));

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? window.innerWidth;
      setBp(getBreakpoint(width));
    });
    obs.observe(document.documentElement);
    return () => obs.disconnect();
  }, []);

  return bp;
}
