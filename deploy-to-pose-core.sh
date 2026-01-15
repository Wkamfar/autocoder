#!/bin/bash
# Deploy WIREv2 to Pose Core Droplet (165.227.68.201)
# This script uploads and deploys WIREv2 to the existing pose core server

set -e

SERVER="root@165.227.68.201"
WIRE2_DIR="wire2"
REMOTE_DIR="/opt/wire2"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🚀 Deploying WIREv2 to Pose Core Droplet...${NC}"
echo ""

# Check if we're in the right directory
if [ ! -d "$WIRE2_DIR" ]; then
    echo -e "${RED}❌ Error: wire2/ directory not found${NC}"
    echo "Please run this script from the pose-os root directory"
    exit 1
fi

echo -e "${YELLOW}📦 Step 1: Uploading WIREv2 code to server...${NC}"
# Use rsync to upload (excludes node_modules, .git, etc.)
rsync -avz --progress --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'dist' \
    --exclude 'dist-wire' \
    --exclude '*.log' \
    --exclude '.env' \
    --exclude '.env.production' \
    "$WIRE2_DIR/" "$SERVER:$REMOTE_DIR/"

echo ""
echo -e "${YELLOW}📝 Step 2: Creating .env.production on server...${NC}"
echo "⚠️  You'll need to manually create .env.production on the server"
echo "   SSH into the server and edit $REMOTE_DIR/.env.production"

echo ""
echo -e "${YELLOW}⚙️  Step 3: Setting up on server...${NC}"
ssh $SERVER << 'ENDSSH'
set -e
cd /opt/wire2

# Install Docker if not already installed
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
fi

# Install Docker Compose plugin if not installed
if ! docker compose version &> /dev/null; then
    echo "Installing Docker Compose..."
    apt-get update
    apt-get install docker-compose-plugin -y
fi

# Make deploy script executable
chmod +x deploy.sh

echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "1. Create /opt/wire2/.env.production with your configuration"
echo "2. Run: cd /opt/wire2 && ./deploy.sh"
echo "3. Configure Nginx for wire.pose.xyz"
ENDSSH

echo ""
echo -e "${GREEN}✅ Upload complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. SSH into server: ssh $SERVER"
echo "2. Create .env.production: cd /opt/wire2 && nano .env.production"
echo "3. Deploy: cd /opt/wire2 && ./deploy.sh"
echo "4. Configure Nginx (see DEPLOYMENT_OPTIONS.md)"
echo ""
echo "See QUICK_DEPLOY_GUIDE.md for detailed instructions"
