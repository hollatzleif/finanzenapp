import { query, queryOne, db } from "./db";
import { getMonthKey } from "./utils";

// Re-export for backward compatibility
export { getMonthKey };

function getIntervalSnapshot(def: {
  isRecurring: boolean;
  intervalType: string;
  intervalEvery: number;
}): string {
  if (!def.isRecurring || def.intervalType === "EINMALIG") {
    return "einmalig";
  }
  const type =
    def.intervalType === "TAGE"
      ? "Tage"
      : def.intervalType === "WOCHEN"
      ? "Wochen"
      : def.intervalType === "MONATE"
      ? "Monate"
      : "Jahre";
  return `alle ${def.intervalEvery} ${type}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

function lastDayOfMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function addMonthsAnchor(date: Date, months: number, anchorDay?: number | null): Date {
  const d = new Date(date);
  const year = d.getFullYear();
  const month0 = d.getMonth();
  const targetMonth0 = month0 + months;
  const targetYear = year + Math.floor(targetMonth0 / 12);
  const normalizedMonth0 = ((targetMonth0 % 12) + 12) % 12;

  const dayAnchor = anchorDay ?? d.getDate();
  const lastDay = lastDayOfMonth(targetYear, normalizedMonth0);
  const day = Math.min(dayAnchor, lastDay);

  return new Date(targetYear, normalizedMonth0, day, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
}

function addYearsAnchor(date: Date, years: number, anchorDay?: number | null): Date {
  return addMonthsAnchor(date, years * 12, anchorDay);
}

export async function ensureChargesUpToNow(userId: string) {
  const now = new Date();

  const defs = await query<{
    id: string;
    userId: string;
    purpose: string;
    amount: string;
    isRecurring: boolean;
    intervalType: string;
    intervalEvery: number;
    startDate: Date;
    anchorDayOfMonth: number | null;
    lastChargedAt: Date | null;
  }>(
    `SELECT id, "userId", purpose, amount, "isRecurring", "intervalType", "intervalEvery", "startDate", "anchorDayOfMonth", "lastChargedAt"
     FROM "ExpenseDefinition"
     WHERE "userId" = $1 AND "isRecurring" = true
     ORDER BY "createdAt" ASC`,
    [userId]
  );

  for (const def of defs) {
    if (!def.isRecurring) continue;

    let lastCharged = def.lastChargedAt ?? def.startDate;

    while (true) {
      let nextDue: Date;
      switch (def.intervalType) {
        case "TAGE":
          nextDue = addDays(lastCharged, def.intervalEvery);
          break;
        case "WOCHEN":
          nextDue = addWeeks(lastCharged, def.intervalEvery);
          break;
        case "MONATE":
          nextDue = addMonthsAnchor(
            lastCharged,
            def.intervalEvery,
            def.anchorDayOfMonth ?? new Date(def.startDate).getDate()
          );
          break;
        case "JAHRE":
          nextDue = addYearsAnchor(
            lastCharged,
            def.intervalEvery,
            def.anchorDayOfMonth ?? new Date(def.startDate).getDate()
          );
          break;
        case "EINMALIG":
        default:
          nextDue = lastCharged;
          break;
      }

      if (nextDue > now || def.intervalType === "EINMALIG") {
        break;
      }

      const monthKey = getMonthKey(nextDue);
      const intervalSnapshot = getIntervalSnapshot(def);

      try {
        const client = await db.connect();
        try {
          await client.query("BEGIN");
          
          const existing = await client.query(
            `SELECT id FROM "ExpenseInstance" WHERE "definitionId" = $1 AND "chargedAt" = $2`,
            [def.id, nextDue]
          );

          if (existing.rows.length > 0) {
            await client.query("ROLLBACK");
            return;
          }

          await client.query(
            `INSERT INTO "ExpenseInstance" (id, "userId", "definitionId", "purposeSnapshot", "amountSnapshot", "chargedAt", "monthKey", "isRecurringSnapshot", "intervalSnapshot", "ratingStatus")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 'UNBEWERTET')`,
            [def.userId, def.id, def.purpose, def.amount, nextDue, monthKey, def.isRecurring, intervalSnapshot]
          );

          const currentTotal = await client.query(
            `SELECT "totalPaid" FROM "ExpenseDefinition" WHERE id = $1`,
            [def.id]
          );
          const currentTotalPaid = parseFloat(currentTotal.rows[0]?.totalPaid || "0");
          const newTotalPaid = (currentTotalPaid + parseFloat(def.amount)).toFixed(2);
          await client.query(
            `UPDATE "ExpenseDefinition" 
             SET "timesCharged" = "timesCharged" + 1, 
                 "totalPaid" = $1, 
                 "lastChargedAt" = $2
             WHERE id = $3`,
            [newTotalPaid, nextDue, def.id]
          );

          await client.query("COMMIT");
        } catch {
          await client.query("ROLLBACK");
        } finally {
          client.release();
        }
      } catch {
        // Ignorieren für Idempotenz
      }

      lastCharged = nextDue;
    }
  }
}
