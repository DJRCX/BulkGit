import { useCallback, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useStore } from "../store/store";

type KeyCombo = string; // e.g. "ctrl+f", "ctrl+a", "escape"

function parseCombo(e: KeyboardEvent): KeyCombo {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("ctrl");
  if (e.shiftKey) parts.push("shift");
  if (e.altKey) parts.push("alt");
  parts.push(e.key.toLowerCase());
  return parts.join("+");
}

/** Global keyboard shortcut handler. */
export function useKeyboard(onFocusSearch: () => void) {
  const { selectAll, clearSelection, toggleSidebar, toggleQueue, selectedPaths } = useStore(
    useShallow((s) => ({
      selectAll: s.selectAll,
      clearSelection: s.clearSelection,
      toggleSidebar: s.toggleSidebar,
      toggleQueue: s.toggleQueue,
      selectedPaths: s.selectedPaths,
    }))
  );

  const handle = useCallback(
    (e: KeyboardEvent) => {
      // Skip if typing inside an input
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";

      const combo = parseCombo(e);

      switch (combo) {
        case "ctrl+f":
          e.preventDefault();
          onFocusSearch();
          break;
        case "ctrl+a":
          if (!isInput) {
            e.preventDefault();
            selectAll();
          }
          break;
        case "ctrl+b":
          e.preventDefault();
          toggleSidebar();
          break;
        case "ctrl+j":
          e.preventDefault();
          toggleQueue();
          break;
        case "escape":
          if (selectedPaths.size > 0) clearSelection();
          break;
      }
    },
    [selectAll, clearSelection, toggleSidebar, toggleQueue, selectedPaths, onFocusSearch]
  );

  useEffect(() => {
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [handle]);
}
