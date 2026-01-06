import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { verifyCsrf } from "@/lib/csrf";

export async function POST() {
  try {
    await verifyCsrf();
    await destroySession();
    return NextResponse.json({ message: "Abgemeldet." }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { message: err.message ?? "Logout fehlgeschlagen." },
      { status: 400 }
    );
  }
}

