#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p .local
./scripts/setup-cloud-jdk.sh
./mvnw -B -q -f backend/pom.xml verify
npm ci --prefix frontend --cache "$ROOT/.cache/npm" --no-audit --no-fund
npm run build --prefix frontend
docker compose up -d --wait db
echo 'Dependencies installed, unit tests passed, frontend built and PostgreSQL healthy.'
