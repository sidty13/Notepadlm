export type SourceType = "pdf" | "text" | "website" | "youtube" | "vtt";

export type SourceStatus =
  | "uploading"
  | "extracting"
  | "chunking"
  | "embedding"
  | "ready"
  | "failed";

export type Role = "user" | "assistant";

export interface Notebook {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  source_count: number;
}

export interface SourceOut {
  id: string;
  notebook_id: string;
  type: SourceType;
  title: string;
  status: SourceStatus;
  status_detail: string | null;
  origin: string;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface ChunkOut {
  id: string;
  source_id: string;
  content: string;
  page: number | null;
  timestamp_start: number | null;
  timestamp_end: number | null;
  section: string | null;
}

export interface CitationOut {
  marker_index: number;
  chunk: ChunkOut;
  source: SourceOut;
}

export interface MessageOut {
  id: string;
  role: Role;
  content: string;
  created_at: string;
  citations: CitationOut[];
}

export interface ChatContextEvent {
  type: "context";
  standalone_query: string;
  chunks: { marker_index: number; chunk: ChunkOut; source: SourceOut }[];
}

export interface ChatTokenEvent {
  type: "token";
  text: string;
}

export interface ChatDoneEvent {
  type: "done";
  message_id: string;
}

export type ChatStreamEvent = ChatContextEvent | ChatTokenEvent | ChatDoneEvent;

export interface ViewerPayload {
  source_id: string;
  source_type: SourceType;
  title: string;
  chunk_text: string;
  mode: "pdf" | "website" | "youtube" | "transcript" | "text";
  page?: number | null;
  file_url?: string;
  section?: string | null;
  url?: string;
  timestamp?: number;
  timestamp_start?: number | null;
  timestamp_end?: number | null;
}

export interface RoadmapItem {
  source_id: string;
  source_title: string;
  why: string;
}

export interface RoadmapWeek {
  week: number;
  theme: string;
  items: RoadmapItem[];
}

export interface RoadmapResponse {
  weeks: RoadmapWeek[];
}

export interface PodcastLine {
  speaker: "A" | "B";
  text: string;
}

export interface PodcastResponse {
  audio_url: string;
  script: PodcastLine[];
}

// ---- Quiz / flashcards ----
export interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface QuizResponse {
  questions: QuizQuestion[];
  flashcards: Flashcard[];
}

// ---- Export ----
export type ExportFormat = "markdown" | "json" | "pdf";
