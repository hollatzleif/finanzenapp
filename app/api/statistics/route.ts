import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureChargesUpToNow, getMonthKey } from "@/lib/recurrence";

// Helper-Funktion für WeekKey (ISO-Woche)
function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay();
  const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Montag als Wochenstart
  const monday = new Date(d.setDate(diff));
  const year = monday.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const days = Math.floor((monday.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${year}-W${weekNumber.toString().padStart(2, "0")}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay();
  const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getPreviousPeriodKey(periodType: "month" | "week", currentKey: string): string {
  if (periodType === "month") {
    const [year, month] = currentKey.split("-").map(Number);
    const date = new Date(year, month - 2, 1);
    return getMonthKey(date);
  } else {
    // week
    const [year, week] = currentKey.split("-W").map(Number);
    const date = new Date(year, 0, 1);
    const weekStart = new Date(date.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
    const prevWeek = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    return getWeekKey(prevWeek);
  }
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { message: "Nicht authentifiziert." },
      { status: 401 }
    );
  }

  const now = new Date();
  const currentMonthKey = getMonthKey(now);
  const currentWeekKey = getWeekKey(now);

  const { searchParams } = new URL(req.url);
  const periodType = (searchParams.get("periodType") || "month") as "month" | "week";
  const periodKey = searchParams.get("periodKey") || (periodType === "month" ? currentMonthKey : currentWeekKey);

  // Validierung: Keine Zukunft
  if (periodType === "month") {
    if (periodKey > currentMonthKey) {
      return NextResponse.json(
        { message: "Zukünftige Monate sind nicht erlaubt." },
        { status: 400 }
      );
    }
    // Nur für aktuellen Monat ensureChargesUpToNow
    if (periodKey === currentMonthKey) {
      await ensureChargesUpToNow(user.id);
    }
  } else {
    if (periodKey > currentWeekKey) {
      return NextResponse.json(
        { message: "Zukünftige Wochen sind nicht erlaubt." },
        { status: 400 }
      );
    }
    // Nur für aktuelle Woche ensureChargesUpToNow (wenn Woche aktuellen Monat enthält)
    const weekStart = getWeekStart(new Date(now));
    const weekStartMonthKey = getMonthKey(weekStart);
    if (weekStartMonthKey === currentMonthKey) {
      await ensureChargesUpToNow(user.id);
    }
  }

  // Abfrage der Ausgaben
  let startDate: Date;
  let endDate: Date;
  let periodName: string;

  if (periodType === "month") {
    const [year, month] = periodKey.split("-").map(Number);
    startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    endDate = new Date(year, month, 0, 23, 59, 59, 999);
    const monthDate = new Date(year, month - 1, 1);
    periodName = monthDate.toLocaleString("de-DE", { month: "long", year: "numeric" });
  } else {
    // week
    const [year, week] = periodKey.split("-W").map(Number);
    const date = new Date(year, 0, 1);
    const weekStart = new Date(date.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
    const dayOfWeek = weekStart.getDay();
    const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(weekStart.setDate(diff));
    startDate = new Date(monday);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(monday);
    endDate.setDate(endDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
    periodName = `Woche ${week}, ${year}`;
  }

  const instances = await query<{
    id: string;
    purposeSnapshot: string;
    amountSnapshot: string;
    chargedAt: Date;
    ratingStatus: string;
    ratingValue: number | null;
  }>(
    `SELECT id, "purposeSnapshot", "amountSnapshot", "chargedAt", "ratingStatus", "ratingValue"
     FROM "ExpenseInstance"
     WHERE "userId" = $1 AND "chargedAt" >= $2 AND "chargedAt" <= $3
     ORDER BY "chargedAt" ASC`,
    [user.id, startDate, endDate]
  );

  // Vorheriger Zeitraum für Vergleich
  const previousPeriodKey = getPreviousPeriodKey(periodType, periodKey);
  let previousStartDate: Date;
  let previousEndDate: Date;

  if (periodType === "month") {
    const [year, month] = previousPeriodKey.split("-").map(Number);
    previousStartDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    previousEndDate = new Date(year, month, 0, 23, 59, 59, 999);
  } else {
    const [year, week] = previousPeriodKey.split("-W").map(Number);
    const date = new Date(year, 0, 1);
    const weekStart = new Date(date.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
    const dayOfWeek = weekStart.getDay();
    const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(weekStart.setDate(diff));
    previousStartDate = new Date(monday);
    previousStartDate.setHours(0, 0, 0, 0);
    previousEndDate = new Date(monday);
    previousEndDate.setDate(previousEndDate.getDate() + 6);
    previousEndDate.setHours(23, 59, 59, 999);
  }

  const previousInstances = await query<{
    ratingStatus: string;
    ratingValue: number | null;
  }>(
    `SELECT "ratingStatus", "ratingValue"
     FROM "ExpenseInstance"
     WHERE "userId" = $1 AND "chargedAt" >= $2 AND "chargedAt" <= $3
       AND "ratingStatus" != 'LEBENSNOTWENDIG' AND "ratingStatus" != 'UNBEWERTET'`,
    [user.id, previousStartDate, previousEndDate]
  );

  // Finde letzten Zeitraum mit Ausgaben für Vergleich
  let comparisonPeriodKey = previousPeriodKey;
  let comparisonInstances = previousInstances;
  let foundComparison = previousInstances.length > 0;

  if (!foundComparison) {
    // Suche weiter zurück
    let searchKey = previousPeriodKey;
    for (let i = 0; i < 12; i++) {
      searchKey = getPreviousPeriodKey(periodType, searchKey);
      let searchStart: Date;
      let searchEnd: Date;
      if (periodType === "month") {
        const [year, month] = searchKey.split("-").map(Number);
        searchStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
        searchEnd = new Date(year, month, 0, 23, 59, 59, 999);
      } else {
        const [year, week] = searchKey.split("-W").map(Number);
        const date = new Date(year, 0, 1);
        const weekStart = new Date(date.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
        const dayOfWeek = weekStart.getDay();
        const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(weekStart.setDate(diff));
        searchStart = new Date(monday);
        searchStart.setHours(0, 0, 0, 0);
        searchEnd = new Date(monday);
        searchEnd.setDate(searchEnd.getDate() + 6);
        searchEnd.setHours(23, 59, 59, 999);
      }
      const searchResults = await query<{
        ratingStatus: string;
        ratingValue: number | null;
      }>(
        `SELECT "ratingStatus", "ratingValue"
         FROM "ExpenseInstance"
         WHERE "userId" = $1 AND "chargedAt" >= $2 AND "chargedAt" <= $3
           AND "ratingStatus" != 'LEBENSNOTWENDIG' AND "ratingStatus" != 'UNBEWERTET'`,
        [user.id, searchStart, searchEnd]
      );
      if (searchResults.length > 0) {
        comparisonPeriodKey = searchKey;
        comparisonInstances = searchResults;
        foundComparison = true;
        break;
      }
    }
  }

  const expenses = instances.map((inst) => ({
    id: inst.id,
    purposeSnapshot: inst.purposeSnapshot,
    amountSnapshot: parseFloat(inst.amountSnapshot),
    chargedAt: inst.chargedAt.toISOString(),
    ratingStatus: inst.ratingStatus,
    ratingValue: inst.ratingValue !== null ? parseFloat(String(inst.ratingValue)) : null,
  }));

  // Berechnungen
  const totalSpent = expenses.reduce((sum, e) => sum + e.amountSnapshot, 0);

  // Nur bewertete, nicht-lebensnotwendige für Durchschnitt
  const ratedExpenses = expenses.filter(
    (e) => e.ratingStatus === "BEWERTET" && e.ratingValue !== null
  );
  const avgRating =
    ratedExpenses.length > 0
      ? ratedExpenses.reduce((sum, e) => sum + (e.ratingValue || 0), 0) / ratedExpenses.length
      : null;

  // Vergleich
  const comparisonAvgRating =
    comparisonInstances.length > 0
      ? comparisonInstances.reduce(
          (sum, e) => sum + (e.ratingValue !== null ? parseFloat(String(e.ratingValue)) : 0),
          0
        ) / comparisonInstances.length
      : null;

  const ratingDiff = avgRating !== null && comparisonAvgRating !== null
    ? avgRating - comparisonAvgRating
    : null;

  // Bewertungen für Dichtediagramm (nur 0-10, ohne lebensnotwendig/unbewertet)
  const ratingsForDensity = ratedExpenses
    .map((e) => e.ratingValue)
    .filter((r): r is number => r !== null && r >= 0 && r <= 10);

  return NextResponse.json(
    {
      periodType,
      periodKey,
      periodName,
      expenses,
      totalSpent,
      avgRating,
      ratingDiff,
      hasComparison: foundComparison,
      ratingsForDensity,
    },
    { status: 200 }
  );
}
