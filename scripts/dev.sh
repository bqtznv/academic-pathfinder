#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p .local
BACKEND_PORT="${PORT:-8080}"
export API_PROXY_TARGET="${API_PROXY_TARGET:-http://127.0.0.1:$BACKEND_PORT}"
docker compose up -d --wait db
./mvnw -q -f backend/pom.xml package -DskipTests
JAVA_BIN=java
if [ -x "$ROOT/.tools/jdk/usr/lib/jvm/java-21-openjdk-amd64/bin/java" ]; then JAVA_BIN="$ROOT/.tools/jdk/usr/lib/jvm/java-21-openjdk-amd64/bin/java"; fi
"$JAVA_BIN" -jar backend/target/academic-pathfinder-1.0.0.jar > .local/backend.log 2>&1 &
BACKEND_PID=$!
node frontend/node_modules/vite/bin/vite.js frontend --config frontend/vite.config.ts --host 0.0.0.0 --port 5173 > .local/frontend.log 2>&1 &
FRONTEND_PID=$!
cleanup(){ kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
for ((i=0;i<60;i++)); do
  if curl -fsS "http://127.0.0.1:$BACKEND_PORT/api/health" >/dev/null 2>&1 && curl -fsS http://127.0.0.1:5173 >/dev/null 2>&1; then
    echo "Academic Path Planner is running: frontend port 5173, API port $BACKEND_PORT."
    echo 'Logs: .local/frontend.log and .local/backend.log. Stop this script to stop the two app processes.'
    wait -n "$BACKEND_PID" "$FRONTEND_PID"
    exit 1
  fi
  if ! kill -0 "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null; then cat .local/backend.log .local/frontend.log; exit 1; fi
  sleep 1
done
echo 'Startup timed out. Inspect .local/backend.log and .local/frontend.log.' >&2
exit 1
