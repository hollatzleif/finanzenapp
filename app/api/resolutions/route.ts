import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { verifyCsrf } from "@/lib/csrf";
import { getMonthKey } from "@/lib/recurrence";

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

  const resolutions = await query<{
    id: string;
    type: string;
    monthKey: string;
    amountThreshold: string | null;
    ratingThreshold: string | null;
    unit: string | null;
    targetAvgRating: string | null;
    reductionAmount: string | null;
    reductionUnit: string | null;
    maxAffectiveAmount: string | null;
    maxAffectiveCount: number | null;
    maxAffectivePeriod: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>(
    `SELECT id, type, "monthKey", "amountThreshold", "ratingThreshold", unit, 
            "targetAvgRating", "reductionAmount", "reductionUnit", 
            "maxAffectiveAmount", "maxAffectiveCount", "maxAffectivePeriod",
            "createdAt", "updatedAt"
     FROM "Resolution"
     WHERE "userId" = $1 AND "monthKey" = $2
     ORDER BY "createdAt" ASC`,
    [user.id, monthKey]
  );

  return NextResponse.json(
    resolutions.map((r) => ({
      id: r.id,
      type: r.type,
      monthKey: r.monthKey,
      amountThreshold: r.amountThreshold ? parseFloat(r.amountThreshold) : null,
      ratingThreshold: r.ratingThreshold ? parseFloat(r.ratingThreshold) : null,
      unit: r.unit,
      targetAvgRating: r.targetAvgRating ? parseFloat(r.targetAvgRating) : null,
      reductionAmount: r.reductionAmount ? parseFloat(r.reductionAmount) : null,
      reductionUnit: r.reductionUnit,
      maxAffectiveAmount: r.maxAffectiveAmount ? parseFloat(r.maxAffectiveAmount) : null,
      maxAffectiveCount: r.maxAffectiveCount,
      maxAffectivePeriod: r.maxAffectivePeriod,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    { status: 200 }
  );
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { message: "Nicht authentifiziert." },
      { status: 401 }
    );
  }

  try {
    await verifyCsrf();
  } catch {
    return NextResponse.json(
      { message: "CSRF-Token ungültig." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const {
    type,
    monthKey,
    amountThreshold,
    ratingThreshold,
    unit,
    targetAvgRating,
    reductionAmount,
    reductionUnit,
    maxAffectiveAmount,
    maxAffectiveCount,
    maxAffectivePeriod,
  } = body;

  // Validierung
  if (!type || !monthKey) {
    return NextResponse.json(
      { message: "type und monthKey sind erforderlich." },
      { status: 400 }
    );
  }

  // Prüfe ob bereits 9 Vorsätze für diesen Monat existieren
  const existingCount = await query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM "Resolution"
     WHERE "userId" = $1 AND "monthKey" = $2`,
    [user.id, monthKey]
  );

  if (parseInt(existingCount[0].count) >= 9) {
    return NextResponse.json(
      { message: "Maximal 9 Vorsätze pro Monat erlaubt." },
      { status: 400 }
    );
  }

  // Erstelle Vorsatz
  const result = await query<{ id: string }>(
    `INSERT INTO "Resolution" 
     ("id", "userId", "type", "monthKey", "amountThreshold", "ratingThreshold", 
      "unit", "targetAvgRating", "reductionAmount", "reductionUnit", 
      "maxAffectiveAmount", "maxAffectiveCount", "maxAffectivePeriod", 
      "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
     RETURNING id`,
    [
      user.id,
      type,
      monthKey,
      amountThreshold ?? null,
      ratingThreshold ?? null,
      unit ?? null,
      targetAvgRating ?? null,
      reductionAmount ?? null,
      reductionUnit ?? null,
      maxAffectiveAmount ?? null,
      maxAffectiveCount ?? null,
      maxAffectivePeriod ?? null,
    ]
  );

  return NextResponse.json(
    { id: result[0].id, message: "Vorsatz erstellt." },
    { status: 201 }
  );
}
