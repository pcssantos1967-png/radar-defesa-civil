# Deployment Guide

This guide covers deployment options for the Radar Defesa Civil system.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Deployment Options](#deployment-options)
  - [Docker Compose (Single Server)](#docker-compose-single-server)
  - [Kubernetes](#kubernetes)
- [CI/CD Pipeline](#cicd-pipeline)
- [Environment Configuration](#environment-configuration)
- [Database Migrations](#database-migrations)
- [Monitoring & Health Checks](#monitoring--health-checks)
- [Backup & Recovery](#backup--recovery)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

- Docker 24+
- Docker Compose 2.20+
- Node.js 20+ (for local development)
- pnpm 8+
- kubectl (for Kubernetes deployment)
- Git

### Infrastructure Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 4 cores | 8+ cores |
| RAM | 8 GB | 16+ GB |
| Storage | 50 GB SSD | 200+ GB SSD |
| Network | 100 Mbps | 1 Gbps |

---

## Deployment Options

### Docker Compose (Single Server)

Best for: Development, staging, or small production deployments.

#### Quick Start

```bash
# Clone the repository
git clone https://github.com/defesacivil/radar-defesa-civil.git
cd radar-defesa-civil

# Copy environment file
cp .env.example .env
# Edit .env with your configuration

# Start all services
./scripts/deploy-docker.sh up

# Check status
./scripts/deploy-docker.sh status

# View logs
./scripts/deploy-docker.sh logs
```

#### Services Started

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Database with TimescaleDB |
| Redis | 6379 | Cache and pub/sub |
| MinIO | 9000/9001 | Object storage |
| API | 3001 | Backend API |
| Web | 3000 | Frontend application |
| Nginx | 80/443 | Reverse proxy |

#### Managing Services

```bash
# Stop all services
./scripts/deploy-docker.sh down

# Restart services
./scripts/deploy-docker.sh restart

# Rebuild images
./scripts/deploy-docker.sh build

# View logs for specific service
./scripts/deploy-docker.sh logs api
```

---

### Kubernetes

Best for: Production deployments with high availability requirements.

#### Prerequisites

- Kubernetes cluster (1.28+)
- kubectl configured
- Container registry access
- Ingress controller (nginx-ingress recommended)
- cert-manager (for SSL certificates)

#### Deployment Steps

1. **Configure secrets**

```bash
# Create namespace
kubectl apply -f infrastructure/kubernetes/namespace.yaml

# Edit configmap.yaml with your values
# IMPORTANT: Update all CHANGE_ME values
kubectl apply -f infrastructure/kubernetes/configmap.yaml -n radar-production
```

2. **Deploy services**

```bash
# Set environment variables
export CONTAINER_REGISTRY=your-registry.com
export IMAGE_TAG=latest

# Deploy using script
./scripts/deploy.sh production

# Or deploy manually
kubectl apply -f infrastructure/kubernetes/ -n radar-production
```

3. **Verify deployment**

```bash
kubectl get pods -n radar-production
kubectl get services -n radar-production
kubectl get ingress -n radar-production
```

#### Scaling

```bash
# Scale API replicas
kubectl scale deployment/radar-api --replicas=5 -n radar-production

# View HPA status
kubectl get hpa -n radar-production
```

---

## CI/CD Pipeline

The project uses GitHub Actions for CI/CD.

### Workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `ci.yml` | Push/PR to main, develop | Lint, test, build |
| `deploy.yml` | Push to main, staging | Deploy to environments |

### Required Secrets

Configure these in GitHub repository settings:

| Secret | Description |
|--------|-------------|
| `CONTAINER_REGISTRY` | Docker registry URL |
| `REGISTRY_USERNAME` | Registry username |
| `REGISTRY_PASSWORD` | Registry password |
| `KUBECONFIG` | Base64 encoded kubeconfig |
| `API_URL` | Production API URL |
| `WS_URL` | Production WebSocket URL |

### Manual Deployment

```bash
# Trigger deployment via GitHub Actions
gh workflow run deploy.yml -f environment=production
```

---

## Environment Configuration

### Required Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/database
POSTGRES_PASSWORD=secure_password

# Redis
REDIS_URL=redis://:password@host:6379

# Authentication
JWT_SECRET=your-256-bit-secret
JWT_REFRESH_SECRET=your-refresh-secret

# API
API_PORT=3001
NODE_ENV=production

# Frontend
NEXT_PUBLIC_API_URL=https://api.radar.defesacivil.gov.br/api/v1
NEXT_PUBLIC_WS_URL=wss://api.radar.defesacivil.gov.br
```

### Environment-Specific Files

- `.env.development` - Local development
- `.env.staging` - Staging environment
- `.env.production` - Production environment

---

## Database Migrations

### Running Migrations

```bash
# Docker Compose
docker exec radar-api pnpm db:migrate

# Kubernetes
kubectl exec -n radar-production deployment/radar-api -- pnpm db:migrate
```

### Creating Migrations

```bash
cd apps/api
pnpm db:migrate:create -- --name add_new_feature
```

### Seeding Data

```bash
# Docker Compose
docker exec radar-api pnpm db:seed

# Kubernetes
kubectl exec -n radar-production deployment/radar-api -- pnpm db:seed
```

---

## Monitoring & Health Checks

### Health Check Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/v1/health` | API health status |
| `/api/v1/health/db` | Database connectivity |
| `/api/v1/health/redis` | Redis connectivity |
| `/health` (nginx) | Nginx health |

### Running Health Checks

```bash
./scripts/health-check.sh http://localhost
./scripts/health-check.sh https://radar.defesacivil.gov.br
```

### Recommended Monitoring Stack

- **Prometheus** - Metrics collection
- **Grafana** - Dashboards and visualization
- **Loki** - Log aggregation
- **AlertManager** - Alerting

---

## Backup & Recovery

### Automated Backups

```bash
# Full backup (database + files)
./scripts/backup.sh all

# Database only
./scripts/backup.sh database

# Files only
./scripts/backup.sh files

# Cleanup old backups
./scripts/backup.sh cleanup
```

### Backup Schedule (Cron)

```cron
# Daily database backup at 2 AM
0 2 * * * /path/to/radar-defesa-civil/scripts/backup.sh database

# Weekly full backup on Sunday at 3 AM
0 3 * * 0 /path/to/radar-defesa-civil/scripts/backup.sh all
```

### Restoring from Backup

```bash
# Restore database
gunzip < backups/db_backup_TIMESTAMP.sql.gz | docker exec -i radar-postgres psql -U radar radar_defesa_civil

# Restore files
tar -xzf backups/files_backup_TIMESTAMP.tar.gz -C /path/to/restore
```

---

## Troubleshooting

### Common Issues

#### API not starting

```bash
# Check logs
docker logs radar-api

# Verify database connection
docker exec radar-api pnpm db:migrate --dry-run
```

#### Database connection errors

```bash
# Test database connectivity
docker exec radar-postgres pg_isready -U radar

# Check database logs
docker logs radar-postgres
```

#### Redis connection errors

```bash
# Test Redis connectivity
docker exec radar-redis redis-cli ping
```

#### Web app not loading

```bash
# Check web logs
docker logs radar-web

# Verify API URL configuration
docker exec radar-web printenv | grep NEXT_PUBLIC
```

### Getting Help

- Check logs: `./scripts/deploy-docker.sh logs`
- Health check: `./scripts/health-check.sh`
- Documentation: https://docs.radar.defesacivil.gov.br
- Support: suporte@defesacivil.gov.br

---

## Security Recommendations

1. **Use secrets management** (HashiCorp Vault, AWS Secrets Manager)
2. **Enable SSL/TLS** for all external traffic
3. **Regular security updates** for base images
4. **Network policies** to restrict pod communication
5. **Regular backup testing** to ensure recoverability
6. **Monitor for vulnerabilities** with tools like Trivy
7. **Implement rate limiting** at the ingress level
8. **Use non-root containers** (already configured)
