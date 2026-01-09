"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CSRF_HEADER = "x-csrf-token";

function readCsrf(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("finanzapp_csrf="));
  if (!match) return null;
  return decodeURIComponent(match.split("=")[1]);
}

export default function MainPage() {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [intervalType, setIntervalType] = useState<
    "TAGE" | "WOCHEN" | "MONATE" | "JAHRE"
  >("MONATE");
  const [intervalEvery, setIntervalEvery] = useState(1);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const value = Number(amount.replace(",", "."));
    if (!value || value <= 0) {
      setCreateError("Bitte gib einen gültigen Betrag größer 0 ein.");
      return;
    }
    if (!purpose.trim()) {
      setCreateError("Bitte gib einen Zweck ein.");
      return;
    }

    const csrf = readCsrf();
    if (!csrf) {
      setCreateError(
        "Sicherheits-Token fehlt. Bitte Seite neu laden und erneut versuchen."
      );
      return;
    }

    setSubmittingExpense(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [CSRF_HEADER]: csrf,
        } as Record<string, string>,
        body: JSON.stringify({
          amount: value,
          purpose: purpose.trim(),
          isRecurring,
          intervalType: isRecurring ? intervalType : undefined,
          intervalEvery: isRecurring ? intervalEvery : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data?.message ?? "Ausgabe konnte nicht erstellt werden.");
        return;
      }

      setAmount("");
      setPurpose("");
      setIsRecurring(false);
      setIntervalType("MONATE");
      setIntervalEvery(1);
      setDrawerOpen(false);
      // Optional: Reload oder Weiterleitung
      router.refresh();
    } catch {
      setCreateError("Netzwerkfehler beim Erstellen der Ausgabe.");
    } finally {
      setSubmittingExpense(false);
    }
  };

  const handleLogout = async () => {
    const csrf = readCsrf();
    if (!csrf) return;
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        [CSRF_HEADER]: csrf,
      } as Record<string, string>,
    });
    router.push("/auth");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="tech-label text-[#8EB69B]/70">
            FINANZAPP // HAUPTMENÜ
          </span>
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-semibold tracking-[0.24em] text-[#DAF1DE] sm:text-3xl">
              WILLKOMMEN
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLogout}
            className="hidden rounded-xl border border-[#235347]/80 bg-[#163832]/80 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-[#8EB69B] hover:border-[#8EB69B]/80 hover:text-[#DAF1DE] sm:block"
          >
            ABMELDEN
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Menü */}
        <div className="lg:col-span-2 glass-panel flex flex-col gap-5 p-5 sm:p-7">
          <div className="flex flex-col gap-4">
            <span className="tech-label text-[#8EB69B]">
              FUNKTIONEN
            </span>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/finances"
                className="rounded-2xl border border-[#235347]/80 bg-[#163832]/80 p-5 hover:border-[#8EB69B]/80 hover:bg-[#163832]/90 transition"
              >
                <div className="flex flex-col gap-2">
                  <span className="tech-label text-[#8EB69B] text-xs">
                    FINANZEN
                  </span>
                  <p className="text-sm text-[#DAF1DE]">
                    Verwalte deine Ausgaben, bewerte sie und verfolge deine Vorsätze
                  </p>
                </div>
              </Link>
              <Link
                href="/learning"
                className="rounded-2xl border border-[#235347]/80 bg-[#163832]/80 p-5 hover:border-[#8EB69B]/80 hover:bg-[#163832]/90 transition"
              >
                <div className="flex flex-col gap-2">
                  <span className="tech-label text-[#8EB69B] text-xs">
                    LERNEN
                  </span>
                  <p className="text-sm text-[#DAF1DE]">
                    Pomodoro-Timer, sammle L-Coins und steige im Level auf
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Schnell-Funktionen */}
        <div className="glass-panel flex flex-col gap-5 p-5 sm:p-7">
          <div className="flex flex-col gap-4">
            <span className="tech-label text-[#8EB69B]">
              SCHNELL-FUNKTIONEN
            </span>
            <button
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center justify-center rounded-2xl border border-[#8EB69B]/70 bg-[#8EB69B]/10 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.21em] text-[#DAF1DE] shadow-[0_0_18px_rgba(142,182,155,0.5)] hover:bg-[#8EB69B]/20 w-full"
            >
              AUSGABE HINZUFÜGEN
            </button>
          </div>
        </div>
      </div>

      {/* Drawer: Ausgabe hinzufügen */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            className="fixed inset-0 z-40 flex items-end justify-center bg-[#051F20]/70 backdrop-blur-md sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-lg rounded-t-3xl border border-[#235347]/80 bg-[#051F20]/95 p-5 shadow-[0_0_40px_rgba(5,31,32,0.95)] sm:rounded-3xl sm:border-[#235347]/80 sm:p-6"
              initial={{ y: 80 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <span className="tech-label text-[#8EB69B]">
                    NEUE AUSGABE
                  </span>
                  <p className="mt-1 text-sm text-[#DAF1DE]">
                    Erfasse eine einmalige oder wiederkehrende Abbuchung.
                  </p>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-full border border-[#235347]/80 bg-[#163832]/80 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[#8EB69B] hover:border-[#8EB69B]/80 hover:text-[#DAF1DE]"
                >
                  SCHLIESSEN
                </button>
              </div>

              <form onSubmit={handleCreateExpense} className="flex flex-col gap-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="tech-label text-[#8EB69B]" htmlFor="amount">
                      BETRAG
                    </label>
                    <input
                      id="amount"
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[#235347]/80 bg-[#163832]/80 px-3 py-2 text-sm text-[#DAF1DE] outline-none placeholder:text-[#235347]"
                      placeholder="z.B. 42,50"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="tech-label text-[#8EB69B]" htmlFor="purpose">
                      ZWECK
                    </label>
                    <input
                      id="purpose"
                      type="text"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[#235347]/80 bg-[#163832]/80 px-3 py-2 text-sm text-[#DAF1DE] outline-none placeholder:text-[#235347]"
                      placeholder="z.B. Netflix, Miete, Kaffee"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 rounded-2xl border border-[#235347]/80 bg-[#163832]/80 px-3 py-2">
                  <label className="flex items-center justify-between gap-2">
                    <span className="tech-label text-[#8EB69B]">
                      REGELMÄSSIG?
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsRecurring((v) => !v)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full border border-[#235347]/80 bg-[#051F20]/80 px-0.5 transition ${
                        isRecurring ? "border-[#8EB69B]/80" : ""
                      }`}
                    >
                      <motion.div
                        className={`h-4 w-4 rounded-full bg-[#DAF1DE] shadow-md`}
                        layout
                        transition={{ type: "spring", stiffness: 320, damping: 26 }}
                      />
                    </button>
                  </label>
                  {isRecurring && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-[#DAF1DE]">
                      <span>Intervall:</span>
                      <input
                        type="number"
                        min={1}
                        value={intervalEvery}
                        onChange={(e) =>
                          setIntervalEvery(
                            Math.max(1, Number(e.target.value) || 1)
                          )
                        }
                        className="w-14 rounded-xl border border-[#235347]/80 bg-[#051F20]/80 px-2 py-1 text-right text-xs outline-none"
                      />
                      <select
                        value={intervalType}
                        onChange={(e) =>
                          setIntervalType(
                            e.target.value as
                              | "TAGE"
                              | "WOCHEN"
                              | "MONATE"
                              | "JAHRE"
                          )
                        }
                        className="flex-1 rounded-xl border border-[#235347]/80 bg-[#051F20]/80 px-2 py-1 text-xs outline-none"
                      >
                        <option value="TAGE">Tage</option>
                        <option value="WOCHEN">Wochen</option>
                        <option value="MONATE">Monate</option>
                        <option value="JAHRE">Jahre</option>
                      </select>
                    </div>
                  )}
                </div>

                {createError && (
                  <div className="rounded-xl border border-[#8EB69B]/70 bg-[#0B2B26]/40 px-3 py-2 text-xs text-[#DAF1DE]">
                    {createError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingExpense}
                  className="mt-1 inline-flex items-center justify-center rounded-2xl border border-[#8EB69B]/70 bg-[#8EB69B]/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#DAF1DE] shadow-[0_0_18px_rgba(142,182,155,0.6)] hover:bg-[#8EB69B]/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submittingExpense ? "VERARBEITE …" : "GELD AUSGEBEN"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
