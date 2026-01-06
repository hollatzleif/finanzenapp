import { cookies, headers } from "next/headers";
import { randomBytes, timingSafeEqual } from "crypto";

const CSRF_COOKIE_NAME = "finanzapp_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";

function getCsrfSecret() {
  const secret = process.env.CSRF_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "CSRF_SECRET ist nicht gesetzt oder zu kurz. Bitte in der .env konfigurieren."
    );
  }
  return secret;
}

export async function ensureCsrfToken() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  if (existing) {
    return existing;
  }

  const secret = getCsrfSecret();
  const random = randomBytes(32).toString("hex");
  const token = `${random}.${Buffer.from(secret).toString("hex")}`;

  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // muss für JS lesbar sein, um ihn in Header zu senden
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return token;
}

export async function verifyCsrf() {
  const hdrs = await headers();
  const cookieStore = await cookies();

  const sent = hdrs.get(CSRF_HEADER_NAME);
  const cookie = cookieStore.get(CSRF_COOKIE_NAME)?.value;

  if (!sent || !cookie) {
    throw new Error("CSRF-Token fehlt.");
  }

  const sentBuf = Buffer.from(sent);
  const cookieBuf = Buffer.from(cookie);

  if (
    sentBuf.length !== cookieBuf.length ||
    !timingSafeEqual(sentBuf, cookieBuf)
  ) {
    throw new Error("CSRF-Token ungültig.");
  }
}

