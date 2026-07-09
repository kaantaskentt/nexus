"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Horizontal step rail with a REAL scroll affordance (Emre report #8, July 8): the
// edge fade alone read as a hard cut, so a nine-step workflow hid most of itself.
// Now: fade + chevron buttons on whichever edge has more content, driven by actual
// scroll state — the buttons only exist when there is somewhere to go
// (every-button-works). Keyboard/trackpad scrolling keeps working; the buttons
// nudge by ~70% of the visible width.
export function StepRail({
  children,
  fadeFrom = "from-canvas",
  className = "",
}: {
  children: React.ReactNode;
  // Tailwind gradient-from class matching the rail's background, so the fade blends.
  fadeFrom?: string;
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    const el = scroller.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);
  // Content can land after mount (steps stream in) — re-measure on every render pass.
  useEffect(update);

  const nudge = (dir: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    // Page by ONE step (Emre doc-2 P2 / Kaan ruling): measure the first step wrapper —
    // a fixed fraction of the container felt arbitrary and read as broken when the
    // container was near the content width. Fallback keeps the rail usable if the
    // structure ever changes.
    const firstStep = el.firstElementChild?.firstElementChild as HTMLElement | null;
    const step = firstStep ? firstStep.getBoundingClientRect().width + 8 : el.clientWidth * 0.7;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <div className={"relative " + className}>
      <div ref={scroller} className="overflow-x-auto pb-2">
        {children}
      </div>
      {canLeft && (
        <>
          <div
            className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-14 bg-gradient-to-r ${fadeFrom} to-transparent`}
          />
          <button
            onClick={() => nudge(-1)}
            aria-label="Scroll steps left"
            className="absolute left-1 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink-soft shadow-elev-2 transition-colors hover:border-line-strong hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          </button>
        </>
      )}
      {canRight && (
        <>
          <div
            className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l ${fadeFrom} to-transparent`}
          />
          <button
            onClick={() => nudge(1)}
            aria-label="Scroll steps right"
            className="absolute right-1 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink-soft shadow-elev-2 transition-colors hover:border-line-strong hover:text-ink"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </button>
        </>
      )}
    </div>
  );
}
