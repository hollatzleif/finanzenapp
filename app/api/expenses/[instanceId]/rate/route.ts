import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { verifyCsrf } from "@/lib/csrf";
import { computeRating } from "@/lib/rating";
import { getMonthKey } from "@/lib/recurrence";

interface RouteParams {
  params: Promise<{
    instanceId: string;
  }>;
}

// POST für neue Bewertung, PUT für Update
export async function POST(req: Request, { params }: RouteParams) {
  return handleRate(req, params, false);
}

export async function PUT(req: Request, { params }: RouteParams) {
  return handleRate(req, params, true);
}

async function handleRate(
  req: Request,
  params: Promise<{ instanceId: string }>,
  isUpdate: boolean
) {
  try {
    await verifyCsrf();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { message: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const { instanceId } = await params;
    const instance = await queryOne<{ userId: string; monthKey: string }>(
      `SELECT "userId", "monthKey" FROM "ExpenseInstance" WHERE id = $1`,
      [instanceId]
    );

    if (!instance || instance.userId !== user.id) {
      return NextResponse.json(
        { message: "Ausgabe nicht gefunden." },
        { status: 404 }
      );
    }

    // Prüfe, ob es der aktuelle Monat ist (Bewertungen können nur im aktuellen Monat geändert werden)
    const now = new Date();
    const currentMonthKey = getMonthKey(now);
    if (instance.monthKey !== currentMonthKey) {
      return NextResponse.json(
        { message: "Bewertungen können nur für den aktuellen Monat geändert werden." },
        { status: 400 }
      );
    }

    const body = await req.json();

    if (body?.lifesaving === true) {
      await query(
        `UPDATE "ExpenseInstance" 
         SET "ratingStatus" = 'LEBENSNOTWENDIG', 
             "ratingValue" = 11.0, 
             "ratedAt" = NOW(),
             "q1Happy" = NULL,
             "q2Value" = NULL,
             "q3RepeatNow" = NULL,
             "q4NeedElsewhere" = NULL,
             "q5Planned" = NULL
         WHERE id = $1`,
        [instanceId]
      );
    } else {
      const {
        q1Happy,
        q2Value,
        q3RepeatNow,
        q4NeedElsewhere,
        q5Planned,
      } = body ?? {};

      if (
        typeof q1Happy !== "number" ||
        typeof q2Value !== "number" ||
        typeof q3RepeatNow !== "boolean" ||
        typeof q4NeedElsewhere !== "boolean" ||
        (q5Planned !== "DURCHDACHT" && q5Planned !== "AFFEKTIV")
      ) {
        return NextResponse.json(
          { message: "Bewertungsdaten sind unvollständig oder ungültig." },
          { status: 400 }
        );
      }

      const ratingValue = computeRating({
        q1Happy,
        q2Value,
        q3RepeatNow,
        q4NeedElsewhere,
        q5Planned,
      });

      await query(
        `UPDATE "ExpenseInstance" 
         SET "ratingStatus" = 'BEWERTET', 
             "ratingValue" = $1, 
             "q1Happy" = $2,
             "q2Value" = $3,
             "q3RepeatNow" = $4,
             "q4NeedElsewhere" = $5,
             "q5Planned" = $6,
             "ratedAt" = NOW()
         WHERE id = $7`,
        [
          ratingValue,
          q1Happy,
          q2Value,
          q3RepeatNow,
          q4NeedElsewhere,
          q5Planned,
          instanceId,
        ]
      );
    }

    const updated = await queryOne<{
      id: string;
      ratingStatus: string;
      ratingValue: number | null;
      ratedAt: Date | null;
    }>(
      `SELECT id, "ratingStatus", "ratingValue", "ratedAt" FROM "ExpenseInstance" WHERE id = $1`,
      [instanceId]
    );

    return NextResponse.json(
      {
        id: updated!.id,
        ratingStatus: updated!.ratingStatus,
        ratingValue: updated!.ratingValue,
        ratedAt: updated!.ratedAt,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { message: err.message ?? "Bewertung konnte nicht gespeichert werden." },
      { status: 400 }
    );
  }
}
