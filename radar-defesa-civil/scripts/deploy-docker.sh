#!/bin/bash
set -e

# Radar Defesa Civil - Docker Compose Deployment Script
# Usage: ./scripts/deploy-docker.sh [up|down|restart|logs|status]

ACTION=${1:-up}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$PROJECT_ROOT/infrastructure/docker"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check required tools
command -v docker >/dev/null 2>&1 || { log_error "docker is required but not installed."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || COMPOSE_CMD="docker compose" || COMPOSE_CMD="docker-compose"

# Set compose command
if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD="docker compose"
fi

# Load environment variables
if [[ -f "$PROJECT_ROOT/.env" ]]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

cd "$DOCKER_DIR"

case $ACTION in
    up)
        log_info "Starting services with Docker Compose..."
        $COMPOSE_CMD -f docker-compose.yml -f docker-compose.prod.yml up -d --build

        log_info "Waiting for services to be healthy..."
        sleep 10

        log_info "Running database migrations..."
        $COMPOSE_CMD -f docker-compose.yml -f docker-compose.prod.yml exec -T api pnpm db:migrate || log_warn "Migration skipped"

        log_info "Services started successfully!"
        $COMPOSE_CMD -f docker-compose.yml -f docker-compose.prod.yml ps
        ;;

    down)
        log_info "Stopping services..."
        $COMPOSE_CMD -f docker-compose.yml -f docker-compose.prod.yml down
        log_info "Services stopped"
        ;;

    restart)
        log_info "Restarting services..."
        $COMPOSE_CMD -f docker-compose.yml -f docker-compose.prod.yml restart
        log_info "Services restarted"
        ;;

    logs)
        SERVICE=${2:-}
        if [[ -n "$SERVICE" ]]; then
            $COMPOSE_CMD -f docker-compose.yml -f docker-compose.prod.yml logs -f $SERVICE
        else
            $COMPOSE_CMD -f docker-compose.yml -f docker-compose.prod.yml logs -f
        fi
        ;;

    status)
        log_info "Service Status:"
        $COMPOSE_CMD -f docker-compose.yml -f docker-compose.prod.yml ps
        echo ""
        log_info "Service Health:"
        $COMPOSE_CMD -f docker-compose.yml -f docker-compose.prod.yml ps --format "table {{.Name}}\t{{.Status}}"
        ;;

    build)
        log_info "Building images..."
        $COMPOSE_CMD -f docker-compose.yml -f docker-compose.prod.yml build
        log_info "Build complete"
        ;;

    pull)
        log_info "Pulling latest images..."
        $COMPOSE_CMD -f docker-compose.yml -f docker-compose.prod.yml pull
        log_info "Pull complete"
        ;;

    *)
        echo "Usage: $0 [up|down|restart|logs|status|build|pull]"
        echo ""
        echo "Commands:"
        echo "  up       - Start all services"
        echo "  down     - Stop all services"
        echo "  restart  - Restart all services"
        echo "  logs     - View logs (optionally specify service name)"
        echo "  status   - Show service status"
        echo "  build    - Build Docker images"
        echo "  pull     - Pull latest images"
        exit 1
        ;;
esac
