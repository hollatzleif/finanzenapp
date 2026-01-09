import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { verifyCsrf } from "@/lib/csrf";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function PUT(
  req: Request,
  { params }: RouteParams
) {
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

  const { id } = await params;
  const body = await req.json();
  const {
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

  // Prüfe ob Vorsatz existiert und dem User gehört
  const existing = await query<{ userId: string }>(
    `SELECT "userId" FROM "Resolution" WHERE id = $1`,
    [id]
  );

  if (existing.length === 0) {
    return NextResponse.json(
      { message: "Vorsatz nicht gefunden." },
      { status: 404 }
    );
  }

  if (existing[0].userId !== user.id) {
    return NextResponse.json(
      { message: "Keine Berechtigung." },
      { status: 403 }
    );
  }

  // Update
  await query(
    `UPDATE "Resolution"
     SET "amountThreshold" = $1, "ratingThreshold" = $2, "unit" = $3,
         "targetAvgRating" = $4, "reductionAmount" = $5, "reductionUnit" = $6,
         "maxAffectiveAmount" = $7, "maxAffectiveCount" = $8, 
         "maxAffectivePeriod" = $9, "updatedAt" = NOW()
     WHERE id = $10`,
    [
      amountThreshold ?? null,
      ratingThreshold ?? null,
      unit ?? null,
      targetAvgRating ?? null,
      reductionAmount ?? null,
      reductionUnit ?? null,
      maxAffectiveAmount ?? null,
      maxAffectiveCount ?? null,
      maxAffectivePeriod ?? null,
      id,
    ]
  );

  return NextResponse.json(
    { message: "Vorsatz aktualisiert." },
    { status: 200 }
  );
}

export async function DELETE(
  req: Request,
  { params }: RouteParams
) {
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

  const { id } = await params;

  // Prüfe ob Vorsatz existiert und dem User gehört
  const existing = await query<{ userId: string }>(
    `SELECT "userId" FROM "Resolution" WHERE id = $1`,
    [id]
  );

  if (existing.length === 0) {
    return NextResponse.json(
      { message: "Vorsatz nicht gefunden." },
      { status: 404 }
    );
  }

  if (existing[0].userId !== user.id) {
    return NextResponse.json(
      { message: "Keine Berechtigung." },
      { status: 403 }
    );
  }

  // Lösche
  await query(`DELETE FROM "Resolution" WHERE id = $1`, [id]);

  return NextResponse.json(
    { message: "Vorsatz gelöscht." },
    { status: 200 }
  );
}
