import { NextResponse } from "next/server";
import { query, queryOne, db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { verifyCsrf } from "@/lib/csrf";
import { getMonthKey } from "@/lib/recurrence";

interface RouteParams {
  params: Promise<{
    instanceId: string;
  }>;
}

export async function DELETE(req: Request, { params }: RouteParams) {
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
    const instance = await queryOne<{
      userId: string;
      amountSnapshot: string;
      definitionId: string;
      monthKey: string;
      chargedAt: Date;
    }>(
      `SELECT "userId", "amountSnapshot", "definitionId", "monthKey", "chargedAt"
       FROM "ExpenseInstance" 
       WHERE id = $1`,
      [instanceId]
    );

    if (!instance || instance.userId !== user.id) {
      return NextResponse.json(
        { message: "Ausgabe nicht gefunden." },
        { status: 404 }
      );
    }

    // Prüfe, ob es der aktuelle Monat ist
    const now = new Date();
    const currentMonthKey = getMonthKey(now);
    if (instance.monthKey !== currentMonthKey) {
      return NextResponse.json(
        { message: "Löschen ist nur für den aktuellen Monat erlaubt." },
        { status: 400 }
      );
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Prüfe, ob es die erste Abbuchung einer einmaligen Ausgabe ist
      const definition = await client.query(
        `SELECT "isRecurring", "timesCharged" 
         FROM "ExpenseDefinition" 
         WHERE id = $1`,
        [instance.definitionId]
      );

      const def = definition.rows[0];
      const isFirstInstance =
        !def.isRecurring && def.timesCharged === 1;

      // Lösche die Instance
      await client.query(`DELETE FROM "ExpenseInstance" WHERE id = $1`, [
        instanceId,
      ]);

      // Aktualisiere die Definition
      const amountNum = parseFloat(instance.amountSnapshot);
      await client.query(
        `UPDATE "ExpenseDefinition" 
         SET "timesCharged" = "timesCharged" - 1,
             "totalPaid" = "totalPaid"::numeric - $1::numeric
         WHERE id = $2`,
        [amountNum, instance.definitionId]
      );

      // Wenn erste Instance einer einmaligen Ausgabe, lösche auch die Definition
      if (isFirstInstance) {
        await client.query(
          `DELETE FROM "ExpenseDefinition" WHERE id = $1`,
          [instance.definitionId]
        );
      }

      await client.query("COMMIT");

      return NextResponse.json(
        { message: "Abbuchung wurde gelöscht." },
        { status: 200 }
      );
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    return NextResponse.json(
      { message: err.message ?? "Abbuchung konnte nicht gelöscht werden." },
      { status: 400 }
    );
  }
}
