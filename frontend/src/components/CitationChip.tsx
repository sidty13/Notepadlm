"use client";

export default function CitationChip({
  index,
  onClick,
}: {
  index: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`Open source ${index}`}
      className="citation-stamp relative -top-[2px] mx-0.5 inline-flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border-[1.5px] font-display text-[11px] leading-none transition hover:scale-110"
      style={{
        borderColor: "var(--color-rust)",
        color: "var(--color-rust)",
        transform: "rotate(-6deg)",
        fontWeight: 600,
      }}
    >
      {index}
    </button>
  );
}
