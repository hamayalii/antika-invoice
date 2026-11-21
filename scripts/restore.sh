#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Antika Docs — restore a PostgreSQL dump into the Docker Compose deployment.
#
# Usage (on the VPS, from the repository root):
#   ./scripts/restore.sh backups/antika_docs-20261120T101500Z.dump
#
# The script stops the API container so nothing writes while the schema is
# replaced, takes a safety backup first, then restores and restarts the API.
# Set SKIP_BACKUP=1 to skip the safety backup (not recommended).
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.docker}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$ROOT_DIR/docker-compose.yml")

usage() {
  echo "Usage: $0 <path-to.dump>" >&2
  echo "Example: $0 backups/antika_docs-20261120T101500Z.dump" >&2
  exit 1
}

[[ $# -eq 1 ]] || usage
DUMP_FILE="$1"
[[ -f "$DUMP_FILE" ]] || { echo "[restore] file not found: $DUMP_FILE" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "[restore] env file not found: $ENV_FILE" >&2; exit 1; }

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

DB_NAME="${POSTGRES_DB:-antika_docs}"
DB_USER="${POSTGRES_USER:-antika}"

echo "[restore] database: $DB_NAME"
echo "[restore] dump:     $DUMP_FILE"
echo "[restore] WARNING: this replaces the current database contents."
if [[ "${CONFIRM_RESTORE:-}" != "yes" ]]; then
  read -r -p "Type 'yes' to continue: " ANSWER
  [[ "$ANSWER" == "yes" ]] || { echo "[restore] cancelled"; exit 1; }
fi

if [[ "${SKIP_BACKUP:-0}" != "1" ]]; then
  echo "[restore] taking a safety backup first ..."
  "$SCRIPT_DIR/backup.sh"
fi

STARTED_API=0
restart_api() {
  if [[ "$STARTED_API" == "1" ]]; then
    echo "[restore] starting api ..."
    "${COMPOSE[@]}" start api >/dev/null || true
  fi
}
trap restart_api EXIT

# Avoid writes while the schema is dropped and recreated.
"${COMPOSE[@]}" stop api >/dev/null || true
STARTED_API=1

echo "[restore] restoring ..."
"${COMPOSE[@]}" exec -T postgres \
  pg_restore -U "$DB_USER" -d "$DB_NAME" \
  --clean --if-exists --no-owner --no-privileges \
  --exit-on-error --single-transaction <"$DUMP_FILE"

echo "[restore] done. The API will be restarted automatically."
