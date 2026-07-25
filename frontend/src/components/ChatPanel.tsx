"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Feather } from "lucide-react";
import { listMessages, streamChat } from "@/lib/api";
import type { CitationOut, MessageOut } from "@/lib/types";
import MessageContent from "./MessageContent";

interface DraftMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: CitationOut[];
  streaming?: boolean;
}

export default function ChatPanel({
  notebookId,
  hasReadySource,
  onOpenCitation,
}: {
  notebookId: string;
  hasReadySource: boolean;
  onOpenCitation: (citation: CitationOut) => void;
}) {
  const [messages, setMessages] = useState<DraftMessage[] | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listMessages(notebookId).then((rows: MessageOut[]) =>
      setMessages(rows.map((m) => ({ id: m.id, role: m.role, content: m.content, citations: m.citations }))),
    );
  }, [notebookId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const question = input.trim();
    if (!question || sending) return;
    setInput("");
    setSending(true);

    const userMsg: DraftMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: question,
      citations: [],
    };
    const assistantId = `local-assistant-${Date.now()}`;
    const assistantMsg: DraftMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      citations: [],
      streaming: true,
    };
    setMessages((cur) => [...(cur ?? []), userMsg, assistantMsg]);

    try {
      for await (const evt of streamChat(notebookId, question)) {
        if (evt.type === "context") {
          const citations = evt.chunks.map((c) => ({
            marker_index: c.marker_index,
            chunk: c.chunk,
            source: c.source,
          }));
          setMessages((cur) =>
            cur?.map((m) => (m.id === assistantId ? { ...m, citations } : m)) ?? cur,
          );
        } else if (evt.type === "token") {
          setMessages((cur) =>
            cur?.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + evt.text } : m,
            ) ?? cur,
          );
        } else if (evt.type === "done") {
          setMessages((cur) =>
            cur?.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)) ?? cur,
          );
        }
      }
    } catch {
      setMessages((cur) =>
        cur?.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                streaming: false,
                content: m.content || "Something interrupted that answer. Please try asking again.",
              }
            : m,
        ) ?? cur,
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-10">
        {messages === null ? (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 max-w-lg animate-pulse rounded-sm bg-surface-raised" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="fade-up mx-auto mt-10 max-w-md text-center">
            <Feather className="mx-auto mb-3 text-moss" size={26} strokeWidth={1.5} />
            <p className="font-display text-xl text-ink">Ask your first question</p>
            <p className="mt-2 text-sm text-ink-soft">
              {hasReadySource
                ? "Answers are grounded in your sources — every claim links back to a page or timestamp you can check."
                : "Add a source from the left panel first, then come back and ask about it."}
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-sm bg-moss px-4 py-2.5 text-[15px] text-surface"
                      : "max-w-[85%] rounded-sm border border-line bg-surface px-4 py-3 text-[15px] text-ink shadow-[var(--shadow-card)]"
                  }
                >
                  {m.content ? (
                    <MessageContent
                      text={m.content}
                      citations={m.citations}
                      onOpenCitation={onOpenCitation}
                    />
                  ) : m.streaming ? (
                    <span className="pulse-soft font-mono text-xs text-ink-faint">thinking…</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-line px-6 py-4 sm:px-10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="mx-auto flex max-w-2xl items-end gap-2 rounded-sm border border-line bg-surface-raised px-3 py-2 shadow-[var(--shadow-card)] focus-within:border-moss"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={hasReadySource ? "Ask about your sources…" : "Add a source to start asking questions"}
            disabled={!hasReadySource}
            className="max-h-32 min-h-[28px] flex-1 resize-none bg-transparent py-1 text-sm text-ink outline-none placeholder:text-ink-faint disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!hasReadySource || !input.trim() || sending}
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-moss text-surface transition hover:bg-moss-dark disabled:opacity-30"
            aria-label="Send"
          >
            <ArrowUp size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
