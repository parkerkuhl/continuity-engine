import type { Metadata } from "next";
import { cookies } from "next/headers";
import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4";
import "./globals.css";

export const metadata: Metadata = { title: "Continuity Engine", description: "Browse, edit and review your campaign wiki." };

const THEME_COOKIE = "theme";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Light / Dark from the sidebar's theme switch; no attribute means follow the system (UX review #33).
  const theme = (await cookies()).get(THEME_COOKIE)?.value;
  return (
    <html lang="en" {...((theme === "light" || theme === "dark") && { "data-theme": theme })}>
      <body>{children}</body>
    </html>
  );
}
