import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { verifyCsrf } from "@/lib/csrf";

const MAX_DURATION_SECONDS = 4 * 60 * 60; // 4 Stunden

// Timer-Modi
const MODES = {
  SHORT: { learn: 25 * 60, pause: 5 * 60 }, // 25/5 Minuten
  LONG: { learn: 50 * 60, pause: 10 * 60 }, // 50/10 Minuten
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { message: "Nicht authentifiziert." },
      { status: 401 }
    );
  }

  const timer = await queryOne<{
    id: string;
    mode: string;
    startTime: Date;
    currentPhase: string;
    phaseStartTime: Date;
    totalElapsedSeconds: number;
    learnSeconds: number;
  }>(
    `SELECT id, mode, "startTime", "currentPhase", "phaseStartTime", "totalElapsedSeconds", "learnSeconds"
     FROM "Timer"
     WHERE "userId" = $1`,
    [user.id]
  );

  if (!timer) {
    return NextResponse.json({ timer: null }, { status: 200 });
  }

  // Prüfe ob Timer noch aktiv (nicht über 4h)
  const now = new Date();
  const elapsedSinceStart = Math.floor(
    (now.getTime() - timer.startTime.getTime()) / 1000
  );

  if (elapsedSinceStart >= MAX_DURATION_SECONDS) {
    // Timer ist abgelaufen, lösche ihn
    await query(`DELETE FROM "Timer" WHERE id = $1`, [timer.id]);
    return NextResponse.json({ timer: null }, { status: 200 });
  }

  return NextResponse.json({
    timer: {
      id: timer.id,
      mode: timer.mode,
      startTime: timer.startTime.toISOString(),
      currentPhase: timer.currentPhase,
      phaseStartTime: timer.phaseStartTime.toISOString(),
      totalElapsedSeconds: timer.totalElapsedSeconds,
      learnSeconds: timer.learnSeconds,
    },
  });
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
  const { mode } = body;

  if (!mode || (mode !== "SHORT" && mode !== "LONG")) {
    return NextResponse.json(
      { message: "Ungültiger Modus. Erlaubt: SHORT oder LONG." },
      { status: 400 }
    );
  }

  // Prüfe ob bereits ein Timer existiert
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM "Timer" WHERE "userId" = $1`,
    [user.id]
  );

  if (existing) {
    return NextResponse.json(
      { message: "Ein Timer läuft bereits." },
      { status: 400 }
    );
  }

  const now = new Date();

  // Erstelle neuen Timer
  const result = await query<{ id: string }>(
    `INSERT INTO "Timer" 
     ("id", "userId", "mode", "startTime", "currentPhase", "phaseStartTime", "totalElapsedSeconds", "learnSeconds", "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, $3, 'LEARN', $3, 0, 0, NOW(), NOW())
     RETURNING id`,
    [user.id, mode, now]
  );

  return NextResponse.json(
    { id: result[0].id, message: "Timer gestartet." },
    { status: 201 }
  );
}

export async function PUT(req: Request) {
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
  const { phase, totalElapsedSeconds, learnSeconds } = body;

  if (!phase || (phase !== "LEARN" && phase !== "PAUSE")) {
    return NextResponse.json(
      { message: "Ungültige Phase." },
      { status: 400 }
    );
  }

  const timer = await queryOne<{ id: string; startTime: Date; currentPhase: string; phaseStartTime: Date; learnSeconds: number }>(
    `SELECT id, "startTime", "currentPhase", "phaseStartTime", "learnSeconds" FROM "Timer" WHERE "userId" = $1`,
    [user.id]
  );

  if (!timer) {
    return NextResponse.json(
      { message: "Kein aktiver Timer gefunden." },
      { status: 404 }
    );
  }

  // Prüfe 4h Grenze
  const now = new Date();
  const elapsedSinceStart = Math.floor(
    (now.getTime() - timer.startTime.getTime()) / 1000
  );

  if (elapsedSinceStart >= MAX_DURATION_SECONDS) {
    await query(`DELETE FROM "Timer" WHERE id = $1`, [timer.id]);
    return NextResponse.json(
      { message: "Timer hat 4 Stunden erreicht." },
      { status: 400 }
    );
  }

  // Berechne zusätzliche Lernzeit wenn Phase von LEARN zu PAUSE wechselt
  let newLearnSeconds = timer.learnSeconds;
  if (timer.currentPhase === "LEARN" && phase === "PAUSE") {
    const phaseElapsed = Math.floor((now.getTime() - timer.phaseStartTime.getTime()) / 1000);
    newLearnSeconds = timer.learnSeconds + phaseElapsed;
  } else if (phase === "LEARN") {
    // Wenn zu LEARN gewechselt wird, startet neue Lernphase (keine Addition hier)
    newLearnSeconds = learnSeconds || timer.learnSeconds;
  }

  // Update Phase
  await query(
    `UPDATE "Timer"
     SET "currentPhase" = $1, "phaseStartTime" = $2, "totalElapsedSeconds" = $3, "learnSeconds" = $4, "updatedAt" = NOW()
     WHERE id = $5`,
    [phase, now, totalElapsedSeconds || 0, newLearnSeconds, timer.id]
  );

  return NextResponse.json({ message: "Timer aktualisiert." }, { status: 200 });
}

export async function DELETE() {
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

  const timer = await queryOne<{ id: string }>(
    `SELECT id FROM "Timer" WHERE "userId" = $1`,
    [user.id]
  );

  if (!timer) {
    return NextResponse.json(
      { message: "Kein aktiver Timer gefunden." },
      { status: 404 }
    );
  }

  await query(`DELETE FROM "Timer" WHERE id = $1`, [timer.id]);

  return NextResponse.json({ message: "Timer gestoppt." }, { status: 200 });
}
