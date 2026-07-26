"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, RotateCw } from "lucide-react";

function formatTime(sec: number) {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

const SPEEDS = [1, 1.25, 1.5, 0.75];

export default function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrent(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnd = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnd);
    };
  }, [src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play();
    setPlaying(!playing);
  };

  const seek = (delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + delta));
  };

  const scrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = Number(e.target.value);
    audio.currentTime = t;
    setCurrent(t);
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  };

  return (
    <div className="rounded-sm border border-line bg-surface-raised p-4 shadow-[var(--shadow-card)]">
      <audio ref={audioRef} src={src} preload="metadata" />
      <div className="mb-3 flex items-center gap-3">
        <button
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-moss text-surface shadow-[var(--shadow-card)] transition hover:bg-moss-dark"
        >
          {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>
        <button
          onClick={() => seek(-10)}
          aria-label="Back 10 seconds"
          className="press flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition hover:bg-paper hover:text-ink"
        >
          <RotateCcw size={15} />
        </button>
        <button
          onClick={() => seek(10)}
          aria-label="Forward 10 seconds"
          className="press flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition hover:bg-paper hover:text-ink"
        >
          <RotateCw size={15} />
        </button>
        <button
          onClick={cycleSpeed}
          className="press ml-auto rounded-sm border border-line px-2 py-1 font-mono text-[11px] text-ink-soft transition hover:border-moss hover:text-moss"
        >
          {SPEEDS[speedIdx]}×
        </button>
      </div>

      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={current}
        onChange={scrub}
        className="w-full accent-[var(--color-moss)]"
      />
      <div className="mt-1 flex justify-between font-mono text-[11px] text-ink-faint">
        <span>{formatTime(current)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
