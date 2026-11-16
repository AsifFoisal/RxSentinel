import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import Disclaimer from "@/components/Disclaimer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "RxSentinel — Medicine Safety Check",
  description:
    "Scan a prescription or medicine packs and check for interactions, duplicate ingredients, dose load and expiry.",
  appleWebApp: {
    capable: true,
    title: "RxSentinel",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a1120",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${sora.variable} min-h-screen bg-ink-50 font-sans text-ink-900 antialiased`}
      >
        <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/85 pt-safe backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-900 font-display text-sm font-bold text-white shadow-soft">
                Rx
              </span>
              <span className="font-display text-lg font-bold tracking-tight text-ink-900">
                RxSentinel
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm font-medium">
              <Link
                href="/"
                className="min-h-11 rounded-full px-4 py-2 text-ink-600 transition hover:bg-ink-100 hover:text-ink-900"
              >
                Scan
              </Link>
              <Link
                href="/admin"
                className="min-h-11 rounded-full px-4 py-2 text-ink-600 transition hover:bg-ink-100 hover:text-ink-900"
              >
                Admin
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-28 pt-8 sm:px-6 md:pb-12">
          {children}
        </main>
        <footer className="mx-auto max-w-5xl px-4 pb-8 sm:px-6">
          <Disclaimer />
        </footer>
      </body>
    </html>
  );
}
