"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Expense = {
  id: string;
  purposeSnapshot: string;
  amountSnapshot: number;
  chargedAt: string;
  ratingStatus: string;
  ratingValue: number | null;
};

type StatisticsData = {
  periodType: "month" | "week";
  periodKey: string;
  periodName: string;
  expenses: Expense[];
  totalSpent: number;
  avgRating: number | null;
  ratingDiff: number | null;
  hasComparison: boolean;
  ratingsForDensity: number[];
};

type StatisticsViewProps = {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
};

function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${year}-${month}`;
}

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay();
  const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const year = monday.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const days = Math.floor((monday.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${year}-W${weekNumber.toString().padStart(2, "0")}`;
}

function getPreviousPeriodKey(periodType: "month" | "week", currentKey: string): string {
  if (periodType === "month") {
    const [year, month] = currentKey.split("-").map(Number);
    const date = new Date(year, month - 2, 1);
    return getMonthKey(date);
  } else {
    const [year, week] = currentKey.split("-W").map(Number);
    const date = new Date(year, 0, 1);
    const weekStart = new Date(date.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
    const prevWeek = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    return getWeekKey(prevWeek);
  }
}

function getNextPeriodKey(periodType: "month" | "week", currentKey: string): string {
  if (periodType === "month") {
    const [year, month] = currentKey.split("-").map(Number);
    const date = new Date(year, month, 1);
    return getMonthKey(date);
  } else {
    const [year, week] = currentKey.split("-W").map(Number);
    const date = new Date(year, 0, 1);
    const weekStart = new Date(date.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
    const nextWeek = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    return getWeekKey(nextWeek);
  }
}

function calculateCompoundInterest(principal: number, rate: number, periods: number, periodType: "months" | "years"): number {
  // Zinssatz pro Periode (p.a. = pro Jahr)
  if (periodType === "years") {
    // Jahresweise Verzinsung
    return principal * Math.pow(1 + rate / 100, periods);
  } else {
    // Monatliche Verzinsung: Zinssatz pro Monat = p.a. / 12
    const monthlyRate = rate / 100 / 12;
    return principal * Math.pow(1 + monthlyRate, periods);
  }
}

export default function StatisticsView({
  isOpen,
  onClose,
  onRefresh,
}: StatisticsViewProps) {
  const [periodType, setPeriodType] = useState<"month" | "week">("month");
  const [periodKey, setPeriodKey] = useState<string>("");
  const [data, setData] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(false);

  // Rechenmodul 1: Bewertungs-Schwelle
  const [threshold, setThreshold] = useState(5);
  const [investEnabled1, setInvestEnabled1] = useState(false);
  const [interestRate1, setInterestRate1] = useState(5);
  const [duration1, setDuration1] = useState(12);
  const [durationType1, setDurationType1] = useState<"months" | "years">("months");

  // Rechenmodul 2: Manuell auswählen
  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set());
  const [showExpenseList, setShowExpenseList] = useState(false);
  const [investEnabled2, setInvestEnabled2] = useState(false);
  const [interestRate2, setInterestRate2] = useState(5);
  const [duration2, setDuration2] = useState(12);
  const [durationType2, setDurationType2] = useState<"months" | "years">("months");

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const initialKey = periodType === "month" ? getMonthKey(now) : getWeekKey(now);
      setPeriodKey(initialKey);
      loadData(periodType, initialKey);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && periodKey) {
      loadData(periodType, periodKey);
    }
  }, [periodKey, periodType]);

  const loadData = async (type: "month" | "week", key: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/statistics?periodType=${type}&periodKey=${key}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setData(null);
        return;
      }
      const result = await res.json();
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousPeriod = () => {
    if (periodKey) {
      const prev = getPreviousPeriodKey(periodType, periodKey);
      setPeriodKey(prev);
    }
  };

  const handleNextPeriod = () => {
    if (periodKey) {
      const now = new Date();
      const currentKey = periodType === "month" ? getMonthKey(now) : getWeekKey(now);
      if (periodKey < currentKey) {
        const next = getNextPeriodKey(periodType, periodKey);
        if (next <= currentKey) {
          setPeriodKey(next);
        }
      }
    }
  };

  const handlePeriodTypeChange = (type: "month" | "week") => {
    setPeriodType(type);
    const now = new Date();
    const newKey = type === "month" ? getMonthKey(now) : getWeekKey(now);
    setPeriodKey(newKey);
  };

  // Rechenmodul 1: Berechnungen
  const thresholdCalculations = useMemo(() => {
    if (!data) return { adjustedSpent: 0, savings: 0 };

    const filtered = data.expenses.filter((e) => {
      if (e.ratingStatus === "LEBENSNOTWENDIG") return true;
      if (e.ratingStatus === "UNBEWERTET") return true;
      if (e.ratingValue === null) return true;
      return e.ratingValue >= threshold;
    });

    const adjustedSpent = filtered.reduce((sum, e) => sum + e.amountSnapshot, 0);
    const savings = data.totalSpent - adjustedSpent;

    return { adjustedSpent, savings };
  }, [data, threshold]);

  const investmentResult1 = useMemo(() => {
    if (!investEnabled1 || thresholdCalculations.savings <= 0) return null;
    return calculateCompoundInterest(
      thresholdCalculations.savings,
      interestRate1,
      duration1,
      durationType1
    );
  }, [investEnabled1, thresholdCalculations.savings, interestRate1, duration1, durationType1]);

  // Rechenmodul 2: Berechnungen
  const manualCalculations = useMemo(() => {
    if (!data) return { adjustedSpent: 0, savings: 0 };

    const selected = data.expenses.filter((e) => selectedExpenses.has(e.id));
    const savings = selected.reduce((sum, e) => sum + e.amountSnapshot, 0);
    const adjustedSpent = data.totalSpent - savings;

    return { adjustedSpent, savings };
  }, [data, selectedExpenses]);

  const investmentResult2 = useMemo(() => {
    if (!investEnabled2 || manualCalculations.savings <= 0) return null;
    return calculateCompoundInterest(
      manualCalculations.savings,
      interestRate2,
      duration2,
      durationType2
    );
  }, [investEnabled2, manualCalculations.savings, interestRate2, duration2, durationType2]);

  // Dichtediagramm
  const densityData = useMemo(() => {
    if (!data || data.ratingsForDensity.length === 0) return null;

    const bins = 20;
    const min = 0;
    const max = 10;
    const binWidth = (max - min) / bins;
    const histogram = new Array(bins).fill(0);

    data.ratingsForDensity.forEach((rating) => {
      const binIndex = Math.min(
        Math.floor((rating - min) / binWidth),
        bins - 1
      );
      histogram[binIndex]++;
    });

    const maxCount = Math.max(...histogram);
    return {
      bins: histogram.map((count, i) => ({
        x: min + i * binWidth + binWidth / 2,
        y: count / maxCount,
        count,
      })),
      maxCount,
    };
  }, [data]);

  // Kuchendiagramm-Daten
  const pieChartData = useMemo(() => {
    if (!data || data.ratingsForDensity.length === 0) return null;

    // Gruppiere Bewertungen in Kategorien
    const categories = {
      "0-2": 0,
      "2-4": 0,
      "4-6": 0,
      "6-8": 0,
      "8-10": 0,
    };

    data.ratingsForDensity.forEach((rating) => {
      if (rating >= 0 && rating < 2) categories["0-2"]++;
      else if (rating >= 2 && rating < 4) categories["2-4"]++;
      else if (rating >= 4 && rating < 6) categories["4-6"]++;
      else if (rating >= 6 && rating < 8) categories["6-8"]++;
      else if (rating >= 8 && rating <= 10) categories["8-10"]++;
    });

    const total = data.ratingsForDensity.length;
    const colors = [
      "rgb(35, 83, 71)", // #235347 for 0-2
      "rgb(22, 56, 50)", // #163832 for 2-4
      "rgb(142, 182, 155)", // #8EB69B for 4-6
      "rgb(142, 182, 155)", // #8EB69B for 6-8
      "rgb(218, 241, 222)", // #DAF1DE for 8-10
    ];

    let currentAngle = -90; // Start at top
    return Object.entries(categories).map(([label, count], index) => {
      const percentage = total > 0 ? count / total : 0;
      const angle = percentage * 360;
      const startAngle = currentAngle;
      currentAngle += angle;

      return {
        label,
        count,
        percentage,
        startAngle,
        angle,
        color: colors[index],
      };
    });
  }, [data]);

  if (!isOpen) return null;

  const now = new Date();
  const currentKey = periodType === "month" ? getMonthKey(now) : getWeekKey(now);
  const canGoNext = periodKey < currentKey;

  return (
    <>
      <AnimatePresence>
        <motion.div
          key="statistics-modal"
          className="fixed inset-0 z-40 flex flex-col bg-[#051F20]/90 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
        <motion.div
          className="glass-panel flex w-[1086px] h-fit flex-col gap-2 sm:gap-3 p-2 sm:p-3 md:p-4 justify-center -mt-[104px] -mb-[104px] relative top-[-97px]"
          initial={{ y: 40, scale: 0.98 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: 40, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-[#235347]/70 pb-2 sm:pb-3 flex-shrink-0">
            <span className="tech-label text-[#8EB69B] text-[10px] sm:text-xs">STATISTIKEN</span>
            <button
              onClick={onClose}
              className="rounded-xl border border-[#235347]/80 bg-[#163832]/80 px-2 py-1 sm:px-3 sm:py-1.5 text-[9px] sm:text-[10px] uppercase tracking-[0.18em] text-[#DAF1DE] hover:border-[#8EB69B]/80 hover:text-[#DAF1DE] hover:bg-[#235347]/80"
            >
              <span className="hidden sm:inline">ZURÜCK ZUM HAUPTMENÜ</span>
              <span className="sm:hidden">ZURÜCK</span>
            </button>
          </div>

          {/* Zeitraum-Auswahl */}
          <div className="flex flex-col gap-1.5 sm:gap-2 flex-shrink-0">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                onClick={() => handlePeriodTypeChange("month")}
                className={`rounded-lg border px-1.5 py-0.5 sm:px-2 sm:py-1 text-[9px] sm:text-[10px] uppercase tracking-[0.16em] ${
                  periodType === "month"
                    ? "border-[#8EB69B]/80 bg-[#8EB69B]/20 text-[#DAF1DE]"
                    : "border-[#235347]/80 bg-[#163832]/80 text-[#DAF1DE]"
                }`}
              >
                MONAT
              </button>
              <button
                onClick={() => handlePeriodTypeChange("week")}
                className={`rounded-lg border px-1.5 py-0.5 sm:px-2 sm:py-1 text-[9px] sm:text-[10px] uppercase tracking-[0.16em] ${
                  periodType === "week"
                    ? "border-[#8EB69B]/80 bg-[#8EB69B]/20 text-[#DAF1DE]"
                    : "border-[#235347]/80 bg-[#163832]/80 text-[#DAF1DE]"
                }`}
              >
                WOCHE
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-lg sm:rounded-xl border border-[#235347]/80 bg-[#163832]/80 px-2 sm:px-3 py-1 sm:py-1.5">
              <button
                onClick={handlePreviousPeriod}
                className="rounded-lg border border-[#235347]/80 bg-[#051F20]/80 px-2 py-1 text-xs text-[#DAF1DE] hover:border-[#235347]/80 hover:bg-[#163832]/80"
              >
                ←
              </button>
              <div className="flex-1 text-center">
                <span className="text-[10px] sm:text-xs font-semibold text-[#DAF1DE]">
                  {data?.periodName || "Lade …"}
                </span>
              </div>
              <button
                onClick={handleNextPeriod}
                className="rounded-lg border border-[#235347]/80 bg-[#051F20]/80 px-2 py-1 text-xs text-[#DAF1DE] hover:border-[#235347]/80 hover:bg-[#163832]/80 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canGoNext}
              >
                →
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-xs text-[#8EB69B]">Lade …</p>
          ) : !data || data.expenses.length === 0 ? (
            <p className="text-sm text-[#DAF1DE]">Keine Ausgaben in diesem Zeitraum.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-1.5 sm:gap-2 flex-1 overflow-hidden">
              {/* Dichtediagramm */}
              {densityData && densityData.bins.length > 0 && (
                <div className="rounded-lg sm:rounded-xl border border-[#235347]/80 bg-[#163832]/80 p-1.5 sm:p-2 flex flex-col">
                  <span className="tech-label text-[#8EB69B] mb-1 block text-[8px] sm:text-[9px]">
                    VERTEILUNG DER BEWERTUNGEN
                  </span>
                  <div className="h-20 sm:h-24 md:h-28 w-full flex-1 relative">
                    <svg width="100%" height="100%" viewBox="0 0 300 100" preserveAspectRatio="none" className="overflow-visible">
                      <defs>
                        <clipPath id="chart-clip">
                          <rect x="30" y="5" width="260" height="85" />
                        </clipPath>
                      </defs>
                      {/* Y-Achse */}
                      <line
                        x1="30"
                        y1="5"
                        x2="30"
                        y2="90"
                        stroke="rgb(142, 182, 155)"
                        strokeWidth="1"
                      />
                      {/* X-Achse */}
                      <line
                        x1="30"
                        y1="90"
                        x2="290"
                        y2="90"
                        stroke="rgb(142, 182, 155)"
                        strokeWidth="1"
                      />
                      {/* Y-Achsen-Labels */}
                      {[0, 1, 2, 3, 4, 5].map((tick) => {
                        const yValue = densityData.maxCount > 0 ? Math.floor((tick / 5) * densityData.maxCount) : 0;
                        const yPos = 90 - (tick / 5) * 85;
                        return (
                          <g key={tick}>
                            <line
                              x1="28"
                              y1={yPos}
                              x2="30"
                              y2={yPos}
                              stroke="rgb(142, 182, 155)"
                              strokeWidth="0.5"
                            />
                            <text
                              x="25"
                              y={yPos}
                              fill="rgb(142, 182, 155)"
                              fontSize="8"
                              textAnchor="end"
                              alignmentBaseline="middle"
                            >
                              {yValue}
                            </text>
                          </g>
                        );
                      })}
                      {/* X-Achsen-Labels */}
                      {[0, 2, 4, 6, 8, 10].map((tick) => {
                        const xPos = 30 + (tick / 10) * 260;
                        return (
                          <g key={tick}>
                            <line
                              x1={xPos}
                              y1="90"
                              x2={xPos}
                              y2="92"
                              stroke="rgb(142, 182, 155)"
                              strokeWidth="0.5"
                            />
                            <text
                              x={xPos}
                              y="98"
                              fill="rgb(142, 182, 155)"
                              fontSize="8"
                              textAnchor="middle"
                            >
                              {tick}
                            </text>
                          </g>
                        );
                      })}
                      {/* Balken */}
                      <g clipPath="url(#chart-clip)">
                        {densityData.bins.map((point, i) => {
                          const xPos = 30 + (point.x / 10) * 260;
                          const barWidth = (10 / 20 / 10) * 260;
                          const height = densityData.maxCount > 0 ? (point.count / densityData.maxCount) * 85 : 0;
                          return (
                            <rect
                              key={i}
                              x={xPos - barWidth / 2}
                              y={90 - height}
                              width={barWidth}
                              height={height}
                              fill="rgb(142, 182, 155)"
                              opacity={0.7}
                            />
                          );
                        })}
                      </g>
                    </svg>
                  </div>
                </div>
              )}

              {/* Kuchendiagramm */}
              {pieChartData && pieChartData.length > 0 && (
                <div className="rounded-lg sm:rounded-xl border border-[#235347]/80 bg-[#163832]/80 p-1.5 sm:p-2 flex flex-col justify-center">
                  <span className="tech-label text-[#8EB69B] mb-1 block text-[8px] sm:text-[9px]">
                    BEWERTUNGSVERTEILUNG
                  </span>
                  <div className="h-20 sm:h-24 md:h-28 w-full flex items-center gap-2">
                    <div className="flex-shrink-0 flex items-center justify-center">
                      <svg width="207" height="100%" viewBox="0 0 100 100" className="overflow-visible" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                        {pieChartData.map((segment, i) => {
                          if (segment.percentage === 0) return null;
                          
                          const largeArc = segment.angle > 180 ? 1 : 0;
                          const startRad = (segment.startAngle * Math.PI) / 180;
                          const endRad = ((segment.startAngle + segment.angle) * Math.PI) / 180;
                          
                          const x1 = 50 + 28 * Math.cos(startRad);
                          const y1 = 50 + 28 * Math.sin(startRad);
                          const x2 = 50 + 28 * Math.cos(endRad);
                          const y2 = 50 + 28 * Math.sin(endRad);
                          
                          const pathData = [
                            `M 50 50`,
                            `L ${x1} ${y1}`,
                            `A 28 28 0 ${largeArc} 1 ${x2} ${y2}`,
                            `Z`,
                          ].join(" ");
                          
                          return (
                            <path
                              key={i}
                              d={pathData}
                              fill={segment.color}
                              opacity={0.8}
                              stroke="rgb(5, 31, 32)"
                              strokeWidth="0.5"
                            />
                          );
                        })}
                      </svg>
                    </div>
                    <div className="flex flex-col gap-1 justify-center text-[9px] sm:text-[10px] flex-1" style={{ alignItems: "flex-end", width: "fit-content", height: "96px" }}>
                      {pieChartData.map((segment, i) => (
                        <div key={i} className="flex items-center gap-1.5" style={{ justifyContent: "center" }}>
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: segment.color }}
                          />
                          <span className="text-[#DAF1DE] whitespace-nowrap">{segment.label}:</span>
                          <span className="text-[#8EB69B] font-semibold">{(segment.percentage * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Durchschnittliche Bewertung */}
              {data.avgRating !== null && (
                <div className="rounded-lg sm:rounded-xl border border-[#235347]/80 bg-[#163832]/80 p-1.5 sm:p-2 flex flex-col justify-center">
                  <span className="tech-label text-[#8EB69B] mb-0.5 sm:mb-1 block text-[8px] sm:text-[9px]">
                    DURCHSCHNITTLICHE BEWERTUNG
                  </span>
                  <span className="text-[10px] sm:text-xs font-semibold text-[#DAF1DE]">
                    Ø Bewertung: {data.avgRating.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Vergleich */}
              {data.hasComparison && data.ratingDiff !== null && (
                <div className="rounded-lg sm:rounded-xl border border-[#235347]/80 bg-[#163832]/80 p-1.5 sm:p-2 flex flex-col justify-center">
                  <span className="tech-label text-[#8EB69B] mb-0.5 sm:mb-1 block text-[8px] sm:text-[9px]">TREND</span>
                  <span
                    className={`text-[10px] sm:text-xs font-semibold ${
                      data.ratingDiff > 0
                        ? "text-[#8EB69B]"
                        : data.ratingDiff < 0
                        ? "text-[#8EB69B]"
                        : "text-[#DAF1DE]"
                    }`}
                  >
                    {data.ratingDiff > 0 ? "+" : ""}
                    {data.ratingDiff.toFixed(2)}{" "}
                    <span className="text-[8px] sm:text-[9px]">
                      {data.ratingDiff > 0
                        ? `besser als letzter ${periodType === "month" ? "Monat" : "Woche"}`
                        : data.ratingDiff < 0
                        ? `schlechter als letzte ${periodType === "month" ? "Monat" : "Woche"}`
                        : "gleich geblieben"}
                    </span>
                  </span>
                </div>
              )}

              {/* Rechenmodul 2: Manuell auswählen / Sparplan */}
              <div className="rounded-lg sm:rounded-xl border border-[#235347]/80 bg-[#163832]/80 p-1.5 sm:p-2 flex flex-col overflow-y-auto lg:col-span-2 xl:col-span-3">
                <span className="tech-label text-[#8EB69B] mb-1 block text-[8px] sm:text-[9px]">
                  SPARPLAN: SELEKTIVE AUSGABEN ENTFERNEN
                </span>
                <div className="flex flex-col gap-1">
                  <div>
                    <span className="text-[9px] sm:text-[10px] text-[#DAF1DE]">Gesamtausgaben: </span>
                    <span className="text-[9px] sm:text-[10px] font-semibold text-[#8EB69B]">
                      {data.totalSpent.toLocaleString("de-DE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      €
                    </span>
                  </div>
                  <button
                    onClick={() => setShowExpenseList(true)}
                    className="rounded-lg border border-[#235347]/80 bg-[#051F20]/80 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[8px] sm:text-[9px] text-[#DAF1DE] hover:border-[#235347]/80 hover:bg-[#163832]/80"
                  >
                    Ausgaben auswählen
                  </button>
                  <div>
                    <span className="text-[9px] sm:text-[10px] text-[#DAF1DE]">Angepasste Ausgaben: </span>
                    <span className="text-[9px] sm:text-[10px] font-semibold text-[#8EB69B]">
                      {manualCalculations.adjustedSpent.toLocaleString("de-DE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      €
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-[#DAF1DE]">Mögliche Ersparnis: </span>
                    <span className="text-sm font-semibold text-[#8EB69B]">
                      {manualCalculations.savings.toLocaleString("de-DE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      €
                    </span>
                  </div>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={investEnabled2}
                      onChange={(e) => setInvestEnabled2(e.target.checked)}
                      className="accent-[#8EB69B] w-3 h-3"
                    />
                    <span className="text-[8px] sm:text-[9px] text-[#DAF1DE]">stattdessen investieren</span>
                  </label>
                  {investEnabled2 && (
                    <div className="flex flex-col gap-1 pl-3 sm:pl-4">
                      <div>
                        <label className="text-[8px] sm:text-[9px] text-[#8EB69B]">Zinssatz p.a. (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          step={0.1}
                          value={interestRate2}
                          onChange={(e) => setInterestRate2(Number(e.target.value))}
                          className="w-full rounded-lg border border-[#235347]/80 bg-[#051F20]/80 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[9px] sm:text-[10px] text-[#DAF1DE]"
                        />
                      </div>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          min={1}
                          value={duration2}
                          onChange={(e) => setDuration2(Number(e.target.value))}
                          className="flex-1 rounded-lg border border-[#235347]/80 bg-[#051F20]/80 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[9px] sm:text-[10px] text-[#DAF1DE]"
                        />
                        <select
                          value={durationType2}
                          onChange={(e) => setDurationType2(e.target.value as "months" | "years")}
                          className="rounded-lg border border-[#235347]/80 bg-[#051F20]/80 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[9px] sm:text-[10px] text-[#DAF1DE]"
                        >
                          <option value="months">Monate</option>
                          <option value="years">Jahre</option>
                        </select>
                      </div>
                      {investmentResult2 !== null && (
                        <div className="mt-1">
                          <span className="text-[9px] sm:text-[10px] font-semibold text-[#8EB69B]">
                            Wert heute:{" "}
                            {investmentResult2.toLocaleString("de-DE", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            €
                          </span>
                          <p className="text-[7px] sm:text-[8px] text-[#DAF1DE] mt-0.5 leading-tight">
                            Hättest Du {periodType === "month" ? "diesen Monat" : "diese Woche"} auf{" "}
                            {selectedExpenses.size} Ausgaben verzichtet, hättest Du{" "}
                            {manualCalculations.savings.toLocaleString("de-DE", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            € gespart! Hättest Du diese{" "}
                            {manualCalculations.savings.toLocaleString("de-DE", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            € für {duration2} {durationType2 === "months" ? "Monate" : "Jahre"} bei{" "}
                            {interestRate2}% Zinsen angelegt, hättest Du jetzt stattdessen{" "}
                            {investmentResult2.toLocaleString("de-DE", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            €!
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Rechenmodul 1: Bewertungs-Schwelle */}
              <div className="rounded-lg sm:rounded-xl border border-[#235347]/80 bg-[#163832]/80 p-1.5 sm:p-2 flex flex-col overflow-y-auto w-[1052px]">
                <span className="tech-label text-[#8EB69B] mb-1 block text-[8px] sm:text-[9px]">
                  AUSGABEN NACH BEWERTUNGS-SCHWELLE
                </span>
                <div className="flex flex-col gap-1 sm:gap-1.5">
                  <div>
                    <span className="text-xs sm:text-sm text-[#DAF1DE]">Gesamtausgaben: </span>
                    <span className="text-xs sm:text-sm font-semibold text-[#8EB69B]">
                      {data.totalSpent.toLocaleString("de-DE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      €
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:gap-2">
                    <label className="text-[10px] sm:text-xs text-[#8EB69B]">Schwelle: {threshold.toFixed(1)}</label>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={0.1}
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                      className="accent-[#8EB69B]"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] sm:text-[10px] text-[#DAF1DE]">Angepasste Ausgaben: </span>
                    <span className="text-[9px] sm:text-[10px] font-semibold text-[#8EB69B]">
                      {thresholdCalculations.adjustedSpent.toLocaleString("de-DE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      €
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-[#DAF1DE]">Mögliche Ersparnis: </span>
                    <span className="text-sm font-semibold text-[#8EB69B]">
                      {thresholdCalculations.savings.toLocaleString("de-DE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      €
                    </span>
                  </div>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={investEnabled1}
                      onChange={(e) => setInvestEnabled1(e.target.checked)}
                      className="accent-[#8EB69B] w-3 h-3"
                    />
                    <span className="text-[8px] sm:text-[9px] text-[#DAF1DE]">stattdessen investieren</span>
                  </label>
                  {investEnabled1 && (
                    <div className="flex flex-col gap-1 pl-3 sm:pl-4">
                      <div>
                        <label className="text-[8px] sm:text-[9px] text-[#8EB69B]">Zinssatz p.a. (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          step={0.1}
                          value={interestRate1}
                          onChange={(e) => setInterestRate1(Number(e.target.value))}
                          className="w-full rounded-lg border border-[#235347]/80 bg-[#051F20]/80 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[9px] sm:text-[10px] text-[#DAF1DE]"
                        />
                      </div>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          min={1}
                          value={duration1}
                          onChange={(e) => setDuration1(Number(e.target.value))}
                          className="flex-1 rounded-lg border border-[#235347]/80 bg-[#051F20]/80 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[9px] sm:text-[10px] text-[#DAF1DE]"
                        />
                        <select
                          value={durationType1}
                          onChange={(e) => setDurationType1(e.target.value as "months" | "years")}
                          className="rounded-lg border border-[#235347]/80 bg-[#051F20]/80 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[9px] sm:text-[10px] text-[#DAF1DE]"
                        >
                          <option value="months">Monate</option>
                          <option value="years">Jahre</option>
                        </select>
                      </div>
                      {investmentResult1 !== null && (
                        <div className="mt-1">
                          <span className="text-[9px] sm:text-[10px] font-semibold text-[#8EB69B]">
                            Wert heute:{" "}
                            {investmentResult1.toLocaleString("de-DE", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            €
                          </span>
                          <p className="text-[7px] sm:text-[8px] text-[#DAF1DE] mt-0.5 leading-tight">
                            Hättest Du {periodType === "month" ? "diesen Monat" : "diese Woche"} auf
                            alle Ausgaben mit der Bewertung {threshold.toFixed(1)} oder niedriger
                            verzichtet, hättest Du {thresholdCalculations.savings.toLocaleString("de-DE", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            € gespart! Hättest Du diese{" "}
                            {thresholdCalculations.savings.toLocaleString("de-DE", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            € für {duration1} {durationType1 === "months" ? "Monate" : "Jahre"} bei{" "}
                            {interestRate1}% Zinsen angelegt, hättest Du jetzt stattdessen{" "}
                            {investmentResult1.toLocaleString("de-DE", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            €!
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
      </AnimatePresence>

      {/* Popup: Ausgabenliste */}
      <AnimatePresence>
        {showExpenseList && data && (
          <motion.div
            key="expense-list-popup"
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#051F20]/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowExpenseList(false)}
          >
            <motion.div
              className="w-full max-w-2xl max-h-[80vh] rounded-2xl border border-[#235347]/80 bg-[#051F20]/95 p-4 sm:p-6 shadow-[0_0_40px_rgba(5,31,32,0.95)] flex flex-col"
              initial={{ y: 40, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 40, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#235347]/70">
                <span className="tech-label text-[#8EB69B] text-xs sm:text-sm">
                  AUSGABEN AUSWÄHLEN
                </span>
                <button
                  onClick={() => setShowExpenseList(false)}
                  className="rounded-full border border-[#235347]/80 bg-[#163832]/80 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[#8EB69B] hover:border-[#8EB69B]/80 hover:text-[#DAF1DE]"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto flex flex-col gap-2">
                {data.expenses.map((expense) => (
                  <label
                    key={expense.id}
                    className="flex items-center gap-2 p-2 sm:p-3 rounded-lg border border-[#235347]/80 bg-[#163832]/80 cursor-pointer hover:bg-[#235347]/80 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedExpenses.has(expense.id)}
                      onChange={(e) => {
                        const newSet = new Set(selectedExpenses);
                        if (e.target.checked) {
                          newSet.add(expense.id);
                        } else {
                          newSet.delete(expense.id);
                        }
                        setSelectedExpenses(newSet);
                      }}
                      className="accent-[#8EB69B] w-4 h-4 flex-shrink-0"
                    />
                    <div className="flex-1 flex items-center justify-between gap-2 text-[10px] sm:text-xs flex-wrap">
                      <span className="text-[#DAF1DE] truncate flex-1 min-w-0">{expense.purposeSnapshot}</span>
                      <span className="text-[#8EB69B] whitespace-nowrap">
                        {expense.amountSnapshot.toLocaleString("de-DE", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        €
                      </span>
                      <span className="text-[#8EB69B] text-[9px] sm:text-[10px] whitespace-nowrap">
                        {new Date(expense.chargedAt).toLocaleDateString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                      <span className="text-[#8EB69B] text-[9px] sm:text-[10px] whitespace-nowrap">
                        {expense.ratingStatus === "LEBENSNOTWENDIG"
                          ? "lebensnotwendig"
                          : expense.ratingStatus === "UNBEWERTET" || expense.ratingValue === null
                          ? "unbewertet"
                          : expense.ratingValue.toFixed(2)}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
