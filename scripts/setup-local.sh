#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then
  cp .env.example .env
fi
docker compose up -d
echo "Esperando Postgres..."
until docker compose exec -T postgres pg_isready -U pan -d pan >/dev/null 2>&1; do
  sleep 1
done
npm install
npm run migrate
echo "Listo. Corré: npm run dev"
echo "Login: admin / admin123"
