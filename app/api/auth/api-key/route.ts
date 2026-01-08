import { NextResponse } from "next/server";
import { getCurrentUser, getOrCreateApiKey } from "@/lib/auth";
import { verifyCsrf } from "@/lib/csrf";

export async function GET() {
  try {
    await verifyCsrf();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { message: "Nicht authentifiziert." },
        { status: 401 }
      );
    }

    const apiKey = await getOrCreateApiKey(user.id);

    return NextResponse.json({ apiKey });
  } catch (err: any) {
    return NextResponse.json(
      { message: err.message ?? "Fehler beim Abrufen des API-Keys." },
      { status: 500 }
    );
  }
}
