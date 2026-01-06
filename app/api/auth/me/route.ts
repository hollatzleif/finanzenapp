import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureCsrfToken } from "@/lib/csrf";

export async function GET() {
  // CSRF-Token immer setzen, damit das Frontend ihn lesen kann
  await ensureCsrfToken();
  
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

