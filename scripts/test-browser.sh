#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p .local
docker compose up -d --wait db
if ! docker exec academic-pathfinder-db psql -U planner -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='pathfinder_browser_test'" | rg -q 1; then
  docker exec academic-pathfinder-db createdb -U planner pathfinder_browser_test
fi
./mvnw -q -f backend/pom.xml package -DskipTests
JDK="$ROOT/.tools/jdk/usr/lib/jvm/java-21-openjdk-amd64"
JAVA_BIN=java
if [ -x "$JDK/bin/java" ]; then JAVA_BIN="$JDK/bin/java"; fi
DATABASE_URL=jdbc:postgresql://127.0.0.1:5432/pathfinder_browser_test PORT=8081 "$JAVA_BIN" -jar backend/target/academic-pathfinder-1.0.0.jar > .local/browser-backend.log 2>&1 &
BACKEND_PID=$!
API_PROXY_TARGET=http://127.0.0.1:8081 node frontend/node_modules/vite/bin/vite.js frontend --config frontend/vite.config.ts --host 127.0.0.1 --port 5174 > .local/browser-frontend.log 2>&1 &
FRONTEND_PID=$!
cleanup(){ kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
for ((i=0;i<60;i++)); do
  if curl -fsS http://127.0.0.1:8081/api/health >/dev/null 2>&1 && curl -fsS http://127.0.0.1:5174 >/dev/null 2>&1; then break; fi
  if ! kill -0 "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null; then cat .local/browser-backend.log .local/browser-frontend.log; exit 1; fi
  sleep 1
done
curl -fsS http://127.0.0.1:8081/api/health >/dev/null
cd frontend
APP_URL=http://127.0.0.1:5174 npm run test:e2e
