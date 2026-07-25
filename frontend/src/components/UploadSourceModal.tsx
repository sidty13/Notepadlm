"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import Modal from "./Modal";
import { addWebsiteSource, addYoutubeSource, uploadFileSource } from "@/lib/api";
import type { SourceOut } from "@/lib/types";

type Tab = "file" | "website" | "youtube";

export default function UploadSourceModal({
  notebookId,
  onClose,
  onAdded,
}: {
  notebookId: string;
  onClose: () => void;
  onAdded: (source: SourceOut) => void;
}) {
  const [tab, setTab] = useState<Tab>("file");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      let source: SourceOut;
      if (tab === "file") {
        if (!file) {
          setError("Choose a PDF, .txt, .md, or .vtt file first.");
          setBusy(false);
          return;
        }
        source = await uploadFileSource(notebookId, file, title || undefined);
      } else if (tab === "website") {
        if (!url.trim()) {
          setError("Paste a URL to continue.");
          setBusy(false);
          return;
        }
        source = await addWebsiteSource(notebookId, url.trim(), title || undefined);
      } else {
        if (!url.trim()) {
          setError("Paste a YouTube link to continue.");
          setBusy(false);
          return;
        }
        source = await addYoutubeSource(notebookId, url.trim(), title || undefined);
      }
      onAdded(source);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that source.");
      setBusy(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "file", label: "File" },
    { id: "website", label: "Website" },
    { id: "youtube", label: "YouTube" },
  ];

  return (
    <Modal title="Add a source" onClose={onClose} width={520}>
      <div className="mb-5 flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setError(null);
            }}
            className={`px-3 pb-2.5 text-sm font-medium transition ${
              tab === t.id
                ? "border-b-2 border-moss text-ink"
                : "border-b-2 border-transparent text-ink-faint hover:text-ink-soft"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-4"
      >
        {tab === "file" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) setFile(f);
            }}
            onClick={() => fileInput.current?.click()}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-sm border-2 border-dashed px-4 py-8 text-center transition ${
              dragOver ? "border-moss bg-moss-light" : "border-line hover:border-ink-faint"
            }`}
          >
            <UploadCloud size={22} className="text-ink-faint" />
            {file ? (
              <p className="text-sm text-ink">{file.name}</p>
            ) : (
              <>
                <p className="text-sm text-ink">Drop a file, or click to browse</p>
                <p className="font-mono text-[11px] text-ink-faint">.pdf · .txt · .md · .vtt</p>
              </>
            )}
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.txt,.md,.vtt"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        )}

        {(tab === "website" || tab === "youtube") && (
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">
              {tab === "website" ? "Page URL" : "YouTube URL"}
            </span>
            <input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={tab === "website" ? "https://example.com/article" : "https://youtube.com/watch?v=…"}
              className="rounded-sm border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none focus:border-moss"
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">
            Title <span className="text-ink-faint">(optional)</span>
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="How it should appear in the notebook"
            className="rounded-sm border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none focus:border-moss"
          />
        </label>

        {error && <p className="text-sm text-rust">{error}</p>}

        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm px-4 py-2 text-sm text-ink-soft hover:bg-paper"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-sm bg-moss px-4 py-2 text-sm font-medium text-surface transition hover:bg-moss-dark disabled:opacity-60"
          >
            {busy ? "Adding…" : "Add source"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
