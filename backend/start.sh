#!/bin/sh

echo "Running database migrations..."
MAX_RETRIES=15
RETRY=0

while [ $RETRY -lt $MAX_RETRIES ]; do
  if npx prisma db push --skip-generate --accept-data-loss 2>&1; then
    echo "Database ready!"
    break
  fi
  RETRY=$((RETRY + 1))
  echo "Attempt $RETRY/$MAX_RETRIES failed, retrying in 5s..."
  sleep 5
done

if [ $RETRY -eq $MAX_RETRIES ]; then
  echo "WARNING: Database migration failed after $MAX_RETRIES attempts, starting anyway..."
fi

echo "Starting server on port ${PORT:-3001}..."
node dist/index.js
