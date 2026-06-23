import { type RefObject, useEffect, useState } from "react";

interface UseVirtualOptions {
  containerRef: RefObject<HTMLElement | null>;
  totalCount: number;
  rowHeight: number;
  buffer?: number;
}

export function useVirtual({ containerRef, totalCount, rowHeight, buffer = 5 }: UseVirtualOptions) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Initialize container client height
    setContainerHeight(el.clientHeight);

    const handleScroll = () => {
      setScrollTop(el.scrollTop);
    };

    const handleResize = () => {
      setContainerHeight(el.clientHeight);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    const observer = new ResizeObserver(() => {
      setContainerHeight(el.clientHeight);
    });
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
    };
  }, [containerRef]);

  const rawStartIndex = Math.floor(scrollTop / rowHeight);
  const rawEndIndex = Math.ceil((scrollTop + containerHeight) / rowHeight);

  const startIndex = Math.max(0, rawStartIndex - buffer);
  const endIndex = Math.min(totalCount, rawEndIndex + buffer);

  const offset = startIndex * rowHeight;
  const totalHeight = totalCount * rowHeight;

  return {
    startIndex,
    endIndex,
    offset,
    totalHeight,
  };
}
