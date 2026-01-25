#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Login to GitHub Container Registry if token is provided
if [ -n "$GITHUB_TOKEN" ]; then
    echo -e "${YELLOW}🔐 Logging in to GitHub Container Registry...${NC}"
    # Extract username from IMAGE_NAME_SERVER (format: owner/repo/server)
    GITHUB_USER=$(echo "$IMAGE_NAME_SERVER" | cut -d'/' -f1)
    echo "$GITHUB_TOKEN" | docker login $REGISTRY -u "$GITHUB_USER" --password-stdin || {
        echo -e "${YELLOW}⚠️  Warning: Failed to login to GHCR. Make sure GITHUB_TOKEN is valid.${NC}"
        echo -e "${YELLOW}   If images are public, login might not be required.${NC}"
    }
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

# Load existing .env if it exists (for passwords and other configs)
if [ -f .env.production ]; then
    echo -e "${YELLOW}📋 Loading additional configuration from .env.production...${NC}"
    cat .env.production >> .env
fi

# Stop existing containers gracefully
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker-compose -f docker-compose.prod.yml down || {
    echo -e "${YELLOW}⚠️  Warning: Some containers might not have been running${NC}"
}

# Start new containers
echo -e "${YELLOW}🚀 Starting new containers with version $VERSION...${NC}"
docker-compose -f docker-compose.prod.yml up -d

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
    docker-compose -f docker-compose.prod.yml logs --tail=50
    exit 1
fi

# Health check
echo -e "${YELLOW}🏥 Performing health checks...${NC}"
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f http://localhost:5000/swagger/index.html > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Server is healthy${NC}"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo -e "${RED}❌ Error: Server health check failed after $MAX_RETRIES attempts${NC}"
        docker-compose -f docker-compose.prod.yml logs server
        exit 1
    fi
    
    echo -e "${YELLOW}   Waiting for server... ($RETRY_COUNT/$MAX_RETRIES)${NC}"
    sleep 2
done

# Cleanup old images (keep last 3 versions)
echo -e "${YELLOW}🧹 Cleaning up old images...${NC}"
docker image prune -f

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${GREEN}   Version $VERSION is now live${NC}"
echo ""
echo -e "${YELLOW}📊 Service URLs:${NC}"
echo "  Frontend: http://localhost:3000"
echo "  Backend API: http://localhost:5000"
echo "  Swagger UI: http://localhost:5000/swagger"
echo "  pgAdmin: http://localhost:5050"
