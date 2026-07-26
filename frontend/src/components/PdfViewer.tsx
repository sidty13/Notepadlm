"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { TextContent, TextItem } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeft, ChevronRight, ExternalLink, SearchX } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Collapse whitespace/quotes so extracted PDF text and the citation's stored
// chunk text compare cleanly even when line-wraps or curly quotes differ.
function normalize(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export default function PdfViewer({
  fileUrl,
  initialPage,
  highlightText,
}: {
  fileUrl: string;
  initialPage?: number | null;
  highlightText?: string;
}) {
  // Note: this component is expected to be remounted (via a `key` on the
  // parent) whenever fileUrl/initialPage/highlightText change targets, so
  // this local state never needs to be reset mid-lifecycle.
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNum, setPageNum] = useState(initialPage && initialPage > 0 ? initialPage : 1);
  const [pageWidth, setPageWidth] = useState(640);
  const [highlightFound, setHighlightFound] = useState<boolean | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const matchedIndicesRef = useRef<Set<number> | null>(null);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setPageWidth(Math.min(720, containerRef.current.clientWidth - 32));
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // First ~140 normalized characters of the cited passage is plenty to
  // locate it uniquely on a single page without needing an exact full-chunk
  // match (extraction line-wraps can differ slightly from the stored chunk).
  const needle = useMemo(() => {
    if (!highlightText) return null;
    const n = normalize(highlightText).slice(0, 140);
    return n.length > 12 ? n : null;
  }, [highlightText]);

  const onGetTextSuccess = ({ items }: TextContent) => {
    matchedIndicesRef.current = null;
    hasScrolledRef.current = false;
    if (!needle) {
      setHighlightFound(null);
      return;
    }
    let joined = "";
    const ranges: { start: number; end: number; itemIndex: number }[] = [];
    items.forEach((item, itemIndex) => {
      // Marked-content entries (e.g. structural markers) have no `str`;
      // react-pdf assigns customTextRenderer's itemIndex as this same
      // array position, so we mirror that here to keep offsets aligned.
      const str = "str" in item ? item.str : "";
      const start = joined.length;
      joined += normalize(str) + " ";
      ranges.push({ start, end: joined.length, itemIndex });
    });
    const idx = joined.indexOf(needle);
    if (idx === -1) {
      setHighlightFound(false);
      return;
    }
    const matchStart = idx;
    const matchEnd = idx + needle.length;
    const matched = new Set<number>();
    for (const r of ranges) {
      if (r.start < matchEnd && r.end > matchStart) matched.add(r.itemIndex);
    }
    matchedIndicesRef.current = matched;
    setHighlightFound(true);
  };

  const customTextRenderer = (item: TextItem & { itemIndex: number }): string => {
    if (matchedIndicesRef.current?.has(item.itemIndex)) {
      return `<mark class="pdf-citation-mark">${escapeHtml(item.str)}</mark>`;
    }
    return item.str;
  };

  useEffect(() => {
    if (highlightFound && !hasScrolledRef.current) {
      hasScrolledRef.current = true;
      const t = setTimeout(() => {
        const el = containerRef.current?.querySelector(".pdf-citation-mark");
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 250);
      return () => clearTimeout(t);
    }
  }, [highlightFound, pageNum]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line-soft bg-surface-raised px-4 py-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
            disabled={pageNum <= 1}
            className="press flex h-7 w-7 items-center justify-center rounded-sm text-ink-soft transition hover:bg-paper hover:text-ink disabled:opacity-30"
            aria-label="Previous page"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="font-mono text-xs text-ink-soft">
            Page {pageNum}
            {numPages ? ` / ${numPages}` : ""}
          </span>
          <button
            onClick={() => setPageNum((p) => (numPages ? Math.min(numPages, p + 1) : p + 1))}
            disabled={!!numPages && pageNum >= numPages}
            className="press flex h-7 w-7 items-center justify-center rounded-sm text-ink-soft transition hover:bg-paper hover:text-ink disabled:opacity-30"
            aria-label="Next page"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {needle && highlightFound === false && (
            <span className="flex items-center gap-1 font-mono text-[11px] text-ink-faint">
              <SearchX size={12} /> couldn&apos;t pinpoint the exact line on this page
            </span>
          )}
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 font-mono text-[11px] text-ink-soft transition hover:text-moss"
          >
            <ExternalLink size={12} /> Open full PDF
          </a>
        </div>
      </div>

      <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto bg-paper-dim/40 px-4 py-4">
        <div className="mx-auto w-fit rounded-sm border border-line bg-surface shadow-[var(--shadow-card)]">
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={
              <div className="flex h-96 w-full items-center justify-center">
                <p className="pulse-soft font-mono text-xs text-ink-faint">Loading PDF…</p>
              </div>
            }
            error={
              <div className="flex h-40 w-full items-center justify-center px-6 text-center">
                <p className="text-sm text-rust">
                  Couldn&apos;t load this PDF. Try “Open full PDF” instead.
                </p>
              </div>
            }
          >
            <Page
              key={pageNum}
              pageNumber={pageNum}
              width={pageWidth}
              onGetTextSuccess={onGetTextSuccess}
              customTextRenderer={customTextRenderer}
              renderAnnotationLayer={false}
            />
          </Document>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
