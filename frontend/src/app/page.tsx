"use client";

import { useEffect, useState } from "react";
import { Plus, BookMarked } from "lucide-react";
import { createNotebook, deleteNotebook, listNotebooks } from "@/lib/api";
import type { Notebook } from "@/lib/types";
import NotebookCard from "@/components/NotebookCard";
import CreateNotebookModal from "@/components/CreateNotebookModal";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const [notebooks, setNotebooks] = useState<Notebook[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    listNotebooks()
      .then(setNotebooks)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load notebooks."));
  }, []);

  const handleCreate = async (name: string, description: string) => {
    const nb = await createNotebook(name, description || undefined);
    setShowCreate(false);
    router.push(`/notebook/${nb.id}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this notebook and everything in it? This can't be undone.")) return;
    const prev = notebooks;
    setNotebooks((cur) => cur?.filter((n) => n.id !== id) ?? cur);
    try {
      await deleteNotebook(id);
    } catch {
      setNotebooks(prev ?? null);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12 sm:px-10">
      <header className="mb-12 flex items-end justify-between border-b border-line pb-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-moss">
            <BookMarked size={20} strokeWidth={1.75} />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em]">
              Notebook RAG
            </span>
          </div>
          <h1 className="font-display text-4xl text-ink">Marginal</h1>
          <p className="mt-2 max-w-md text-sm text-ink-soft">
            Ask questions across your PDFs, transcripts, and lecture subtitles. Every answer
            points back to the exact page or moment it came from.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex shrink-0 items-center gap-2 rounded-sm bg-moss px-4 py-2.5 text-sm font-medium text-surface shadow-[var(--shadow-card)] transition hover:bg-moss-dark"
        >
          <Plus size={16} /> New notebook
        </button>
      </header>

      {error && (
        <div className="rounded-sm border border-rust/30 bg-rust-light px-4 py-3 text-sm text-rust-dark">
          {error}
        </div>
      )}

      {notebooks === null && !error ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-sm border border-line-soft bg-surface" />
          ))}
        </div>
      ) : notebooks && notebooks.length === 0 ? (
        <div className="fade-up rounded-sm border border-dashed border-line py-20 text-center">
          <p className="font-display text-xl text-ink">Your shelf is empty</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
            Create a notebook, then add PDFs, websites, YouTube videos, or subtitle files to
            start asking questions with citations.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-sm bg-moss px-4 py-2.5 text-sm font-medium text-surface hover:bg-moss-dark"
          >
            <Plus size={16} /> New notebook
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notebooks?.map((nb) => (
            <NotebookCard key={nb.id} notebook={nb} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateNotebookModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}
    </main>
  );
}
