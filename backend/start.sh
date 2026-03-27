#!/bin/sh

echo "Starting Celestix Workspace backend..."
echo "PORT: ${PORT:-3001}"

# Run prisma db push with timeout - don't let it hang
timeout 30 npx prisma db push --skip-generate --accept-data-loss 2>&1 || echo "DB push skipped or timed out - starting server anyway"

echo "Starting server on port ${PORT:-3001}..."
exec node dist/index.js
