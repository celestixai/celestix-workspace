#!/bin/sh
echo "=== Celestix Backend Starting ==="
echo "PORT=${PORT:-3001}"
echo "NODE_ENV=${NODE_ENV:-production}"
echo "Checking dist/index.js..."
ls -la dist/index.js 2>&1 || echo "dist/index.js NOT FOUND"
echo "Starting node..."
node dist/index.js 2>&1
EXIT_CODE=$?
echo "=== Node exited with code: $EXIT_CODE ==="
