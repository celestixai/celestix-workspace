#!/bin/bash
# ===========================================
# Celestix Workspace — Railway Deployment
# ===========================================
# Run this script from the celestix-workspace directory
# Prerequisites: railway CLI installed (npm i -g @railway/cli)

set -e

echo "=== Celestix Workspace Railway Deployment ==="
echo ""

# Step 1: Login
echo "Step 1: Logging into Railway..."
railway login
echo ""

# Step 2: Initialize project
echo "Step 2: Creating Railway project..."
cd backend
railway init
echo ""

# Step 3: Add PostgreSQL
echo "Step 3: Adding PostgreSQL database..."
echo ">>> Go to your Railway dashboard and add a PostgreSQL plugin to the project."
echo ">>> Railway will automatically set DATABASE_URL for the backend service."
echo ">>> Press Enter when done..."
read -r

# Step 4: Add Redis
echo "Step 4: Adding Redis..."
echo ">>> In the Railway dashboard, add a Redis plugin to the project."
echo ">>> Railway will automatically set REDIS_URL for the backend service."
echo ">>> Press Enter when done..."
read -r

# Step 5: Set environment variables
echo "Step 5: Setting environment variables..."
railway variables set NODE_ENV=production
railway variables set JWT_SECRET="$(openssl rand -hex 32)"
railway variables set SESSION_SECRET="$(openssl rand -hex 32)"
railway variables set CORS_ORIGINS="*"
railway variables set RATE_LIMIT_MAX=10000
railway variables set AUTH_RATE_LIMIT_MAX=500
railway variables set UPLOAD_RATE_LIMIT_MAX=50
railway variables set LOG_LEVEL=info
railway variables set STORAGE_PATH=./storage
echo "Environment variables set!"
echo ""

# Step 6: Deploy
echo "Step 6: Deploying backend..."
railway up --detach
echo ""

echo "Step 7: Getting your deployment URL..."
railway domain
echo ""

echo "=== DONE ==="
echo "Copy the URL above (e.g., celestix-backend-production.up.railway.app)"
echo "Then run: ./rebuild-app.sh <YOUR_RAILWAY_URL>"
