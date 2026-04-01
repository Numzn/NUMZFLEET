#!/bin/bash
# =========================================================================
# NumzTrak Backend-Only Deployment - Quick Start Script
# =========================================================================
# This script automates the deployment to Oracle Cloud
# 
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh <oracle-domain-or-ip> <frontend-domain>
# 
# Example:
#   ./deploy.sh numz.site app.numz.site
# =========================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =========================================================================
# Validate Input
# =========================================================================

if [ $# -lt 2 ]; then
    echo -e "${RED}Usage: $0 <oracle-ip-or-domain> <netlify-domain>${NC}"
    echo ""
    echo "Examples:"
    echo "  ./deploy.sh 123.45.67.89 my-site.netlify.app"
    echo "  ./deploy.sh api.example.com my-site.netlify.app"
    exit 1
fi

ORACLE_IP="$1"
NETLIFY_DOMAIN="$2"
DEPLOY_DIR="$HOME/numztrak"

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}NumzTrak Backend-Only Deployment${NC}"
echo -e "${BLUE}=====================================================${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  Oracle IP/Domain: ${ORACLE_IP}"
echo "  Netlify Domain: ${NETLIFY_DOMAIN}"
echo "  Deploy Directory: ${DEPLOY_DIR}"
echo ""

# =========================================================================
# Step 1: Setup Directory
# =========================================================================

echo -e "${BLUE}[1/8] Creating deployment directory...${NC}"
mkdir -p "${DEPLOY_DIR}/conf"
mkdir -p "${DEPLOY_DIR}/nginx"
mkdir -p "${DEPLOY_DIR}/logs"
cd "${DEPLOY_DIR}"

if [ -d "${DEPLOY_DIR}" ]; then
    echo -e "${GREEN}✓ Directory created${NC}"
else
    echo -e "${RED}✗ Failed to create directory${NC}"
    exit 1
fi

# =========================================================================
# Step 2: Copy Files from Repo
# =========================================================================

echo -e "${BLUE}[2/8] Copying configuration files from repo...${NC}"

# Check if files exist in current directory (for local testing)
if [ -f "docker-compose.prod.yml" ]; then
    echo -e "${YELLOW}  Using local files${NC}"
elif [ -d "../NUMZFLEET" ]; then
    echo -e "${YELLOW}  Copying from ../NUMZFLEET${NC}"
    cp ../NUMZFLEET/backend/docker-compose.prod.yml .
    cp ../NUMZFLEET/backend/nginx/nginx.prod.conf ./nginx/nginx.prod.conf
    cp ../NUMZFLEET/backend/conf/traccar.xml conf/
else
    echo -e "${RED}✗ Could not find files. Clone repo first:${NC}"
    echo "  git clone https://github.com/Numzn/NUMZFLEET.git"
    exit 1
fi

echo -e "${GREEN}✓ Files copied${NC}"

# =========================================================================
# Step 3: Generate Environment File
# =========================================================================

echo -e "${BLUE}[3/8] Creating .env file...${NC}"

# Generate random passwords
MYSQL_ROOT_PASS=$(openssl rand -base64 16)
MYSQL_PASS=$(openssl rand -base64 16)
POSTGRES_PASS=$(openssl rand -base64 16)
SESSION_SECRET=$(openssl rand -base64 32)

cat > .env << EOF
# Database Passwords (auto-generated)
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASS}
MYSQL_PASSWORD=${MYSQL_PASS}
POSTGRES_PASSWORD=${POSTGRES_PASS}

# Fuel API Configuration
SESSION_SECRET=${SESSION_SECRET}
CORS_ORIGIN=https://${NETLIFY_DOMAIN}
TRACCAR_SERVER_URL=http://traccar-server:8082

# Node Environment
NODE_ENV=production
PORT=3001
EOF

chmod 600 .env
echo -e "${GREEN}✓ Environment file created with random passwords${NC}"
echo -e "${YELLOW}  ⚠️  Save these passwords in a secure location!${NC}"
echo ""
echo "  MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASS}"
echo "  MYSQL_PASSWORD: ${MYSQL_PASS}"
echo "  POSTGRES_PASSWORD: ${POSTGRES_PASS}"
echo "  SESSION_SECRET: ${SESSION_SECRET}"
echo ""

# =========================================================================
# Step 4: Verify Let's Encrypt Certificates
# =========================================================================

echo -e "${BLUE}[4/8] Checking Let's Encrypt certificates...${NC}"

if [ -f "/etc/letsencrypt/live/${ORACLE_IP}/fullchain.pem" ] && [ -f "/etc/letsencrypt/live/${ORACLE_IP}/privkey.pem" ]; then
    echo -e "${GREEN}✓ Let's Encrypt certificates found for ${ORACLE_IP}${NC}"
