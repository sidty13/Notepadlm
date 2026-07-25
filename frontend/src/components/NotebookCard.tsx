"use client";

import Link from "next/link";
import { MoreVertical, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Notebook } from "@/lib/types";
import { formatRelativeDate } from "@/lib/format";

export default function NotebookCard({
  notebook,
  onDelete,
}: {
  notebook: Notebook;
  onDelete: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="group relative">
      <Link
        href={`/notebook/${notebook.id}`}
        className="fade-up block h-full rounded-sm border border-line bg-surface p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-moss/50"
      >
        <div className="mb-8 flex items-start justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
            {notebook.source_count} {notebook.source_count === 1 ? "source" : "sources"}
          </span>
        </div>
        <h3 className="font-display text-xl leading-snug text-ink">{notebook.name}</h3>
        {notebook.description ? (
          <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">{notebook.description}</p>
        ) : (
          <p className="mt-1.5 text-sm italic text-ink-faint">No description yet</p>
        )}
        <p className="mt-6 font-mono text-[11px] text-ink-faint">
          updated {formatRelativeDate(notebook.updated_at)}
        </p>
      </Link>
      <button
        onClick={(e) => {
          e.preventDefault();
          setMenuOpen((v) => !v);
        }}
        className="absolute right-3 top-3 rounded-full p-1.5 text-ink-faint opacity-0 transition hover:bg-paper hover:text-ink group-hover:opacity-100"
        aria-label="Notebook options"
      >
        <MoreVertical size={16} />
      </button>
      {menuOpen && (
        <div
          className="absolute right-3 top-10 z-10 w-40 rounded-sm border border-line bg-surface-raised py-1 shadow-lg"
          onMouseLeave={() => setMenuOpen(false)}
        >
          <button
            onClick={() => {
              setMenuOpen(false);
              onDelete(notebook.id);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rust hover:bg-rust-light"
          >
            <Trash2 size={14} /> Delete notebook
          </button>
        </div>
      )}
    </div>
  );
}
