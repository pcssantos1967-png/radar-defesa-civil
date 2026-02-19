# Monitoring & Observability Guide

This guide covers the monitoring and observability setup for the Radar Defesa Civil system.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Components](#components)
- [Metrics](#metrics)
- [Logs](#logs)
- [Alerts](#alerts)
- [Dashboards](#dashboards)
- [Troubleshooting](#troubleshooting)

---

## Overview

The monitoring stack provides:

- **Metrics Collection** - Prometheus collects metrics from all services
- **Visualization** - Grafana dashboards for real-time monitoring
- **Alerting** - Alertmanager handles alert routing and notifications
- **Log Aggregation** - Loki collects and indexes logs from all containers
- **Infrastructure Monitoring** - Node Exporter and cAdvisor for system metrics

### Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Grafana   │────▶│ Prometheus  │────▶│  Services   │
│  (UI/Dash)  │     │  (Metrics)  │     │ (API, Web)  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │            ┌──────┴──────┐
       │            │             │
       ▼            ▼             ▼
┌─────────────┐ ┌─────────┐ ┌─────────────┐
│    Loki     │ │Alertmgr │ │  Exporters  │
│   (Logs)    │ │(Alerts) │ │(Node,Redis) │
└─────────────┘ └─────────┘ └─────────────┘
       ▲
       │
┌─────────────┐
│  Promtail   │
│(Log Shipper)│
└─────────────┘
```

---

## Quick Start

### Starting the Monitoring Stack

```bash
# Start all monitoring services
./scripts/monitoring.sh up

# Check status
./scripts/monitoring.sh status

# View logs
./scripts/monitoring.sh logs
```

### Access URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Grafana | http://localhost:3030 | admin / radar_grafana_123 |
| Prometheus | http://localhost:9090 | - |
| Alertmanager | http://localhost:9093 | - |
| Loki | http://localhost:3100 | - |

---

## Components

### Prometheus (Metrics)

Prometheus scrapes metrics from all services at configurable intervals.

**Configuration:** `infrastructure/monitoring/prometheus/prometheus.yml`

**Scrape Targets:**
- `radar-api:3001/api/v1/metrics` - API metrics
- `radar-web:3000/api/metrics` - Web metrics
- `node-exporter:9100` - System metrics
- `cadvisor:8080` - Container metrics
- `redis-exporter:9121` - Redis metrics
- `postgres-exporter:9187` - PostgreSQL metrics

### Grafana (Visualization)

Grafana provides dashboards and visualization.

**Pre-configured Dashboards:**
- Radar Overview - System and service status
- API Performance - Request rates, latencies, errors
- Infrastructure - CPU, memory, disk usage
- Alerts - Alert history and status

### Alertmanager (Alerts)

Alertmanager handles alert routing and notifications.

**Configuration:** `infrastructure/monitoring/alertmanager/alertmanager.yml`

**Notification Channels:**
- Email - For all alert levels
- Slack - For critical and warning alerts
- Webhook - For SMS/WhatsApp integration

### Loki (Logs)

Loki aggregates logs from all containers.

**Configuration:** `infrastructure/monitoring/loki/loki-config.yml`

**Log Sources:**
- Docker container logs
- Application logs (JSON formatted)
- PostgreSQL logs
- Nginx access/error logs

---

## Metrics

### HTTP Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests |
| `http_request_duration_seconds` | Histogram | Request duration |
| `http_request_size_bytes` | Histogram | Request body size |
| `http_response_size_bytes` | Histogram | Response body size |

### Application Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `radar_alerts_active_total` | Gauge | Active alerts by severity |
| `radar_alerts_created_total` | Counter | Total alerts created |
| `radar_alerts_resolved_total` | Counter | Total alerts resolved |
| `radar_last_scan_timestamp` | Gauge | Last radar scan time |
| `radar_notifications_sent_total` | Counter | Notifications sent |

### Infrastructure Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `node_cpu_seconds_total` | Counter | CPU time |
| `node_memory_MemAvailable_bytes` | Gauge | Available memory |
| `node_filesystem_avail_bytes` | Gauge | Available disk space |
| `container_cpu_usage_seconds_total` | Counter | Container CPU |
| `container_memory_usage_bytes` | Gauge | Container memory |

### Database Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `pg_up` | Gauge | PostgreSQL status |
| `pg_stat_activity_count` | Gauge | Active connections |
| `pg_stat_database_deadlocks` | Counter | Deadlock count |
| `redis_up` | Gauge | Redis status |
| `redis_memory_used_bytes` | Gauge | Redis memory usage |

---

## Logs

### Querying Logs in Grafana

1. Open Grafana (http://localhost:3030)
2. Go to Explore
3. Select "Loki" datasource
4. Use LogQL queries

### LogQL Examples

```logql
# All API logs
{container="radar-api"}

# Error logs only
{container="radar-api"} |= "error"

# JSON parsed logs
{container="radar-api"} | json | level="error"

# Logs with specific status code
{container="radar-api"} | json | statusCode >= 500

# Rate of errors per minute
rate({container="radar-api"} |= "error" [1m])
```

### Log Levels

- `error` - Errors requiring attention
- `warn` - Warning conditions
- `info` - Informational messages
- `debug` - Debug information (not in production)

---

## Alerts

### Alert Severity Levels

| Severity | Description | Response Time |
|----------|-------------|---------------|
| `critical` | Service down, data loss | Immediate |
| `warning` | Degraded performance | Within 1 hour |
| `info` | Informational | Next business day |

### Alert Categories

#### Infrastructure Alerts
- `HighCPUUsage` - CPU > 80% for 5 minutes
- `CriticalCPUUsage` - CPU > 95% for 2 minutes
- `HighMemoryUsage` - Memory > 80% for 5 minutes
- `DiskSpaceLow` - Disk < 20% free

#### Container Alerts
- `ContainerDown` - Container not responding
- `ContainerHighCPU` - Container CPU > 80%
- `ContainerRestartLoop` - > 5 restarts per hour

#### Database Alerts
- `PostgreSQLDown` - Database not responding
- `PostgreSQLHighConnections` - Connections > 80%
- `PostgreSQLDeadlocks` - Deadlocks detected

#### Application Alerts
- `APIHighLatency` - p95 latency > 1 second
- `APIHighErrorRate` - Error rate > 5%
- `RadarDataStale` - No data for 10 minutes

### Managing Alerts

```bash
# View active alerts
./scripts/monitoring.sh alerts

# Silence an alert (via Alertmanager UI)
# http://localhost:9093/#/silences/new
```

---

## Dashboards

### Pre-configured Dashboards

1. **Radar Overview**
   - Service status indicators
   - Request rate and latency
   - Active alerts count
   - System resource usage

2. **API Performance**
   - Request rate by endpoint
   - Response time percentiles
   - Error rate by status code
   - Slow query analysis

3. **Infrastructure**
   - CPU, memory, disk usage
   - Network I/O
   - Container resource usage
   - Database connections

4. **Alerts Dashboard**
   - Alert history timeline
   - Alert distribution by severity
   - Mean time to resolution
   - Top alerting services

### Creating Custom Dashboards

1. Open Grafana
2. Click "+" → "New Dashboard"
3. Add panels with Prometheus queries
4. Save and organize in folders

### Useful Prometheus Queries

```promql
# Request rate
sum(rate(http_requests_total[5m]))

# Error rate percentage
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Active alerts by severity
radar_alerts_active_total

# Memory usage percentage
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100
```

---

## Troubleshooting

### Common Issues

#### Prometheus not scraping targets

```bash
# Check target status
./scripts/monitoring.sh targets

# Verify network connectivity
docker exec radar-prometheus wget -qO- http://radar-api:3001/api/v1/metrics
```

#### Grafana dashboards not loading

```bash
# Check Grafana logs
./scripts/monitoring.sh logs grafana

# Verify datasource connection
curl http://localhost:3030/api/datasources
```

#### Alerts not firing

```bash
# Check Prometheus rules
curl http://localhost:9090/api/v1/rules

# Check Alertmanager config
curl http://localhost:9093/api/v2/status
```

#### Loki not receiving logs

```bash
# Check Promtail status
./scripts/monitoring.sh logs promtail

# Verify Loki is ready
curl http://localhost:3100/ready
```

### Useful Commands

```bash
# Reload Prometheus config
./scripts/monitoring.sh reload

# Check all service health
./scripts/monitoring.sh status

# View real-time logs
./scripts/monitoring.sh logs prometheus

# Export metrics manually
curl http://localhost:9090/api/v1/query?query=up
```

---

## Best Practices

1. **Set appropriate alert thresholds** - Start with conservative thresholds and adjust based on baseline
2. **Use labels effectively** - Add meaningful labels to metrics for better filtering
3. **Implement SLOs** - Define Service Level Objectives and track them
4. **Regular review** - Review dashboards and alerts weekly
5. **Document runbooks** - Create runbooks for common alert scenarios
6. **Test alerts** - Periodically test alert routing and notifications
7. **Retention policies** - Configure appropriate data retention for metrics and logs
