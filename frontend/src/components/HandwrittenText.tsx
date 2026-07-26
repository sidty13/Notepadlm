"use client";

import { Fragment, useMemo } from "react";

// Deterministic pseudo-random generator so the same text always jitters the
// same way (no flicker on re-render / streaming updates).
function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return () => {
    h = (h * 9301 + 49297) % 233280;
    return h / 233280;
  };
}

/**
 * Renders text word-by-word with slight, deterministic rotation, baseline
 * offset, and opacity jitter so it reads like real pen-on-paper pressure
 * variation rather than uniform digital type. Whitespace is preserved.
 */
export default function HandwrittenText({ text }: { text: string }) {
  const tokens = useMemo(() => {
    const rand = seededRandom(text.slice(0, 40) + text.length);
    return text.split(/(\s+)/).map((chunk, i) => {
      if (/^\s+$/.test(chunk) || chunk === "") {
        return { key: i, chunk, jitter: null as null };
      }
      const rotate = (rand() - 0.5) * 4.5; // -2.25deg .. 2.25deg
      const rise = (rand() - 0.5) * 3.2; // px
      const opacity = 0.86 + rand() * 0.14; // ink pressure 0.86 - 1.0
      const scale = 0.97 + rand() * 0.06;
      return { key: i, chunk, jitter: { rotate, rise, opacity, scale } };
    });
  }, [text]);

  return (
    <span className="ink-text">
      {tokens.map((t) =>
        t.jitter ? (
          <span
            key={t.key}
            style={{
              display: "inline-block",
              transform: `rotate(${t.jitter.rotate}deg) translateY(${t.jitter.rise}px) scale(${t.jitter.scale})`,
              opacity: t.jitter.opacity,
            }}
          >
            {t.chunk}
          </span>
        ) : (
          <Fragment key={t.key}>{t.chunk}</Fragment>
        ),
      )}
    </span>
  );
}
