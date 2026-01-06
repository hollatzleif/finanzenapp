import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "FINANZAPP",
  description: "Reflektiere deine Ausgaben mit Klarheit.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body
        className={`${spaceGrotesk.variable} antialiased bg-[#020617] text-slate-100`}
      >
        <div className="relative min-h-screen overflow-hidden">
          {/* Hintergrund-Layer */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-black" />
          <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_top,_#38bdf8_0,_transparent_55%),radial-gradient(circle_at_bottom,_#6366f1_0,_transparent_55%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.2)_0,_transparent_55%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(15,23,42,0.9)_0,rgba(15,23,42,0.9)_1px,transparent_1px,transparent_80px),repeating-linear-gradient(0deg,rgba(15,23,42,0.9)_0,rgba(15,23,42,0.9)_1px,transparent_1px,transparent_80px)] opacity-60 mix-blend-soft-light" />

          {/* große Kreis-Outline */}
          <div className="pointer-events-none absolute -left-40 top-[-200px] h-[520px] w-[520px] rounded-full border border-cyan-500/20 blur-[0.3px]" />
          <div className="pointer-events-none absolute right-[-200px] top-[40%] h-[420px] w-[420px] rounded-[9999px] border border-indigo-500/25 blur-[0.3px]" />

          {/* kleine Tech-Pixel */}
          <div className="pointer-events-none absolute left-10 top-10 h-1 w-8 bg-gradient-to-r from-cyan-400/60 via-sky-400/40 to-transparent" />
          <div className="pointer-events-none absolute right-16 bottom-16 h-1 w-6 bg-gradient-to-r from-fuchsia-400/60 via-purple-400/40 to-transparent" />

          {/* Inhalt */}
          <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-6 sm:px-6 lg:px-10">
            <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 rounded-3xl border border-slate-700/70 bg-slate-950/70 p-4 shadow-[0_0_60px_rgba(15,23,42,0.9)] backdrop-blur-xl sm:p-8 lg:p-10">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}

