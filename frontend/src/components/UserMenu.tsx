"use client";

import { useEffect, useRef, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { LogOut, Settings, User as UserIcon } from "lucide-react";

export default function UserMenu() {
  const { user, isLoaded } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!isLoaded || !user) {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-paper-dim" />;
  }

  const initials =
    (user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? user.username?.[0] ?? "");
  const displayName = user.fullName || user.username || user.primaryEmailAddress?.emailAddress || "Account";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        className="press flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-line bg-moss-light text-sm font-medium text-moss-dark transition hover:border-moss"
      >
        {user.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Clerk-hosted avatar, arbitrary remote host
          <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : initials ? (
          <span className="font-display">{initials.toUpperCase()}</span>
        ) : (
          <UserIcon size={16} />
        )}
      </button>

      {open && (
        <div className="fade-up absolute right-0 top-11 z-40 w-64 rounded-sm border border-line bg-surface-raised p-1.5 shadow-[var(--shadow-drawer)]">
          <span
            aria-hidden
            className="washi-tape -top-2 right-6 rounded-[1px]"
            style={{ background: "var(--color-rust-light)", transform: "rotate(3deg)" }}
          />

          <div className="flex items-center gap-3 border-b border-line-soft px-2.5 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-moss-light text-sm font-medium text-moss-dark">
              {user.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-display">{initials.toUpperCase() || <UserIcon size={16} />}</span>
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-sm text-ink">{displayName}</p>
              {user.primaryEmailAddress && (
                <p className="truncate text-xs text-ink-faint">
                  {user.primaryEmailAddress.emailAddress}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              setOpen(false);
              openUserProfile();
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-ink-soft transition hover:bg-paper hover:text-ink"
          >
            <Settings size={15} /> Manage account
          </button>
          <button
            onClick={() => {
              setOpen(false);
              signOut({ redirectUrl: "/sign-in" });
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-rust transition hover:bg-rust-light"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
