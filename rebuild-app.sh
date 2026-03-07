#!/bin/bash
# ===========================================
# Rebuild Celestix Electron app with production backend URL
# Usage: ./rebuild-app.sh https://your-backend.up.railway.app
# ===========================================

set -e

if [ -z "$1" ]; then
  echo "Usage: ./rebuild-app.sh <BACKEND_URL>"
  echo "Example: ./rebuild-app.sh https://celestix-backend-production.up.railway.app"
  exit 1
fi

BACKEND_URL="$1"
echo "=== Rebuilding Celestix Workspace Electron app ==="
echo "Backend URL: $BACKEND_URL"
echo ""

# Update Electron main.cjs with the production backend URL
cd frontend

# Build the frontend with the production backend URL baked in
echo "Building frontend with VITE_BACKEND_URL=$BACKEND_URL ..."
VITE_BACKEND_URL="$BACKEND_URL" npx vite build

# Also update the Electron main.cjs default
sed -i "s|process.env.CELESTIX_BACKEND || 'http://localhost:3001'|process.env.CELESTIX_BACKEND || '${BACKEND_URL}'|" electron/main.cjs

# Build Electron installer
echo "Building Electron installer..."
npx electron-builder --win

echo ""
echo "=== DONE ==="
echo "Installer is at: frontend/release/Celestix Workspace-Setup-1.0.0.exe"
echo "Share this .exe with your users!"
