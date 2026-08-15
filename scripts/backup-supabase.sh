#!/bin/bash
# Weekly local backup of the EasyOut Supabase database.
#
# The Free plan provides no downloadable backups, and the repo is public, so
# dumps must never live inside it or in GitHub Actions artifacts. Credentials
# and output both stay outside the working tree, in the user's home directory.
#
# Credentials: ~/.easyout-backup.env  (chmod 600), defining SUPABASE_DB_URL
# Output:      ~/EasyOut-backups/easyout-YYYY-MM-DD.sql.gz
set -euo pipefail

CRED_FILE="$HOME/.easyout-backup.env"
BACKUP_DIR="$HOME/EasyOut-backups"
PG_DUMP="/opt/homebrew/opt/libpq/bin/pg_dump"
KEEP_DAYS=60

if [ ! -f "$CRED_FILE" ]; then
  echo "Missing $CRED_FILE — see scripts/backup-supabase.sh header" >&2
  exit 1
fi
# shellcheck source=/dev/null
set -a && . "$CRED_FILE" && set +a

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "SUPABASE_DB_URL not set in $CRED_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

stamp=$(date +%F)
target="$BACKUP_DIR/easyout-$stamp.sql.gz"
tmp="$target.partial"

# --no-owner/--no-acl keep the dump restorable into a fresh Supabase project,
# where the original role grants do not exist.
"$PG_DUMP" "$SUPABASE_DB_URL" \
  --no-owner --no-acl \
  --schema=public --schema=auth \
  | gzip > "$tmp"

mv "$tmp" "$target"
chmod 600 "$target"
echo "$(date '+%F %T') wrote $target ($(du -h "$target" | cut -f1))"

# Prune old dumps so this never fills the disk unattended.
find "$BACKUP_DIR" -name 'easyout-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
