import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { message: "Nicht authentifiziert." },
      { status: 401 }
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

  // Berechne Fortschritt bis nächstes Level
  const progressNeeded = userData.level * 100;
  const progressToNext = progressNeeded - userData.progress;

  return NextResponse.json(
    {
      level: userData.level,
      progress: userData.progress,
      progressNeeded,
      progressToNext,
      lCoins: parseFloat(userData.lCoins),
    },
    { status: 200 }
  );
}
