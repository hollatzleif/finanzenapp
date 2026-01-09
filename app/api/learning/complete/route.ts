import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne, db } from "@/lib/db";
import { verifyCsrf } from "@/lib/csrf";

function getLevelMultiplier(level: number): number {
  if (level === 1) return 1.0;
  if (level === 2) return 1.2;
  if (level >= 3) return 1.3 + (level - 3) * 0.1;
  return 1.0;
}

function calculateProgressForLevelUp(currentLevel: number): number {
  return currentLevel * 100;
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
  const { totalSeconds } = body;

  if (!totalSeconds || totalSeconds <= 0) {
    return NextResponse.json(
      { message: "Ungültige Zeit." },
      { status: 400 }
    );
  }

  // Hole Timer und User-Daten
  const timer = await queryOne<{
    id: string;
    mode: string;
    startTime: Date;
    currentPhase: string;
    phaseStartTime: Date;
    learnSeconds: number;
  }>(
    `SELECT id, mode, "startTime", "currentPhase", "phaseStartTime", "learnSeconds"
     FROM "Timer"
     WHERE "userId" = $1`,
    [user.id]
  );

  if (!timer) {
    return NextResponse.json(
      { message: "Kein aktiver Timer gefunden." },
      { status: 404 }
    );
  }

  const userData = await queryOne<{
    level: number;
    progress: number;
    lCoins: string;
  }>(
    `SELECT level, progress, "lCoins" FROM "User" WHERE id = $1`,
    [user.id]
  );

  if (!userData) {
    return NextResponse.json(
      { message: "Benutzer nicht gefunden." },
      { status: 404 }
    );
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Berechne finale Lernzeit
    const now = new Date();
    let finalLearnSeconds = timer.learnSeconds;
    
    // Wenn Timer in LEARN-Phase gestoppt wurde, addiere aktuelle Phase
    if (timer.currentPhase === "LEARN") {
      const phaseElapsed = Math.floor((now.getTime() - timer.phaseStartTime.getTime()) / 1000);
      finalLearnSeconds = timer.learnSeconds + phaseElapsed;
    }
    
    const learnMinutes = Math.floor(finalLearnSeconds / 60);
    
    // L-Coins: Vollständige 5-Minuten-Intervalle
    const completedIntervals = Math.floor(learnMinutes / 5);
    const levelMultiplier = getLevelMultiplier(userData.level);
    const lCoinsEarned = completedIntervals * levelMultiplier * 3;
    const lCoinsRounded = Math.floor(lCoinsEarned * 100) / 100; // Abrunden auf 2 Dezimalen

    // Lernfortschritt
    const newProgress = userData.progress + learnMinutes;
    const progressNeeded = calculateProgressForLevelUp(userData.level);
    
    let finalLevel = userData.level;
    let finalProgress = newProgress;
    
    // Level-Up Logik mit Überschuss
    while (finalProgress >= progressNeeded) {
      const excess = finalProgress - progressNeeded;
      finalLevel += 1;
      finalProgress = excess;
    }

    // Update User
    const newLCoins = parseFloat(userData.lCoins) + lCoinsRounded;
    
    await client.query(
      `UPDATE "User"
       SET level = $1, progress = $2, "lCoins" = $3
       WHERE id = $4`,
      [finalLevel, finalProgress, newLCoins.toFixed(2), user.id]
    );

    // Lösche Timer
    await client.query(`DELETE FROM "Timer" WHERE id = $1`, [timer.id]);

    await client.query("COMMIT");

    // Format Zeit für Anzeige
    const totalHours = Math.floor(totalSeconds / 3600);
    const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
    const timeString = `${totalHours}:${totalMinutes.toString().padStart(2, "0")} h`;

    // Berechne Fortschritt-Änderung
    const progressEarned = learnMinutes;

    return NextResponse.json(
      {
        totalTime: timeString,
        totalSeconds,
        learnMinutes,
        progressEarned,
        lCoinsEarned: lCoinsRounded,
        levelUp: finalLevel > userData.level,
        newLevel: finalLevel,
        newProgress: finalProgress,
      },
      { status: 200 }
    );
  } catch (err: any) {
    await client.query("ROLLBACK");
    return NextResponse.json(
      { message: err.message ?? "Fehler beim Abschließen." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
