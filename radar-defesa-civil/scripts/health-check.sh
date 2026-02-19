#!/bin/bash

# Radar Defesa Civil - Health Check Script
# Usage: ./scripts/health-check.sh [url]

BASE_URL=${1:-http://localhost}
API_URL="${BASE_URL}:3001"
WEB_URL="${BASE_URL}:3000"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_service() {
    local name=$1
    local url=$2
    local expected_code=${3:-200}

    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$url" 2>/dev/null)

    if [[ "$response" == "$expected_code" ]]; then
        echo -e "${GREEN}[OK]${NC} $name - $url (HTTP $response)"
        return 0
    else
        echo -e "${RED}[FAIL]${NC} $name - $url (HTTP $response, expected $expected_code)"
        return 1
    fi
}

echo "==================================="
echo "Radar Defesa Civil - Health Check"
echo "==================================="
echo ""

FAILED=0

# Check API health
echo "Checking API Services..."
check_service "API Health" "$API_URL/api/v1/health" || ((FAILED++))
check_service "API Docs" "$API_URL/docs" || ((FAILED++))

echo ""

# Check Web frontend
echo "Checking Web Frontend..."
check_service "Web App" "$WEB_URL" || ((FAILED++))

echo ""

# Check database connectivity (via API)
echo "Checking Database Connectivity..."
check_service "Database (via API)" "$API_URL/api/v1/health/db" || ((FAILED++))

echo ""

# Check Redis connectivity (via API)
echo "Checking Redis Connectivity..."
check_service "Redis (via API)" "$API_URL/api/v1/health/redis" || ((FAILED++))

echo ""
echo "==================================="

if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}All health checks passed!${NC}"
    exit 0
else
    echo -e "${RED}$FAILED health check(s) failed!${NC}"
    exit 1
fi
