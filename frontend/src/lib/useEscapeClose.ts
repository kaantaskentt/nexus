"use client";

import { useEffect } from "react";

// Escape closes any floating surface (Emre report #6, July 8): drawers and modals
// register while open; the newest handler wins if several are stacked (listener is
// added per-open, and browsers dispatch in registration order — last registered acts
// last, but since closing unmounts the surface, one Escape closes one layer).
export function useEscapeClose(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, onClose]);
}
