#!/bin/sh
echo "Starting Celestix Workspace backend on port ${PORT:-3001}..."
exec node dist/index.js
