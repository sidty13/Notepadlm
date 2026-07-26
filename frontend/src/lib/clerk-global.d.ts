// Minimal ambient typing for the global `window.Clerk` object that
// @clerk/nextjs mounts once loaded, so src/lib/api.ts (a plain module, not
// a component/hook) can read the current session token without pulling in
// the full Clerk client types.
export {};

declare global {
  interface Window {
    Clerk?: {
      loaded?: boolean;
      session?: {
        getToken(options?: { template?: string }): Promise<string | null>;
      } | null;
    };
  }
}
