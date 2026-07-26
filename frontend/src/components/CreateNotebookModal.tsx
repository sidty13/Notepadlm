"use client";

import { useState } from "react";
import Modal from "./Modal";

export default function CreateNotebookModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError("Give the notebook a name to continue.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onCreate(name.trim(), description.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <Modal title="New notebook" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">Name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Distributed Systems, Fall term"
            className="rounded-sm border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none focus:border-moss"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">
            Description <span className="text-ink-faint">(optional)</span>
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this notebook is for"
            rows={3}
            className="resize-none rounded-sm border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none focus:border-moss"
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
            className="press rounded-sm bg-moss px-4 py-2 text-sm font-medium text-surface transition hover:bg-moss-dark disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create notebook"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
