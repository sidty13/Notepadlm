import { SignIn } from "@clerk/nextjs";
import { BookMarked } from "lucide-react";

export default function SignInPage() {
  return (
    <main className="paper-surface flex min-h-screen items-center justify-center px-6 py-12">
      <div className="fade-up w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-2 flex items-center justify-center gap-2 text-moss">
            <BookMarked size={20} strokeWidth={1.75} />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em]">
              Notebook RAG
            </span>
          </div>
          <h1 className="font-display text-4xl text-ink">Marginal</h1>
          <p className="font-hand -rotate-1 mt-1 text-lg text-rust">welcome back ↴</p>
        </div>
        <div className="relative">
          <span
            aria-hidden
            className="washi-tape -top-2 left-1/2 -translate-x-1/2 rounded-[1px]"
            style={{ background: "var(--color-gold-light)", transform: "translateX(-50%) rotate(-2deg)" }}
          />
          <SignIn
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            fallbackRedirectUrl="/dashboard"
          />
        </div>
      </div>
    </main>
  );
}
