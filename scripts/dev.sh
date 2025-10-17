#!/bin/bash

# daml-ci-bot development script
# This script starts the bot with smee.io for local development

set -e

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "Loading environment variables from .env file..."
    export $(grep -v '^#' .env | xargs)
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PORT=${PORT:-3000}
WEBHOOK_PROXY_URL=${WEBHOOK_PROXY_URL:-"http://localhost:$PORT"}
WEBHOOK_SECRET=${WEBHOOK_SECRET:-"development"}

echo -e "${BLUE}🚀 Starting daml-ci-bot development server...${NC}"
echo ""

# Check required environment variables
if [ -z "$APP_ID" ]; then
    echo -e "${RED}❌ Error: APP_ID environment variable is required${NC}"
    echo "   Set it to your GitHub App ID"
    exit 1
fi

if [ -z "$PRIVATE_KEY_PATH" ]; then
    echo -e "${RED}❌ Error: PRIVATE_KEY_PATH environment variable is required${NC}"
    echo "   Set it to the path of your GitHub App private key file"
    exit 1
fi

echo -e "${BLUE}📋 Configuration:${NC}"
echo "   SMEE URL: $SMEE_URL"
echo "   Port: $PORT"
echo "   Webhook Proxy URL: $WEBHOOK_PROXY_URL"
echo "   App ID: $APP_ID"
echo "   Private Key: $PRIVATE_KEY_PATH"
echo ""

# Check if smee-client is installed
if ! command -v smee-client &> /dev/null; then
    echo -e "${YELLOW}⚠️  smee-client not found. Installing...${NC}"
    npm install -g smee-client
fi

# Start smee client in background
echo -e "${BLUE}🔗 Starting smee client...${NC}"
smee-client --url "$SMEE_URL" --target "$WEBHOOK_PROXY_URL" &
SMEE_PID=$!

# Wait a moment for smee to start
sleep 2

# Start the probot app
echo -e "${BLUE}🤖 Starting probot app...${NC}"
export WEBHOOK_PROXY_URL
export WEBHOOK_SECRET
export APP_ID
export PRIVATE_KEY_PATH
export PORT

npm start &
PROBOT_PID=$!

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down...${NC}"
    kill $SMEE_PID 2>/dev/null || true
    kill $PROBOT_PID 2>/dev/null || true
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

echo -e "${GREEN}✅ Development server started!${NC}"
echo "   Press Ctrl+C to stop"
echo ""
echo -e "${BLUE}📝 Next steps:${NC}"
echo "   1. Make sure your GitHub App is configured with the webhook URL from smee.io"
echo "   2. Test by opening a pull request in a repository where the app is installed"
echo ""

# Wait for processes
wait
