"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";

export default function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(30,35,25,0.45)" }}
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="fade-up w-full max-w-sm rounded-sm border border-line bg-surface p-5"
        style={{ boxShadow: "var(--shadow-drawer)" }}
      >
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{
              background: danger ? "var(--color-rust-light)" : "var(--color-gold-light)",
              color: danger ? "var(--color-rust)" : "var(--color-gold)",
            }}
          >
            <TriangleAlert size={16} />
          </span>
          <div>
            <p className="font-display text-lg leading-snug text-ink">{title}</p>
            <p className="mt-1.5 text-sm text-ink-soft">{description}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-sm px-4 py-2 text-sm text-ink-soft transition hover:bg-paper active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className={
              danger
                ? "rounded-sm bg-rust px-4 py-2 text-sm font-medium text-surface transition hover:bg-rust-dark active:scale-95"
                : "rounded-sm bg-moss px-4 py-2 text-sm font-medium text-surface transition hover:bg-moss-dark active:scale-95"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
