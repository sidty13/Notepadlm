"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import { generatePodcast, API_ORIGIN } from "@/lib/api";
import type { PodcastResponse } from "@/lib/types";

export default function PodcastModal({
  notebookId,
  onClose,
}: {
  notebookId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<PodcastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    generatePodcast(notebookId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't generate a podcast."));
  }, [notebookId]);

  return (
    <Modal title="Podcast summary" onClose={onClose} width={560}>
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
          <audio
            controls
            className="w-full"
            src={data.audio_url.startsWith("http") ? data.audio_url : `${API_ORIGIN}${data.audio_url}`}
          />
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-sm border border-line bg-surface-raised p-3">
            {data.script.map((line, i) => (
              <p key={i} className="text-sm">
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
