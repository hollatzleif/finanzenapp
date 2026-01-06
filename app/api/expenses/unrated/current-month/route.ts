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
    id: string;
    purposeSnapshot: string;
    amountSnapshot: string;
    chargedAt: Date;
    isRecurringSnapshot: boolean;
    intervalSnapshot: string;
    ratingStatus: string;
    definitionId: string;
  }>(
    `SELECT ei.id, ei."purposeSnapshot", ei."amountSnapshot", ei."chargedAt", 
            ei."isRecurringSnapshot", ei."intervalSnapshot", ei."ratingStatus", ei."definitionId"
     FROM "ExpenseInstance" ei
     WHERE ei."userId" = $1 AND ei."monthKey" = $2 AND ei."ratingStatus" = 'UNBEWERTET'
     ORDER BY ei."chargedAt" ASC`,
    [user.id, monthKey]
  );

  const definitions = await query<{
    id: string;
    isRecurring: boolean;
    timesCharged: number;
    totalPaid: string;
  }>(
    `SELECT id, "isRecurring", "timesCharged", "totalPaid"
     FROM "ExpenseDefinition"
     WHERE id = ANY($1::text[])`,
    [instances.map(i => i.definitionId)]
  );

  const defMap = new Map(definitions.map(d => [d.id, d]));

  const result = instances.map((inst) => {
    const def = defMap.get(inst.definitionId);
    return {
      id: inst.id,
      purposeSnapshot: inst.purposeSnapshot,
      amountSnapshot: parseFloat(inst.amountSnapshot),
      chargedAt: inst.chargedAt.toISOString(),
      isRecurringSnapshot: inst.isRecurringSnapshot,
      intervalSnapshot: inst.intervalSnapshot,
      ratingStatus: inst.ratingStatus,
      timesCharged: def?.isRecurring ? def.timesCharged : undefined,
      totalPaid: def?.isRecurring ? parseFloat(def.totalPaid) : undefined,
    };
  });

  return NextResponse.json(result, { status: 200 });
}
