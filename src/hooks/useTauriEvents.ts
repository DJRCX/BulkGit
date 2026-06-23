import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";
import { type QueueItem, useStore } from "../store/store";

interface RepoProgressPayload {
  path: string;
  name: string;
  phase: QueueItem["phase"];
  message: string | null;
}

export function useTauriEvents() {
  const queryClient = useQueryClient();
  const upsertQueueItem = useStore((s) => s.upsertQueueItem);
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    listen<RepoProgressPayload>("repo_progress", (event) => {
      if (cancelled) return;
      const { path, name, phase, message } = event.payload;
      upsertQueueItem({ path, name, phase, message });

      if (phase === "success") {
        queryClient.invalidateQueries({ queryKey: ["repos"] });
      }
    }).then((unlisten) => {
      if (cancelled) {
        unlisten();
      } else {
        unlistenRef.current = unlisten;
      }
    });

    return () => {
      cancelled = true;
      unlistenRef.current?.();
    };
  }, [upsertQueueItem, queryClient]);
}
