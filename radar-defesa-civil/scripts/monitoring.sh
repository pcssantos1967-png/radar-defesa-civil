#!/bin/bash
set -e

# Radar Defesa Civil - Monitoring Stack Management
# Usage: ./scripts/monitoring.sh [up|down|restart|status|logs]

ACTION=${1:-status}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MONITORING_DIR="$PROJECT_ROOT/infrastructure/monitoring"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Set compose command
if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD="docker compose"
fi

cd "$MONITORING_DIR"

case $ACTION in
    up)
        log_info "Starting monitoring stack..."

        # Ensure radar network exists
        docker network create radar-network 2>/dev/null || true
        docker network create docker_radar-network 2>/dev/null || true

        $COMPOSE_CMD -f docker-compose.monitoring.yml up -d

        log_info "Waiting for services to start..."
        sleep 10

        echo ""
        log_info "Monitoring stack started!"
        echo ""
        echo -e "${BLUE}Access URLs:${NC}"
        echo "  - Grafana:      http://localhost:3030 (admin / radar_grafana_123)"
        echo "  - Prometheus:   http://localhost:9090"
        echo "  - Alertmanager: http://localhost:9093"
        echo "  - Loki:         http://localhost:3100"
        echo ""
        ;;

    down)
        log_info "Stopping monitoring stack..."
        $COMPOSE_CMD -f docker-compose.monitoring.yml down
        log_info "Monitoring stack stopped"
        ;;

    restart)
        log_info "Restarting monitoring stack..."
        $COMPOSE_CMD -f docker-compose.monitoring.yml restart
        log_info "Monitoring stack restarted"
        ;;

    status)
        log_info "Monitoring Stack Status:"
        echo ""
        $COMPOSE_CMD -f docker-compose.monitoring.yml ps
        echo ""

        # Check health of services
        echo -e "${BLUE}Service Health:${NC}"

        # Check Prometheus
        if curl -s "http://localhost:9090/-/healthy" >/dev/null 2>&1; then
            echo -e "  Prometheus:    ${GREEN}healthy${NC}"
        else
            echo -e "  Prometheus:    ${RED}unhealthy${NC}"
        fi

        # Check Grafana
        if curl -s "http://localhost:3030/api/health" >/dev/null 2>&1; then
            echo -e "  Grafana:       ${GREEN}healthy${NC}"
        else
            echo -e "  Grafana:       ${RED}unhealthy${NC}"
        fi

        # Check Alertmanager
        if curl -s "http://localhost:9093/-/healthy" >/dev/null 2>&1; then
            echo -e "  Alertmanager:  ${GREEN}healthy${NC}"
        else
            echo -e "  Alertmanager:  ${RED}unhealthy${NC}"
        fi

        # Check Loki
        if curl -s "http://localhost:3100/ready" >/dev/null 2>&1; then
            echo -e "  Loki:          ${GREEN}healthy${NC}"
        else
            echo -e "  Loki:          ${RED}unhealthy${NC}"
        fi

        echo ""
        ;;

    logs)
        SERVICE=${2:-}
        if [[ -n "$SERVICE" ]]; then
            $COMPOSE_CMD -f docker-compose.monitoring.yml logs -f $SERVICE
        else
            $COMPOSE_CMD -f docker-compose.monitoring.yml logs -f
        fi
        ;;

    alerts)
        log_info "Active Alerts:"
        curl -s "http://localhost:9093/api/v2/alerts" | python3 -m json.tool 2>/dev/null || \
        curl -s "http://localhost:9093/api/v2/alerts"
        ;;

    targets)
        log_info "Prometheus Targets:"
        curl -s "http://localhost:9090/api/v1/targets" | python3 -m json.tool 2>/dev/null || \
        curl -s "http://localhost:9090/api/v1/targets"
        ;;

    reload)
        log_info "Reloading Prometheus configuration..."
        curl -X POST "http://localhost:9090/-/reload"
        log_info "Prometheus configuration reloaded"
        ;;

    *)
        echo "Usage: $0 [up|down|restart|status|logs|alerts|targets|reload]"
        echo ""
        echo "Commands:"
        echo "  up       - Start monitoring stack"
        echo "  down     - Stop monitoring stack"
        echo "  restart  - Restart monitoring stack"
        echo "  status   - Show status and health of services"
        echo "  logs     - View logs (optionally specify service name)"
        echo "  alerts   - Show active alerts from Alertmanager"
        echo "  targets  - Show Prometheus scrape targets"
        echo "  reload   - Reload Prometheus configuration"
        echo ""
        echo "Services: prometheus, grafana, alertmanager, loki, promtail, node-exporter, cadvisor"
        exit 1
        ;;
esac
