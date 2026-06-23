import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// custom tooltip system (with aria-label fallback helper)

interface CustomTooltipProps {
  content: string;
  children: React.ReactNode;
}

export function CustomTooltip({ content, children }: CustomTooltipProps) {
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [show, setShow] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: "hidden" });

  const handleMouseMove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCoords({ x: e.clientX, y: e.clientY });
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCoords({ x: e.clientX, y: e.clientY });
    setShow(true);
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShow(false);
    setCoords(null);
  };

  useEffect(() => {
    if (!show || !coords) return;
    const tooltip = tooltipRef.current;
    if (!tooltip) return;

    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;

    const viewportWidth = window.innerWidth;

    // 12px gap above cursor
    let top = coords.y - height - 12;
    let left = coords.x - width / 2;

    // If top is less than 5px, show below the cursor, clearing space for the cursor arrow (approx. 20px)
    if (top < 5) {
      top = coords.y + 20;
    }

    // Keep horizontal boundaries inside the viewport
    if (left < 5) {
      left = 5;
    } else if (left + width > viewportWidth - 5) {
      left = viewportWidth - width - 5;
    }

    setStyle({
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 9999,
      pointerEvents: "none",
      visibility: "visible",
    });
  }, [show, coords]);

  if (!content) return <>{children}</>;

  return (
    <div
      ref={targetRef}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="inline-flex items-center"
    >
      {children}
      {show &&
        createPortal(
          <div
            ref={tooltipRef}
            style={style}
            className="px-2 py-1 text-[11px] font-sans font-medium text-[var(--foreground)] bg-[var(--card)] border border-[var(--border)] rounded shadow-xl pointer-events-none max-w-xs break-words"
          >
            {content}
          </div>,
          document.body
        )}
    </div>
  );
}
