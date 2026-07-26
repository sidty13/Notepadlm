"use client";

import { useState } from "react";
import { MoreVertical, RefreshCw, Trash2, ExternalLink } from "lucide-react";
import type { SourceOut } from "@/lib/types";
import { SOURCE_TYPE_LABEL } from "@/lib/format";
import SourceIcon from "./SourceIcon";
import StatusDot from "./StatusDot";

export default function SourceRow({
  source,
  onReindex,
  onDelete,
  onOpen,
}: {
  source: SourceOut;
  onReindex: (id: string) => void;
  onDelete: () => void;
  onOpen: (source: SourceOut) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const clickable = source.type === "website" || source.type === "youtube" || source.status === "ready";

  return (
    <div className="group relative flex items-start gap-2.5 rounded-sm px-2.5 py-2.5 transition hover:bg-surface-raised">
      <span className="mt-0.5 shrink-0 text-ink-faint">
        <SourceIcon type={source.type} />
      </span>
      <button
        onClick={() => clickable && onOpen(source)}
        className="min-w-0 flex-1 text-left"
        disabled={!clickable}
      >
        <p className="truncate text-sm text-ink" title={source.title}>
          {source.title}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
            {SOURCE_TYPE_LABEL[source.type]}
          </span>
          <span className="text-ink-faint">·</span>
          <StatusDot status={source.status} />
        </div>
        {source.status === "failed" && source.status_detail && (
          <p className="mt-1 text-[11px] text-rust">{source.status_detail}</p>
        )}
      </button>
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="shrink-0 rounded-full p-1 text-ink-faint opacity-0 transition hover:bg-paper hover:text-ink group-hover:opacity-100"
        aria-label="Source options"
      >
        <MoreVertical size={14} />
      </button>
      {menuOpen && (
        <div
          className="absolute right-2 top-9 z-10 w-40 rounded-sm border border-line bg-surface-raised py-1 shadow-lg"
          onMouseLeave={() => setMenuOpen(false)}
        >
          {source.type === "website" && (
            <a
              href={source.origin}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-left text-sm text-ink-soft hover:bg-paper"
            >
              <ExternalLink size={14} /> Open page
            </a>
          )}
          <button
            onClick={() => {
              setMenuOpen(false);
              onReindex(source.id);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-soft hover:bg-paper"
          >
            <RefreshCw size={14} /> Re-index
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              onDelete();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rust hover:bg-rust-light"
          >
            <Trash2 size={14} /> Remove
          </button>
        </div>
      )}
    </div>
  );
}
