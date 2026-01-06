"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ExpenseOverview from "./ExpenseOverview";
import StatisticsView from "./StatisticsView";

const CSRF_HEADER = "x-csrf-token";

type Summary = {
  monthKey: string;
  monthName: string;
  totalSpent: number;
  countUnrated: number;
};

type UnratedItem = {
  id: string;
  purposeSnapshot: string;
  amountSnapshot: number;
  chargedAt: string;
  isRecurringSnapshot: boolean;
  intervalSnapshot: string;
  ratingStatus: string;
  timesCharged?: number;
  totalPaid?: number;
};

type RatingState = {
  q1Happy: number;
  q2Value: number;
  q3RepeatNow: boolean | null;
  q4NeedElsewhere: boolean | null;
  q5Planned: "DURCHDACHT" | "AFFEKTIV" | null;
};

function readCsrf(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("finanzapp_csrf="));
  if (!match) return null;
  return decodeURIComponent(match.split("=")[1]);
}

export default function HomeShell() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [statisticsOpen, setStatisticsOpen] = useState(false);
  const [unrated, setUnrated] = useState<UnratedItem[]>([]);
  const [loadingUnrated, setLoadingUnrated] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [intervalType, setIntervalType] = useState<
    "TAGE" | "WOCHEN" | "MONATE" | "JAHRE"
  >("MONATE");
  const [intervalEvery, setIntervalEvery] = useState(1);
  const [submittingExpense, setSubmittingExpense] = useState(false);

  const [ratingIndex, setRatingIndex] = useState(0);
  const [ratingState, setRatingState] = useState<RatingState>({
    q1Happy: 5,
    q2Value: 5,
    q3RepeatNow: null,
    q4NeedElsewhere: null,
    q5Planned: null,
  });
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  const currentToRate = unrated[ratingIndex] ?? null;

  const monthSummaryLabel = useMemo(() => {
    if (!summary) return "Lade Monat …";
    const sumFormatted = summary.totalSpent.toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${summary.monthName}: ${sumFormatted} €`;
  }, [summary]);

  useEffect(() => {
    // CSRF-Cookie einmal sicherstellen
    fetch("/api/auth/me").finally(() => {
      reloadSummary();
    });
  }, []);

  const reloadSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await fetch("/api/expenses/summary/current-month", {
        cache: "no-store",
      });
      if (!res.ok) {
        setSummary(null);
        return;
      }
      const data = (await res.json()) as Summary;
      setSummary(data);
    } finally {
      setLoadingSummary(false);
    }
  };

  const reloadUnrated = async () => {
    setLoadingUnrated(true);
    try {
      const res = await fetch("/api/expenses/unrated/current-month", {
        cache: "no-store",
      });
      if (!res.ok) {
        setUnrated([]);
        return;
      }
      const data = (await res.json()) as UnratedItem[];
      setUnrated(data);
      setRatingIndex(0);
      setRatingState({
        q1Happy: 5,
        q2Value: 5,
        q3RepeatNow: null,
        q4NeedElsewhere: null,
        q5Planned: null,
      });
    } finally {
      setLoadingUnrated(false);
    }
  };

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
      reloadSummary();
      reloadUnrated();
      setDrawerOpen(false);
    } catch {
      setCreateError("Netzwerkfehler beim Erstellen der Ausgabe.");
    } finally {
      setSubmittingExpense(false);
    }
  };

  const handleOpenRating = () => {
    setRatingError(null);
    reloadUnrated();
    setRatingOpen(true);
  };

  const handleRate = async (lifesaving: boolean) => {
    if (!currentToRate) return;
    setRatingError(null);

    const csrf = readCsrf();
    if (!csrf) {
      setRatingError(
        "Sicherheits-Token fehlt. Bitte Seite neu laden und erneut versuchen."
      );
      return;
    }

    if (!lifesaving) {
      const { q1Happy, q2Value, q3RepeatNow, q4NeedElsewhere, q5Planned } =
        ratingState;
      if (
        q3RepeatNow === null ||
        q4NeedElsewhere === null ||
        q5Planned === null
      ) {
        setRatingError("Bitte beantworte alle Fragen oder markiere als lebensnotwendig.");
        return;
      }
    }

    setRatingBusy(true);
    try {
      const body = lifesaving
        ? { lifesaving: true }
        : {
            q1Happy: ratingState.q1Happy,
            q2Value: ratingState.q2Value,
            q3RepeatNow: ratingState.q3RepeatNow,
            q4NeedElsewhere: ratingState.q4NeedElsewhere,
            q5Planned: ratingState.q5Planned,
          };

      const res = await fetch(`/api/expenses/${currentToRate.id}/rate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [CSRF_HEADER]: csrf,
        } as Record<string, string>,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setRatingError(
          data?.message ?? "Bewertung konnte nicht gespeichert werden."
        );
        return;
      }

      const nextIndex = ratingIndex + 1;
      if (nextIndex >= unrated.length) {
        await reloadSummary();
        await reloadUnrated();
        setRatingOpen(false);
      } else {
        setRatingIndex(nextIndex);
        setRatingState({
          q1Happy: 5,
          q2Value: 5,
          q3RepeatNow: null,
          q4NeedElsewhere: null,
          q5Planned: null,
        });
      }
    } catch {
      setRatingError("Netzwerkfehler beim Speichern der Bewertung.");
    } finally {
      setRatingBusy(false);
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
    window.location.href = "/auth";
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="tech-label text-sky-400/70">
            FINANZAPP // MONATSÜBERSICHT
          </span>
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-semibold tracking-[0.24em] text-slate-100 sm:text-3xl">
              DEIN GELDFLUSS
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
            <div className="flex items-center justify-between gap-3">
              <span className="tech-label text-[0.65rem] text-slate-400">
                AKTUELLER MONAT
              </span>
              {summary && (
                <span className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-2 py-0.5 text-[0.64rem] uppercase tracking-[0.18em] text-emerald-200">
                  {summary.countUnrated} UNBEWERTET
                </span>
              )}
            </div>
            <div className="mt-1 text-sm font-medium text-slate-50">
              {loadingSummary ? "Lädt …" : monthSummaryLabel}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="hidden rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-slate-400 hover:border-rose-500/80 hover:text-rose-200 sm:block"
          >
            ABMELDEN
          </button>
        </div>
      </div>

      {/* Hauptpanel */}
      <div className="glass-panel flex flex-col gap-5 p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="tech-label text-slate-400">
              HANDLUNGSFELDER DIESES MONATS
            </span>
            <p className="text-sm text-slate-300">
              Trage Ausgaben ein, beobachte dein Verhalten und bewerte, was sich{" "}
              <span className="text-sky-300">wirklich gut</span> anfühlt – und
              was vielleicht nur{" "}
              <span className="text-indigo-300">Gewohnheit</span> ist.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center justify-center rounded-2xl border border-cyan-400/70 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.21em] text-cyan-200 shadow-[0_0_18px_rgba(56,189,248,0.5)] hover:bg-cyan-500/20"
            >
              AUSGABE HINZUFÜGEN
            </button>
            <button
              onClick={handleOpenRating}
              className="inline-flex items-center justify-center rounded-2xl border border-indigo-400/70 bg-indigo-500/10 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.21em] text-indigo-200 hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={summary?.countUnrated === 0}
            >
              AUSGABEN BEWERTEN
            </button>
            <button
              onClick={() => setOverviewOpen(true)}
              className="inline-flex items-center justify-center rounded-2xl border border-purple-400/70 bg-purple-500/10 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.21em] text-purple-200 hover:bg-purple-500/20"
            >
              VERGANGENE AUSGABEN
            </button>
            <button
              onClick={() => setStatisticsOpen(true)}
              className="inline-flex items-center justify-center rounded-2xl border border-emerald-400/70 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.21em] text-emerald-200 hover:bg-emerald-500/20"
            >
              STATISTIKEN
            </button>
          </div>
        </div>

        {/* Kleinere Kennzahlen */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 px-4 py-3">
            <span className="tech-label text-[0.68rem] text-slate-400">
              MONATLICHE SUMME
            </span>
            <p className="mt-1 text-xl font-semibold text-slate-50">
              {summary
                ? `${summary.totalSpent.toLocaleString("de-DE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} €`
                : "–"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 px-4 py-3">
            <span className="tech-label text-[0.68rem] text-slate-400">
              UNBEWERTET
            </span>
            <p className="mt-1 text-xl font-semibold text-amber-300">
              {summary ? summary.countUnrated : "–"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 px-4 py-3">
            <span className="tech-label text-[0.68rem] text-slate-400">
              FOKUS
            </span>
            <p className="mt-1 text-xs text-slate-300">
              Wiederkehrende Ausgaben werden automatisch zum Fälligkeitstag
              erzeugt. Du siehst hier immer den aktuellen Monat.
            </p>
          </div>
        </div>
      </div>

      {/* Drawer: Ausgabe hinzufügen */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/70 backdrop-blur-md sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-lg rounded-t-3xl border border-slate-700/80 bg-slate-950/95 p-5 shadow-[0_0_40px_rgba(15,23,42,0.95)] sm:rounded-3xl sm:border-slate-600/80 sm:p-6"
              initial={{ y: 80 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <span className="tech-label text-slate-400">
                    NEUE AUSGABE
                  </span>
                  <p className="mt-1 text-sm text-slate-200">
                    Erfasse eine einmalige oder wiederkehrende Abbuchung.
                  </p>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-full border border-slate-600/80 bg-slate-900/80 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400 hover:border-rose-500/80 hover:text-rose-200"
                >
                  SCHLIESSEN
                </button>
              </div>

              <form onSubmit={handleCreateExpense} className="flex flex-col gap-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="tech-label text-slate-400" htmlFor="amount">
                      BETRAG
                    </label>
                    <input
                      id="amount"
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                      placeholder="z.B. 42,50"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="tech-label text-slate-400" htmlFor="purpose">
                      ZWECK
                    </label>
                    <input
                      id="purpose"
                      type="text"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                      placeholder="z.B. Netflix, Miete, Kaffee"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/80 px-3 py-2">
                  <label className="flex items-center justify-between gap-2">
                    <span className="tech-label text-slate-400">
                      REGELMÄSSIG?
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsRecurring((v) => !v)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full border border-slate-600/80 bg-slate-950/80 px-0.5 transition ${
                        isRecurring ? "border-cyan-400/80" : ""
                      }`}
                    >
                      <motion.div
                        className={`h-4 w-4 rounded-full bg-slate-300 shadow-md`}
                        layout
                        transition={{ type: "spring", stiffness: 320, damping: 26 }}
                      />
                    </button>
                  </label>
                  {isRecurring && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-300">
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
                        className="w-14 rounded-xl border border-slate-700/80 bg-slate-950/80 px-2 py-1 text-right text-xs outline-none"
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
                        className="flex-1 rounded-xl border border-slate-700/80 bg-slate-950/80 px-2 py-1 text-xs outline-none"
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
                  <div className="rounded-xl border border-rose-500/70 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
                    {createError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingExpense}
                  className="mt-1 inline-flex items-center justify-center rounded-2xl border border-emerald-400/70 bg-emerald-500/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100 shadow-[0_0_18px_rgba(34,197,94,0.6)] hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submittingExpense ? "VERARBEITE …" : "GELD AUSGEBEN"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bewertungs-Overlay */}
      <AnimatePresence>
        {ratingOpen && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="glass-panel flex w-full max-w-md flex-col gap-4 p-5 sm:p-6"
              initial={{ y: 40, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 40, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="tech-label text-slate-400">
                    AUSGABE BEWERTEN
                  </span>
                  <p className="mt-1 text-xs text-slate-300">
                    Wie bewertest du diese Ausgabe?
                  </p>
                </div>
                <button
                  onClick={() => setRatingOpen(false)}
                  className="rounded-full border border-slate-600/80 bg-slate-900/80 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400 hover:border-rose-500/80 hover:text-rose-200"
                >
                  ABBRECHEN
                </button>
              </div>

              {loadingUnrated && <p className="text-xs text-slate-400">Lade …</p>}

              {!loadingUnrated && !currentToRate && (
                <p className="text-xs text-slate-300">
                  Aktuell gibt es keine unbewerteten Ausgaben im laufenden Monat.
                </p>
              )}

              {currentToRate && (
                <>
                  <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 px-4 py-3">
                    <p className="text-sm font-medium text-slate-50">
                      {currentToRate.purposeSnapshot}
                    </p>
                    <p className="mt-1 text-sm text-sky-300">
                      {currentToRate.amountSnapshot.toLocaleString("de-DE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      €
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {currentToRate.isRecurringSnapshot
                        ? `Wiederkehrend (${currentToRate.intervalSnapshot})`
                        : "Einmalige Ausgabe"}
                    </p>
                    {currentToRate.isRecurringSnapshot &&
                      currentToRate.timesCharged &&
                      currentToRate.totalPaid !== undefined && (
                        <p className="mt-1 text-[11px] text-slate-400">
                          Bisher abgebucht: {currentToRate.timesCharged}× ·
                          insgesamt{" "}
                          {currentToRate.totalPaid.toLocaleString("de-DE", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          €
                        </p>
                      )}
                  </div>

                  <div className="flex flex-col gap-3">
                    <SliderRow
                      label="Wie glücklich hat dich diese Ausgabe gemacht?"
                      value={ratingState.q1Happy}
                      onChange={(v) =>
                        setRatingState((s) => ({ ...s, q1Happy: v }))
                      }
                    />
                    <SliderRow
                      label="Wie war das Preis-Leistungs-Verhältnis dieser Ausgabe?"
                      value={ratingState.q2Value}
                      onChange={(v) =>
                        setRatingState((s) => ({ ...s, q2Value: v }))
                      }
                    />

                    <ToggleRow
                      label="Würdest du diese Ausgabe jetzt sofort wiederholen?"
                      value={ratingState.q3RepeatNow}
                      onChange={(v) =>
                        setRatingState((s) => ({ ...s, q3RepeatNow: v }))
                      }
                    />
                    <ToggleRow
                      label="Fehlt dir das Geld gerade an anderer Stelle?"
                      value={ratingState.q4NeedElsewhere}
                      onChange={(v) =>
                        setRatingState((s) => ({ ...s, q4NeedElsewhere: v }))
                      }
                    />

                    <div className="flex flex-col gap-2">
                      <span className="tech-label text-slate-400">
                        WIE ENTSTAND DIESE AUSGABE?
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setRatingState((s) => ({
                              ...s,
                              q5Planned: "DURCHDACHT",
                            }))
                          }
                          className={`flex-1 rounded-2xl border px-3 py-2 text-[11px] uppercase tracking-[0.16em] ${
                            ratingState.q5Planned === "DURCHDACHT"
                              ? "border-emerald-400/80 bg-emerald-500/20 text-emerald-100"
                              : "border-slate-700/80 bg-slate-900/80 text-slate-300"
                          }`}
                        >
                          DURCHDACHT
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setRatingState((s) => ({
                              ...s,
                              q5Planned: "AFFEKTIV",
                            }))
                          }
                          className={`flex-1 rounded-2xl border px-3 py-2 text-[11px] uppercase tracking-[0.16em] ${
                            ratingState.q5Planned === "AFFEKTIV"
                              ? "border-amber-400/80 bg-amber-500/15 text-amber-100"
                              : "border-slate-700/80 bg-slate-900/80 text-slate-300"
                          }`}
                        >
                          AFFEKTIV
                        </button>
                      </div>
                    </div>
                  </div>

                  {ratingError && (
                    <div className="rounded-xl border border-rose-500/70 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
                      {ratingError}
                    </div>
                  )}

                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleRate(false)}
                      disabled={ratingBusy}
                      className="flex-1 rounded-2xl border border-indigo-400/80 bg-indigo-500/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-100 hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {ratingBusy ? "SPEICHERE …" : "BEWERTUNG SPEICHERN"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRate(true)}
                      disabled={ratingBusy}
                      className="flex-1 rounded-2xl border border-emerald-400/80 bg-emerald-500/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      LEBENSNOTWENDIGE AUSGABE
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ausgaben-Übersicht */}
      <ExpenseOverview
        isOpen={overviewOpen}
        onClose={() => setOverviewOpen(false)}
        onRefresh={() => {
          reloadSummary();
          reloadUnrated();
        }}
      />

      {/* Statistiken */}
      <StatisticsView
        isOpen={statisticsOpen}
        onClose={() => setStatisticsOpen(false)}
        onRefresh={() => {
          reloadSummary();
        }}
      />
    </div>
  );
}

type SliderRowProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

function SliderRow({ label, value, onChange }: SliderRowProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="tech-label text-slate-400">{label}</span>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-cyan-400"
        />
        <span className="w-10 rounded-full border border-slate-700/80 bg-slate-950/80 py-1 text-center text-xs text-slate-100">
          {value}
        </span>
      </div>
    </div>
  );
}

type ToggleRowProps = {
  label: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
};

function ToggleRow({ label, value, onChange }: ToggleRowProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="tech-label text-slate-400">{label}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 rounded-2xl border px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] ${
            value === true
              ? "border-emerald-400/80 bg-emerald-500/20 text-emerald-100"
              : "border-slate-700/80 bg-slate-900/80 text-slate-300"
          }`}
        >
          JA
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 rounded-2xl border px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] ${
            value === false
              ? "border-rose-400/80 bg-rose-500/20 text-rose-100"
              : "border-slate-700/80 bg-slate-900/80 text-slate-300"
          }`}
        >
          NEIN
        </button>
      </div>
    </div>
  );
}

