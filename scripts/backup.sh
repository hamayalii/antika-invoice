#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Antika Docs — PostgreSQL backup for the Docker Compose deployment.
#
# Usage (on the VPS, from the repository root):
#   ./scripts/backup.sh
#   ENV_FILE=.env.docker BACKUP_DIR=/var/backups/antika KEEP_DAYS=30 ./scripts/backup.sh
#
# The script writes a compressed custom-format dump plus a SHA-256 checksum.
# Restore with: ./scripts/restore.sh backups/<file>.dump
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.docker}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[backup] env file not found: $ENV_FILE" >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "[backup] docker is not installed or not on PATH" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

DB_NAME="${POSTGRES_DB:-antika_docs}"
DB_USER="${POSTGRES_USER:-antika}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="$BACKUP_DIR/${DB_NAME}-${STAMP}.dump"
TMP="$TARGET.part"

mkdir -p "$BACKUP_DIR"
cleanup() {
  rm -f "$TMP"
}
trap cleanup EXIT

echo "[backup] dumping database '$DB_NAME' ..."
docker compose --env-file "$ENV_FILE" -f "$ROOT_DIR/docker-compose.yml" exec -T postgres \
  pg_dump -U "$DB_USER" -d "$DB_NAME" \
  --format=custom --compress=9 --no-owner --no-privileges >"$TMP"

mv "$TMP" "$TARGET"

if command -v sha256sum >/dev/null 2>&1; then
  (cd "$BACKUP_DIR" && sha256sum "$(basename "$TARGET")" >"$(basename "$TARGET").sha256")
elif command -v shasum >/dev/null 2>&1; then
  (cd "$BACKUP_DIR" && shasum -a 256 "$(basename "$TARGET")" >"$(basename "$TARGET").sha256")
fi

# Delete dumps older than KEEP_DAYS, together with their checksum files.
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name '*.dump' -o -name '*.dump.sha256' \) \
  -mtime +"$KEEP_DAYS" -print -delete

SIZE="$(du -h "$TARGET" | cut -f1)"
echo "[backup] wrote $TARGET ($SIZE)"
echo "[backup] retention: $KEEP_DAYS days in $BACKUP_DIR"
