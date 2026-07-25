"use client";

import { Fragment } from "react";
import CitationChip from "./CitationChip";
import type { CitationOut } from "@/lib/types";

export default function MessageContent({
  text,
  citations,
  onOpenCitation,
}: {
  text: string;
  citations: CitationOut[];
  onOpenCitation: (citation: CitationOut) => void;
}) {
  const byMarker = new Map(citations.map((c) => [c.marker_index, c]));
  const parts: (string | { marker: number })[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const markerRe = /\[(\d+)]/g;
  while ((match = markerRe.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push({ marker: parseInt(match[1], 10) });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return (
    <span className="whitespace-pre-wrap leading-relaxed">
      {parts.map((p, i) => {
        if (typeof p === "string") return <Fragment key={i}>{p}</Fragment>;
        const citation = byMarker.get(p.marker);
        if (!citation) return <Fragment key={i}>{`[${p.marker}]`}</Fragment>;
        return (
          <CitationChip key={i} index={p.marker} onClick={() => onOpenCitation(citation)} />
        );
      })}
    </span>
  );
}
