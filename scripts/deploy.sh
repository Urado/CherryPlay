#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
source ./compose-env.sh

if docker compose version > /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
elif docker-compose version > /dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
else
    echo -e "${RED}❌ Error: docker compose or docker-compose not found${NC}"
    exit 1
fi

echo -e "${GREEN}🚀 Starting deployment...${NC}"

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

GITHUB_USER=$(echo "$IMAGE_NAME_SERVER" | cut -d'/' -f1)

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

echo -e "${YELLOW}📝 Updating docker-compose.prod.yml with version $VERSION...${NC}"

umask 077
: > .env
chmod 600 .env
write_compose_env VERSION "$VERSION"
write_compose_env REGISTRY "$REGISTRY"
write_compose_env IMAGE_NAME_SERVER "$IMAGE_NAME_SERVER"
write_compose_env IMAGE_NAME_WEB "$IMAGE_NAME_WEB"

if [ -f .env.production ]; then
    echo -e "${YELLOW}📋 Loading configuration from .env.production...${NC}"
    cat .env.production >> .env
fi

[ -z "$JWT_SECRET_KEY" ] || write_compose_env JWT_SECRET_KEY "$JWT_SECRET_KEY"
[ -z "$POSTGRES_PASSWORD" ] || write_compose_env POSTGRES_PASSWORD "$POSTGRES_PASSWORD"
write_compose_env PGADMIN_EMAIL "${PGADMIN_EMAIL:-admin@localhost}"
write_compose_env PGADMIN_PASSWORD "${PGADMIN_PASSWORD:-changeme}"
[ -z "$PGADMIN_EMAIL" ] || [ -z "$PGADMIN_PASSWORD" ] && echo -e "${YELLOW}⚠️  PGADMIN_EMAIL или PGADMIN_PASSWORD не заданы — используются значения по умолчанию. Задайте их в GitHub Secrets или .env.production и передеплойте.${NC}"
[ -z "$GRAFANA_ADMIN_PASSWORD" ] || write_compose_env GRAFANA_ADMIN_PASSWORD "$GRAFANA_ADMIN_PASSWORD"
[ -z "$DATABASE__AutoMigrateOnStartup" ] || write_compose_env DATABASE__AutoMigrateOnStartup "$DATABASE__AutoMigrateOnStartup"
[ -z "$CORS_ORIGIN_0" ] || write_compose_env CORS_ORIGIN_0 "$CORS_ORIGIN_0"
[ -z "$CORS_ORIGIN_1" ] || write_compose_env CORS_ORIGIN_1 "$CORS_ORIGIN_1"
[ -z "$CORS_ORIGIN_2" ] || write_compose_env CORS_ORIGIN_2 "$CORS_ORIGIN_2"
[ -z "$OAUTH_VK_CLIENT_ID" ] || write_compose_env OAUTH_VK_CLIENT_ID "$OAUTH_VK_CLIENT_ID"
[ -z "$OAUTH_VK_CLIENT_SECRET" ] || write_compose_env OAUTH_VK_CLIENT_SECRET "$OAUTH_VK_CLIENT_SECRET"
[ -z "$RUSENDER_API_TOKEN" ] || write_compose_env RUSENDER_API_TOKEN "$RUSENDER_API_TOKEN"
[ -z "$RUSENDER_SEND_KEY_ID" ] || write_compose_env RUSENDER_SEND_KEY_ID "$RUSENDER_SEND_KEY_ID"
[ -z "$EMAIL_FROM_ADDRESS" ] || write_compose_env EMAIL_FROM_ADDRESS "$EMAIL_FROM_ADDRESS"
[ -z "$EMAIL_FROM_NAME" ] || write_compose_env EMAIL_FROM_NAME "$EMAIL_FROM_NAME"
[ -z "$PUBLIC_WEB_BASE_URL" ] || write_compose_env PUBLIC_WEB_BASE_URL "$PUBLIC_WEB_BASE_URL"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_COUNT="${BACKUP_RETENTION_COUNT:-10}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-cherryplay-postgres}"

