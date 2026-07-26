"use client";

import { useState } from "react";
import { PenLine, Trash2, StickyNote } from "lucide-react";
import Modal from "./Modal";
import { addNote, deleteNote, getNotes, type StoredNote } from "@/lib/storage";
import { formatRelativeDate } from "@/lib/format";

// Deterministic tiny rotation per card so the stack looks pinned, not printed.
function rotationFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return (h % 5) - 2; // -2deg .. 2deg
}

export default function NotesModal({
  notebookId,
  onClose,
}: {
  notebookId: string;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState<StoredNote[]>(() => getNotes(notebookId));
  const [draft, setDraft] = useState("");

  const save = () => {
    const text = draft.trim();
    if (!text) return;
    setNotes(addNote(notebookId, text, "Written by you"));
    setDraft("");
  };

  const remove = (id: string) => setNotes(deleteNote(notebookId, id));

  return (
    <Modal title="Notes" onClose={onClose} width={640}>
      <div className="mb-4 rounded-sm border border-line bg-surface-raised p-3 shadow-[var(--shadow-card)]">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              save();
            }
          }}
          rows={3}
          placeholder="Jot something down… (⌘/Ctrl + Enter to save)"
          className="ink-text w-full resize-none bg-transparent text-[15px] text-ink outline-none placeholder:font-sans placeholder:text-sm placeholder:italic placeholder:text-ink-faint"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={save}
            disabled={!draft.trim()}
            className="press flex items-center gap-1.5 rounded-sm bg-moss px-3 py-1.5 text-xs font-medium text-surface transition hover:bg-moss-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PenLine size={13} /> Add note
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="rounded-sm border border-dashed border-line px-4 py-10 text-center">
          <StickyNote className="mx-auto mb-2 text-ink-faint" size={22} strokeWidth={1.5} />
          <p className="text-sm text-ink-soft">No notes yet</p>
          <p className="mt-1 text-xs text-ink-faint">
            Write your own above, or save an answer from the chat — look for “Save to notes”
            when you hover a response.
          </p>
        </div>
      ) : (
        <div className="grid max-h-[50vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {notes.map((n) => (
            <div
              key={n.id}
              className="note-card group relative rounded-sm border border-line-soft bg-gold-light px-3.5 py-3"
              style={{
                background: "var(--color-gold-light)",
                transform: `rotate(${rotationFor(n.id)}deg)`,
              }}
            >
              <p className="ink-text whitespace-pre-wrap text-sm leading-snug text-ink">
                {n.text}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
                  {n.source ? `${n.source} · ` : ""}
                  {formatRelativeDate(n.createdAt)}
                </span>
                <button
                  onClick={() => remove(n.id)}
                  aria-label="Delete note"
                  className="rounded-full p-1 text-ink-faint opacity-0 transition hover:bg-rust-light hover:text-rust-dark group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
