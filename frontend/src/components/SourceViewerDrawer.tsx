"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { sourceFileUrl, viewChunk } from "@/lib/api";
import type { CitationOut, SourceOut, ViewerPayload } from "@/lib/types";
import { formatTimestamp } from "@/lib/format";
import SourceIcon from "./SourceIcon";

export type ViewerTarget =
  | { kind: "citation"; citation: CitationOut }
  | { kind: "source"; source: SourceOut };

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([a-zA-Z0-9_-]{6,})/);
  return m ? m[1] : null;
}

export default function SourceViewerDrawer({
  notebookId,
  target,
  onClose,
}: {
  notebookId: string;
  target: ViewerTarget;
  onClose: () => void;
}) {
  const [payload, setPayload] = useState<ViewerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      await Promise.resolve();
      if (cancelled) return;
      setPayload(null);
      setError(null);
      setLoading(true);

      if (target.kind === "citation") {
        try {
          const result = await viewChunk(notebookId, target.citation.chunk.id);
          if (cancelled) return;
          setPayload(result);
        } catch {
          if (!cancelled) setError("Couldn't load that citation.");
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      const s = target.source;
      const base: ViewerPayload = {
        source_id: s.id,
        source_type: s.type,
        title: s.title,
        chunk_text: "",
        mode:
          s.type === "pdf"
            ? "pdf"
            : s.type === "website"
              ? "website"
              : s.type === "youtube"
                ? "youtube"
                : s.type === "vtt"
                  ? "transcript"
                  : "text",
        file_url: s.type === "pdf" ? sourceFileUrl(notebookId, s.id) : undefined,
        url: s.type === "website" || s.type === "youtube" ? s.origin : undefined,
        page: s.type === "pdf" ? 1 : undefined,
        timestamp: 0,
      };
      if (cancelled) return;
      setPayload(base);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [target, notebookId]);

  const title = payload?.title ?? (target.kind === "source" ? target.source.title : target.citation.source.title);
  const type = payload?.source_type ?? (target.kind === "source" ? target.source.type : target.citation.source.type);

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-ink/30"
      style={{ background: "rgba(30,35,25,0.25)" }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex h-full w-full max-w-xl flex-col border-l border-line bg-surface"
        style={{ boxShadow: "var(--shadow-drawer)", animation: "fade-up 0.22s ease-out" }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex min-w-0 items-center gap-2 text-ink-soft">
            <SourceIcon type={type} size={16} />
            <span className="truncate font-display text-base text-ink">{title}</span>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 text-ink-soft transition hover:bg-paper hover:text-ink"
            aria-label="Close viewer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && (
            <div className="p-6">
              <div className="h-40 animate-pulse rounded-sm bg-paper" />
            </div>
          )}
          {error && <p className="p-6 text-sm text-rust">{error}</p>}
          {payload && !loading && <ViewerBody notebookId={notebookId} payload={payload} />}
        </div>
      </div>
    </div>
  );
}

function ViewerBody({ payload }: { notebookId: string; payload: ViewerPayload }) {
  if (payload.mode === "pdf") {
    return (
      <iframe
        title={payload.title}
        src={`${payload.file_url}#page=${payload.page ?? 1}`}
        className="h-full w-full"
        style={{ minHeight: "70vh", border: "none" }}
      />
    );
  }

  if (payload.mode === "youtube") {
    const id = payload.url ? youtubeId(payload.url) : null;
    return (
      <div className="p-5">
        {id ? (
          <div className="aspect-video w-full overflow-hidden rounded-sm border border-line">
            <iframe
              title={payload.title}
              src={`https://www.youtube.com/embed/${id}?start=${payload.timestamp ?? 0}`}
              className="h-full w-full"
              style={{ border: "none" }}
              allow="accelerometer; autoplay; clip-board-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <a
            href={payload.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm text-moss hover:underline"
          >
            <ExternalLink size={14} /> Open on YouTube at {formatTimestamp(payload.timestamp)}
          </a>
        )}
        <p className="mt-3 font-mono text-xs text-ink-faint">
          jumps to {formatTimestamp(payload.timestamp)}
        </p>
        {payload.chunk_text && (
          <blockquote className="mt-4 border-l-2 border-rust pl-3 text-sm italic text-ink-soft">
            “{payload.chunk_text}”
          </blockquote>
        )}
      </div>
    );
  }

  if (payload.mode === "website") {
    return (
      <div className="p-5">
        <a
          href={payload.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-sm text-moss hover:underline"
        >
          <ExternalLink size={14} /> Open original page
        </a>
        {payload.section && (
          <p className="mt-3 font-mono text-[11px] uppercase tracking-wide text-ink-faint">
            Section: {payload.section}
          </p>
        )}
        {payload.chunk_text && (
          <blockquote className="mt-4 border-l-2 border-rust pl-3 text-sm italic text-ink-soft">
            “{payload.chunk_text}”
          </blockquote>
        )}
      </div>
    );
  }

  if (payload.mode === "transcript") {
    return (
      <div className="p-5">
        {(payload.timestamp_start !== undefined && payload.timestamp_start !== null) && (
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
            {formatTimestamp(payload.timestamp_start)} – {formatTimestamp(payload.timestamp_end)}
          </p>
        )}
        {payload.chunk_text && (
          <blockquote className="mt-3 border-l-2 border-rust pl-3 text-[15px] leading-relaxed text-ink">
            “{payload.chunk_text}”
          </blockquote>
        )}
      </div>
    );
  }

  // plain text
  return (
    <div className="p-5">
      {payload.chunk_text ? (
        <blockquote className="border-l-2 border-rust pl-3 text-[15px] leading-relaxed text-ink">
          “{payload.chunk_text}”
        </blockquote>
      ) : (
        <p className="text-sm text-ink-soft">
          Ask a question in chat and click a citation to see the exact passage here.
        </p>
      )}
    </div>
  );
}
