import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// -----------------------------------------------------------------------------
// Animations / micro-interactions (inlined into CrmV2Page)
// -----------------------------------------------------------------------------
export const CRM_ANIMATIONS_CSS = `
@keyframes crm-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes crm-pop {
  0% { transform: scale(0.98); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
.crm-fade-in { animation: crm-fade-in 160ms ease-out; }
.crm-pop { animation: crm-pop 140ms ease-out; }
`;

// -----------------------------------------------------------------------------
// Primitives
// -----------------------------------------------------------------------------
export function Kbd({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono border border-gray-200 bg-gray-50 text-gray-600 ${className}`}
    >
      {children}
    </kbd>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "purple";
  className?: string;
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : tone === "danger"
          ? "bg-red-50 text-red-700 border-red-200"
          : tone === "info"
            ? "bg-blue-50 text-blue-700 border-blue-200"
            : tone === "purple"
              ? "bg-violet-50 text-violet-700 border-violet-200"
              : "bg-gray-50 text-gray-700 border-gray-200";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${toneClass} ${className}`}
    >
      {children}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Toasts
// -----------------------------------------------------------------------------
type ToastTone = "neutral" | "success" | "warning" | "danger";
export type ToastItem = {
  id: string;
  title?: string;
  message: string;
  tone: ToastTone;
  createdAt: number;
  timeoutMs?: number;
};

type ToastContextValue = {
  push: (t: Omit<ToastItem, "id" | "createdAt">) => void;
  clear: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const clear = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (t: Omit<ToastItem, "id" | "createdAt">) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const item: ToastItem = {
        id,
        createdAt: Date.now(),
        timeoutMs: t.timeoutMs ?? 4000,
        ...t,
      };
      setToasts((prev) => [item, ...prev].slice(0, 4));
      if (item.timeoutMs && item.timeoutMs > 0) {
        window.setTimeout(() => clear(id), item.timeoutMs);
      }
    },
    [clear]
  );

  const value = useMemo(() => ({ push, clear }), [push, clear]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] space-y-2">
        {toasts.map((t) => {
          const tone =
            t.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : t.tone === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : t.tone === "danger"
                  ? "border-red-200 bg-red-50 text-red-900"
                  : "border-gray-200 bg-white text-gray-900";
          return (
            <div
              key={t.id}
              className={`crm-pop w-[320px] rounded-xl border shadow-lg px-3 py-2 ${tone}`}
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {t.title && <div className="text-xs font-semibold">{t.title}</div>}
                  <div className="text-[11px] opacity-80">{t.message}</div>
                </div>
                <button
                  type="button"
                  className="text-xs opacity-60 hover:opacity-100"
                  onClick={() => clear(t.id)}
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// -----------------------------------------------------------------------------
// Command Palette
// -----------------------------------------------------------------------------
export type CommandItem = {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  category?: string;
  icon?: React.ReactNode;
  action: () => void;
};

type CommandPaletteContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
  commands: CommandItem[];
  setCommands: (c: CommandItem[]) => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function CommandPaletteProvider({
  children,
  defaultCommands = [],
}: {
  children: React.ReactNode;
  defaultCommands?: CommandItem[];
}) {
  const [open, setOpen] = useState(false);
  const [commands, setCommands] = useState<CommandItem[]>(defaultCommands);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === "k";
      const isOpenShortcut = (e.metaKey || e.ctrlKey) && isK;
      if (!isOpenShortcut) return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(
    () => ({ open, setOpen, commands, setCommands }),
    [open, commands]
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPaletteModal />
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  return ctx;
}

function CommandPaletteModal() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) return null;
  const { open, setOpen, commands } = ctx;
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      return (
        c.label.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q) ||
        (c.category ?? "").toLowerCase().includes(q)
      );
    });
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 p-4 pt-[12vh]">
      <div className="crm-pop w-full max-w-xl rounded-2xl border border-black bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="text-xs font-semibold">Command Palette</div>
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-black"
            onClick={() => setOpen(false)}
          >
            <Kbd>Esc</Kbd>
          </button>
        </div>
        <div className="px-4 py-3 border-b border-gray-200">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command…"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
            autoFocus
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-500">
              No commands found.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-gray-50"
                    onClick={() => {
                      setOpen(false);
                      c.action();
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {c.icon && <span className="text-gray-500">{c.icon}</span>}
                          <span className="text-sm font-medium text-gray-900">{c.label}</span>
                          {c.category && <Badge tone="neutral">{c.category}</Badge>}
                        </div>
                        {c.description && (
                          <div className="text-[11px] text-gray-500 mt-0.5">{c.description}</div>
                        )}
                      </div>
                      {c.shortcut && (
                        <div className="flex-shrink-0">
                          <Kbd>{c.shortcut}</Kbd>
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-gray-200 px-4 py-2 text-[11px] text-gray-500 flex items-center justify-between">
          <span>
            Open with <Kbd>⌘K</Kbd> / <Kbd>Ctrl K</Kbd>
          </span>
          <span>
            Close <Kbd>Esc</Kbd>
          </span>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Skeletons
// -----------------------------------------------------------------------------
function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />;
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-4 ${className}`}>
      <SkeletonBlock className="h-4 w-40" />
      <SkeletonBlock className="h-3 w-64 mt-3" />
      <SkeletonBlock className="h-3 w-56 mt-2" />
      <SkeletonBlock className="h-20 w-full mt-4" />
    </div>
  );
}

export function SkeletonMetrics({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-4 ${className}`}>
      <div className="flex items-center gap-6">
        <SkeletonBlock className="h-10 w-40 bg-white/10" />
        <SkeletonBlock className="h-10 w-40 bg-white/10" />
        <SkeletonBlock className="h-10 w-40 bg-white/10" />
      </div>
    </div>
  );
}

export function SkeletonTable({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white overflow-hidden ${className}`}>
      <div className="border-b border-gray-200 p-4">
        <SkeletonBlock className="h-4 w-48" />
      </div>
      <div className="p-4 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
