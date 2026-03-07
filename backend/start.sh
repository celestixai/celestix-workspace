#!/bin/sh
set -e

echo "Waiting for database..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if npx prisma db push --skip-generate 2>/dev/null; then
    echo "Database ready!"
    break
  fi
  echo "Attempt $i failed, retrying in 5s..."
  sleep 5
done

echo "Starting server..."
node dist/index.js
