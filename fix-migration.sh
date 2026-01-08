#!/bin/bash
# Script zum Beheben von Prisma-Migrations-Problemen

echo "🔄 Setze Datenbank zurück..."

# Stoppe Docker Container
docker compose down

# Lösche das Datenbank-Volume (ACHTUNG: Alle Daten gehen verloren!)
read -p "⚠️  Möchtest du alle Daten löschen? (j/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Jj]$ ]]; then
  docker volume rm web_db-data 2>/dev/null || true
  echo "✅ Datenbank-Volume gelöscht"
else
  echo "❌ Abgebrochen"
  exit 1
fi

# Starte Datenbank neu
echo "🚀 Starte Datenbank neu..."
docker compose up -d

# Warte bis Datenbank bereit ist
echo "⏳ Warte auf Datenbank..."
sleep 5

# Erstelle Migrationen
echo "📦 Erstelle Migrationen..."
npx prisma migrate dev --name init

echo "✅ Fertig! Migrationen wurden erstellt."
