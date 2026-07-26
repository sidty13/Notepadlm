import type {
  ChatStreamEvent,
  ExportFormat,
  MessageOut,
  Notebook,
  PodcastResponse,
  QuizResponse,
  RoadmapResponse,
  SourceOut,
  ViewerPayload,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000/api";

// Origin without the trailing /api, for resolving server-relative URLs
// that backend responses return already prefixed with /api (e.g. podcast audio_url).
export const API_ORIGIN = API_BASE.replace(/\/api$/, "");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Clerk mounts a global `window.Clerk` once loaded, which is how we attach
// the current session's bearer token from this plain (non-hook) module
// without threading a token through every call site. See ClerkProvider in
// layout.tsx for where the client is loaded.
//
// IMPORTANT: Clerk's script loads asynchronously. On a fresh page load,
// components can (and do) fire their first fetch in a useEffect before
// window.Clerk exists yet -- that request would silently go out with no
// Authorization header and the backend correctly rejects it with 401. We
// wait for window.Clerk.loaded here so every request, including the very
// first one, gets a token once the user is actually signed in.
function waitForClerkLoaded(timeoutMs = 8000): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Clerk?.loaded) return Promise.resolve();
  return new Promise((resolve) => {
    const start = Date.now();
    const poll = () => {
      if (window.Clerk?.loaded || Date.now() - start > timeoutMs) {
        resolve();
      } else {
        setTimeout(poll, 50);
      }
    };
    poll();
  });
}

async function authHeader(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  try {
    await waitForClerkLoaded();
    const token = await window.Clerk?.session?.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(await authHeader()),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---- Notebooks ----
export const listNotebooks = () => request<Notebook[]>("/notebooks");

export const createNotebook = (name: string, description?: string) =>
  request<Notebook>("/notebooks", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });

export const getNotebook = (id: string) => request<Notebook>(`/notebooks/${id}`);

export const updateNotebook = (id: string, payload: { name?: string; description?: string }) =>
  request<Notebook>(`/notebooks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteNotebook = (id: string) =>
  request<void>(`/notebooks/${id}`, { method: "DELETE" });

// ---- Sources ----
export const listSources = (notebookId: string) =>
  request<SourceOut[]>(`/notebooks/${notebookId}/sources`);

export const getSource = (notebookId: string, sourceId: string) =>
  request<SourceOut>(`/notebooks/${notebookId}/sources/${sourceId}`);

export const uploadFileSource = (notebookId: string, file: File, title?: string) => {
  const form = new FormData();
  form.append("file", file);
  if (title) form.append("title", title);
  return request<SourceOut>(`/notebooks/${notebookId}/sources/upload`, {
    method: "POST",
    body: form,
  });
};

export const addWebsiteSource = (notebookId: string, url: string, title?: string) =>
  request<SourceOut>(`/notebooks/${notebookId}/sources/website`, {
    method: "POST",
    body: JSON.stringify({ url, title }),
  });

export const addYoutubeSource = (notebookId: string, url: string, title?: string) =>
  request<SourceOut>(`/notebooks/${notebookId}/sources/youtube`, {
    method: "POST",
    body: JSON.stringify({ url, title }),
  });

export const reindexSource = (notebookId: string, sourceId: string) =>
  request<SourceOut>(`/notebooks/${notebookId}/sources/${sourceId}/reindex`, {
    method: "POST",
  });

export const deleteSource = (notebookId: string, sourceId: string) =>
  request<void>(`/notebooks/${notebookId}/sources/${sourceId}`, { method: "DELETE" });

export const sourceFileUrl = (notebookId: string, sourceId: string) =>
  `${API_BASE}/notebooks/${notebookId}/sources/${sourceId}/file`;

// ---- Chat ----
export const listMessages = (notebookId: string) =>
  request<MessageOut[]>(`/notebooks/${notebookId}/messages`);

export async function* streamChat(
  notebookId: string,
  question: string,
): AsyncGenerator<ChatStreamEvent> {
  const res = await fetch(`${API_BASE}/notebooks/${notebookId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ question }),
  });
  if (!res.ok || !res.body) {
    throw new ApiError(res.status, "Failed to reach the notebook's chat stream.");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const json = line.slice("data: ".length);
      try {
        yield JSON.parse(json) as ChatStreamEvent;
      } catch {
        /* skip malformed frame */
      }
    }
  }
}

// ---- Viewer ----
export const viewChunk = (notebookId: string, chunkId: string) =>
  request<ViewerPayload>(`/notebooks/${notebookId}/chunks/${chunkId}/view`);

// ---- Bonus: roadmap & podcast ----
export const generateRoadmap = (notebookId: string, sourceIds?: string[]) =>
  request<RoadmapResponse>(`/notebooks/${notebookId}/roadmap`, {
    method: "POST",
    body: JSON.stringify({ source_ids: sourceIds }),
  });

export const generatePodcast = (notebookId: string, sourceIds?: string[]) =>
  request<PodcastResponse>(`/notebooks/${notebookId}/podcast`, {
    method: "POST",
    body: JSON.stringify({ source_ids: sourceIds }),
  });

export const podcastFileUrl = (notebookId: string, path: string) =>
  `${API_BASE}/notebooks/${notebookId}/podcast/file?path=${encodeURIComponent(path)}`;

// ---- Quiz & flashcards ----
export const generateQuiz = (
  notebookId: string,
  sourceIds?: string[],
  numQuestions = 8,
  numFlashcards = 10,
) =>
  request<QuizResponse>(`/notebooks/${notebookId}/quiz`, {
    method: "POST",
    body: JSON.stringify({
      source_ids: sourceIds,
      num_questions: numQuestions,
      num_flashcards: numFlashcards,
    }),
  });

// ---- Export ----
export const exportUrl = (notebookId: string, format: ExportFormat) =>
  `${API_BASE}/notebooks/${notebookId}/export?format=${format}`;

export async function downloadExport(notebookId: string, format: ExportFormat) {
  const res = await fetch(exportUrl(notebookId, format), { headers: await authHeader() });
  if (!res.ok) throw new ApiError(res.status, "Export failed.");
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] || `notebook-export.${format === "markdown" ? "md" : format}`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export { API_BASE };
