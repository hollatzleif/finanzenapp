import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureChargesUpToNow, getMonthKey } from "@/lib/recurrence";

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

  // Query-Parameter
  const { searchParams } = new URL(req.url);
  const monthKeyParam = searchParams.get("monthKey");
  const sortBy = searchParams.get("sortBy") || "date";
  const order = searchParams.get("order") || "desc";

  // Validierung: monthKey darf nicht in der Zukunft sein
  let monthKey = monthKeyParam || currentMonthKey;
  if (monthKey > currentMonthKey) {
    monthKey = currentMonthKey;
  }

  // Nur für aktuellen Monat ensureChargesUpToNow aufrufen
  if (monthKey === currentMonthKey) {
    await ensureChargesUpToNow(user.id);
  }

  // Validierung
  if (!["rating", "date", "amount"].includes(sortBy)) {
    return NextResponse.json(
      { message: "Ungültiger sortBy-Parameter." },
      { status: 400 }
    );
  }
  if (!["asc", "desc"].includes(order)) {
    return NextResponse.json(
      { message: "Ungültiger order-Parameter." },
      { status: 400 }
    );
  }

  // SQL-Order-By aufbauen (sicher gegen SQL-Injection durch Validierung)
  const orderDir = order.toUpperCase() === "ASC" ? "ASC" : "DESC";
  let orderBy = "";
  switch (sortBy) {
    case "rating":
      orderBy = `COALESCE(ei."ratingValue", 0) ${orderDir}`;
      break;
    case "date":
      orderBy = `ei."chargedAt" ${orderDir}`;
      break;
    case "amount":
      orderBy = `ei."amountSnapshot"::numeric ${orderDir}`;
      break;
    default:
      orderBy = `ei."chargedAt" DESC`;
  }

  const instances = await query<{
    id: string;
    purposeSnapshot: string;
    amountSnapshot: string;
    chargedAt: Date;
    isRecurringSnapshot: boolean;
    intervalSnapshot: string;
    ratingStatus: string;
    ratingValue: number | null;
    definitionId: string;
  }>(
    `SELECT ei.id, ei."purposeSnapshot", ei."amountSnapshot", ei."chargedAt", 
            ei."isRecurringSnapshot", ei."intervalSnapshot", ei."ratingStatus", 
            ei."ratingValue", ei."definitionId"
     FROM "ExpenseInstance" ei
     WHERE ei."userId" = $1 AND ei."monthKey" = $2
     ORDER BY ${orderBy}`,
    [user.id, monthKey]
  );

  // Monatsname aus monthKey ableiten
  const [year, month] = monthKey.split("-").map(Number);
  const monthDate = new Date(year, month - 1, 1);
  const monthName = monthDate.toLocaleString("de-DE", { month: "long", year: "numeric" });

  const result = instances.map((inst) => ({
    id: inst.id,
    purposeSnapshot: inst.purposeSnapshot,
    amountSnapshot: parseFloat(inst.amountSnapshot),
    chargedAt: inst.chargedAt.toISOString(),
    isRecurringSnapshot: inst.isRecurringSnapshot,
    intervalSnapshot: inst.intervalSnapshot,
    ratingStatus: inst.ratingStatus,
    ratingValue: inst.ratingValue !== null ? parseFloat(String(inst.ratingValue)) : null,
    definitionId: inst.definitionId,
  }));

  return NextResponse.json(
    {
      monthKey,
      monthName,
      expenses: result,
      isCurrentMonth: monthKey === currentMonthKey,
    },
    { status: 200 }
  );
}
