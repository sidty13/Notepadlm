"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  ArrowRight,
  BookMarked,
  Feather,
  Map as MapIcon,
  Mic,
  StickyNote,
  Highlighter,
  Upload,
  MessageSquareText,
  Sparkles,
} from "lucide-react";

export default function LandingPage() {
  const { isSignedIn, isLoaded } = useUser();

  return (
    <main className="paper-surface relative min-h-screen overflow-x-hidden">
      {/* decorative floating scraps, purely atmospheric */}
      <span
        aria-hidden
        className="float-slow pointer-events-none absolute left-[6%] top-24 hidden h-16 w-14 rounded-sm border border-line bg-gold-light shadow-[var(--shadow-card)] sm:block"
        style={{ ["--float-r" as string]: "-8deg", transform: "rotate(-8deg)" }}
      />
      <span
        aria-hidden
        className="float-slow pointer-events-none absolute right-[8%] top-40 hidden h-12 w-20 rounded-sm border border-line bg-rust-light shadow-[var(--shadow-card)] sm:block"
        style={{ ["--float-r" as string]: "6deg", transform: "rotate(6deg)", animationDelay: "1.2s" }}
      />
      <span
        aria-hidden
        className="float-slow pointer-events-none absolute bottom-16 left-[12%] hidden h-10 w-24 rounded-sm border border-line bg-moss-light shadow-[var(--shadow-card)] md:block"
        style={{ ["--float-r" as string]: "3deg", transform: "rotate(3deg)", animationDelay: "2.4s" }}
      />

      {/* nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
        <div className="flex items-center gap-2 text-moss">
          <BookMarked size={20} strokeWidth={1.75} />
          <span className="font-display text-lg text-ink">Marginal</span>
        </div>
        <nav className="flex items-center gap-3">
          {isLoaded && isSignedIn ? (
            <Link
              href="/dashboard"
              className="press flex items-center gap-1.5 rounded-sm bg-moss px-4 py-2 text-sm font-medium text-surface transition hover:bg-moss-dark"
            >
              Go to your notebooks <ArrowRight size={14} />
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="rounded-sm px-3 py-2 text-sm text-ink-soft transition hover:text-ink"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="press rounded-sm bg-moss px-4 py-2 text-sm font-medium text-surface transition hover:bg-moss-dark"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* hero */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-20 pt-10 text-center sm:px-10 sm:pt-16">
        <p className="rise-in mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-moss">
          Notebook RAG for people who write in the margins
        </p>
        <h1 className="rise-in font-display text-5xl leading-[1.05] text-ink sm:text-6xl" style={{ ["--rise-delay" as string]: "0.08s" }}>
          Ask your sources
          <br />
          anything.
        </h1>

        <div className="rise-in relative mx-auto mt-3 w-fit" style={{ ["--rise-delay" as string]: "0.2s" }}>
          <span className="ink-text -rotate-1 inline-block text-2xl text-rust">
            get an answer, and the exact page it came from ↴
          </span>
          <svg
            aria-hidden
            viewBox="0 0 360 14"
            className="mx-auto mt-1 h-3 w-full max-w-xs text-rust"
          >
            <path
              d="M4 8 C 80 2, 140 12, 200 6 S 320 2, 356 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="draw-underline"
              style={{ ["--len" as string]: 420 }}
            />
          </svg>
        </div>

        <p
          className="rise-in mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-ink-soft"
          style={{ ["--rise-delay" as string]: "0.3s" }}
        >
          Drop in PDFs, websites, YouTube videos, or lecture subtitles. Marginal reads them,
          answers your questions in a handwritten-feeling chat, and links every claim back to the
          exact page or timestamp — so you can check it yourself in seconds.
        </p>

        <div
          className="rise-in mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          style={{ ["--rise-delay" as string]: "0.4s" }}
        >
          <Link
            href={isSignedIn ? "/dashboard" : "/sign-up"}
            className="press flex items-center gap-2 rounded-sm bg-moss px-6 py-3 text-sm font-medium text-surface shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:bg-moss-dark hover:shadow-[var(--shadow-card-hover)]"
          >
            {isSignedIn ? "Open your notebooks" : "Start your first notebook"} <ArrowRight size={15} />
          </Link>
          {!isSignedIn && (
            <Link
              href="/sign-in"
              className="rounded-sm border border-line px-6 py-3 text-sm text-ink-soft transition hover:border-moss hover:text-moss"
            >
              I already have an account
            </Link>
          )}
        </div>
      </section>

      {/* feature grid */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-20 sm:px-10">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            delay="0s"
            icon={<MessageSquareText size={18} />}
            title="Ask & cite"
            desc="Every answer links back to the page or timestamp it came from — click to see it highlighted in place."
          />
          <FeatureCard
            delay="0.08s"
            icon={<Highlighter size={18} />}
            title="Real citations"
            desc="PDF citations render the actual page and glow the exact cited passage, not just a download link."
          />
          <FeatureCard
            delay="0.16s"
            icon={<Feather size={18} />}
            title="Handwritten chat"
            desc="Toggle ruled, grid, dotted, or parchment paper, plus fountain, ballpoint, or pencil ink."
          />
          <FeatureCard
            delay="0.24s"
            icon={<StickyNote size={18} />}
            title="Study tools, saved"
            desc="Roadmaps, podcasts, and quizzes generate once and stay saved to the notebook — no re-generating."
          />
        </div>
      </section>

      {/* how it works */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-24 sm:px-10">
        <h2 className="rise-in text-center font-display text-2xl text-ink">How it works</h2>
        <div className="relative mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
          <span
            aria-hidden
            className="absolute left-0 right-0 top-6 hidden border-t border-dashed border-line-soft sm:block"
          />
          <Step
            delay="0s"
            icon={<Upload size={17} />}
            step="1"
            title="Add sources"
            desc="PDFs, websites, YouTube links, or subtitle files."
          />
          <Step
            delay="0.12s"
            icon={<MessageSquareText size={17} />}
            step="2"
            title="Ask a question"
            desc="Chat naturally, in whichever paper style you like."
          />
          <Step
            delay="0.24s"
            icon={<Sparkles size={17} />}
            step="3"
            title="Get a cited answer"
            desc="Click any citation to see the exact passage, highlighted."
          />
        </div>
      </section>

      {/* closing CTA */}
      <section className="relative z-10 border-t border-line-soft bg-surface/60 px-6 py-16 text-center sm:px-10">
        <MapIcon className="mx-auto mb-3 text-moss" size={22} strokeWidth={1.5} />
        <h2 className="font-display text-3xl text-ink">Bring your own reading list.</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
          Free to start. Your notebooks, sources, and generated study material stay right where
          you left them.
        </p>
        <Link
          href={isSignedIn ? "/dashboard" : "/sign-up"}
          className="press mt-6 inline-flex items-center gap-2 rounded-sm bg-moss px-6 py-3 text-sm font-medium text-surface transition hover:bg-moss-dark"
        >
          {isSignedIn ? "Open your notebooks" : "Create your first notebook"} <ArrowRight size={15} />
        </Link>
        <p className="mt-8 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-wide text-ink-faint">
          <Mic size={12} /> also does podcasts, roadmaps, and flashcards
        </p>
      </section>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  delay: string;
}) {
  return (
    <div
      className="note-card rise-in rounded-sm border border-line bg-surface-raised p-4"
      style={{ ["--rise-delay" as string]: delay }}
    >
      <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-moss-light text-moss-dark">
        {icon}
      </span>
      <p className="font-display text-[15px] text-ink">{title}</p>
      <p className="mt-1.5 text-[13px] leading-snug text-ink-faint">{desc}</p>
    </div>
  );
}

function Step({
  icon,
  step,
  title,
  desc,
  delay,
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
  desc: string;
  delay: string;
}) {
  return (
    <div className="rise-in relative flex flex-col items-center text-center" style={{ ["--rise-delay" as string]: delay }}>
      <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 border-moss bg-surface text-moss shadow-[var(--shadow-card)]">
        {icon}
      </span>
      <span className="mt-3 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
        Step {step}
      </span>
      <p className="mt-1 font-display text-base text-ink">{title}</p>
      <p className="mt-1 max-w-[18ch] text-[13px] leading-snug text-ink-faint">{desc}</p>
    </div>
  );
}
