import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "Continuity Engine", description: "Browse, edit and review your campaign wiki." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2">
            <Link href="/" className="font-serif text-lg font-semibold tracking-tight">
              Continuity Engine
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
