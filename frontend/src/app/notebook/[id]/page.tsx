"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BookMarked } from "lucide-react";
import { getNotebook, listSources } from "@/lib/api";
import type { CitationOut, Notebook, SourceOut } from "@/lib/types";
import SourcesPanel from "@/components/SourcesPanel";
import ChatPanel from "@/components/ChatPanel";
import SourceViewerDrawer, { ViewerTarget } from "@/components/SourceViewerDrawer";
import RoadmapModal from "@/components/RoadmapModal";
import PodcastModal from "@/components/PodcastModal";
import QuizModal from "@/components/QuizModal";
import ExportMenu from "@/components/ExportMenu";

export default function NotebookWorkspacePage() {
  const params = useParams<{ id: string }>();
  const notebookId = params.id;
  const router = useRouter();

  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [hasReadySource, setHasReadySource] = useState(false);
  const [viewerTarget, setViewerTarget] = useState<ViewerTarget | null>(null);
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [showPodcast, setShowPodcast] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getNotebook(notebookId)
      .then(setNotebook)
      .catch(() => setNotFound(true));
  }, [notebookId]);

  useEffect(() => {
    const check = () =>
      listSources(notebookId)
        .then((rows: SourceOut[]) => setHasReadySource(rows.some((s) => s.status === "ready")))
        .catch(() => {});
    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, [notebookId]);

  const handleOpenCitation = (citation: CitationOut) =>
    setViewerTarget({ kind: "citation", citation });

  const handleOpenSource = (source: SourceOut) => setViewerTarget({ kind: "source", source });

  if (notFound) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-center">
        <p className="font-display text-2xl text-ink">Notebook not found</p>
        <button onClick={() => router.push("/")} className="text-sm text-moss hover:underline">
          Back to your notebooks
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <button
          onClick={() => router.push("/")}
          className="rounded-full p-1.5 text-ink-soft transition hover:bg-paper hover:text-ink"
          aria-label="Back to notebooks"
        >
          <ArrowLeft size={17} />
        </button>
        <BookMarked size={16} className="text-moss" />
        <h1 className="truncate font-display text-lg text-ink">
          {notebook?.name ?? <span className="inline-block h-4 w-40 animate-pulse rounded-sm bg-paper" />}
        </h1>
        <div className="ml-auto">
          <ExportMenu notebookId={notebookId} />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr]">
        <aside className="min-h-0 border-r border-line bg-paper-dim/40">
          <SourcesPanel
            notebookId={notebookId}
            onOpenSource={handleOpenSource}
            onOpenRoadmap={() => setShowRoadmap(true)}
            onOpenPodcast={() => setShowPodcast(true)}
            onOpenQuiz={() => setShowQuiz(true)}
          />
        </aside>
        <main className="min-h-0">
          <ChatPanel
            notebookId={notebookId}
            hasReadySource={hasReadySource}
            onOpenCitation={handleOpenCitation}
          />
        </main>
      </div>

      {viewerTarget && (
        <SourceViewerDrawer
          notebookId={notebookId}
          target={viewerTarget}
          onClose={() => setViewerTarget(null)}
        />
      )}
      {showRoadmap && (
        <RoadmapModal notebookId={notebookId} onClose={() => setShowRoadmap(false)} />
      )}
      {showPodcast && (
        <PodcastModal notebookId={notebookId} onClose={() => setShowPodcast(false)} />
      )}
      {showQuiz && <QuizModal notebookId={notebookId} onClose={() => setShowQuiz(false)} />}
    </div>
  );
}