create_pre_deploy_backup() {
    if ! docker ps --format '{{.Names}}' | grep -qx "$POSTGRES_CONTAINER"; then
        echo -e "${YELLOW}⚠️  PostgreSQL container not running — skipping pre-deploy backup (first deploy?)${NC}"
        return 0
    fi

    mkdir -p "$BACKUP_DIR"
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${BACKUP_DIR}/pre-deploy_${VERSION}_${timestamp}.dump"

    echo -e "${YELLOW}💾 Creating mandatory pre-deploy database backup...${NC}"
    echo "  File: $backup_file"

    if ! docker exec "$POSTGRES_CONTAINER" pg_dump -U cherryplay -Fc cherryplay > "$backup_file"; then
        echo -e "${RED}❌ Error: pre-deploy database backup failed${NC}"
        rm -f "$backup_file"
        exit 1
    fi

    if [ ! -s "$backup_file" ]; then
        echo -e "${RED}❌ Error: backup file is missing or empty${NC}"
        rm -f "$backup_file"
        exit 1
    fi

    local backup_size
    backup_size=$(du -h "$backup_file" | cut -f1)
    echo -e "${GREEN}✅ Pre-deploy backup created ($backup_size)${NC}"

    if [ "$BACKUP_RETENTION_COUNT" -gt 0 ]; then
        local old_backups
        old_backups=$(ls -1t "${BACKUP_DIR}"/pre-deploy_*.dump 2>/dev/null | tail -n +$((BACKUP_RETENTION_COUNT + 1)) || true)
        if [ -n "$old_backups" ]; then
            echo -e "${YELLOW}🧹 Rotating old pre-deploy backups (keeping last $BACKUP_RETENTION_COUNT)...${NC}"
            echo "$old_backups" | while read -r f; do
                rm -f "$f"
                echo "  Removed: $f"
            done
        fi
    fi
}

create_pre_deploy_backup

echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
$DOCKER_COMPOSE -f docker-compose.prod.yml down || {
    echo -e "${YELLOW}⚠️  Warning: Some containers might not have been running${NC}"
}

echo -e "${YELLOW}🚀 Starting new containers with version $VERSION...${NC}"
$DOCKER_COMPOSE -f docker-compose.prod.yml up -d

echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 10

echo -e "${YELLOW}🔍 Checking container status...${NC}"
if docker ps | grep -q cherryplay-server && docker ps | grep -q cherryplay-web; then
    echo -e "${GREEN}✅ All containers are running${NC}"
else
    echo -e "${RED}❌ Error: Some containers failed to start${NC}"
    echo -e "${YELLOW}📋 Container logs:${NC}"
    $DOCKER_COMPOSE -f docker-compose.prod.yml logs --tail=50
    exit 1
fi

echo -e "${YELLOW}🏥 Performing health checks...${NC}"
MAX_RETRIES=40
RETRY_COUNT=0

sleep 10

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if ! docker ps | grep -q cherryplay-server; then
        echo -e "${YELLOW}   Container not running yet... ($RETRY_COUNT/$MAX_RETRIES)${NC}"
        RETRY_COUNT=$((RETRY_COUNT + 1))
        sleep 3
        continue
    fi
    
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
    
    CONTAINER_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' cherryplay-server 2>/dev/null || echo "none")
    if [ "$CONTAINER_HEALTH" = "healthy" ]; then
        echo -e "${GREEN}✅ Server is healthy (Docker health check)${NC}"
        break
    fi
    
    if docker exec cherryplay-server ps aux | grep -q "[d]otnet.*CherryPlayServer.dll"; then
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
        echo -e "${YELLOW}   Check the server healthcheck and logs. For Swagger, open an SSH tunnel to 127.0.0.1:5000.${NC}"
        break
    fi
    
    echo -e "${YELLOW}   Waiting for server... ($RETRY_COUNT/$MAX_RETRIES)${NC}"
    sleep 3
done

echo -e "${YELLOW}🧹 Cleaning up old images...${NC}"
docker image prune -f

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
echo "  Backend API: configured public domain /api (via web proxy)"
echo "  Swagger UI: http://127.0.0.1:5000/swagger (loopback only; use SSH tunnel)"
echo "  pgAdmin: http://127.0.0.1:5050 (local only; use SSH tunnel)"
echo ""
echo -e "${YELLOW}📋 Local access (on server):${NC}"
echo "  Frontend: http://localhost"
echo "  Backend API: http://127.0.0.1:5000/api (server loopback)"
echo "  Swagger UI: http://127.0.0.1:5000/swagger (server loopback)"
echo ""
echo -e "${YELLOW}💾 Pre-deploy backups:${NC}"
echo "  Directory: $(cd "$BACKUP_DIR" 2>/dev/null && pwd || echo "$BACKUP_DIR")"
