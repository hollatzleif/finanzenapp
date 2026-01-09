"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getMonthKey } from "@/lib/utils";

type Resolution = {
  id: string;
  type: string;
  monthKey: string;
  amountThreshold: number | null;
  ratingThreshold: number | null;
  unit: string | null;
  targetAvgRating: number | null;
  reductionAmount: number | null;
  reductionUnit: string | null;
  maxAffectiveAmount: number | null;
  maxAffectiveCount: number | null;
  maxAffectivePeriod: string | null;
  createdAt: string;
  updatedAt: string;
};

type ResolutionStatus = {
  id: string;
  isMet: boolean;
  current: number;
  target: number;
  description: string;
};

type ResolutionsViewProps = {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
};

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

function getMonthName(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString("de-DE", { month: "long", year: "numeric" });
}

function getAvailableMonths(): string[] {
  const months: string[] = [];
  const now = new Date();
  const currentMonthKey = getMonthKey(now);
  
  // Letzte 12 Monate
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(getMonthKey(date));
  }
  
  return months;
}

function getResolutionLabel(resolution: Resolution): string {
  switch (resolution.type) {
    case "UNDER_AMOUNT_FOR_RATING":
      const unit = resolution.unit === "PERCENT" ? "%" : "€";
      return `Unter ${resolution.amountThreshold?.toFixed(2)}${unit} für Ausgaben unter ${resolution.ratingThreshold?.toFixed(1)}`;
    case "TARGET_AVG_RATING":
      return `Angestrebte Durchschnittsbewertung: ${resolution.targetAvgRating?.toFixed(1)}`;
    case "LESS_THAN_LAST_MONTH":
      const redUnit = resolution.reductionUnit === "PERCENT" ? "%" : "€";
      return `${resolution.reductionAmount?.toFixed(2)}${redUnit} weniger als letzten Monat`;
    case "NO_AFFECTIVE_ABOVE_AMOUNT":
      return `Keine affektive Ausgabe über ${resolution.maxAffectiveAmount?.toFixed(2)}€`;
    case "MAX_AFFECTIVE_PER_PERIOD":
      const period = resolution.maxAffectivePeriod === "WEEK" ? "Woche" : "Monat";
      return `Maximal ${resolution.maxAffectiveCount} affektive Ausgaben pro ${period}`;
    default:
      return "Unbekannter Vorsatz";
  }
}

