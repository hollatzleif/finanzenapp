import { NextResponse } from "next/server";
import { query, queryOne, db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { verifyCsrf } from "@/lib/csrf";

interface RouteParams {
  params: Promise<{
    definitionId: string;
  }>;
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    await verifyCsrf();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { message: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const { definitionId } = await params;
    const definition = await queryOne<{
      userId: string;
      isRecurring: boolean;
    }>(
      `SELECT "userId", "isRecurring" FROM "ExpenseDefinition" WHERE id = $1`,
      [definitionId]
    );

    if (!definition || definition.userId !== user.id) {
      return NextResponse.json(
        { message: "Ausgabedefinition nicht gefunden." },
        { status: 404 }
      );
    }

    if (!definition.isRecurring) {
      return NextResponse.json(
        { message: "Diese Ausgabe ist nicht wiederkehrend." },
        { status: 400 }
      );
    }

    // Setze isRecurring auf false, damit keine neuen Instances mehr erzeugt werden
    await query(
      `UPDATE "ExpenseDefinition" 
       SET "isRecurring" = false
       WHERE id = $1`,
      [definitionId]
    );

    return NextResponse.json(
      { message: "Wiederkehrende Ausgabe wurde beendet." },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { message: err.message ?? "Ausgabe konnte nicht beendet werden." },
      { status: 400 }
    );
  }
}
