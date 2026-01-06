import { NextResponse } from "next/server";
import { query, queryOne, db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { verifyCsrf } from "@/lib/csrf";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  try {
    await verifyCsrf();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { message: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { amount, purpose, isRecurring, intervalType, intervalEvery } = body;

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { message: "Betrag muss eine positive Zahl sein." },
        { status: 400 }
      );
    }

    if (typeof purpose !== "string" || !purpose.trim()) {
      return NextResponse.json(
        { message: "Zweck ist erforderlich." },
        { status: 400 }
      );
    }

    const now = new Date();
    const isRec: boolean = Boolean(isRecurring);

    let finalIntervalType: "EINMALIG" | "TAGE" | "WOCHEN" | "MONATE" | "JAHRE" =
      "EINMALIG";
    let finalIntervalEvery = 1;

    if (isRec) {
      if (
        intervalType !== "TAGE" &&
        intervalType !== "WOCHEN" &&
        intervalType !== "MONATE" &&
        intervalType !== "JAHRE"
      ) {
        return NextResponse.json(
          { message: "Ungültiger Intervall-Typ." },
          { status: 400 }
        );
      }

      if (
        typeof intervalEvery !== "number" ||
        !Number.isInteger(intervalEvery) ||
        intervalEvery < 1
      ) {
        return NextResponse.json(
          { message: "Intervall-Wert muss eine positive ganze Zahl sein." },
          { status: 400 }
        );
      }
      finalIntervalType = intervalType;
      finalIntervalEvery = intervalEvery;
    }

    const anchorDayOfMonth =
      isRec && (finalIntervalType === "MONATE" || finalIntervalType === "JAHRE")
        ? now.getDate()
        : null;

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      const defId = randomUUID();
      const amountStr = amount.toFixed(2);
      const monthKey = `${now.getFullYear()}-${(now.getMonth() + 1)
        .toString()
        .padStart(2, "0")}`;

      const intervalSnapshot = isRec
        ? `alle ${finalIntervalEvery} ${
            finalIntervalType === "TAGE"
              ? "Tage"
              : finalIntervalType === "WOCHEN"
              ? "Wochen"
              : finalIntervalType === "MONATE"
              ? "Monate"
              : "Jahre"
          }`
        : "einmalig";

      await client.query(
        `INSERT INTO "ExpenseDefinition" (id, "userId", purpose, amount, "isRecurring", "intervalType", "intervalEvery", "startDate", "anchorDayOfMonth", "timesCharged", "totalPaid", "lastChargedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $4, $8)`,
        [
          defId,
          user.id,
          purpose.trim(),
          amountStr,
          isRec,
          finalIntervalType,
          finalIntervalEvery,
          now,
          anchorDayOfMonth,
        ]
      );

      const instanceId = randomUUID();
      await client.query(
        `INSERT INTO "ExpenseInstance" (id, "userId", "definitionId", "purposeSnapshot", "amountSnapshot", "chargedAt", "monthKey", "isRecurringSnapshot", "intervalSnapshot", "ratingStatus")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'UNBEWERTET')`,
        [
          instanceId,
          user.id,
          defId,
          purpose.trim(),
          amountStr,
          now,
          monthKey,
          isRec,
          intervalSnapshot,
        ]
      );

      await client.query("COMMIT");

      return NextResponse.json(
        {
          definitionId: defId,
          instanceId: instanceId,
        },
        { status: 201 }
      );
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    return NextResponse.json(
      { message: err.message ?? "Ausgabe konnte nicht erstellt werden." },
      { status: 400 }
    );
  }
}
