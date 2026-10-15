#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
docker compose up -d --wait db
if ! docker exec academic-pathfinder-db psql -U planner -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='pathfinder_test'" | grep -q '^1$'; then
  docker exec academic-pathfinder-db createdb -U planner pathfinder_test
fi
./mvnw -B -q -f backend/pom.xml -Pintegration verify
