"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import Modal from "./Modal";
import { generateRoadmap } from "@/lib/api";
import type { RoadmapResponse } from "@/lib/types";
import { useToast } from "./Toast";
import { getCached, setCached, roadmapKey } from "@/lib/storage";
import { formatRelativeDate } from "@/lib/format";

export default function RoadmapModal({
  notebookId,
  onClose,
}: {
  notebookId: string;
  onClose: () => void;
}) {
  const initialCache = useState(() => getCached<RoadmapResponse>(roadmapKey(notebookId)))[0];
  const [data, setData] = useState<RoadmapResponse | null>(initialCache?.data ?? null);
  const [savedAt, setSavedAt] = useState<string | null>(initialCache?.createdAt ?? null);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const toast = useToast();

  const fetchRoadmap = (isRegenerate: boolean) =>
    generateRoadmap(notebookId)
      .then((d) => {
        const entry = setCached(roadmapKey(notebookId), d);
        setData(entry.data);
        setSavedAt(entry.createdAt);
        toast.success(
          isRegenerate ? "Roadmap regenerated" : "Roadmap ready",
          "Saved to this notebook — reopen anytime without regenerating.",
        );
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Couldn't build a roadmap.";
        setError(msg);
        toast.error("Couldn't build a roadmap", msg);
      });

  const regenerate = () => {
    setError(null);
    setRegenerating(true);
    fetchRoadmap(true).finally(() => setRegenerating(false));
  };

  useEffect(() => {
    if (!initialCache) fetchRoadmap(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal title="Study roadmap" onClose={onClose} width={640}>
      {error && <p className="text-sm text-rust">{error}</p>}
      {!data && !error && (
        <div className="space-y-3 py-4">
          <div className="h-4 w-2/3 animate-pulse rounded-sm bg-paper" />
          <div className="h-4 w-1/2 animate-pulse rounded-sm bg-paper" />
          <p className="pt-2 font-mono text-[11px] uppercase tracking-wide text-ink-faint">
            Sequencing your sources…
          </p>
        </div>
      )}
      {data && (
        <div>
          <div className="mb-4 flex items-center justify-between">
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
          <div className="max-h-[55vh] space-y-6 overflow-y-auto pr-1">
            {data.weeks.map((week) => (
              <div key={week.week} className="page-turn">
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="font-mono text-xs text-rust">Week {week.week}</span>
                  <h3 className="font-display text-lg text-ink">{week.theme}</h3>
                </div>
                <ul className="space-y-2">
                  {week.items.map((item, i) => (
                    <li
                      key={i}
                      className="note-card rounded-sm border border-line bg-surface-raised px-3 py-2 text-sm"
                    >
                      <p className="font-medium text-ink">{item.source_title}</p>
                      <p className="mt-0.5 text-ink-soft">{item.why}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
