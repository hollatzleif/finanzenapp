import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureChargesUpToNow, getMonthKey } from "@/lib/recurrence";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { message: "Nicht authentifiziert." },
      { status: 401 }
    );
  }

  await ensureChargesUpToNow(user.id);

  const now = new Date();
  const monthKey = getMonthKey(now);

  const instances = await query<{
    amountSnapshot: string;
    ratingStatus: string;
  }>(
    `SELECT "amountSnapshot", "ratingStatus"
     FROM "ExpenseInstance"
     WHERE "userId" = $1 AND "monthKey" = $2`,
    [user.id, monthKey]
  );

  const totalSpent = instances.reduce(
    (sum, inst) => sum + parseFloat(inst.amountSnapshot),
    0
  );

  const countUnrated = instances.filter(
    (inst) => inst.ratingStatus === "UNBEWERTET"
  ).length;

  const monthName = now.toLocaleString("de-DE", { month: "long" });

  return NextResponse.json(
    {
      monthKey,
      monthName,
      totalSpent,
      countUnrated,
    },
    { status: 200 }
  );
}
