#!/usr/bin/env bash
# Free port 3000 from orphaned builderbackend dev servers before nest watch starts.
# Without this, a second `bun run start:dev` leaves the old dist/main bound → EADDRINUSE.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-3000}"

for pid in $(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true); do
  cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  if [[ "$cmd" == *"$ROOT/dist/main"* ]]; then
    kill -9 "$pid" 2>/dev/null || true
  fi
done

pkill -f "$ROOT/node_modules/.bin/nest start --watch" 2>/dev/null || true

sleep 0.3
