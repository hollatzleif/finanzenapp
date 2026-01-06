# Deployment-Anleitung: Finanzapp auf Render & Netlify

Diese Anleitung zeigt, wie du die Finanzapp kostenlos auf Render (empfohlen) oder Netlify + Render hostest.

## 🎯 Option 1: Render (Empfohlen - Einfachste Lösung)

Render kann die komplette Next.js-App inkl. API Routes und die PostgreSQL-Datenbank hosten.

### Schritt 0: Erste Migration erstellen (Lokal) ⚠️ WICHTIG

**Bevor du deployst, musst du die erste Migration erstellen!**

1. Stelle sicher, dass deine lokale Datenbank läuft (Docker Compose):
```bash
cd web
docker compose up -d
```

2. Erstelle die Migration:
```bash
npx prisma migrate dev --name init
```

3. Committe die Migration-Dateien:
```bash
git add prisma/migrations
git commit -m "Add initial database migration"
git push origin main
```

⚠️ **Ohne Migrationen funktioniert die App nicht!** Die Migrationen müssen im Repository sein, damit sie beim Deployment ausgeführt werden können.

### Schritt 1: GitHub Repository vorbereiten

1. Stelle sicher, dass dein Code auf GitHub ist:
```bash
cd web
git add .
git commit -m "Add deployment configuration"
git push origin main
```

### Schritt 2: Render Account erstellen

1. Gehe zu https://render.com und erstelle einen kostenlosen Account
2. Verbinde dein GitHub-Account

### Schritt 3: PostgreSQL Datenbank erstellen

1. Klicke auf "New +" → "PostgreSQL"
2. Name: `finanzapp-db`
3. Plan: **Free** (kostenlos)
4. Database: `finanzapp`
5. User: `finanzapp`
6. Klicke auf "Create Database"
7. **WICHTIG**: Kopiere die "Internal Database URL" (wird später benötigt)

### Schritt 4: Datenbank-Migrationen ausführen

1. Öffne die Render Shell (in der Datenbank-Übersicht)
2. Führe aus:
```bash
npx prisma migrate deploy
```

Oder lokal mit der Render-Datenbank-URL:
```bash
DATABASE_URL="<deine-render-db-url>" npx prisma migrate deploy
```

### Schritt 5: Web Service erstellen

1. Klicke auf "New +" → "Web Service"
2. Verbinde dein GitHub-Repository
3. Wähle das Repository aus
4. Konfiguration:
   - **Name**: `finanzapp`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: **Free** (kostenlos)

5. **Environment Variables** hinzufügen:
   - `DATABASE_URL`: Die "Internal Database URL" aus Schritt 3
   - `NODE_ENV`: `production`
   - `SESSION_SECRET`: Generiere einen zufälligen String (mind. 16 Zeichen, z.B. mit `openssl rand -base64 32`)
   - `CSRF_SECRET`: Generiere einen zufälligen String (mind. 16 Zeichen, z.B. mit `openssl rand -base64 32`)
   
   ⚠️ **WICHTIG**: Beide Secrets müssen gesetzt sein, sonst funktioniert die Authentifizierung nicht!

6. Klicke auf "Create Web Service"

### Schritt 6: Warten und testen

- Der erste Build kann 5-10 Minuten dauern
- Nach dem Build ist deine App unter `https://finanzapp.onrender.com` erreichbar

---

## 🎯 Option 2: Netlify + Render (Komplexer)

Diese Option nutzt Netlify für das Frontend und Render für die Datenbank.

### Schritt 1: PostgreSQL auf Render erstellen

Folge **Schritt 3** aus Option 1, um die Datenbank zu erstellen.

### Schritt 2: Netlify Account erstellen

1. Gehe zu https://netlify.com und erstelle einen Account
2. Verbinde dein GitHub-Account

### Schritt 3: Site auf Netlify erstellen

1. Klicke auf "Add new site" → "Import an existing project"
2. Wähle dein GitHub-Repository
3. Build settings:
   - **Base directory**: Leer lassen (da das Repository bereits im `web`-Verzeichnis liegt)
   - **Build command**: `npm install && npx prisma generate && npm run build`
   - **Publish directory**: `.next`

   ⚠️ **WICHTIG**: Wenn du einen Fehler wie "Base directory does not exist: /opt/build}" siehst:
   - Gehe zu Site settings → Build & deploy → Continuous Deployment → Build settings
   - Stelle sicher, dass das "Base directory" Feld **leer** ist (nicht `web` oder `/opt/build}`)
   - Die `netlify.toml` im Repository hat bereits die korrekte Konfiguration

4. **Environment Variables** hinzufügen:
   - `DATABASE_URL`: Die Render-Datenbank-URL
     - ⚠️ **WICHTIG**: Wenn die App auf Netlify läuft, verwende die **"External Connection String"** aus Render (nicht die "Internal Database URL")
     - Die External URL findest du in Render unter: Database → Connect → External Connection String
   - `NODE_ENV`: `production`
   - `SESSION_SECRET`: Generiere einen zufälligen String (mind. 16 Zeichen, z.B. mit `openssl rand -base64 32`)
   - `CSRF_SECRET`: Generiere einen zufälligen String (mind. 16 Zeichen, z.B. mit `openssl rand -base64 32`)
   
   ⚠️ **WICHTIG**: Beide Secrets müssen gesetzt sein, sonst funktioniert die Authentifizierung nicht!

