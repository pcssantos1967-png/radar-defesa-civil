#!/bin/bash
set -e

# Radar Defesa Civil - Backup Script
# Usage: ./scripts/backup.sh [database|files|all]

BACKUP_TYPE=${1:-all}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
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

# Load environment variables
if [[ -f "$PROJECT_ROOT/.env" ]]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

# Database configuration
DB_HOST=${POSTGRES_HOST:-localhost}
DB_PORT=${POSTGRES_PORT:-5432}
DB_NAME=${POSTGRES_DB:-radar_defesa_civil}
DB_USER=${POSTGRES_USER:-radar}

# Create backup directory
mkdir -p "$BACKUP_DIR"

backup_database() {
    log_info "Starting database backup..."

    BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"

    # Check if running in Docker
    if docker ps --format '{{.Names}}' | grep -q "radar-postgres"; then
        log_info "Backing up from Docker container..."
        docker exec radar-postgres pg_dump -U $DB_USER $DB_NAME | gzip > "$BACKUP_FILE"
    else
        log_info "Backing up from local/remote database..."
        PGPASSWORD=$POSTGRES_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME | gzip > "$BACKUP_FILE"
    fi

    if [[ -f "$BACKUP_FILE" ]]; then
        SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        log_info "Database backup completed: $BACKUP_FILE ($SIZE)"
    else
        log_error "Database backup failed!"
        return 1
    fi
}

backup_files() {
    log_info "Starting file backup..."

    BACKUP_FILE="$BACKUP_DIR/files_backup_$TIMESTAMP.tar.gz"

    # Directories to backup
    DIRS_TO_BACKUP=""

    # Add radar data if exists
    if [[ -d "$PROJECT_ROOT/data/radar" ]]; then
        DIRS_TO_BACKUP="$DIRS_TO_BACKUP data/radar"
    fi

    # Add tiles if exists
    if [[ -d "$PROJECT_ROOT/data/tiles" ]]; then
        DIRS_TO_BACKUP="$DIRS_TO_BACKUP data/tiles"
    fi

    # Add uploads if exists
    if [[ -d "$PROJECT_ROOT/uploads" ]]; then
        DIRS_TO_BACKUP="$DIRS_TO_BACKUP uploads"
    fi

    if [[ -n "$DIRS_TO_BACKUP" ]]; then
        cd "$PROJECT_ROOT"
        tar -czf "$BACKUP_FILE" $DIRS_TO_BACKUP

        SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        log_info "File backup completed: $BACKUP_FILE ($SIZE)"
    else
        log_warn "No data directories found to backup"
    fi
}

backup_minio() {
    log_info "Starting MinIO backup..."

    if docker ps --format '{{.Names}}' | grep -q "radar-minio"; then
        BACKUP_FILE="$BACKUP_DIR/minio_backup_$TIMESTAMP.tar.gz"

        docker exec radar-minio sh -c "cd /data && tar -czf - ." > "$BACKUP_FILE"

        if [[ -f "$BACKUP_FILE" ]]; then
            SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
            log_info "MinIO backup completed: $BACKUP_FILE ($SIZE)"
        fi
    else
        log_warn "MinIO container not found, skipping MinIO backup"
    fi
}

cleanup_old_backups() {
    log_info "Cleaning up old backups (keeping last 7 days)..."

    find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete 2>/dev/null || true

    log_info "Cleanup completed"
}

# Main
echo "==================================="
echo "Radar Defesa Civil - Backup"
echo "==================================="
echo "Timestamp: $TIMESTAMP"
echo "Backup directory: $BACKUP_DIR"
echo ""

case $BACKUP_TYPE in
    database|db)
        backup_database
        ;;
    files)
        backup_files
        ;;
    minio)
        backup_minio
        ;;
    all)
        backup_database
        backup_files
        backup_minio
        cleanup_old_backups
        ;;
    cleanup)
        cleanup_old_backups
        ;;
    *)
        echo "Usage: $0 [database|files|minio|all|cleanup]"
        echo ""
        echo "Commands:"
        echo "  database  - Backup PostgreSQL database"
        echo "  files     - Backup data files (radar, tiles)"
        echo "  minio     - Backup MinIO object storage"
        echo "  all       - Backup everything and cleanup old backups"
        echo "  cleanup   - Remove backups older than 7 days"
        exit 1
        ;;
esac

echo ""
echo "==================================="
log_info "Backup process completed!"

# List backups
echo ""
log_info "Recent backups:"
ls -lah "$BACKUP_DIR"/*.gz 2>/dev/null | tail -10 || echo "No backups found"
