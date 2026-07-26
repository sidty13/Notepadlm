"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastApi {
  show: (kind: ToastKind, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const KIND_STYLE: Record<
  ToastKind,
  { icon: typeof CheckCircle2; color: string; tape: string; label: string }
> = {
  success: { icon: CheckCircle2, color: "var(--color-moss)", tape: "var(--color-moss-light)", label: "Done" },
  error: { icon: XCircle, color: "var(--color-rust)", tape: "var(--color-rust-light)", label: "Trouble" },
  info: { icon: Info, color: "var(--color-gold)", tape: "var(--color-gold-light)", label: "Note" },
};

let idSeq = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (kind: ToastKind, title: string, description?: string) => {
      const id = idSeq++;
      setToasts((cur) => [...cur, { id, kind, title, description }]);
      const timer = setTimeout(() => dismiss(id), 4200);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const api: ToastApi = {
    show,
    success: (title, description) => show("success", title, description),
    error: (title, description) => show("error", title, description),
    info: (title, description) => show("info", title, description),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-3 sm:right-6 sm:top-6"
      >
        {toasts.map((t) => {
          const style = KIND_STYLE[t.kind];
          const Icon = style.icon;
          return (
            <div
              key={t.id}
              role="status"
              className="toast-in pointer-events-auto relative overflow-visible rounded-sm border border-line bg-surface-raised pl-4 pr-8 py-3 shadow-[var(--shadow-drawer)]"
              style={{ transform: "rotate(-0.6deg)" }}
            >
              {/* washi tape */}
              <span
                aria-hidden
                className="absolute -top-2.5 left-5 h-4 w-12 rounded-[1px] opacity-80"
                style={{
                  background: style.tape,
                  boxShadow: "0 1px 2px rgba(30,35,25,0.15)",
                  transform: "rotate(-3deg)",
                }}
              />
              <div className="flex items-start gap-2.5">
                <Icon size={18} className="mt-0.5 shrink-0" style={{ color: style.color }} />
                <div className="min-w-0">
                  <p className="font-display text-[15px] leading-snug text-ink">{t.title}</p>
                  {t.description && (
                    <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">{t.description}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="absolute right-1.5 top-1.5 rounded-full p-1 text-ink-faint transition hover:bg-paper hover:text-ink"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
