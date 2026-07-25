"use client";

import { STATUS_LABEL } from "@/lib/format";
import type { SourceStatus } from "@/lib/types";

const IN_PROGRESS: SourceStatus[] = ["uploading", "extracting", "chunking", "embedding"];

export default function StatusDot({ status }: { status: SourceStatus }) {
  const inProgress = IN_PROGRESS.includes(status);
  const color =
    status === "ready" ? "var(--color-moss)" : status === "failed" ? "var(--color-rust)" : "var(--color-gold)";

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-soft">
      <span
        className={inProgress ? "pulse-soft" : ""}
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: color,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
