import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { query, queryOne, db } from "@/lib/db";
import { getUserByApiKey } from "@/lib/auth";
import { randomUUID } from "crypto";
import { getMonthKey } from "@/lib/recurrence";

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const apiKey = headersList.get("x-api-key") || headersList.get("authorization")?.replace("Bearer ", "");

    if (!apiKey) {
      return NextResponse.json(
        { message: "API-Key fehlt. Bitte sende 'x-api-key' Header oder 'Authorization: Bearer <key>'." },
        { status: 401 }
      );
    }

    const user = await getUserByApiKey(apiKey);
    if (!user) {
      return NextResponse.json(
        { message: "Ungültiger API-Key." },
        { status: 401 }
      );
    }

    const body = await req.json();
    let { amount, purpose, captured_at } = body;

    // Parse amount: Unterstützt sowohl Zahl als auch String wie "7,00€" oder "7.50"
    let amountValue: number;
    if (typeof amount === "number") {
      amountValue = amount;
    } else if (typeof amount === "string") {
      // Entferne €, Leerzeichen und ersetze Komma durch Punkt
      const cleaned = amount.replace(/€/g, "").replace(/\s/g, "").replace(",", ".");
      amountValue = parseFloat(cleaned);
      if (isNaN(amountValue)) {
        return NextResponse.json(
          { message: `Ungültiger Betrag: "${amount}". Erwartet wird eine Zahl oder String wie "7,00€".` },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { message: "Betrag muss eine Zahl oder String sein." },
        { status: 400 }
      );
    }

    if (amountValue <= 0) {
      return NextResponse.json(
        { message: "Betrag muss größer als 0 sein." },
        { status: 400 }
      );
    }

    // Trimme purpose (kann führende Leerzeichen haben)
    if (typeof purpose !== "string") {
      return NextResponse.json(
        { message: "Zweck muss ein String sein." },
        { status: 400 }
      );
    }
    purpose = purpose.trim();
    if (!purpose) {
      return NextResponse.json(
        { message: "Zweck ist erforderlich." },
        { status: 400 }
      );
    }

    // Parse captured_at: Unterstützt deutsches Format "08.01.2026, 14:50" oder ISO-Format
    let chargedAt: Date;
    if (captured_at) {
      if (typeof captured_at !== "string") {
        return NextResponse.json(
          { message: "captured_at muss ein String sein." },
          { status: 400 }
        );
      }

      // Versuche deutsches Format: "DD.MM.YYYY, HH:mm"
      const germanDateMatch = captured_at.match(/^(\d{2})\.(\d{2})\.(\d{4}),\s*(\d{2}):(\d{2})/);
      if (germanDateMatch) {
        const [, day, month, year, hour, minute] = germanDateMatch;
        chargedAt = new Date(
          parseInt(year),
          parseInt(month) - 1, // Monate sind 0-indexiert
          parseInt(day),
          parseInt(hour),
          parseInt(minute)
        );
      } else {
        // Versuche ISO-Format oder Standard Date.parse
        chargedAt = new Date(captured_at);
      }

      if (isNaN(chargedAt.getTime())) {
        return NextResponse.json(
          { message: `Ungültiges Datum-Format: "${captured_at}". Erwartet wird "DD.MM.YYYY, HH:mm" oder ISO-Format.` },
          { status: 400 }
        );
      }
    } else {
      chargedAt = new Date();
    }

    const monthKey = getMonthKey(chargedAt);
    const amountStr = amountValue.toFixed(2);

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Erstelle eine einmalige ExpenseDefinition
      const defId = randomUUID();
      await client.query(
        `INSERT INTO "ExpenseDefinition" (id, "userId", purpose, amount, "isRecurring", "intervalType", "intervalEvery", "startDate", "anchorDayOfMonth", "timesCharged", "totalPaid", "lastChargedAt")
         VALUES ($1, $2, $3, $4, false, 'EINMALIG', 1, $5, NULL, 1, $4, $5)`,
        [defId, user.id, purpose, amountStr, chargedAt]
      );

      // Erstelle ExpenseInstance
      const instanceId = randomUUID();
      await client.query(
        `INSERT INTO "ExpenseInstance" (id, "userId", "definitionId", "purposeSnapshot", "amountSnapshot", "chargedAt", "monthKey", "isRecurringSnapshot", "intervalSnapshot", "ratingStatus")
         VALUES ($1, $2, $3, $4, $5, $6, $7, false, 'einmalig', 'UNBEWERTET')`,
        [instanceId, user.id, defId, purpose, amountStr, chargedAt, monthKey]
      );

      await client.query("COMMIT");

      return NextResponse.json(
        {
          success: true,
          definitionId: defId,
          instanceId: instanceId,
          message: "Ausgabe erfolgreich hinzugefügt.",
        },
        { status: 201 }
      );
    } catch (err: any) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: err.message ?? "Ausgabe konnte nicht erstellt werden." },
        { status: 500 }
      );
    } finally {
      client.release();
    }
  } catch (err: any) {
    return NextResponse.json(
      { message: err.message ?? "Fehler beim Verarbeiten der Anfrage." },
      { status: 400 }
    );
  }
}
