# Deployment-Anleitung: Finanzapp auf Render & Netlify

Diese Anleitung zeigt, wie du die Finanzapp kostenlos auf Render (empfohlen) oder Netlify + Render hostest.

## 🎯 Option 1: Render (Empfohlen - Einfachste Lösung)

Render kann die komplette Next.js-App inkl. API Routes und die PostgreSQL-Datenbank hosten.

### Schritt 0: Erste Migration erstellen (Lokal)

Bevor du deployst, erstelle die erste Migration lokal:

```bash
cd web
npx prisma migrate dev --name init
```

Dies erstellt die Migration-Dateien, die auf Render verwendet werden.

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

### Datenbank-Verbindung fehlgeschlagen
- Prüfe, ob `DATABASE_URL` korrekt gesetzt ist
- Stelle sicher, dass die Datenbank auf Render läuft
- Bei Render: Nutze die "Internal Database URL" (nicht die externe)

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
