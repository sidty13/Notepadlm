"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Map as MapIcon, Mic, Library, GraduationCap, StickyNote } from "lucide-react";
import { deleteSource, listSources, reindexSource } from "@/lib/api";
import type { SourceOut } from "@/lib/types";
import SourceRow from "./SourceRow";
import UploadSourceModal from "./UploadSourceModal";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "./Toast";

const ACTIVE_STATUSES = new Set(["uploading", "extracting", "chunking", "embedding"]);

export default function SourcesPanel({
  notebookId,
  onOpenSource,
  onOpenRoadmap,
  onOpenPodcast,
  onOpenQuiz,
  onOpenNotes,
}: {
  notebookId: string;
  onOpenSource: (source: SourceOut) => void;
  onOpenRoadmap: () => void;
  onOpenPodcast: () => void;
  onOpenQuiz: () => void;
  onOpenNotes: () => void;
}) {
  const [sources, setSources] = useState<SourceOut[] | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SourceOut | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusRef = useRef<Map<string, SourceOut["status"]>>(new Map());
  const toast = useToast();

  const refresh = useCallback(async () => {
    const rows = await listSources(notebookId);
    for (const s of rows) {
      const prev = statusRef.current.get(s.id);
      if (prev && prev !== s.status) {
        if (s.status === "ready") toast.success("Source ready", `“${s.title}” is indexed and citable.`);
        if (s.status === "failed") toast.error("Indexing failed", s.status_detail || `“${s.title}” couldn't be processed.`);
      }
      statusRef.current.set(s.id, s.status);
    }
    setSources(rows);
  }, [notebookId, toast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await listSources(notebookId);
      if (!cancelled) {
        for (const s of rows) statusRef.current.set(s.id, s.status);
        setSources(rows);
      }
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
      <div className="flex items-center justify-between border-b border-line-soft px-4 pb-3 pt-4">
        <div className="flex items-center gap-2 text-ink">
          <Library size={16} className="text-moss" />
          <span className="font-display text-[15px]">Sources</span>
          {sources && sources.length > 0 && (
            <span className="rounded-full bg-moss-light px-1.5 py-0.5 font-mono text-[10px] font-medium text-moss-dark">
              {readyCount}/{sources.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="press flex items-center gap-1 rounded-sm border border-moss/40 bg-moss-light px-2 py-1 text-xs font-medium text-moss-dark transition hover:border-moss hover:bg-moss hover:text-surface"
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
                try {
                  await reindexSource(notebookId, id);
                  toast.info("Re-indexing started", `“${s.title}” is being processed again.`);
                  refresh();
                } catch (e) {
                  toast.error("Couldn't re-index", e instanceof Error ? e.message : undefined);
                }
              }}
              onDelete={() => setPendingDelete(s)}
            />
          ))
        )}
      </div>

      <div className="binder-tab border-t border-line bg-paper-dim/50 px-3 py-3 pl-4">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
          Study tools
        </p>
        <div className="flex flex-col gap-1.5">
          <button
            disabled={readyCount === 0}
            onClick={onOpenRoadmap}
            className="press flex items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-ink-soft transition hover:bg-surface-raised hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <MapIcon size={15} className="text-rust" /> Study roadmap
          </button>
          <button
            disabled={readyCount === 0}
            onClick={onOpenPodcast}
            className="press flex items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-ink-soft transition hover:bg-surface-raised hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Mic size={15} className="text-rust" /> Podcast summary
          </button>
          <button
            disabled={readyCount === 0}
            onClick={onOpenQuiz}
            className="press flex items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-ink-soft transition hover:bg-surface-raised hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <GraduationCap size={15} className="text-rust" /> Quiz & flashcards
          </button>
          <button
            onClick={onOpenNotes}
            className="press flex items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-ink-soft transition hover:bg-surface-raised hover:text-ink"
          >
            <StickyNote size={15} className="text-rust" /> Notes
          </button>
        </div>
      </div>

      {showUpload && (
        <UploadSourceModal
          notebookId={notebookId}
          onClose={() => setShowUpload(false)}
          onAdded={(s) => {
            statusRef.current.set(s.id, s.status);
            setSources((cur) => [s, ...(cur ?? [])]);
            toast.success("Source added", `“${s.title}” is on its way to being indexed.`);
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Remove “${pendingDelete.title}”?`}
          description="This source and its citations will no longer be searchable in this notebook."
          confirmLabel="Remove source"
          danger
          onConfirm={async () => {
            const s = pendingDelete;
            setPendingDelete(null);
            setSources((cur) => cur?.filter((x) => x.id !== s.id) ?? cur);
            try {
              await deleteSource(notebookId, s.id);
              toast.success("Source removed", `“${s.title}” was removed from this notebook.`);
            } catch (e) {
              toast.error("Couldn't remove source", e instanceof Error ? e.message : undefined);
              refresh();
            }
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
