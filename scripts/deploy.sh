#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Detect docker compose command (V2 uses 'docker compose', V1 uses 'docker-compose')
if docker compose version > /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
elif docker-compose version > /dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
else
    echo -e "${RED}❌ Error: docker compose or docker-compose not found${NC}"
    exit 1
fi

echo -e "${GREEN}🚀 Starting deployment...${NC}"

# Check required environment variables
if [ -z "$VERSION" ]; then
    echo -e "${RED}❌ Error: VERSION environment variable is not set${NC}"
    exit 1
fi

if [ -z "$REGISTRY" ]; then
    REGISTRY="ghcr.io"
fi

if [ -z "$IMAGE_NAME_SERVER" ]; then
    echo -e "${RED}❌ Error: IMAGE_NAME_SERVER environment variable is not set${NC}"
    exit 1
fi

if [ -z "$IMAGE_NAME_WEB" ]; then
    echo -e "${RED}❌ Error: IMAGE_NAME_WEB environment variable is not set${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Deployment configuration:${NC}"
echo "  Version: $VERSION"
echo "  Registry: $REGISTRY"
echo "  Server image: $REGISTRY/$IMAGE_NAME_SERVER:$VERSION"
echo "  Web image: $REGISTRY/$IMAGE_NAME_WEB:$VERSION"

# Login to GitHub Container Registry
# IMPORTANT: Even public images in GHCR require authentication
# Extract username from IMAGE_NAME_SERVER (format: owner/repo/server)
GITHUB_USER=$(echo "$IMAGE_NAME_SERVER" | cut -d'/' -f1)

# Use GHCR_TOKEN if provided, otherwise try GITHUB_TOKEN (for backward compatibility)
TOKEN="${GHCR_TOKEN:-${GITHUB_TOKEN}}"

if [ -n "$TOKEN" ]; then
    echo -e "${YELLOW}🔐 Logging in to GitHub Container Registry...${NC}"
    echo "  Username: $GITHUB_USER"
    if echo "$TOKEN" | docker login $REGISTRY -u "$GITHUB_USER" --password-stdin; then
        echo -e "${GREEN}✅ Successfully logged in to GHCR${NC}"
    else
        echo -e "${RED}❌ Failed to login to GHCR${NC}"
        echo -e "${YELLOW}   Please check:${NC}"
        echo -e "${YELLOW}   1. GHCR_TOKEN secret is set in GitHub Actions${NC}"
        echo -e "${YELLOW}   2. Token has 'read:packages' permission${NC}"
        echo -e "${YELLOW}   3. For public repos, any valid GitHub token should work${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Error: GHCR_TOKEN is required${NC}"
    echo -e "${YELLOW}   Even public images in GHCR require authentication.${NC}"
    echo -e "${YELLOW}   Please set GHCR_TOKEN secret in GitHub Actions.${NC}"
    exit 1
fi

# Pull new images
echo -e "${YELLOW}📥 Pulling new images...${NC}"
docker pull "$REGISTRY/$IMAGE_NAME_SERVER:$VERSION" || {
    echo -e "${RED}❌ Error: Failed to pull server image${NC}"
    exit 1
}

docker pull "$REGISTRY/$IMAGE_NAME_WEB:$VERSION" || {
    echo -e "${RED}❌ Error: Failed to pull web image${NC}"
    exit 1
}

echo -e "${GREEN}✅ Images pulled successfully${NC}"

# Update docker-compose.prod.yml with version
echo -e "${YELLOW}📝 Updating docker-compose.prod.yml with version $VERSION...${NC}"

# Create .env file for docker-compose
cat > .env << EOF
VERSION=$VERSION
REGISTRY=$REGISTRY
IMAGE_NAME_SERVER=$IMAGE_NAME_SERVER
IMAGE_NAME_WEB=$IMAGE_NAME_WEB
EOF

