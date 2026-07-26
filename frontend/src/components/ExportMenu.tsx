"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileJson, FileText, Loader2 } from "lucide-react";
import { downloadExport } from "@/lib/api";
import type { ExportFormat } from "@/lib/types";
import { useToast } from "./Toast";

const OPTIONS: { format: ExportFormat; label: string; icon: React.ReactNode }[] = [
  { format: "markdown", label: "Markdown (.md)", icon: <FileText size={14} /> },
  { format: "pdf", label: "PDF (.pdf)", icon: <FileText size={14} /> },
  { format: "json", label: "JSON (.json)", icon: <FileJson size={14} /> },
];

export default function ExportMenu({ notebookId }: { notebookId: string }) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleExport = async (format: ExportFormat) => {
    setError(null);
    setDownloading(format);
    try {
      await downloadExport(notebookId, format);
      setOpen(false);
      toast.success("Export ready", `Your ${format.toUpperCase()} download has started.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Export failed.";
      setError(msg);
      toast.error("Export failed", msg);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="press flex items-center gap-1 rounded-sm border border-line px-2 py-1 text-xs text-ink-soft transition hover:border-moss hover:text-moss"
      >
        <Download size={13} /> Export
      </button>

      {open && (
        <div
          className="fade-up absolute right-0 top-full z-20 mt-1.5 w-44 rounded-sm border border-line bg-surface shadow-2xl"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          {OPTIONS.map((opt) => (
            <button
              key={opt.format}
              onClick={() => handleExport(opt.format)}
              disabled={downloading !== null}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-soft transition first:rounded-t-sm last:rounded-b-sm hover:bg-paper-dim/50 hover:text-ink disabled:cursor-not-allowed"
            >
              {downloading === opt.format ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                opt.icon
              )}
              {opt.label}
            </button>
          ))}
          {error && <p className="border-t border-line px-3 py-2 text-xs text-rust">{error}</p>}
        </div>
      )}
    </div>
  );
}