export default function ResolutionsView({
  isOpen,
  onClose,
  onRefresh,
}: ResolutionsViewProps) {
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>("");
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [statuses, setStatuses] = useState<ResolutionStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingResolution, setEditingResolution] = useState<Resolution | null>(null);
  const [selectedResolution, setSelectedResolution] = useState<Resolution | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Formular-Felder
  const [formType, setFormType] = useState<string>("");
  const [formAmountThreshold, setFormAmountThreshold] = useState("");
  const [formRatingThreshold, setFormRatingThreshold] = useState("");
  const [formUnit, setFormUnit] = useState<"EURO" | "PERCENT">("EURO");
  const [formTargetAvgRating, setFormTargetAvgRating] = useState("");
  const [formReductionAmount, setFormReductionAmount] = useState("");
  const [formReductionUnit, setFormReductionUnit] = useState<"EURO" | "PERCENT">("EURO");
  const [formMaxAffectiveAmount, setFormMaxAffectiveAmount] = useState("");
  const [formMaxAffectiveCount, setFormMaxAffectiveCount] = useState("");
  const [formMaxAffectivePeriod, setFormMaxAffectivePeriod] = useState<"WEEK" | "MONTH">("MONTH");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      setSelectedMonthKey(getMonthKey(now));
      setShowCreateForm(false);
      setEditingResolution(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && selectedMonthKey) {
      loadResolutions();
      loadStatuses();
    }
  }, [isOpen, selectedMonthKey]);

  const loadResolutions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/resolutions?monthKey=${selectedMonthKey}`);
      if (res.ok) {
        const data = await res.json();
        setResolutions(data);
      }
    } catch {
      setError("Fehler beim Laden der Vorsätze.");
    } finally {
      setLoading(false);
    }
  };

  const loadStatuses = async () => {
    try {
      const res = await fetch(`/api/resolutions/status?monthKey=${selectedMonthKey}`);
      if (res.ok) {
        const data = await res.json();
        setStatuses(data);
      }
    } catch {
      // Fehler ignorieren
    }
  };

  const handleCreate = () => {
    setFormType("");
    setFormAmountThreshold("");
    setFormRatingThreshold("");
    setFormUnit("EURO");
    setFormTargetAvgRating("");
    setFormReductionAmount("");
    setFormReductionUnit("EURO");
    setFormMaxAffectiveAmount("");
    setFormMaxAffectiveCount("");
    setFormMaxAffectivePeriod("MONTH");
    setError(null);
    setShowCreateForm(true);
    setEditingResolution(null);
  };

  const handleEdit = (resolution: Resolution) => {
    setFormType(resolution.type);
    setFormAmountThreshold(resolution.amountThreshold?.toString() || "");
    setFormRatingThreshold(resolution.ratingThreshold?.toString() || "");
    setFormUnit((resolution.unit as "EURO" | "PERCENT") || "EURO");
    setFormTargetAvgRating(resolution.targetAvgRating?.toString() || "");
    setFormReductionAmount(resolution.reductionAmount?.toString() || "");
    setFormReductionUnit((resolution.reductionUnit as "EURO" | "PERCENT") || "EURO");
    setFormMaxAffectiveAmount(resolution.maxAffectiveAmount?.toString() || "");
    setFormMaxAffectiveCount(resolution.maxAffectiveCount?.toString() || "");
    setFormMaxAffectivePeriod((resolution.maxAffectivePeriod as "WEEK" | "MONTH") || "MONTH");
    setError(null);
    setShowCreateForm(true);
    setEditingResolution(resolution);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Vorsatz wirklich löschen?")) return;

    const csrf = readCsrf();
    if (!csrf) {
      setError("Sicherheits-Token fehlt.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/resolutions/${id}`, {
        method: "DELETE",
        headers: {
          [CSRF_HEADER]: csrf,
        } as Record<string, string>,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data?.message || "Fehler beim Löschen.");
        return;
      }

      await loadResolutions();
      await loadStatuses();
      onRefresh();
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formType) {
      setError("Bitte wähle einen Vorsatz-Typ.");
      return;
    }

    const csrf = readCsrf();
    if (!csrf) {
      setError("Sicherheits-Token fehlt.");
      return;
    }

    setSubmitting(true);
    try {
      const body: any = {
        type: formType,
        monthKey: selectedMonthKey,
      };

      if (formType === "UNDER_AMOUNT_FOR_RATING") {
        body.amountThreshold = parseFloat(formAmountThreshold);
        body.ratingThreshold = parseFloat(formRatingThreshold);
        body.unit = formUnit;
      } else if (formType === "TARGET_AVG_RATING") {
        body.targetAvgRating = parseFloat(formTargetAvgRating);
      } else if (formType === "LESS_THAN_LAST_MONTH") {
        body.reductionAmount = parseFloat(formReductionAmount);
        body.reductionUnit = formReductionUnit;
      } else if (formType === "NO_AFFECTIVE_ABOVE_AMOUNT") {
        body.maxAffectiveAmount = parseFloat(formMaxAffectiveAmount);
      } else if (formType === "MAX_AFFECTIVE_PER_PERIOD") {
        body.maxAffectiveCount = parseInt(formMaxAffectiveCount);
        body.maxAffectivePeriod = formMaxAffectivePeriod;
      }

      const url = editingResolution
        ? `/api/resolutions/${editingResolution.id}`
        : "/api/resolutions";
      const method = editingResolution ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          [CSRF_HEADER]: csrf,
        } as Record<string, string>,
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || "Fehler beim Speichern.");
        return;
      }

      setShowCreateForm(false);
      setEditingResolution(null);
      await loadResolutions();
      await loadStatuses();
      onRefresh();
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatus = (id: string): ResolutionStatus | null => {
    return statuses.find((s) => s.id === id) || null;
  };

  // Erstelle 3x3 Grid (9 Slots)
  const gridSlots = useMemo(() => {
    const slots: (Resolution | null)[] = [];
    for (let i = 0; i < 9; i++) {
      slots.push(resolutions[i] || null);
    }
    return slots;
  }, [resolutions]);

  const availableMonths = getAvailableMonths();
  const canAddMore = resolutions.length < 9;

  return (
    <div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="resolutions-modal"
            className="fixed inset-0 z-40 flex items-center justify-center bg-[#051F20]/90 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
          <motion.div
            className="glass-panel flex w-full max-w-4xl flex-col gap-4 p-5 sm:p-6"
            initial={{ y: 40, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                {canAddMore && !showCreateForm && (
                  <button
                    onClick={handleCreate}
                    className="rounded-full border border-[#8EB69B]/80 bg-[#8EB69B]/20 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-[#DAF1DE] hover:bg-[#8EB69B]/30"
                  >
                    +
                  </button>
                )}
                <div>
                  <span className="tech-label text-[#8EB69B]">VORSÄTZE</span>
                  <p className="mt-1 text-xs text-[#DAF1DE]">
                    Setze dir Ziele für deine Ausgaben
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedMonthKey}
                  onChange={(e) => setSelectedMonthKey(e.target.value)}
                  className="rounded-xl border border-[#235347]/80 bg-[#163832]/80 px-3 py-1.5 text-xs text-[#DAF1DE] outline-none"
                >
                  {availableMonths.map((key) => (
                    <option key={key} value={key}>
                      {getMonthName(key)}
                    </option>
                  ))}
                </select>
                <button
                  onClick={onClose}
                  className="rounded-full border border-[#235347]/80 bg-[#163832]/80 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[#8EB69B] hover:border-[#8EB69B]/80 hover:text-[#DAF1DE]"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Formular */}
            {showCreateForm && (
              <motion.div
                className="rounded-2xl border border-[#235347]/80 bg-[#163832]/80 p-4"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <div>
                    <label className="tech-label text-[#8EB69B] text-xs">
                      VORSATZ-TYP
                    </label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[#235347]/80 bg-[#051F20]/80 px-3 py-2 text-xs text-[#DAF1DE] outline-none"
                      disabled={!!editingResolution}
                    >
                      <option value="">Bitte wählen</option>
                      <option value="UNDER_AMOUNT_FOR_RATING">
                        Unter X €/% für Ausgaben unter Y Bewertung
                      </option>
                      <option value="TARGET_AVG_RATING">
                        Angestrebte Durchschnittsbewertung
                      </option>
                      <option value="LESS_THAN_LAST_MONTH">
                        X €/% weniger als letzten Monat
                      </option>
                      <option value="NO_AFFECTIVE_ABOVE_AMOUNT">
                        Keine affektive Ausgabe über X €
                      </option>
                      <option value="MAX_AFFECTIVE_PER_PERIOD">
                        Maximal X affektive Ausgaben pro Woche/Monat
                      </option>
                    </select>
                  </div>

                  {formType === "UNDER_AMOUNT_FOR_RATING" && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="tech-label text-[#8EB69B] text-xs">
                            BETRAG
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={formAmountThreshold}
                            onChange={(e) => setFormAmountThreshold(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-[#235347]/80 bg-[#051F20]/80 px-3 py-2 text-xs text-[#DAF1DE] outline-none"
                            required
                          />
                        </div>
                        <div>
                          <label className="tech-label text-[#8EB69B] text-xs">
                            EINHEIT
                          </label>
                          <select
                            value={formUnit}
                            onChange={(e) =>
                              setFormUnit(e.target.value as "EURO" | "PERCENT")
                            }
                            className="mt-1 w-full rounded-xl border border-[#235347]/80 bg-[#051F20]/80 px-3 py-2 text-xs text-[#DAF1DE] outline-none"
                          >
                            <option value="EURO">€</option>
                            <option value="PERCENT">%</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="tech-label text-[#8EB69B] text-xs">
                          BEWERTUNG (unter)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          value={formRatingThreshold}
                          onChange={(e) => setFormRatingThreshold(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-[#235347]/80 bg-[#051F20]/80 px-3 py-2 text-xs text-[#DAF1DE] outline-none"
                          required
                        />
                      </div>
                    </>
                  )}

                  {formType === "TARGET_AVG_RATING" && (
                    <div>
                      <label className="tech-label text-[#8EB69B] text-xs">
                        ZIEL-BEWERTUNG
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={formTargetAvgRating}
                        onChange={(e) => setFormTargetAvgRating(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[#235347]/80 bg-[#051F20]/80 px-3 py-2 text-xs text-[#DAF1DE] outline-none"
                        required
                      />
                    </div>
                  )}

                  {formType === "LESS_THAN_LAST_MONTH" && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="tech-label text-[#8EB69B] text-xs">
                            REDUKTION
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={formReductionAmount}
                            onChange={(e) => setFormReductionAmount(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-[#235347]/80 bg-[#051F20]/80 px-3 py-2 text-xs text-[#DAF1DE] outline-none"
                            required
                          />
                        </div>
                        <div>
                          <label className="tech-label text-[#8EB69B] text-xs">
                            EINHEIT
                          </label>
                          <select
                            value={formReductionUnit}
                            onChange={(e) =>
                              setFormReductionUnit(e.target.value as "EURO" | "PERCENT")
                            }
                            className="mt-1 w-full rounded-xl border border-[#235347]/80 bg-[#051F20]/80 px-3 py-2 text-xs text-[#DAF1DE] outline-none"
                          >
                            <option value="EURO">€</option>
                            <option value="PERCENT">%</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {formType === "NO_AFFECTIVE_ABOVE_AMOUNT" && (
                    <div>
                      <label className="tech-label text-[#8EB69B] text-xs">
                        MAXIMALER BETRAG (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formMaxAffectiveAmount}
                        onChange={(e) => setFormMaxAffectiveAmount(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[#235347]/80 bg-[#051F20]/80 px-3 py-2 text-xs text-[#DAF1DE] outline-none"
                        required
                      />
                    </div>
                  )}

                  {formType === "MAX_AFFECTIVE_PER_PERIOD" && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="tech-label text-[#8EB69B] text-xs">
                            MAX. ANZAHL
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={formMaxAffectiveCount}
                            onChange={(e) => setFormMaxAffectiveCount(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-[#235347]/80 bg-[#051F20]/80 px-3 py-2 text-xs text-[#DAF1DE] outline-none"
                            required
                          />
                        </div>
                        <div>
                          <label className="tech-label text-[#8EB69B] text-xs">
                            ZEITRAUM
                          </label>
                          <select
                            value={formMaxAffectivePeriod}
                            onChange={(e) =>
                              setFormMaxAffectivePeriod(e.target.value as "WEEK" | "MONTH")
                            }
                            className="mt-1 w-full rounded-xl border border-[#235347]/80 bg-[#051F20]/80 px-3 py-2 text-xs text-[#DAF1DE] outline-none"
                          >
                            <option value="WEEK">Woche</option>
                            <option value="MONTH">Monat</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {error && (
                    <div className="rounded-xl border border-[#8EB69B]/70 bg-[#0B2B26]/40 px-3 py-2 text-xs text-[#DAF1DE]">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 rounded-2xl border border-[#8EB69B]/80 bg-[#8EB69B]/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#DAF1DE] hover:bg-[#8EB69B]/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? "SPEICHERE …" : editingResolution ? "AKTUALISIEREN" : "ERSTELLEN"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        setEditingResolution(null);
                        setError(null);
                      }}
                      className="rounded-2xl border border-[#235347]/80 bg-[#163832]/80 px-3 py-2 text-xs uppercase tracking-[0.18em] text-[#DAF1DE] hover:bg-[#235347]/80"
                    >
                      ABBRECHEN
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* Grid */}
            {!showCreateForm && (
              <div className="grid grid-cols-3 gap-3">
                {gridSlots.map((resolution, index) => {
                  const status = resolution ? getStatus(resolution.id) : null;
                  const isMet = status?.isMet ?? false;

                  return (
                    <motion.div
                      key={resolution?.id || `empty-slot-${selectedMonthKey}-${index}`}
                      className={`relative rounded-2xl border p-3 ${
                        resolution
                          ? isMet
                            ? "border-[#8EB69B]/80 bg-[#8EB69B]/10"
                            : "border-[#235347]/80 bg-[#163832]/80"
                          : "border-[#235347]/40 bg-[#051F20]/40"
                      }`}
                      whileHover={resolution ? { scale: 1.02 } : {}}
                      onClick={() => {
                        if (resolution) {
                          setSelectedResolution(resolution);
                        } else if (canAddMore) {
                          handleCreate();
                        }
                      }}
                      style={{ cursor: resolution || canAddMore ? "pointer" : "default" }}
                    >
                      {resolution ? (
                        <>
                          <div className="mb-2">
                            <p className="text-[10px] text-[#8EB69B] line-clamp-2">
                              {getResolutionLabel(resolution)}
                            </p>
                          </div>
                          {status && (
                            <div className="mt-2">
                              <div className="mb-1 flex items-center justify-between text-[10px]">
                                <span className="text-[#DAF1DE]">
                                  {status.description}
                                </span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#051F20]/80">
                                <motion.div
                                  className={`h-full ${
                                    isMet ? "bg-[#8EB69B]" : "bg-[#DAF1DE]"
                                  }`}
                                  initial={{ width: 0 }}
                                  animate={{
                                    width: status.target > 0
                                      ? `${Math.min(100, (status.current / status.target) * 100)}%`
                                      : isMet
                                      ? "100%"
                                      : "0%",
                                  }}
                                  transition={{ duration: 0.5 }}
                                />
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex h-full items-center justify-center text-[#235347]">
                          <span className="text-2xl">+</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}

            {loading && (
              <p className="text-center text-xs text-[#8EB69B]">Lade …</p>
            )}
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Bearbeiten/Löschen Modal */}
      <AnimatePresence>
        {selectedResolution && (
          <motion.div
            key={`resolution-action-${selectedResolution.id}`}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#051F20]/90 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedResolution(null)}
          >
            <motion.div
              className="glass-panel flex w-full max-w-sm flex-col gap-4 p-5 sm:p-6"
              initial={{ y: 40, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 40, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="tech-label text-[#8EB69B]">VORSATZ</span>
                  <p className="mt-1 text-xs text-[#DAF1DE]">
                    {getResolutionLabel(selectedResolution)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedResolution(null)}
                  className="rounded-full border border-[#235347]/80 bg-[#163832]/80 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[#8EB69B] hover:border-[#8EB69B]/80 hover:text-[#DAF1DE]"
                >
                  ✕
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    handleEdit(selectedResolution);
                    setSelectedResolution(null);
                  }}
                  className="flex-1 rounded-2xl border border-[#8EB69B]/80 bg-[#8EB69B]/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#DAF1DE] hover:bg-[#8EB69B]/30"
                >
                  BEARBEITEN
                </button>
                <button
                  onClick={() => {
                    handleDelete(selectedResolution.id);
                    setSelectedResolution(null);
                  }}
                  className="flex-1 rounded-2xl border border-[#235347]/80 bg-[#163832]/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#DAF1DE] hover:bg-[#235347]/80 hover:border-[#8EB69B]/80"
                >
                  LÖSCHEN
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
