import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ToastProvider } from "@/components/Toast";
import { PreferencesProvider } from "@/components/PreferencesProvider";
import { clerkAppearance } from "@/lib/clerkTheme";

export const metadata: Metadata = {
  title: "Marginal",
  icons:"/favicon.ico",
  description:
    "Ask questions across your PDFs, transcripts, and lecture subtitles, and get answers with exact page and timestamp citations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router root layout, not pages/_document.js */}
          <link
            href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Caveat:wght@500;600;700&family=Kalam:wght@300;400;700&family=Shadows+Into+Light&display=swap"
            rel="stylesheet"
          />
        </head>
        <body>
          <PreferencesProvider>
            <ToastProvider>{children}</ToastProvider>
          </PreferencesProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
