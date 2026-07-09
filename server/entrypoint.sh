#!/bin/sh
set -e

cd /app

# Ensure the directory for the SQLite file exists (Zeabur volume at /data).
db_dir=$(dirname "${DATABASE_URL:-/data/maestro.db}")
mkdir -p "$db_dir"

echo "Running migrations against ${DATABASE_URL}..."
migr up

echo "Starting server..."
exec maestro-server
