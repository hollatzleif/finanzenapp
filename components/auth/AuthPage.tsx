"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const CSRF_HEADER = "x-csrf-token";

type Tab = "login" | "register";

async function fetchCurrentUser() {
  const res = await fetch("/api/auth/me", { cache: "no-store" });
  if (res.ok) return res.json();
  return null;
}

function readCsrfFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("finanzapp_csrf="));
  if (!match) return null;
  return decodeURIComponent(match.split("=")[1]);
}

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<Tab>("login");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // CSRF-Cookie durch einen GET-Request sicherstellen
    fetch("/api/auth/me").finally(() => setInitialized(true));
  }, []);

  useEffect(() => {
    fetchCurrentUser().then((user) => {
      if (user) {
        router.replace("/");
      }
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = username.trim();
    if (!trimmed) {
      setError("Bitte gib einen Benutzernamen ein.");
      return;
    }

    const csrf = readCsrfFromCookie();
    if (!csrf) {
      setError("Sicherheits-Token konnte nicht geladen werden. Bitte Seite neu laden.");
      return;
    }

    setLoading(true);
    try {
      const endpoint =
        activeTab === "register" ? "/api/auth/register" : "/api/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [CSRF_HEADER]: csrf,
        } as Record<string, string>,
        body: JSON.stringify({ username: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Aktion fehlgeschlagen.");
        return;
      }

      router.replace("/");
    } catch {
      setError("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <header className="flex items-center justify-between border-b border-[#235347]/70 pb-4">
        <div className="flex flex-col gap-1">
          <span className="tech-label text-[#8EB69B]/70">FINANZAPP // AUTH</span>
          <h1 className="text-xl font-semibold tracking-[0.22em] text-[#DAF1DE] sm:text-2xl">
            ANMELDEN ODER REGISTRIEREN
          </h1>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-[#235347]/70 bg-[#163832]/70 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[#8EB69B] sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#8EB69B] shadow-[0_0_12px_rgba(142,182,155,0.85)]" />
          <span>SESSION OHNE PASSWORT</span>
        </div>
      </header>

      <div className="glass-panel flex flex-col gap-6 p-5 sm:p-7">
        <div className="inline-flex rounded-full border border-[#235347]/70 bg-[#163832]/70 p-1 text-xs font-medium text-[#DAF1DE]">
          {(["login", "register"] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="relative flex-1 overflow-hidden rounded-full px-3 py-1.5 transition-colors"
            >
              <AnimatePresence>
                {activeTab === tab && (
                  <motion.div
                    layoutId="auth-tab-pill"
                    className="absolute inset-0 bg-gradient-to-r from-[#8EB69B]/70 to-[#235347]/70 shadow-[0_0_12px_rgba(142,182,155,0.55)]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </AnimatePresence>
              <span
                className={`relative z-10 tech-label text-[0.7rem] ${
                  activeTab === tab ? "text-[#051F20]" : "text-[#8EB69B]"
                }`}
              >
                {tab === "login" ? "ANMELDEN" : "REGISTRIEREN"}
              </span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="tech-label text-[#8EB69B]" htmlFor="username">
              BENUTZERNAME
            </label>
            <div className="relative overflow-hidden rounded-2xl border border-[#235347]/80 bg-[#163832]/80">
              <div className="pointer-events-none absolute inset-px rounded-[1.1rem] border border-[#235347]/60 opacity-70" />
              <input
                id="username"
                name="username"
                autoComplete="username"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="relative z-10 w-full bg-transparent px-4 py-3 text-sm text-[#DAF1DE] outline-none placeholder:text-[#235347]"
                placeholder="z.B. finanzen_neo"
                minLength={3}
                pattern="^[a-zA-Z0-9_-]{3,}$"
              />
            </div>
            <p className="text-xs text-[#8EB69B]">
              Mindestens 3 Zeichen. Erlaubt: a-z, A-Z, 0-9, Unterstrich, Bindestrich.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-[#8EB69B]/70 bg-[#0B2B26]/40 px-4 py-2 text-xs text-[#DAF1DE] shadow-[0_0_20px_rgba(142,182,155,0.4)]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !initialized}
            className="relative mt-2 inline-flex items-center justify-center overflow-hidden rounded-2xl border border-[#8EB69B]/70 bg-gradient-to-r from-[#8EB69B] via-[#8EB69B] to-[#235347] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.2em] text-[#051F20] shadow-[0_0_25px_rgba(142,182,155,0.8)] transition hover:from-[#8EB69B] hover:to-[#235347] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <motion.span
              className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(5,31,32,0.2)_0,_transparent_50%)] opacity-70"
              animate={{ x: ["-10%", "10%", "-10%"], opacity: [0.5, 0.9, 0.5] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="relative z-10 flex items-center gap-2">
              {loading ? "VERARBEITE …" : activeTab === "login" ? "ANMELDEN" : "REGISTRIEREN"}
            </span>
          </button>
        </form>
      </div>

      <p className="mt-1 text-[11px] text-[#235347]">
        Keine Passwörter. Deine Identität ist ausschließlich dein Benutzername. Session wird über
        sichere Cookies verwaltet.
      </p>
    </div>
  );
}