else
    echo -e "${RED}✗ Missing Let's Encrypt certs for ${ORACLE_IP}${NC}"
    echo "  Expected files:"
    echo "    /etc/letsencrypt/live/${ORACLE_IP}/fullchain.pem"
    echo "    /etc/letsencrypt/live/${ORACLE_IP}/privkey.pem"
    echo "  Issue certs before deploying nginx."
    exit 1
fi

# =========================================================================
# Step 5: Verify Docker
# =========================================================================

echo -e "${BLUE}[5/8] Verifying Docker installation...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found. Please install Docker first.${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not found. Please install Docker Compose.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker is installed${NC}"
echo "  Docker: $(docker --version)"
echo "  Docker Compose: $(docker-compose --version)"

# =========================================================================
# Step 6: Start Containers
# =========================================================================

echo -e "${BLUE}[6/8] Starting Docker containers...${NC}"
echo -e "${YELLOW}  This may take 1-2 minutes...${NC}"

docker-compose -f docker-compose.prod.yml pull 2>/dev/null || true
docker-compose -f docker-compose.prod.yml up -d

echo -e "${GREEN}✓ Containers started${NC}"

# Wait for services to be healthy
sleep 30

# =========================================================================
# Step 7: Verify Services
# =========================================================================

echo -e "${BLUE}[7/8] Checking service health...${NC}"

HEALTH_COUNT=0
while [ $HEALTH_COUNT -lt 5 ]; do
    if curl -sk https://localhost/health &>/dev/null; then
        echo -e "${GREEN}✓ Nginx health endpoint is responding${NC}"
        break
    fi
    HEALTH_COUNT=$((HEALTH_COUNT + 1))
    if [ $HEALTH_COUNT -lt 5 ]; then
        echo -e "${YELLOW}  Waiting for services to be healthy... ($HEALTH_COUNT/5)${NC}"
        sleep 10
    fi
done

if [ $HEALTH_COUNT -eq 5 ]; then
    echo -e "${YELLOW}⚠️  Services may still be starting. Check logs:${NC}"
    echo "  docker-compose -f docker-compose.prod.yml logs -f"
else
    echo -e "${GREEN}✓ All services are healthy${NC}"
fi

# =========================================================================
# Step 8: Display Next Steps
# =========================================================================

echo -e "${BLUE}[8/8] Deployment Summary${NC}"
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✓ Backend deployment complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Verify API is accessible:"
echo "   curl -k https://${ORACLE_IP}/health"
echo "   curl -k https://${ORACLE_IP}/api/server"
echo ""
echo "2. Update frontend configuration:"
echo "   nano traccar-fleet-system/frontend/.env.production"
echo "   Set: VITE_API_BASE_URL=https://${ORACLE_IP}"
echo ""
echo "3. Commit and push to GitHub:"
echo "   git add traccar-fleet-system/frontend/.env.production"
echo "   git commit -m 'Configure production API endpoint'"
echo "   git push origin main"
echo ""
echo "4. Redeploy frontend on Netlify:"
echo "   Go to Netlify Dashboard"
echo "   Click 'Trigger Deploy' → 'Clear cache and deploy site'"
echo ""
echo "5. Verify frontend works:"
echo "   Open https://${NETLIFY_DOMAIN}"
echo "   Open DevTools (F12) → Network tab"
echo "   Verify API calls go to https://${ORACLE_IP}"
echo ""

echo -e "${YELLOW}Useful Commands:${NC}"
echo "  View logs: docker-compose logs -f"
echo "  Check status: docker-compose ps"
echo "  Stop services: docker-compose stop"
echo "  Restart services: docker-compose restart"
echo "  View environment: cat .env"
echo ""

echo -e "${YELLOW}Backend URLs:${NC}"
echo "  HTTP (redirects to HTTPS): http://${ORACLE_IP}"
echo "  HTTPS: https://${ORACLE_IP}"
echo "  Fuel API: https://${ORACLE_IP}/api/fuel-requests"
echo "  Traccar API: https://${ORACLE_IP}/api/server"
echo "  WebSocket: wss://${ORACLE_IP}/socket.io"
echo ""

echo -e "${YELLOW}Documentation:${NC}"
echo "  Full guide: ORACLE_DEPLOYMENT_GUIDE.md"
echo "  Quick ref: BACKEND_DEPLOYMENT_QUICK_REFERENCE.md"
echo "  Frontend config: FRONTEND_API_CONFIGURATION.md"
echo ""

echo -e "${GREEN}Happy coding! 🚀${NC}"
