"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import Modal from "./Modal";
import { generatePodcast, API_ORIGIN } from "@/lib/api";
import type { PodcastResponse } from "@/lib/types";
import { useToast } from "./Toast";
import { getCached, setCached, podcastKey } from "@/lib/storage";
import { formatRelativeDate } from "@/lib/format";
import AudioPlayer from "./AudioPlayer";

export default function PodcastModal({
  notebookId,
  onClose,
}: {
  notebookId: string;
  onClose: () => void;
}) {
  const initialCache = useState(() => getCached<PodcastResponse>(podcastKey(notebookId)))[0];
  const [data, setData] = useState<PodcastResponse | null>(initialCache?.data ?? null);
  const [savedAt, setSavedAt] = useState<string | null>(initialCache?.createdAt ?? null);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const toast = useToast();

  const fetchPodcast = (isRegenerate: boolean) =>
    generatePodcast(notebookId)
      .then((d) => {
        const entry = setCached(podcastKey(notebookId), d);
        setData(entry.data);
        setSavedAt(entry.createdAt);
        toast.success(
          isRegenerate ? "Podcast regenerated" : "Podcast ready",
          "Saved to this notebook's audio overview.",
        );
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Couldn't generate a podcast.";
        setError(msg);
        toast.error("Couldn't generate a podcast", msg);
      });

  const regenerate = () => {
    setError(null);
    setRegenerating(true);
    fetchPodcast(true).finally(() => setRegenerating(false));
  };

  useEffect(() => {
    if (!initialCache) fetchPodcast(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal title="Audio overview" onClose={onClose} width={560}>
      {error && <p className="text-sm text-rust">{error}</p>}
      {!data && !error && (
        <div className="space-y-3 py-6 text-center">
          <p className="pulse-soft font-mono text-[11px] uppercase tracking-wide text-ink-faint">
            Two hosts are recording a discussion of your sources…
          </p>
        </div>
      )}
      {data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
              {savedAt ? `Saved ${formatRelativeDate(savedAt)}` : ""}
            </span>
            <button
              onClick={regenerate}
              disabled={regenerating}
              className="press flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1 text-xs text-ink-soft transition hover:border-moss hover:text-moss disabled:opacity-50"
            >
              <RotateCcw size={12} className={regenerating ? "animate-spin" : ""} />
              {regenerating ? "Regenerating…" : "Regenerate"}
            </button>
          </div>

          <AudioPlayer
            src={data.audio_url.startsWith("http") ? data.audio_url : `${API_ORIGIN}${data.audio_url}`}
          />

          <div className="paper-surface max-h-72 space-y-2 overflow-y-auto rounded-sm border border-line bg-surface-raised p-3">
            {data.script.map((line, i) => (
              <p key={i} className="ink-text text-sm">
                <span className="font-mono text-xs font-medium text-rust">
                  {line.speaker === "A" ? "Host A" : "Host B"}
                </span>{" "}
                <span className="text-ink-soft">{line.text}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
