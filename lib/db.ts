import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL ist nicht gesetzt. Bitte in der .env konfigurieren.");
}

// Parse DATABASE_URL und verwende explizite Parameter
const dbUrl = process.env.DATABASE_URL.replace(/\?schema=.*$/, "");
const url = new URL(dbUrl);

const pool = new Pool({
  host: url.hostname,
  port: parseInt(url.port || "5432"),
  database: url.pathname.slice(1), // entferne führendes /
  user: url.username,
  password: url.password,
});

export const db = pool;

// Helper-Funktion für einfache Abfragen
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows;
}

// Helper-Funktion für einzelne Zeilen
export async function queryOne<T = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const result = await pool.query(text, params);
  return result.rows[0] || null;
}