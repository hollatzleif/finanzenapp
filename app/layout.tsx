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
        className={`${spaceGrotesk.variable} antialiased bg-[#051F20] text-[#DAF1DE]`}
      >
        <div className="relative min-h-screen overflow-hidden">
          {/* Hintergrund-Bild */}
          <div 
            className="pointer-events-none fixed inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: 'url(/background.jpg)',
            }}
          />
          
          {/* Overlay für bessere Lesbarkeit - subtiler dunkler Overlay */}
          <div className="pointer-events-none absolute inset-0 bg-[#051F20]/30" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#051F20]/20 via-[#0B2B26]/15 to-[#051F20]/25" />

          {/* Inhalt */}
          <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-6 sm:px-6 lg:px-10">
            <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 rounded-3xl border border-[#235347]/70 bg-[#0B2B26]/90 p-4 shadow-[0_0_60px_rgba(5,31,32,0.9)] backdrop-blur-xl sm:p-8 lg:p-10">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}

