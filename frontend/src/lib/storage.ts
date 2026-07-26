// Client-side persistence for generated study material (roadmap, podcast, quiz,
// flashcards, notes) and user appearance preferences. Backed by localStorage so
// that once something is generated for a notebook it doesn't need to be
// regenerated every time the modal is reopened.

const PREFIX = "marginal:";

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    /* storage full or unavailable — fail silently, generation still works */
  }
}

function safeRemove(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

export interface CachedEntry<T> {
  data: T;
  createdAt: string;
}

export function getCached<T>(key: string): CachedEntry<T> | null {
  const raw = safeGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedEntry<T>;
  } catch {
    return null;
  }
}

export function setCached<T>(key: string, data: T): CachedEntry<T> {
  const entry: CachedEntry<T> = { data, createdAt: new Date().toISOString() };
  safeSet(key, JSON.stringify(entry));
  return entry;
}

export function clearCached(key: string) {
  safeRemove(key);
}

// ---- Keys for generated study material, scoped per notebook ----
export const roadmapKey = (notebookId: string) => `roadmap:${notebookId}`;
export const podcastKey = (notebookId: string) => `podcast:${notebookId}`;
export const quizKey = (notebookId: string) => `quiz:${notebookId}`;

// ---- Notes ----
export interface StoredNote {
  id: string;
  text: string;
  source?: string; // e.g. "Saved from chat"
  createdAt: string;
}

export function getNotes(notebookId: string): StoredNote[] {
  const cached = getCached<StoredNote[]>(`notes:${notebookId}`);
  return cached?.data ?? [];
}

export function addNote(notebookId: string, text: string, source?: string): StoredNote[] {
  const notes = getNotes(notebookId);
  const note: StoredNote = {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    source,
    createdAt: new Date().toISOString(),
  };
  const next = [note, ...notes];
  setCached(`notes:${notebookId}`, next);
  return next;
}

export function deleteNote(notebookId: string, noteId: string): StoredNote[] {
  const next = getNotes(notebookId).filter((n) => n.id !== noteId);
  setCached(`notes:${notebookId}`, next);
  return next;
}

// ---- Appearance preferences (shared across the whole app) ----
export type PaperTexture = "blank" | "ruled" | "grid" | "dotted" | "parchment";
export type ColorMode = "light" | "sepia" | "dark";
export type InkStyle = "fountain" | "ballpoint" | "pencil";

export interface Preferences {
  texture: PaperTexture;
  mode: ColorMode;
  handwriting: boolean;
  ink: InkStyle;
}

const DEFAULT_PREFS: Preferences = {
  texture: "ruled",
  mode: "light",
  handwriting: true,
  ink: "fountain",
};

export function getPreferences(): Preferences {
  const raw = safeGet("prefs");
  if (!raw) return DEFAULT_PREFS;
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function setPreferences(prefs: Preferences) {
  safeSet("prefs", JSON.stringify(prefs));
}
