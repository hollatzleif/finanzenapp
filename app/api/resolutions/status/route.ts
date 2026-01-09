import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getMonthKey } from "@/lib/recurrence";

// Helper für WeekKey
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

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { message: "Nicht authentifiziert." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const monthKey = searchParams.get("monthKey");

  if (!monthKey) {
    return NextResponse.json(
      { message: "monthKey ist erforderlich." },
      { status: 400 }
    );
  }

  // Hole alle Vorsätze für diesen Monat
  const resolutions = await query<{
    id: string;
    type: string;
    amountThreshold: string | null;
    ratingThreshold: string | null;
    unit: string | null;
    targetAvgRating: string | null;
    reductionAmount: string | null;
    reductionUnit: string | null;
    maxAffectiveAmount: string | null;
    maxAffectiveCount: number | null;
    maxAffectivePeriod: string | null;
  }>(
    `SELECT id, type, "amountThreshold", "ratingThreshold", unit,
            "targetAvgRating", "reductionAmount", "reductionUnit",
            "maxAffectiveAmount", "maxAffectiveCount", "maxAffectivePeriod"
     FROM "Resolution"
     WHERE "userId" = $1 AND "monthKey" = $2`,
    [user.id, monthKey]
  );

  // Berechne Zeitraum
  const [year, month] = monthKey.split("-").map(Number);
  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  const now = new Date();
  const currentMonthKey = getMonthKey(now);
  const isCurrentMonth = monthKey === currentMonthKey;

  // Hole Ausgaben für diesen Monat
  const expenses = await query<{
    amountSnapshot: string;
    ratingValue: string | null;
    ratingStatus: string;
    q5Planned: string | null;
    chargedAt: Date;
  }>(
    `SELECT "amountSnapshot", "ratingValue", "ratingStatus", "q5Planned", "chargedAt"
     FROM "ExpenseInstance"
     WHERE "userId" = $1 AND "chargedAt" >= $2 AND "chargedAt" <= $3`,
    [user.id, startDate, endDate]
  );

  // Hole Ausgaben des Vormonats für Vergleich
  const prevMonthDate = new Date(year, month - 2, 1);
  const prevMonthKey = getMonthKey(prevMonthDate);
  const [prevYear, prevMonth] = prevMonthKey.split("-").map(Number);
  const prevStartDate = new Date(prevYear, prevMonth - 1, 1, 0, 0, 0, 0);
  const prevEndDate = new Date(prevYear, prevMonth, 0, 23, 59, 59, 999);

  const prevExpenses = await query<{
    amountSnapshot: string;
  }>(
    `SELECT "amountSnapshot"
     FROM "ExpenseInstance"
     WHERE "userId" = $1 AND "chargedAt" >= $2 AND "chargedAt" <= $3`,
    [user.id, prevStartDate, prevEndDate]
  );

  const prevTotal = prevExpenses.reduce(
    (sum, e) => sum + parseFloat(e.amountSnapshot),
    0
  );

  // Berechne Status für jeden Vorsatz
  const statuses = await Promise.all(
    resolutions.map(async (r) => {
      let isMet = false;
      let current = 0;
      let target = 0;
      let description = "";

      switch (r.type) {
        case "UNDER_AMOUNT_FOR_RATING": {
          const threshold = r.amountThreshold ? parseFloat(r.amountThreshold) : 0;
          const rating = r.ratingThreshold ? parseFloat(r.ratingThreshold) : 0;
          const unit = r.unit;

          // Finde Ausgaben unter ratingThreshold
          const relevantExpenses = expenses.filter(
            (e) =>
              e.ratingValue !== null &&
              parseFloat(e.ratingValue) < rating &&
              e.ratingStatus === "BEWERTET"
          );

          if (unit === "EURO") {
            const total = relevantExpenses.reduce(
              (sum, e) => sum + parseFloat(e.amountSnapshot),
              0
            );
            current = total;
            target = threshold;
            isMet = total <= threshold;
            description = `${total.toFixed(2)} € / ${threshold.toFixed(2)} €`;
          } else {
            // PERCENT
            const totalAll = expenses.reduce(
              (sum, e) => sum + parseFloat(e.amountSnapshot),
              0
            );
            const totalRelevant = relevantExpenses.reduce(
              (sum, e) => sum + parseFloat(e.amountSnapshot),
              0
            );
            const percent = totalAll > 0 ? (totalRelevant / totalAll) * 100 : 0;
            current = percent;
            target = threshold;
            isMet = percent <= threshold;
            description = `${percent.toFixed(1)}% / ${threshold.toFixed(1)}%`;
          }
          break;
        }

        case "TARGET_AVG_RATING": {
          const targetValue = r.targetAvgRating ? parseFloat(r.targetAvgRating) : 0;
          const ratedExpenses = expenses.filter(
            (e) => e.ratingStatus === "BEWERTET" && e.ratingValue !== null
          );

          if (ratedExpenses.length === 0) {
            isMet = false;
            current = 0;
            target = 0;
            description = "Keine Bewertungen";
          } else {
            const weightedSum = ratedExpenses.reduce(
              (sum, e) =>
                sum + parseFloat(e.ratingValue || "0") * parseFloat(e.amountSnapshot),
              0
            );
            const totalAmount = ratedExpenses.reduce(
              (sum, e) => sum + parseFloat(e.amountSnapshot),
              0
            );
            const avg = totalAmount > 0 ? weightedSum / totalAmount : 0;
            current = avg;
            target = targetValue;
            isMet = avg >= targetValue;
            description = `${avg.toFixed(2)} / ${targetValue.toFixed(2)}`;
          }
          break;
        }

        case "LESS_THAN_LAST_MONTH": {
          const reduction = r.reductionAmount ? parseFloat(r.reductionAmount) : 0;
          const unit = r.reductionUnit;
          const currentTotal = expenses.reduce(
            (sum, e) => sum + parseFloat(e.amountSnapshot),
            0
          );

          if (unit === "EURO") {
            const targetTotal = prevTotal - reduction;
            current = currentTotal;
            target = targetTotal;
            isMet = currentTotal <= targetTotal;
            description = `${currentTotal.toFixed(2)} € / ${targetTotal.toFixed(2)} €`;
          } else {
            // PERCENT
            const percentReduction = prevTotal > 0 ? (reduction / prevTotal) * 100 : 0;
            const targetTotal = prevTotal * (1 - percentReduction / 100);
            current = currentTotal;
            target = targetTotal;
            isMet = currentTotal <= targetTotal;
            description = `${currentTotal.toFixed(2)} € / ${targetTotal.toFixed(2)} €`;
          }
          break;
        }

        case "NO_AFFECTIVE_ABOVE_AMOUNT": {
          const maxAmount = r.maxAffectiveAmount ? parseFloat(r.maxAffectiveAmount) : 0;
          const affectiveAbove = expenses.filter(
            (e) =>
              e.q5Planned === "AFFEKTIV" &&
              parseFloat(e.amountSnapshot) > maxAmount
          );
          current = affectiveAbove.length;
          target = 0;
          isMet = affectiveAbove.length === 0;
          description = `${affectiveAbove.length} / 0`;
          break;
        }

        case "MAX_AFFECTIVE_PER_PERIOD": {
          const maxCount = r.maxAffectiveCount || 0;
          const period = r.maxAffectivePeriod;

          let relevantExpenses: typeof expenses = [];
          if (period === "WEEK") {
            // Für jede Woche im Monat prüfen
            const weekKeys = new Set<string>();
            expenses.forEach((e) => {
              weekKeys.add(getWeekKey(e.chargedAt));
            });
            // Finde Woche mit meisten affektiven Ausgaben
            let maxWeekCount = 0;
            for (const weekKey of weekKeys) {
              const [wYear, wWeek] = weekKey.split("-W").map(Number);
              const date = new Date(wYear, 0, 1);
              const weekStart = new Date(
                date.getTime() + (wWeek - 1) * 7 * 24 * 60 * 60 * 1000
              );
              const dayOfWeek = weekStart.getDay();
              const diff =
                weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
              const monday = new Date(weekStart.setDate(diff));
              const weekStartDate = new Date(monday);
              weekStartDate.setHours(0, 0, 0, 0);
              const weekEndDate = getWeekEnd(weekStartDate);

              const weekExpenses = expenses.filter(
                (e) =>
                  e.q5Planned === "AFFEKTIV" &&
                  e.chargedAt >= weekStartDate &&
                  e.chargedAt <= weekEndDate
              );
              maxWeekCount = Math.max(maxWeekCount, weekExpenses.length);
            }
            current = maxWeekCount;
            target = maxCount;
            isMet = maxWeekCount <= maxCount;
            description = `${maxWeekCount} / ${maxCount}`;
          } else {
            // MONTH
            const affectiveCount = expenses.filter(
              (e) => e.q5Planned === "AFFEKTIV"
            ).length;
            current = affectiveCount;
            target = maxCount;
            isMet = affectiveCount <= maxCount;
            description = `${affectiveCount} / ${maxCount}`;
          }
          break;
        }
      }

      return {
        id: r.id,
        isMet: isMet || !isCurrentMonth, // Wenn nicht aktueller Monat, immer als erfüllt anzeigen (historisch)
        current,
        target,
        description,
      };
    })
  );

  return NextResponse.json(statuses, { status: 200 });
}
