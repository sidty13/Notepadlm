"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import { generateRoadmap } from "@/lib/api";
import type { RoadmapResponse } from "@/lib/types";

export default function RoadmapModal({
  notebookId,
  onClose,
}: {
  notebookId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<RoadmapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    generateRoadmap(notebookId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't build a roadmap."));
  }, [notebookId]);

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
        <div className="max-h-[60vh] space-y-6 overflow-y-auto pr-1">
          {data.weeks.map((week) => (
            <div key={week.week}>
              <div className="mb-2 flex items-baseline gap-2">
                <span className="font-mono text-xs text-rust">Week {week.week}</span>
                <h3 className="font-display text-lg text-ink">{week.theme}</h3>
              </div>
              <ul className="space-y-2">
                {week.items.map((item, i) => (
                  <li
                    key={i}
                    className="rounded-sm border border-line bg-surface-raised px-3 py-2 text-sm"
                  >
                    <p className="font-medium text-ink">{item.source_title}</p>
                    <p className="mt-0.5 text-ink-soft">{item.why}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
