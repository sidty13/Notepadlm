export function formatTimestamp(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "";
  const s = Math.floor(seconds % 60);
  const m = Math.floor(seconds / 60) % 60;
  const h = Math.floor(seconds / 3600);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const SOURCE_TYPE_LABEL: Record<string, string> = {
  pdf: "PDF",
  text: "Text",
  website: "Website",
  youtube: "YouTube",
  vtt: "Subtitles",
};

export const STATUS_LABEL: Record<string, string> = {
  uploading: "Uploading",
  extracting: "Reading",
  chunking: "Splitting",
  embedding: "Indexing",
  ready: "Ready",
  failed: "Failed",
};
