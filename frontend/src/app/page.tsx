"use client";

import { useEffect, useState } from "react";
import { Plus, BookMarked, Library, Sparkles, PenLine } from "lucide-react";
import { createNotebook, deleteNotebook, listNotebooks } from "@/lib/api";
import type { Notebook } from "@/lib/types";
import NotebookCard from "@/components/NotebookCard";
import CreateNotebookModal from "@/components/CreateNotebookModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import SettingsPanel from "@/components/SettingsPanel";
import { useToast } from "@/components/Toast";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const [notebooks, setNotebooks] = useState<Notebook[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Notebook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    listNotebooks()
      .then(setNotebooks)
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Could not load notebooks.";
        setError(msg);
        toast.error("Couldn't load your shelf", msg);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (name: string, description: string) => {
    const nb = await createNotebook(name, description || undefined);
    setShowCreate(false);
    toast.success("Notebook created", `“${nb.name}” is ready for sources.`);
    router.push(`/notebook/${nb.id}`);
  };

  const confirmDelete = async () => {
    const nb = pendingDelete;
    if (!nb) return;
    setPendingDelete(null);
    const prev = notebooks;
    setNotebooks((cur) => cur?.filter((n) => n.id !== nb.id) ?? cur);
    try {
      await deleteNotebook(nb.id);
      toast.success("Notebook deleted", `“${nb.name}” and its sources are gone.`);
    } catch (e) {
      setNotebooks(prev ?? null);
      toast.error("Couldn't delete notebook", e instanceof Error ? e.message : undefined);
    }
  };

  const totalSources = notebooks?.reduce((sum, n) => sum + n.source_count, 0) ?? 0;

  return (
    <main className="paper-surface mx-auto min-h-screen max-w-6xl px-6 py-12 sm:px-10">
      <header className="mb-10 flex items-end justify-between gap-6 border-b border-line pb-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-moss">
            <BookMarked size={20} strokeWidth={1.75} />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em]">
              Notebook RAG
            </span>
          </div>
          <h1 className="font-display text-4xl text-ink sm:text-5xl">Marginal</h1>
          <p className="mt-2 max-w-md text-sm text-ink-soft">
            Ask questions across your PDFs, transcripts, and lecture subtitles. Every answer
            points back to the exact page or moment it came from.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-3">
          <SettingsPanel />
          <button
            onClick={() => setShowCreate(true)}
            className="press flex items-center gap-2 rounded-sm bg-moss px-4 py-2.5 text-sm font-medium text-surface shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:bg-moss-dark hover:shadow-[var(--shadow-card-hover)]"
          >
            <Plus size={16} /> New notebook
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-sm border border-rust/30 bg-rust-light px-4 py-3 text-sm text-rust-dark">
          {error}
        </div>
      )}

      {notebooks && notebooks.length > 0 && (
        <div className="fade-up mb-10 grid grid-cols-3 gap-3 sm:gap-4">
          <StatCard icon={<Library size={16} />} label="Notebooks" value={notebooks.length} />
          <StatCard icon={<BookMarked size={16} />} label="Sources indexed" value={totalSources} />
          <StatCard
            icon={<Sparkles size={16} />}
            label="Ready to ask"
            value={notebooks.filter((n) => n.source_count > 0).length}
          />
        </div>
      )}

      {notebooks === null && !error ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-sm border border-line-soft bg-surface" />
          ))}
        </div>
      ) : notebooks && notebooks.length === 0 ? (
        <div className="fade-up relative mx-auto max-w-xl rounded-sm border border-dashed border-line bg-surface/60 py-20 text-center shadow-[var(--shadow-card)]">
          <span
            aria-hidden
            className="washi-tape left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-[1px]"
            style={{ background: "var(--color-rust-light)", transform: "translate(-50%, -50%) rotate(-3deg)" }}
          />
          <PenLine className="mx-auto mb-3 text-moss" size={28} strokeWidth={1.5} />
          <p className="font-hand -rotate-2 text-lg text-rust">start here ↴</p>
          <p className="mt-1 font-display text-2xl text-ink">Your shelf is empty</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
            Create a notebook, then add PDFs, websites, YouTube videos, or subtitle files to
            start asking questions with citations.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="press mt-6 inline-flex items-center gap-2 rounded-sm bg-moss px-4 py-2.5 text-sm font-medium text-surface transition hover:bg-moss-dark"
          >
            <Plus size={16} /> New notebook
          </button>

          <div className="mx-auto mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-line-soft pt-6 text-left">
            <FeatureHint title="Ask & cite" desc="Every answer links to its source page or timestamp." />
            <FeatureHint title="Study tools" desc="Roadmaps, podcasts, quizzes, and flashcards, saved." />
            <FeatureHint title="Your notes" desc="Write freely, or save answers straight from chat." />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notebooks?.map((nb, i) => (
            <div key={nb.id} style={{ transform: `rotate(${(i % 5) - 2}deg)` }}>
              <NotebookCard notebook={nb} onDelete={(n) => setPendingDelete(n)} />
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateNotebookModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete “${pendingDelete.name}”?`}
          description="This removes the notebook and everything in it — sources, chat history, and generated study material. This can't be undone."
          confirmLabel="Delete notebook"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="note-card flex items-center gap-3 rounded-sm border border-line bg-surface-raised px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-moss-light text-moss-dark">
        {icon}
      </span>
      <div>
        <p className="font-display text-xl leading-none text-ink">{value}</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-ink-faint">{label}</p>
      </div>
    </div>
  );
}

function FeatureHint({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <p className="font-display text-sm text-ink">{title}</p>
      <p className="mt-0.5 text-xs leading-snug text-ink-faint">{desc}</p>
    </div>
  );
}
