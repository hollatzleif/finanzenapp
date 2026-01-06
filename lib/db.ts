import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL ist nicht gesetzt. Bitte in der .env konfigurieren.");
}

// Parse DATABASE_URL und verwende explizite Parameter
let pool: Pool;

try {
  const dbUrl = process.env.DATABASE_URL.replace(/\?schema=.*$/, "");
  const url = new URL(dbUrl);

  pool = new Pool({
    host: url.hostname,
    port: parseInt(url.port || "5432"),
    database: url.pathname.slice(1), // entferne führendes /
    user: url.username,
    password: url.password,
    // SSL für Render und andere Cloud-Datenbanken
    ssl: process.env.NODE_ENV === "production" ? {
      rejectUnauthorized: false, // Render verwendet selbst-signierte Zertifikate
    } : false,
    // Connection pool settings für bessere Fehlerbehandlung
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 10,
  });

  // Test connection beim Start
  pool.on("error", (err) => {
    console.error("Unexpected error on idle client", err);
  });
} catch (error) {
  console.error("Fehler beim Erstellen des Database Pools:", error);
  throw new Error(`Ungültige DATABASE_URL: ${error instanceof Error ? error.message : String(error)}`);
}

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