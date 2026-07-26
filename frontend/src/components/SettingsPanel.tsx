"use client";

import { useState, useRef, useEffect } from "react";
import { Palette, Check } from "lucide-react";
import { usePreferences } from "./PreferencesProvider";
import type { ColorMode, InkStyle, PaperTexture } from "@/lib/storage";

const TEXTURES: { value: PaperTexture; label: string }[] = [
  { value: "blank", label: "Blank" },
  { value: "ruled", label: "College-ruled" },
  { value: "grid", label: "Grid" },
  { value: "dotted", label: "Dotted" },
  { value: "parchment", label: "Vintage parchment" },
];

const MODES: { value: ColorMode; label: string }[] = [
  { value: "light", label: "Daylight" },
  { value: "sepia", label: "Sepia" },
  { value: "dark", label: "Dark desk" },
];

const INKS: { value: InkStyle; label: string }[] = [
  { value: "fountain", label: "Fountain pen" },
  { value: "ballpoint", label: "Ballpoint" },
  { value: "pencil", label: "Pencil" },
];

export default function SettingsPanel() {
  const { prefs, update } = usePreferences();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Appearance settings"
        className="press flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-moss hover:text-moss"
      >
        <Palette size={14} /> Appearance
      </button>

      {open && (
        <div
          className="fade-up absolute right-0 top-10 z-40 w-72 rounded-sm border border-line bg-surface-raised p-4 shadow-[var(--shadow-drawer)]"
        >
          <span
            aria-hidden
            className="washi-tape -top-2 right-6 rounded-[1px]"
            style={{ background: "var(--color-gold-light)", transform: "rotate(3deg)" }}
          />

          <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
            Paper texture
          </p>
          <div className="mb-4 grid grid-cols-2 gap-1.5">
            {TEXTURES.map((t) => (
              <button
                key={t.value}
                onClick={() => update({ texture: t.value })}
                className={`flex items-center justify-between rounded-sm border px-2 py-1.5 text-left text-xs transition ${
                  prefs.texture === t.value
                    ? "border-moss bg-moss-light text-moss-dark"
                    : "border-line text-ink-soft hover:border-moss/50"
                }`}
              >
                {t.label}
                {prefs.texture === t.value && <Check size={12} />}
              </button>
            ))}
          </div>

          <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
            Mode
          </p>
          <div className="mb-4 flex gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => update({ mode: m.value })}
                className={`flex-1 rounded-sm border px-2 py-1.5 text-xs transition ${
                  prefs.mode === m.value
                    ? "border-moss bg-moss-light text-moss-dark"
                    : "border-line text-ink-soft hover:border-moss/50"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
            Chat handwriting
          </p>
          <button
            onClick={() => update({ handwriting: !prefs.handwriting })}
            className={`mb-2 flex w-full items-center justify-between rounded-sm border px-2.5 py-1.5 text-xs transition ${
              prefs.handwriting
                ? "border-moss bg-moss-light text-moss-dark"
                : "border-line text-ink-soft hover:border-moss/50"
            }`}
          >
            {prefs.handwriting ? "On — messages look handwritten" : "Off — clean type"}
            {prefs.handwriting && <Check size={12} />}
          </button>

          {prefs.handwriting && (
            <div className="flex gap-1.5">
              {INKS.map((ink) => (
                <button
                  key={ink.value}
                  onClick={() => update({ ink: ink.value })}
                  className={`flex-1 rounded-sm border px-1.5 py-1.5 text-[11px] transition ${
                    prefs.ink === ink.value
                      ? "border-rust bg-rust-light text-rust-dark"
                      : "border-line text-ink-soft hover:border-rust/50"
                  }`}
                >
                  {ink.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
