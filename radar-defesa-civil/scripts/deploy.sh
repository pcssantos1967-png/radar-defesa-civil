#!/bin/bash
set -e

# Radar Defesa Civil - Deployment Script
# Usage: ./scripts/deploy.sh [staging|production]

ENVIRONMENT=${1:-staging}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    log_error "Invalid environment: $ENVIRONMENT"
    echo "Usage: $0 [staging|production]"
    exit 1
fi

log_info "Starting deployment to $ENVIRONMENT environment"

# Check required tools
command -v docker >/dev/null 2>&1 || { log_error "docker is required but not installed."; exit 1; }
command -v kubectl >/dev/null 2>&1 || { log_error "kubectl is required but not installed."; exit 1; }

# Load environment variables
ENV_FILE="$PROJECT_ROOT/.env.$ENVIRONMENT"
if [[ -f "$ENV_FILE" ]]; then
    log_info "Loading environment from $ENV_FILE"
    export $(grep -v '^#' "$ENV_FILE" | xargs)
else
    log_warn "Environment file $ENV_FILE not found, using defaults"
fi

# Set image tag
IMAGE_TAG=${IMAGE_TAG:-$(git rev-parse --short HEAD)}
log_info "Using image tag: $IMAGE_TAG"

# Build Docker images
log_info "Building Docker images..."

docker build -t radar-api:$IMAGE_TAG -f "$PROJECT_ROOT/apps/api/Dockerfile" "$PROJECT_ROOT"
docker build -t radar-web:$IMAGE_TAG -f "$PROJECT_ROOT/apps/web/Dockerfile" "$PROJECT_ROOT" \
    --build-arg NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    --build-arg NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
docker build -t radar-processor:$IMAGE_TAG -f "$PROJECT_ROOT/apps/radar-processor/Dockerfile" "$PROJECT_ROOT"

log_info "Docker images built successfully"

# Push images to registry (if CONTAINER_REGISTRY is set)
if [[ -n "$CONTAINER_REGISTRY" ]]; then
    log_info "Pushing images to $CONTAINER_REGISTRY..."

    docker tag radar-api:$IMAGE_TAG $CONTAINER_REGISTRY/radar-api:$IMAGE_TAG
    docker tag radar-web:$IMAGE_TAG $CONTAINER_REGISTRY/radar-web:$IMAGE_TAG
    docker tag radar-processor:$IMAGE_TAG $CONTAINER_REGISTRY/radar-processor:$IMAGE_TAG

    docker push $CONTAINER_REGISTRY/radar-api:$IMAGE_TAG
    docker push $CONTAINER_REGISTRY/radar-web:$IMAGE_TAG
    docker push $CONTAINER_REGISTRY/radar-processor:$IMAGE_TAG

    log_info "Images pushed successfully"
fi

# Deploy to Kubernetes
NAMESPACE="radar-$ENVIRONMENT"
K8S_DIR="$PROJECT_ROOT/infrastructure/kubernetes"

log_info "Deploying to Kubernetes namespace: $NAMESPACE"

# Create namespace if it doesn't exist
kubectl apply -f "$K8S_DIR/namespace.yaml"

# Apply ConfigMap and Secrets
kubectl apply -f "$K8S_DIR/configmap.yaml" -n $NAMESPACE

# Apply deployments with environment variable substitution
export IMAGE_TAG
export CONTAINER_REGISTRY

envsubst < "$K8S_DIR/api-deployment.yaml" | kubectl apply -f - -n $NAMESPACE
envsubst < "$K8S_DIR/web-deployment.yaml" | kubectl apply -f - -n $NAMESPACE
envsubst < "$K8S_DIR/radar-processor-deployment.yaml" | kubectl apply -f - -n $NAMESPACE

# Apply services and ingress
kubectl apply -f "$K8S_DIR/services.yaml" -n $NAMESPACE
kubectl apply -f "$K8S_DIR/ingress.yaml" -n $NAMESPACE

log_info "Waiting for deployments to be ready..."

# Wait for rollouts
kubectl rollout status deployment/radar-api -n $NAMESPACE --timeout=300s
kubectl rollout status deployment/radar-web -n $NAMESPACE --timeout=300s

log_info "Running database migrations..."
kubectl exec -n $NAMESPACE deployment/radar-api -- pnpm db:migrate || log_warn "Migration skipped or failed"

log_info "Deployment completed successfully!"

# Show status
echo ""
log_info "Deployment Status:"
kubectl get pods -n $NAMESPACE
echo ""
kubectl get services -n $NAMESPACE
echo ""
kubectl get ingress -n $NAMESPACE
