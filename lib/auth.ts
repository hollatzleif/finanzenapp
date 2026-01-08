import { cookies, headers } from "next/headers";
import { randomUUID, randomBytes } from "crypto";
import { query, queryOne } from "./db";
import { z } from "zod";

const SESSION_COOKIE_NAME = "finanzapp_session";

const usernameSchema = z
  .string()
  .min(3, "Benutzername muss mindestens 3 Zeichen haben.")
  .regex(/^[a-zA-Z0-9_-]+$/, "Nur a-z, A-Z, 0-9, _ und - sind erlaubt.");

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET ist nicht gesetzt oder zu kurz. Bitte in der .env konfigurieren."
    );
  }
  return secret;
}

export function validateUsername(username: string) {
  return usernameSchema.parse(username);
}

export function generateApiKey(): string {
  // Generiere einen sicheren API-Key: 32 Bytes Base64-encoded
  const bytes = randomBytes(32);
  return `fin_${bytes.toString("base64url")}`;
}

export async function createUser(username: string) {
  const valid = validateUsername(username);
  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM "User" WHERE username = $1',
    [valid]
  );
  if (existing) {
    throw new Error("Benutzername ist bereits vergeben.");
  }
  const id = randomUUID();
  const apiKey = generateApiKey();
  await query(
    'INSERT INTO "User" (id, username, "apiKey", "createdAt") VALUES ($1, $2, $3, NOW())',
    [id, valid, apiKey]
  );
  return { id, username: valid, apiKey };
}

export async function getUserByApiKey(apiKey: string) {
  return queryOne<{ id: string; username: string }>(
    'SELECT id, username FROM "User" WHERE "apiKey" = $1',
    [apiKey]
  );
}

export async function getOrCreateApiKey(userId: string): Promise<string> {
  const user = await queryOne<{ apiKey: string | null }>(
    'SELECT "apiKey" FROM "User" WHERE id = $1',
    [userId]
  );
  
  if (!user) {
    throw new Error("Benutzer nicht gefunden.");
  }
  
  if (user.apiKey) {
    return user.apiKey;
  }
  
  // Generiere neuen API-Key falls keiner existiert
  let apiKey: string;
  let attempts = 0;
  do {
    apiKey = generateApiKey();
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM "User" WHERE "apiKey" = $1',
      [apiKey]
    );
    if (!existing) {
      await query(
        'UPDATE "User" SET "apiKey" = $1 WHERE id = $2',
        [apiKey, userId]
      );
      return apiKey;
    }
    attempts++;
    if (attempts > 10) {
      throw new Error("Konnte keinen eindeutigen API-Key generieren.");
    }
  } while (true);
}

export async function findUserByUsername(username: string) {
  const valid = validateUsername(username);
  return queryOne<{ id: string; username: string; createdAt: Date }>(
    'SELECT id, username, "createdAt" FROM "User" WHERE username = $1',
    [valid]
  );
}

export interface SessionInfo {
  userId: string;
  sessionId: string;
}

export async function createSession(userId: string): Promise<SessionInfo> {
  const ttlHours = 24 * 30; // 30 Tage
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
  const sessionId = randomUUID();

  await query(
    'INSERT INTO "Session" (id, "userId", "createdAt", "expiresAt") VALUES ($1, $2, $3, $4)',
    [sessionId, userId, now, expiresAt]
  );

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return { userId, sessionId };
}

export async function destroySession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    await query(
      'UPDATE "Session" SET "revokedAt" = NOW() WHERE id = $1 AND "revokedAt" IS NULL',
      [sessionId]
    );
  }

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const now = new Date();
  const session = await queryOne<{
    userId: string;
    username: string;
    sessionId: string;
  }>(
    `SELECT s.id as "sessionId", u.id as "userId", u.username 
     FROM "Session" s 
     JOIN "User" u ON s."userId" = u.id 
     WHERE s.id = $1 AND s."revokedAt" IS NULL AND s."expiresAt" > $2`,
    [sessionId, now]
  );

  if (!session) return null;

  return {
    id: session.userId,
    username: session.username,
    sessionId: session.sessionId,
  };
}

export async function getUserWithApiKey(userId: string) {
  const user = await queryOne<{ id: string; username: string; apiKey: string | null }>(
    'SELECT id, username, "apiKey" FROM "User" WHERE id = $1',
    [userId]
  );
  return user;
}

// Einfache In-Memory-Rate-Limiting-Strategie pro IP für Auth-Routen
type RateEntry = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 Minuten
const RATE_LIMIT_MAX = 50;

const rateStore = new Map<string, RateEntry>();

export async function checkAuthRateLimit() {
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    "unknown";

  const key = `auth:${ip}`;
  const now = Date.now();
  const existing = rateStore.get(key);

  if (!existing || existing.resetAt < now) {
    rateStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return;
  }

  if (existing.count >= RATE_LIMIT_MAX) {
    throw new Error("Zu viele Anfragen. Bitte warte einen Moment.");
  }

  existing.count += 1;
  rateStore.set(key, existing);
}