# Load .env.production first (for manual deploy or fallbacks)
if [ -f .env.production ]; then
    echo -e "${YELLOW}📋 Loading configuration from .env.production...${NC}"
    cat .env.production >> .env
fi

# Override with secrets from GitHub Actions when set (so Actions secrets take precedence)
[ -n "$JWT_SECRET_KEY" ] && echo "JWT_SECRET_KEY=$JWT_SECRET_KEY" >> .env
[ -n "$POSTGRES_PASSWORD" ] && echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" >> .env
# pgAdmin: берём из секретов PGADMIN_EMAIL и PGADMIN_PASSWORD, иначе подставляем значения по умолчанию
echo "PGADMIN_EMAIL=${PGADMIN_EMAIL:-admin@localhost}" >> .env
echo "PGADMIN_PASSWORD=${PGADMIN_PASSWORD:-changeme}" >> .env
[ -z "$PGADMIN_EMAIL" ] || [ -z "$PGADMIN_PASSWORD" ] && echo -e "${YELLOW}⚠️  PGADMIN_EMAIL или PGADMIN_PASSWORD не заданы — используются значения по умолчанию. Задайте их в GitHub Secrets или .env.production и передеплойте.${NC}"
[ -n "$CORS_ORIGIN_0" ] && echo "CORS_ORIGIN_0=$CORS_ORIGIN_0" >> .env
[ -n "$CORS_ORIGIN_1" ] && echo "CORS_ORIGIN_1=$CORS_ORIGIN_1" >> .env
[ -n "$CORS_ORIGIN_2" ] && echo "CORS_ORIGIN_2=$CORS_ORIGIN_2" >> .env
[ -n "$OAUTH_VK_CLIENT_ID" ] && echo "OAUTH_VK_CLIENT_ID=$OAUTH_VK_CLIENT_ID" >> .env
[ -n "$OAUTH_VK_CLIENT_SECRET" ] && echo "OAUTH_VK_CLIENT_SECRET=$OAUTH_VK_CLIENT_SECRET" >> .env

# Stop existing containers gracefully
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
$DOCKER_COMPOSE -f docker-compose.prod.yml down || {
    echo -e "${YELLOW}⚠️  Warning: Some containers might not have been running${NC}"
}

# Start new containers
echo -e "${YELLOW}🚀 Starting new containers with version $VERSION...${NC}"
$DOCKER_COMPOSE -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 10

# Check if containers are running
echo -e "${YELLOW}🔍 Checking container status...${NC}"
if docker ps | grep -q cherryplay-server && docker ps | grep -q cherryplay-web; then
    echo -e "${GREEN}✅ All containers are running${NC}"
else
    echo -e "${RED}❌ Error: Some containers failed to start${NC}"
    echo -e "${YELLOW}📋 Container logs:${NC}"
    $DOCKER_COMPOSE -f docker-compose.prod.yml logs --tail=50
    exit 1
fi

# Health check
echo -e "${YELLOW}🏥 Performing health checks...${NC}"
MAX_RETRIES=40
RETRY_COUNT=0