5. Klicke auf "Deploy site"

### Schritt 4: Datenbank-Migrationen

Führe die Migrationen lokal oder über Render Shell aus:
```bash
DATABASE_URL="<deine-render-db-url>" npx prisma migrate deploy
```

---

## 🔧 Wichtige Hinweise

### Kostenlose Limits

**Render Free Tier:**
- Web Service: 750 Stunden/Monat (genug für 24/7)
- Datenbank: 90 Tage kostenlos, danach $7/Monat (oder manuell löschen/neu erstellen)
- Nach 15 Minuten Inaktivität wird der Service "eingeschlafen" (wacht beim nächsten Request auf)

**Netlify Free Tier:**
- 100 GB Bandbreite/Monat
- 300 Build-Minuten/Monat
- Serverless Functions: 125.000 Requests/Monat

### Datenbank-Migrationen

Bei jedem Deployment müssen die Migrationen ausgeführt werden. Render macht das automatisch mit dem `build` Script.

### Umgebungsvariablen

Stelle sicher, dass alle benötigten Umgebungsvariablen in den Platform-Settings gesetzt sind:
- `DATABASE_URL` - PostgreSQL Verbindungs-URL
- `NODE_ENV` - `production`
- `SESSION_SECRET` - Zufälliger String (mind. 16 Zeichen) für Session-Cookies
- `CSRF_SECRET` - Zufälliger String (mind. 16 Zeichen) für CSRF-Schutz

⚠️ **WICHTIG**: `SESSION_SECRET` und `CSRF_SECRET` sind erforderlich! Ohne sie funktioniert die Authentifizierung nicht.

### Custom Domain (Optional)

Beide Plattformen unterstützen kostenlose Custom Domains:
- **Render**: Settings → Custom Domains
- **Netlify**: Domain settings → Add custom domain

---

## 🐛 Troubleshooting

### Build schlägt fehl
- Prüfe die Build-Logs in Render/Netlify
- Stelle sicher, dass `prisma generate` im Build-Command enthalten ist

### Datenbank-Verbindung fehlgeschlagen (`getaddrinfo ENOTFOUND`)

**Symptom**: Fehler wie `getaddrinfo ENOTFOUND dpg-xxxxx` oder `ECONNREFUSED`

**Lösungen**:

1. **Prüfe die DATABASE_URL**:
   - Bei **Netlify + Render**: Verwende die **"External Connection String"** aus Render
     - Render → Database → Connect → External Connection String
   - Bei **Render (alles auf Render)**: Verwende die **"Internal Database URL"**
     - Render → Database → Connect → Internal Database URL

2. **Datenbank ist "eingeschlafen"** (Render Free Tier):
   - Render Free Tier Datenbanken schlafen nach 90 Tagen Inaktivität ein
   - Lösung: Warte 1-2 Minuten nach dem ersten Request, die DB wacht automatisch auf
   - Oder: Upgrade auf einen bezahlten Plan

3. **Datenbank läuft nicht**:
   - Prüfe in Render, ob die Datenbank läuft (Status sollte "Available" sein)
   - Starte die Datenbank neu, falls nötig

4. **Falsche URL-Format**:
   - Die URL sollte so aussehen: `postgresql://user:password@host:port/database`
   - Prüfe, ob alle Teile vorhanden sind

### "relation 'User' does not exist" oder ähnliche Fehler

**Symptom**: Fehler wie `relation "User" does not exist` beim Registrieren oder Login

**Ursache**: Die Datenbank-Tabellen wurden noch nicht erstellt (Migrationen fehlen)

**Lösung**:

1. **Prüfe, ob Migrationen im Repository existieren**:
   ```bash
   ls -la prisma/migrations
   ```
   Wenn leer oder nicht vorhanden, siehe Schritt 0 oben.

2. **Erstelle die Migrationen lokal** (falls noch nicht geschehen):
   ```bash
   cd web
   docker compose up -d  # Stelle sicher, dass DB läuft
   npx prisma migrate dev --name init
   git add prisma/migrations
   git commit -m "Add database migrations"
   git push origin main
   ```

3. **Nach dem Push**: Netlify/Render führt automatisch `prisma migrate deploy` beim Build aus

4. **Fallback**: Falls Migrationen fehlen, verwendet das Build-Script automatisch `prisma db push` (nicht ideal, aber funktioniert)

### API Routes funktionieren nicht
- Bei Netlify: Stelle sicher, dass `@netlify/plugin-nextjs` installiert ist
- Bei Render: Sollten automatisch funktionieren

---

## 📝 Nächste Schritte

1. **Monitoring**: Aktiviere Logs in Render/Netlify
2. **Backups**: Render bietet automatische Backups für die Datenbank
3. **SSL**: Beide Plattformen bieten kostenloses SSL
4. **CI/CD**: Automatisches Deployment bei jedem Git Push

Viel Erfolg! 🚀
