#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "server/.env is required" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a

export SCORING_SIMULATION=local
export SIMULATION_GROUP_ID="${1:-1}"

echo "Seeding scoring simulation into ${DATABASE_URL:-maestro.db} for group ${SIMULATION_GROUP_ID}."
echo "Stop the Maestro server before continuing; restart it afterward to run scoring."

migr up
ard-dev run simulate_scoring.ard
