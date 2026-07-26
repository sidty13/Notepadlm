"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, XCircle } from "lucide-react";
import Modal from "./Modal";
import { generateQuiz } from "@/lib/api";
import type { QuizResponse } from "@/lib/types";

type Tab = "quiz" | "flashcards";

export default function QuizModal({
  notebookId,
  onClose,
}: {
  notebookId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<QuizResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("quiz");

  useEffect(() => {
    generateQuiz(notebookId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't generate a quiz."));
  }, [notebookId]);

  return (
    <Modal title="Quiz & flashcards" onClose={onClose} width={620}>
      {error && <p className="text-sm text-rust">{error}</p>}

      {!data && !error && (
        <div className="space-y-3 py-6 text-center">
          <p className="pulse-soft font-mono text-[11px] uppercase tracking-wide text-ink-faint">
            Writing questions from your sources…
          </p>
        </div>
      )}

      {data && (
        <div>
          <div className="mb-4 flex gap-1 rounded-sm border border-line bg-paper-dim/40 p-1">
            <TabButton active={tab === "quiz"} onClick={() => setTab("quiz")}>
              Quiz ({data.questions.length})
            </TabButton>
            <TabButton active={tab === "flashcards"} onClick={() => setTab("flashcards")}>
              Flashcards ({data.flashcards.length})
            </TabButton>
          </div>

          {tab === "quiz" ? (
            <QuizTab questions={data.questions} />
          ) : (
            <FlashcardsTab cards={data.flashcards} />
          )}
        </div>
      )}
    </Modal>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-sm px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide transition ${
        active ? "bg-surface-raised text-ink shadow-card" : "text-ink-faint hover:text-ink-soft"
      }`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Quiz ----
function QuizTab({
  questions,
}: {
  questions: QuizResponse["questions"];
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>(Array(questions.length).fill(-1));
  const [finished, setFinished] = useState(false);

  const question = questions[index];
  const picked = selected[index];
  const answered = picked !== -1;

  const score = useMemo(
    () => selected.reduce((n, s, i) => n + (s === questions[i]?.correct_index ? 1 : 0), 0),
    [selected, questions],
  );

  const pick = (optionIndex: number) => {
    if (answered) return;
    setSelected((cur) => cur.map((v, i) => (i === index ? optionIndex : v)));
  };

  const next = () => {
    if (index < questions.length - 1) setIndex(index + 1);
    else setFinished(true);
  };

  const restart = () => {
    setSelected(Array(questions.length).fill(-1));
    setIndex(0);
    setFinished(false);
  };

  if (finished) {
    return (
      <div className="space-y-4 py-6 text-center">
        <p className="font-display text-3xl text-ink">
          {score} / {questions.length}
        </p>
        <p className="text-sm text-ink-soft">
          {score === questions.length
            ? "Perfect score — you know these sources well."
            : "Nice work. Review the ones you missed and try again."}
        </p>
        <button
          onClick={restart}
          className="mx-auto flex items-center gap-1.5 rounded-sm border border-line px-3 py-1.5 text-sm text-ink-soft transition hover:border-moss hover:text-moss"
        >
          <RotateCcw size={14} /> Retake quiz
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
          Question {index + 1} of {questions.length}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
          Score {score}/{selected.filter((s) => s !== -1).length}
        </span>
      </div>

      <p className="mb-4 font-display text-lg leading-snug text-ink">{question.question}</p>

      <div className="space-y-2">
        {question.options.map((opt, i) => {
          const isCorrect = i === question.correct_index;
          const isPicked = i === picked;
          let cls =
            "flex w-full items-center justify-between gap-2 rounded-sm border px-3 py-2.5 text-left text-sm transition ";
          if (!answered) {
            cls += "border-line bg-surface-raised hover:border-moss";
          } else if (isCorrect) {
            cls += "border-moss bg-moss-light text-moss-dark";
          } else if (isPicked) {
            cls += "border-rust bg-rust-light text-rust-dark";
          } else {
            cls += "border-line bg-surface-raised opacity-60";
          }
          return (
            <button key={i} onClick={() => pick(i)} disabled={answered} className={cls}>
              <span>{opt}</span>
              {answered && isCorrect && <CheckCircle2 size={16} className="shrink-0" />}
              {answered && isPicked && !isCorrect && <XCircle size={16} className="shrink-0" />}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="fade-up mt-3 rounded-sm border border-line-soft bg-paper-dim/50 px-3 py-2 text-sm text-ink-soft">
          {question.explanation}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          onClick={next}
          disabled={!answered}
          className="flex items-center gap-1 rounded-sm bg-moss px-4 py-2 text-sm font-medium text-surface transition hover:bg-moss-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {index === questions.length - 1 ? "See results" : "Next question"}
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------------- Flashcards ----
function FlashcardsTab({ cards }: { cards: QuizResponse["flashcards"] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];

  const go = (delta: number) => {
    setFlipped(false);
    setIndex((i) => Math.max(0, Math.min(cards.length - 1, i + delta)));
  };

  return (
    <div>
      <button
        onClick={() => setFlipped((f) => !f)}
        className="flex min-h-[180px] w-full flex-col items-center justify-center rounded-sm border border-line bg-surface-raised px-6 py-8 text-center shadow-card transition hover:border-moss"
      >
        <span className="mb-3 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
          {flipped ? "Answer — tap to flip back" : "Term — tap to reveal answer"}
        </span>
        <p className="font-display text-xl text-ink">{flipped ? card.back : card.front}</p>
      </button>

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => go(-1)}
          disabled={index === 0}
          className="flex items-center gap-1 rounded-sm px-2 py-1.5 text-sm text-ink-soft transition hover:text-moss disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft size={16} /> Prev
        </button>
        <span className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
          {index + 1} / {cards.length}
        </span>
        <button
          onClick={() => go(1)}
          disabled={index === cards.length - 1}
          className="flex items-center gap-1 rounded-sm px-2 py-1.5 text-sm text-ink-soft transition hover:text-moss disabled:cursor-not-allowed disabled:opacity-30"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
