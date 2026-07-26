"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Map, Mic, Library, GraduationCap } from "lucide-react";
import { deleteSource, listSources, reindexSource } from "@/lib/api";
import type { SourceOut } from "@/lib/types";
import SourceRow from "./SourceRow";
import UploadSourceModal from "./UploadSourceModal";

const ACTIVE_STATUSES = new Set(["uploading", "extracting", "chunking", "embedding"]);

export default function SourcesPanel({
  notebookId,
  onOpenSource,
  onOpenRoadmap,
  onOpenPodcast,
  onOpenQuiz,
}: {
  notebookId: string;
  onOpenSource: (source: SourceOut) => void;
  onOpenRoadmap: () => void;
  onOpenPodcast: () => void;
  onOpenQuiz: () => void;
}) {
  const [sources, setSources] = useState<SourceOut[] | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const rows = await listSources(notebookId);
    setSources(rows);
  }, [notebookId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await listSources(notebookId);
      if (!cancelled) setSources(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [notebookId]);

  useEffect(() => {
    const hasActive = sources?.some((s) => ACTIVE_STATUSES.has(s.status));
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(refresh, 2500);
    }
    if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [sources, refresh]);

  const readyCount = sources?.filter((s) => s.status === "ready").length ?? 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <div className="flex items-center gap-2 text-ink-soft">
          <Library size={15} />
          <span className="font-mono text-[11px] uppercase tracking-wide">Sources</span>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1 rounded-sm border border-line px-2 py-1 text-xs text-ink-soft transition hover:border-moss hover:text-moss"
        >
          <Plus size={13} /> Add
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {sources === null ? (
          <div className="space-y-2 px-2.5 py-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-sm bg-surface-raised" />
            ))}
          </div>
        ) : sources.length === 0 ? (
          <div className="mx-2 mt-4 rounded-sm border border-dashed border-line px-3 py-6 text-center">
            <p className="text-sm text-ink-soft">No sources yet</p>
            <button
              onClick={() => setShowUpload(true)}
              className="mt-3 text-xs font-medium text-moss hover:underline"
            >
              Add your first source
            </button>
          </div>
        ) : (
          sources.map((s) => (
            <SourceRow
              key={s.id}
              source={s}
              onOpen={onOpenSource}
              onReindex={async (id) => {
                await reindexSource(notebookId, id);
                refresh();
              }}
              onDelete={async (id) => {
                setSources((cur) => cur?.filter((x) => x.id !== id) ?? cur);
                await deleteSource(notebookId, id);
              }}
            />
          ))
        )}
      </div>

      <div className="border-t border-line px-3 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
          From your sources
        </p>
        <div className="flex flex-col gap-1.5">
          <button
            disabled={readyCount === 0}
            onClick={onOpenRoadmap}
            className="flex items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-ink-soft transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Map size={15} /> Study roadmap
          </button>
          <button
            disabled={readyCount === 0}
            onClick={onOpenPodcast}
            className="flex items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-ink-soft transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Mic size={15} /> Podcast summary
          </button>
          <button
            disabled={readyCount === 0}
            onClick={onOpenQuiz}
            className="flex items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-ink-soft transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <GraduationCap size={15} /> Quiz & flashcards
          </button>
        </div>
      </div>

      {showUpload && (
        <UploadSourceModal
          notebookId={notebookId}
          onClose={() => setShowUpload(false)}
          onAdded={(s) => setSources((cur) => [s, ...(cur ?? [])])}
        />
      )}
    </div>
  );
}
