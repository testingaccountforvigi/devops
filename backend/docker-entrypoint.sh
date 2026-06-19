#!/bin/sh
# =============================================================
#  LoanPro — Backend Docker Entrypoint
#  Execution order:
#    1. Wait until MySQL port is reachable
#    2. Run the database seed (idempotent — uses ON DUPLICATE KEY)
#    3. Hand off to the Node.js server via exec
# =============================================================
set -e

DB_HOST="${DB_HOST:-mysql}"
DB_PORT="${DB_PORT:-3306}"

# -------------------------------------------------------------
# 1. Poll MySQL until the TCP port accepts connections.
#    `depends_on: condition: service_healthy` already does the
#    heavy lifting; this loop is a final safety net.
# -------------------------------------------------------------
echo "[entrypoint] Waiting for MySQL at ${DB_HOST}:${DB_PORT} ..."

RETRIES=30
COUNT=0
until nc -z "${DB_HOST}" "${DB_PORT}" 2>/dev/null; do
  COUNT=$((COUNT + 1))
  if [ "${COUNT}" -ge "${RETRIES}" ]; then
    echo "[entrypoint] ERROR: MySQL not reachable after ${RETRIES} attempts. Aborting."
    exit 1
  fi
  echo "[entrypoint]   attempt ${COUNT}/${RETRIES} — sleeping 2 s …"
  sleep 2
done

echo "[entrypoint] MySQL is up — waiting 3 s for InnoDB to finish init …"
sleep 3

# -------------------------------------------------------------
# 2. Seed sample data.
#    ON DUPLICATE KEY UPDATE makes this safe to run on every
#    container start; existing rows are updated, not duplicated.
# -------------------------------------------------------------
echo "[entrypoint] Running database seed …"
node seed.js && echo "[entrypoint] Seed completed." \
             || echo "[entrypoint] Seed skipped or failed (non-fatal)."

# -------------------------------------------------------------
# 3. Start the Express server.
#    `exec` replaces the shell process so Node receives signals
#    (SIGTERM / SIGINT) from Docker directly — clean shutdowns.
# -------------------------------------------------------------
echo "[entrypoint] Starting LoanPro API …"
exec node server.js