# Wait a bit more for server to fully start
sleep 10

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    # Check if container is running
    if ! docker ps | grep -q cherryplay-server; then
        echo -e "${YELLOW}   Container not running yet... ($RETRY_COUNT/$MAX_RETRIES)${NC}"
        RETRY_COUNT=$((RETRY_COUNT + 1))
        sleep 3
        continue
    fi
    
    # Method 1: Check from host if curl/wget is available
    if command -v curl > /dev/null 2>&1; then
        if curl -f -s http://localhost:5000/api/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Server is healthy (checked via curl)${NC}"
            break
        fi
    elif command -v wget > /dev/null 2>&1; then
        if wget -q --spider http://localhost:5000/api/health 2>/dev/null; then
            echo -e "${GREEN}✅ Server is healthy (checked via wget)${NC}"
            break
        fi
    fi
    
    # Method 2: Check if port is accessible using netcat or telnet
    if command -v nc > /dev/null 2>&1; then
        if nc -z localhost 5000 2>/dev/null; then
            echo -e "${GREEN}✅ Server port is accessible${NC}"
            break
        fi
    elif command -v telnet > /dev/null 2>&1; then
        if echo "quit" | telnet localhost 5000 2>/dev/null | grep -q "Connected"; then
            echo -e "${GREEN}✅ Server port is accessible${NC}"
            break
        fi
    fi
    
    # Method 3: Check container health status from Docker
    CONTAINER_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' cherryplay-server 2>/dev/null || echo "none")
    if [ "$CONTAINER_HEALTH" = "healthy" ]; then
        echo -e "${GREEN}✅ Server is healthy (Docker health check)${NC}"
        break
    fi
    
    # Method 4: Check if process is running inside container
    if docker exec cherryplay-server ps aux | grep -q "[d]otnet.*CherryPlayServer.dll"; then
        # Process is running, give it more time
        if [ $RETRY_COUNT -gt 20 ]; then
            echo -e "${YELLOW}⚠️  Server process is running but not responding. Continuing anyway...${NC}"
            break
        fi
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo -e "${RED}❌ Error: Server health check failed after $MAX_RETRIES attempts${NC}"
        echo -e "${YELLOW}📋 Server logs:${NC}"
        $DOCKER_COMPOSE -f docker-compose.prod.yml logs --tail=100 server
        echo -e "${YELLOW}📋 Container status:${NC}"
        docker ps -a | grep cherryplay-server
        echo -e "${YELLOW}⚠️  Warning: Health check failed, but deployment may still be successful${NC}"
        echo -e "${YELLOW}   Please check server manually: http://cherrypashkaparty.ru:5000/swagger${NC}"
        # Don't exit with error, just warn
        break
    fi
    
    echo -e "${YELLOW}   Waiting for server... ($RETRY_COUNT/$MAX_RETRIES)${NC}"
    sleep 3
done

# Cleanup old images (keep last 3 versions)
echo -e "${YELLOW}🧹 Cleaning up old images...${NC}"
docker image prune -f

# Обновить конфиг nginx и перезагрузить (если есть nginx и конфиг CherryPlay)
if [ -f nginx-cherryplay-https.conf ]; then
    echo -e "${YELLOW}🌐 Updating Nginx config...${NC}"
    if command -v nginx > /dev/null 2>&1; then
        if sudo cp nginx-cherryplay-https.conf /etc/nginx/sites-available/cherryplay 2>/dev/null; then
            if sudo nginx -t 2>/dev/null; then
                sudo systemctl reload nginx 2>/dev/null && echo -e "${GREEN}✅ Nginx config updated and reloaded${NC}" || echo -e "${YELLOW}⚠️  Nginx reload skipped (e.g. not enabled)${NC}"
            else
                echo -e "${YELLOW}⚠️  Nginx config test failed, reload skipped${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️  Could not copy nginx config (need sudo?). Update manually: sudo cp nginx-cherryplay-https.conf /etc/nginx/sites-available/cherryplay && sudo nginx -t && sudo systemctl reload nginx${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Nginx not found, config not updated${NC}"
    fi
fi

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${GREEN}   Version $VERSION is now live${NC}"
echo ""
echo -e "${YELLOW}📊 Service URLs:${NC}"
echo "  Frontend: http://cherrypashkaparty.ru"
echo "  Backend API: http://cherrypashkaparty.ru:5000/api"
echo "  Swagger UI: http://cherrypashkaparty.ru:5000/swagger"
echo "  pgAdmin: http://127.0.0.1:5050 (local only; use SSH tunnel)"
echo ""
echo -e "${YELLOW}📋 Local access (on server):${NC}"
echo "  Frontend: http://localhost"
echo "  Backend API: http://localhost:5000/api"
echo "  Swagger UI: http://localhost:5000/swagger"
