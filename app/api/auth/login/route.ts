import { NextResponse } from "next/server";
import {
  checkAuthRateLimit,
  createSession,
  findUserByUsername,
} from "@/lib/auth";
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

    const user = await findUserByUsername(username);
    if (!user) {
      return NextResponse.json(
        { message: "Benutzer existiert nicht." },
        { status: 400 }
      );
    }

    await createSession(user.id);

    return NextResponse.json(
      {
        id: user.id,
        username: user.username,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { message: err.message ?? "Login fehlgeschlagen." },
      { status: 400 }
    );
  }
}

