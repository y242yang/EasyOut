#!/bin/bash
# Write ~/.easyout-backup.env from a password typed at the prompt.
#
# Use after resetting the database password in the Supabase dashboard
# (Connect -> Session pooler -> Reset database password). The password is
# never echoed, never passed as an argument, and never touches shell history.
set -euo pipefail

PROJECT_REF="mknyvshurpqzpuzogsrx"
POOLER_HOST="aws-1-us-west-2.pooler.supabase.com"
CRED_FILE="$HOME/.easyout-backup.env"

if [ ! -t 0 ]; then
  echo "This script needs an interactive terminal; run it from Terminal.app." >&2
  exit 1
fi

echo "Paste the raw password, not the encoded form from a connection string."
echo "(e.g. 'pa@ss', never 'pa%40ss' — encoding is handled below.)"
read -rsp "Supabase database password: " password
echo

if [ -z "$password" ]; then
  echo "No password entered; nothing written." >&2
  exit 1
fi

# Percent-encode so passwords containing @ : / ? # & % survive the URI.
encoded=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read().rstrip("\n"), safe=""))' <<<"$password")

umask 077
printf "SUPABASE_DB_URL='postgresql://postgres.%s:%s@%s:5432/postgres'\n" \
  "$PROJECT_REF" "$encoded" "$POOLER_HOST" > "$CRED_FILE"
chmod 600 "$CRED_FILE"

echo "Wrote $CRED_FILE"
echo "Verifying connection..."
set -a && . "$CRED_FILE" && set +a
/opt/homebrew/opt/libpq/bin/psql "$SUPABASE_DB_URL" -tAc 'select 1' >/dev/null
echo "Connection OK."
