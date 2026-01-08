import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureCsrfToken } from "@/lib/csrf";

export async function GET() {
  try {
  // CSRF-Token immer setzen, damit das Frontend ihn lesen kann
  await ensureCsrfToken();
  } catch (error) {
    console.error("CSRF-Token Fehler:", error);
    return NextResponse.json(
      { 
        message: "Server-Konfigurationsfehler: CSRF_SECRET ist nicht gesetzt.",
        error: process.env.NODE_ENV === "development" ? String(error) : undefined
      },
      { status: 500 }
    );
  }
  
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { message: "Nicht authentifiziert." },
      { status: 401 }
    );
  }

  return NextResponse.json(
    { id: user.id, username: user.username },
    { status: 200 }
  );
}

