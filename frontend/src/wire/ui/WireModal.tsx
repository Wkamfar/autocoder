import React, { useEffect, useMemo, useRef } from "react";

function getFocusable(container: HTMLElement): HTMLElement[] {
  const selectors = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  return Array.from(container.querySelectorAll<HTMLElement>(selectors)).filter(
    (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true"
  );
}

export function WireModal({
  title,
  onClose,
  children,
  className = "",
  initialFocus = "first",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  initialFocus?: "first" | "container";
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useMemo(() => `wire-modal-${Math.random().toString(36).slice(2)}`, []);

  // Lock background scroll + wire Escape handler.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  // Initial focus.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = getFocusable(panel);
    if (initialFocus === "container") {
      panel.focus();
      return;
    }
    (focusable[0] ?? panel).focus();
  }, [initialFocus]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = getFocusable(panel);
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement as HTMLElement | null;

    if (e.shiftKey) {
      if (!active || active === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        // close when clicking the backdrop only
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`bg-white rounded-2xl border-2 border-black shadow-2xl w-full max-h-[90vh] overflow-hidden flex flex-col ${className}`}
      >
        <header className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between gap-3">
            <div id={titleId} className="text-sm font-semibold text-gray-900">
              {title}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-gray-600 hover:text-black rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-black/20"
            >
              ✕
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

