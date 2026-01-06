"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CSRF_HEADER = "x-csrf-token";

type Expense = {
  id: string;
  purposeSnapshot: string;
  amountSnapshot: number;
  chargedAt: string;
  isRecurringSnapshot: boolean;
  intervalSnapshot: string;
  ratingStatus: string;
  ratingValue: number | null;
  definitionId: string;
};

type ExpenseDetailProps = {
  expense: Expense;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  isCurrentMonth: boolean;
  monthKey: string;
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

export default function ExpenseDetail({
  expense,
  isOpen,
  onClose,
  onRefresh,
  isCurrentMonth,
  monthKey,
}: ExpenseDetailProps) {
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [canCancelRecurring, setCanCancelRecurring] = useState(false);
  const [loadingNextCharge, setLoadingNextCharge] = useState(false);
  const [ratingState, setRatingState] = useState<RatingState>({
    q1Happy: 5,
    q2Value: 5,
    q3RepeatNow: null,
    q4NeedElsewhere: null,
    q5Planned: null,
  });
  const [ratingBusy, setRatingBusy] = useState(false);
  const [stopBusy, setStopBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && expense.isRecurringSnapshot) {
      checkNextCharge();
    } else {
      setCanCancelRecurring(false);
    }
  }, [isOpen, expense.definitionId, expense.isRecurringSnapshot]);

  const checkNextCharge = async () => {
    setLoadingNextCharge(true);
    try {
      const res = await fetch(
        `/api/expenses/definitions/${expense.definitionId}/next-charge`
      );
      if (res.ok) {
        const data = await res.json();
        setCanCancelRecurring(data.hasNextCharge || false);
      }
    } catch {
      setCanCancelRecurring(false);
    } finally {
      setLoadingNextCharge(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRating = () => {
    if (expense.ratingStatus === "LEBENSNOTWENDIG") {
      return "lebensnotwendig";
    }
    if (expense.ratingStatus === "UNBEWERTET" || expense.ratingValue === null) {
      return "unbewertet";
    }
    const value = typeof expense.ratingValue === "number" 
      ? expense.ratingValue 
      : parseFloat(String(expense.ratingValue));
    return isNaN(value) ? "unbewertet" : value.toFixed(2);
  };

  const handleUpdateRating = async (lifesaving: boolean) => {
    setError(null);

    const csrf = readCsrf();
    if (!csrf) {
      setError("Sicherheits-Token fehlt. Bitte Seite neu laden.");
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
        setError("Bitte beantworte alle Fragen oder markiere als lebensnotwendig.");
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

      const res = await fetch(`/api/expenses/${expense.id}/rate`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          [CSRF_HEADER]: csrf,
        } as Record<string, string>,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data?.message ?? "Bewertung konnte nicht aktualisiert werden.");
        return;
      }

      setShowRatingForm(false);
      onRefresh();
    } catch {
      setError("Netzwerkfehler beim Aktualisieren der Bewertung.");
    } finally {
      setRatingBusy(false);
    }
  };

  const handleStopRecurring = async () => {
    setError(null);
    const csrf = readCsrf();
    if (!csrf) {
      setError("Sicherheits-Token fehlt. Bitte Seite neu laden.");
      return;
    }

    setStopBusy(true);
    try {
      const res = await fetch(
        `/api/expenses/definitions/${expense.definitionId}/stop`,
        {
          method: "POST",
          headers: {
            [CSRF_HEADER]: csrf,
          } as Record<string, string>,
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data?.message ?? "Ausgabe konnte nicht beendet werden.");
        return;
      }

      setShowStopConfirm(false);
      onRefresh();
    } catch {
      setError("Netzwerkfehler beim Beenden der Ausgabe.");
    } finally {
      setStopBusy(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    const csrf = readCsrf();
    if (!csrf) {
      setError("Sicherheits-Token fehlt. Bitte Seite neu laden.");
      return;
    }

    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: "DELETE",
        headers: {
          [CSRF_HEADER]: csrf,
        } as Record<string, string>,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data?.message ?? "Abbuchung konnte nicht gelöscht werden.");
        return;
      }

      setShowDeleteConfirm(false);
      onClose();
      onRefresh();
    } catch {
      setError("Netzwerkfehler beim Löschen der Abbuchung.");
    } finally {
      setDeleteBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#051F20]/95 backdrop-blur-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="glass-panel flex w-full max-w-md flex-col gap-4 p-5 sm:p-6"
          initial={{ y: 40, scale: 0.98 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: 40, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 border-b border-[#235347]/70 pb-3">
            <div>
              <span className="tech-label text-[#8EB69B]">AUSGABE DETAIL</span>
              <p className="mt-1 text-sm font-medium text-[#DAF1DE]">
                {expense.purposeSnapshot}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full border border-[#235347]/80 bg-[#163832]/80 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[#8EB69B] hover:border-[#8EB69B]/80 hover:text-[#DAF1DE]"
            >
              SCHLIESSEN
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <div className="rounded-2xl border border-[#235347]/80 bg-[#163832]/80 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="tech-label text-[#8EB69B]">BETRAG</span>
                <span className="text-lg font-semibold text-[#8EB69B]">
                  {expense.amountSnapshot.toLocaleString("de-DE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  €
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="tech-label text-[#8EB69B]">DATUM</span>
                <span className="text-sm text-[#DAF1DE]">
                  {formatDate(expense.chargedAt)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="tech-label text-[#8EB69B]">BEWERTUNG</span>
                <span className="text-sm font-medium text-[#DAF1DE]">
                  {formatRating()}
                </span>
              </div>
              {expense.isRecurringSnapshot && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="tech-label text-[#8EB69B]">TYP</span>
                  <span className="text-sm text-[#DAF1DE]">
                    Wiederkehrend ({expense.intervalSnapshot})
                  </span>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-xl border border-[#8EB69B]/70 bg-[#0B2B26]/40 px-3 py-2 text-xs text-[#DAF1DE]">
                {error}
              </div>
            )}

            {!showRatingForm && !showStopConfirm && !showDeleteConfirm && (
              <div className="flex flex-col gap-2">
                {isCurrentMonth && (
                  <button
                    onClick={() => setShowRatingForm(true)}
                    className="rounded-2xl border border-[#8EB69B]/80 bg-[#8EB69B]/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#DAF1DE] hover:bg-[#8EB69B]/30"
                  >
                    BEWERTUNG ÄNDERN
                  </button>
                )}
                {expense.isRecurringSnapshot && (isCurrentMonth || canCancelRecurring) && (
                  <button
                    onClick={() => setShowStopConfirm(true)}
                    className="rounded-2xl border border-[#8EB69B]/80 bg-[#8EB69B]/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#DAF1DE] hover:bg-[#8EB69B]/30"
                    disabled={loadingNextCharge}
                  >
                    {canCancelRecurring && !isCurrentMonth
                      ? "WIEDERKEHRENDE ABBUCHUNG AB NÄCHSTER FÄLLIGKEIT BEENDEN"
                      : "WIEDERKEHRENDE ABBUCHUNG BEENDEN"}
                  </button>
                )}
                {isCurrentMonth && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="rounded-2xl border border-[#8EB69B]/80 bg-[#8EB69B]/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#DAF1DE] hover:bg-[#8EB69B]/30"
                  >
                    ABBUCHUNG LÖSCHEN
                  </button>
                )}
                {!isCurrentMonth && !expense.isRecurringSnapshot && (
                  <p className="text-xs text-[#8EB69B]">
                    Ausgaben aus vergangenen Monaten können nicht bearbeitet werden.
                  </p>
                )}
              </div>
            )}

            {showRatingForm && (
              <div className="flex flex-col gap-3">
                <span className="tech-label text-[#8EB69B]">
                  BEWERTUNG ÄNDERN
                </span>
                <SliderRow
                  label="Wie glücklich macht dich diese Ausgabe?"
                  value={ratingState.q1Happy}
                  onChange={(v) =>
                    setRatingState((s) => ({ ...s, q1Happy: v }))
                  }
                />
                <SliderRow
                  label="Wie wertvoll ist diese Ausgabe für dein Leben?"
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
                  label="Braucht dein Geld gerade eher an anderer Stelle Unterstützung?"
                  value={ratingState.q4NeedElsewhere}
                  onChange={(v) =>
                    setRatingState((s) => ({ ...s, q4NeedElsewhere: v }))
                  }
                />
                <div className="flex flex-col gap-2">
                  <span className="tech-label text-[#8EB69B]">
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
                          ? "border-[#8EB69B]/80 bg-[#8EB69B]/20 text-[#DAF1DE]"
                          : "border-[#235347]/80 bg-[#163832]/80 text-[#DAF1DE]"
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
                          ? "border-[#8EB69B]/80 bg-[#8EB69B]/15 text-[#DAF1DE]"
                          : "border-[#235347]/80 bg-[#163832]/80 text-[#DAF1DE]"
                      }`}
                    >
                      AFFEKTIV
                    </button>
                  </div>
                </div>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateRating(false)}
                    disabled={ratingBusy}
                    className="flex-1 rounded-2xl border border-[#8EB69B]/80 bg-[#8EB69B]/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#DAF1DE] hover:bg-[#8EB69B]/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {ratingBusy ? "SPEICHERE …" : "BEWERTUNG SPEICHERN"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateRating(true)}
                    disabled={ratingBusy}
                    className="flex-1 rounded-2xl border border-[#8EB69B]/80 bg-[#8EB69B]/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#DAF1DE] hover:bg-[#8EB69B]/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    LEBENSNOTWENDIGE AUSGABE
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRatingForm(false)}
                  className="rounded-2xl border border-[#235347]/80 bg-[#163832]/80 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[#8EB69B]"
                >
                  ABBRECHEN
                </button>
              </div>
            )}

            {showStopConfirm && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-[#DAF1DE]">
                  {canCancelRecurring && !isCurrentMonth
                    ? "Diese wiederkehrende Ausgabe wird ab der nächsten Fälligkeit nicht mehr abgebucht. Bereits existierende Abbuchungen bleiben unverändert."
                    : "Diese Ausgabe wird ab dem nächsten Monat nicht mehr abgebucht. Bereits existierende Abbuchungen bleiben unverändert."}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleStopRecurring}
                    disabled={stopBusy}
                    className="flex-1 rounded-2xl border border-[#8EB69B]/80 bg-[#8EB69B]/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#DAF1DE] hover:bg-[#8EB69B]/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {stopBusy ? "VERARBEITE …" : "BESTÄTIGEN"}
                  </button>
                  <button
                    onClick={() => setShowStopConfirm(false)}
                    className="flex-1 rounded-2xl border border-[#235347]/80 bg-[#163832]/80 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[#8EB69B]"
                  >
                    ABBRECHEN
                  </button>
                </div>
              </div>
            )}

            {showDeleteConfirm && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-[#DAF1DE]">
                  Diese Abbuchung wirklich löschen? Diese Aktion kann nicht
                  rückgängig gemacht werden.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleteBusy}
                    className="flex-1 rounded-2xl border border-[#8EB69B]/80 bg-[#8EB69B]/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#DAF1DE] hover:bg-[#8EB69B]/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deleteBusy ? "LÖSCHE …" : "LÖSCHEN"}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 rounded-2xl border border-[#235347]/80 bg-[#163832]/80 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[#8EB69B]"
                  >
                    ABBRECHEN
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
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
      <span className="tech-label text-[#8EB69B]">{label}</span>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-[#8EB69B]"
        />
        <span className="w-10 rounded-full border border-[#235347]/80 bg-[#051F20]/80 py-1 text-center text-xs text-[#DAF1DE]">
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
      <span className="tech-label text-[#8EB69B]">{label}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 rounded-2xl border px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] ${
            value === true
              ? "border-[#8EB69B]/80 bg-[#8EB69B]/20 text-[#DAF1DE]"
              : "border-[#235347]/80 bg-[#163832]/80 text-[#DAF1DE]"
          }`}
        >
          JA
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 rounded-2xl border px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] ${
            value === false
              ? "border-[#8EB69B]/80 bg-[#8EB69B]/20 text-[#DAF1DE]"
              : "border-[#235347]/80 bg-[#163832]/80 text-[#DAF1DE]"
          }`}
        >
          NEIN
        </button>
      </div>
    </div>
  );
}
