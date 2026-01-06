## FINANZAPP – Reflexive Ausgaben-Webapp

Vollständige Full-Stack-Anwendung mit:

- **Frontend**: Next.js (App Router) + TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Next.js Route Handlers (Node.js), Prisma ORM
- **Datenbank**: PostgreSQL (über Docker Compose)
- **Auth**: Nur Benutzername, Sessions per HTTP-only Cookie + Session-Tabelle
- **Features**: Wiederkehrende Abbuchungen (am Kalendertag), Bewertungen, Monatsübersicht

Alles ist **persistent**, keine Simulation.

---

## Voraussetzungen

- Node.js (empfohlen ≥ 20)
- Docker & Docker Compose

---

## Environment-Variablen

Erstelle in `web/` eine `.env` Datei mit mindestens:

```bash
DATABASE_URL="postgresql://finanzapp:finanzapp@localhost:5432/finanzapp?schema=public"
SESSION_SECRET="ein_langes_zufälliges_geheimes_session_secret"
CSRF_SECRET="ein_langes_zufälliges_geheimes_csrf_secret"
```

Hinweis:

- `SESSION_SECRET` und `CSRF_SECRET` sollten lang und zufällig sein (mind. 16 Zeichen).

---

## Datenbank starten (Docker)

Im Ordner `web/`:

```bash
docker compose up -d
```

Das startet eine PostgreSQL-Instanz auf Port `5432` mit der DB `finanzapp`.

---

## Prisma Migrations

Einmalig (bzw. bei Schema-Änderungen):

```bash
cd web
npx prisma migrate dev --name init
```

Das erzeugt die nötigen Tabellen für:

- `User`, `Session`
- `ExpenseDefinition`, `ExpenseInstance`

---

## Dev-Server starten

Im Ordner `web/`:

```bash
npm install
npm run dev
```

Dann im Browser `http://localhost:3000` öffnen.

---

## Wichtigste Routen (Frontend)

- **`/auth`** – Authentifizierung
  - Tabs: „Anmelden“ / „Registrieren“
  - Nur Benutzername, keine Passwörter
  - Eingeloggt → Redirect zu `/`

- **`/`** – Home (geschützt)
  - Zeigt Monatsübersicht (Summe & Anzahl unbewerteter Ausgaben)
  - Button „Ausgabe hinzufügen“ (Drawer)
  - Button „Ausgaben bewerten“ (Bewertungs-Panel)

Nicht eingeloggte User werden von `/` automatisch nach `/auth` umgeleitet.

---

## API-Überblick

### Auth

- `POST /api/auth/register` – `{ username }`
- `POST /api/auth/login` – `{ username }`
- `POST /api/auth/logout`
- `GET  /api/auth/me`

Sessions werden als HTTP-only Cookie gespeichert, es gibt eine `Session`-Tabelle.
Rate-Limiting auf Auth-Endpunkten ist serverseitig aktiv.

### Ausgaben

- `POST /api/expenses` – neue Ausgabe (einmalig oder wiederkehrend)
- `GET  /api/expenses/summary/current-month` – Monatsübersicht
- `GET  /api/expenses/unrated/current-month` – unbewertete Ausgaben des Monats
- `POST /api/expenses/{instanceId}/rate` – Bewertung/Lebensnotwendig markieren

Die **Recurrence Engine** (`ensureChargesUpToNow`) sorgt dafür, dass wiederkehrende
Abbuchungen immer korrekt zum Kalendertag (inkl. Sonderfälle 28./29./30./31.) erzeugt
werden und bei jedem relevanten Read (Summary & Unrated-API) nachgezogen werden.

---

## Struktur (Auszug)

- `app/`
  - `page.tsx` – geschützte Startseite
  - `auth/page.tsx` – Auth-Ansicht
  - `api/**` – alle API-Route-Handler (Auth, Expenses, Rating)
- `components/`
  - `auth/AuthPage.tsx` – UI für Anmelden/Registrieren
  - `home/HomeShell.tsx` – UI für Home, Drawer, Bewertung
- `lib/`
  - `db.ts` – Prisma Client
  - `auth.ts` – User-/Session-Handling + Rate Limiting
  - `recurrence.ts` – Recurrence Engine (Kalendertagsgenau)
  - `rating.ts` – Bewertungsformel
  - `csrf.ts` – CSRF-Token (Cookie + Header-Validierung)
- `prisma/schema.prisma` – Datenmodell
- `docker-compose.yml` – Postgres-Service

---

## Sicherheit (Kurzfassung)

- **Sessions**: HTTP-only, `SameSite=Lax`, optionale `secure`-Cookies in Production
- **CSRF**: Double-Submit-Token (Cookie + `x-csrf-token` Header) auf schreibenden Endpunkten
- **Rate Limiting**: Einfaches In-Memory-Limit für Auth-Endpoints

