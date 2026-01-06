import { NextResponse } from "next/server";
import { createSession, createUser, checkAuthRateLimit } from "@/lib/auth";
import { verifyCsrf } from "@/lib/csrf";

export async function POST(req: Request) {
  try {
    await checkAuthRateLimit();
    await verifyCsrf();

    const body = await req.json();
    const username = body?.username;
    if (typeof username !== "string") {
      return NextResponse.json(
        { message: "Benutzername ist erforderlich." },
        { status: 400 }
      );
    }

    const user = await createUser(username);
    await createSession(user.id);

    return NextResponse.json(
      {
        id: user.id,
        username: user.username,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Registrierungsfehler:", err);
    const isDbError = err?.code === "ENOTFOUND" || err?.code === "ECONNREFUSED" || err?.message?.includes("getaddrinfo");
    
    if (isDbError) {
      return NextResponse.json(
        { 
          message: "Datenbankverbindung fehlgeschlagen. Bitte versuche es später erneut.",
          error: process.env.NODE_ENV === "development" ? err.message : undefined
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        message: err.message ?? "Registrierung fehlgeschlagen.",
        error: process.env.NODE_ENV === "development" ? err.message : undefined
      },
      { status: 400 }
    );
  }
}

