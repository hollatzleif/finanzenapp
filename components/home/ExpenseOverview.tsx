"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ExpenseDetail from "./ExpenseDetail";

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

type SortOption = {
  sortBy: "rating" | "date" | "amount";
  order: "asc" | "desc";
  label: string;
};

const sortOptions: SortOption[] = [
  { sortBy: "date", order: "desc", label: "Datum ↓ (neueste zuerst)" },
  { sortBy: "date", order: "asc", label: "Datum ↑ (älteste zuerst)" },
  { sortBy: "rating", order: "desc", label: "Bewertung ↓ (höchste zuerst)" },
  { sortBy: "rating", order: "asc", label: "Bewertung ↑ (niedrigste zuerst)" },
  { sortBy: "amount", order: "desc", label: "Betrag ↓ (höchste zuerst)" },
  { sortBy: "amount", order: "asc", label: "Betrag ↑ (niedrigste zuerst)" },
];

type ExpenseOverviewProps = {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
};

function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString("de-DE", { month: "long", year: "numeric" });
}

function getPreviousMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return getMonthKey(date);
}

function getNextMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month, 1);
  return getMonthKey(date);
}

export default function ExpenseOverview({
  isOpen,
  onClose,
  onRefresh,
}: ExpenseOverviewProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [monthName, setMonthName] = useState("");
  const [monthKey, setMonthKey] = useState<string>("");
  const [isCurrentMonth, setIsCurrentMonth] = useState(true);
  const [sortOption, setSortOption] = useState<SortOption>(sortOptions[0]);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const currentMonthKey = getMonthKey(now);
      setMonthKey(currentMonthKey);
      loadExpenses(currentMonthKey);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && monthKey) {
      loadExpenses(monthKey);
    }
  }, [monthKey, sortOption]);

  const loadExpenses = async (targetMonthKey: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/expenses/current-month?monthKey=${targetMonthKey}&sortBy=${sortOption.sortBy}&order=${sortOption.order}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        setExpenses([]);
        return;
      }
      const data = await res.json();
      setExpenses(data.expenses || []);
      setMonthName(data.monthName || "");
      setIsCurrentMonth(data.isCurrentMonth || false);
    } finally {
      setLoading(false);
    }
  };

  const handleExpenseClick = (expense: Expense) => {
    setSelectedExpense(expense);
    setDetailOpen(true);
  };

  const handleDetailClose = () => {
    setDetailOpen(false);
    setSelectedExpense(null);
    loadExpenses(monthKey);
    onRefresh();
  };

  const handlePreviousMonth = () => {
    const prev = getPreviousMonth(monthKey);
    setMonthKey(prev);
  };

  const handleNextMonth = () => {
    if (!isCurrentMonth) {
      const next = getNextMonth(monthKey);
      const now = new Date();
      const currentMonthKey = getMonthKey(now);
      if (next <= currentMonthKey) {
        setMonthKey(next);
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatRating = (expense: Expense) => {
    if (expense.ratingStatus === "LEBENSNOTWENDIG") {
      return "lebensnotwendig";
    }
    if (expense.ratingStatus === "UNBEWERTET" || expense.ratingValue === null) {
      return "—";
    }
    const value = typeof expense.ratingValue === "number" 
      ? expense.ratingValue 
      : parseFloat(String(expense.ratingValue));
    return isNaN(value) ? "—" : value.toFixed(2);
  };

  const getRatingColor = (expense: Expense) => {
    if (expense.ratingStatus === "LEBENSNOTWENDIG") {
      return "text-[#8EB69B]";
    }
    if (expense.ratingStatus === "UNBEWERTET" || expense.ratingValue === null) {
      return "text-[#8EB69B]";
    }
    const value = typeof expense.ratingValue === "number" 
      ? expense.ratingValue 
      : parseFloat(String(expense.ratingValue));
    if (isNaN(value)) return "text-[#8EB69B]";
    if (value >= 8) return "text-[#8EB69B]";
    if (value >= 6) return "text-[#8EB69B]";
    if (value >= 4) return "text-[#8EB69B]";
    return "text-[#8EB69B]";
  };

  if (!isOpen) return null;

  const now = new Date();
  const currentMonthKey = getMonthKey(now);
  const canGoNext = monthKey < currentMonthKey;

  return (
    <>
      <AnimatePresence>
        <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center bg-[#051F20]/90 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="glass-panel flex h-full w-full max-w-6xl flex-col gap-4 p-5 sm:h-auto sm:max-h-[90vh] sm:p-6"
            initial={{ y: 40, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#235347]/70 pb-4">
              <div>
                <span className="tech-label text-[#8EB69B]">
                  VERGANGENE AUSGABEN
                </span>
                <p className="mt-1 text-xs text-[#DAF1DE]">
                  Alle Abbuchungen des ausgewählten Monats
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full border border-[#235347]/80 bg-[#163832]/80 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[#8EB69B] hover:border-[#8EB69B]/80 hover:text-[#DAF1DE]"
              >
                SCHLIESSEN
              </button>
            </div>

            {/* Monats-Regler */}
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#235347]/80 bg-[#163832]/80 px-4 py-3">
              <button
                onClick={handlePreviousMonth}
                className="rounded-xl border border-[#235347]/80 bg-[#051F20]/80 px-3 py-1.5 text-sm text-[#DAF1DE] hover:border-[#235347]/80 hover:bg-[#163832]/80 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={false}
              >
                ←
              </button>
              <div className="flex-1 text-center">
                <span className="text-sm font-semibold text-[#DAF1DE]">
                  {monthName || formatMonthKey(monthKey)}
                </span>
              </div>
              <button
                onClick={handleNextMonth}
                className="rounded-xl border border-[#235347]/80 bg-[#051F20]/80 px-3 py-1.5 text-sm text-[#DAF1DE] hover:border-[#235347]/80 hover:bg-[#163832]/80 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canGoNext}
              >
                →
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="tech-label text-[#8EB69B]">SORTIEREN NACH:</span>
              <select
                value={sortOptions.findIndex(
                  (opt) =>
                    opt.sortBy === sortOption.sortBy &&
                    opt.order === sortOption.order
                )}
                onChange={(e) => setSortOption(sortOptions[Number(e.target.value)])}
                className="rounded-xl border border-[#235347]/80 bg-[#163832]/80 px-3 py-1.5 text-xs text-[#DAF1DE] outline-none"
              >
                {sortOptions.map((opt, idx) => (
                  <option key={idx} value={idx}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <p className="text-xs text-[#8EB69B]">Lade …</p>
              ) : expenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-sm text-[#DAF1DE]">
                    Keine Ausgaben in diesem Monat.
                  </p>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {expenses.map((expense) => (
                    <motion.button
                      key={expense.id}
                      onClick={() => handleExpenseClick(expense)}
                      className="group rounded-2xl border border-[#235347]/80 bg-[#163832]/80 p-3 text-left transition hover:border-[#235347]/80 hover:bg-[#235347]/80"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[#DAF1DE]">
                            {expense.purposeSnapshot}
                          </p>
                          <p className="mt-1 text-sm text-[#8EB69B]">
                            {expense.amountSnapshot.toLocaleString("de-DE", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            €
                          </p>
                          <p className="mt-1 text-[11px] text-[#8EB69B]">
                            {formatDate(expense.chargedAt)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`text-xs font-medium ${getRatingColor(expense)}`}
                          >
                            {formatRating(expense)}
                          </span>
                          {expense.isRecurringSnapshot && (
                            <span className="text-[10px] text-[#235347]">
                              wiederkehrend
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {selectedExpense && (
        <ExpenseDetail
          expense={selectedExpense}
          isOpen={detailOpen}
          onClose={handleDetailClose}
          onRefresh={handleDetailClose}
          isCurrentMonth={isCurrentMonth}
          monthKey={monthKey}
        />
      )}
    </>
  );
}
