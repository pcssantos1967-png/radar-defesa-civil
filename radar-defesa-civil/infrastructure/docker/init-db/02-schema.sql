-- Radar Defesa Civil - Database Schema
-- PostgreSQL + PostGIS + TimescaleDB

-- ============================================
-- CORE TABLES
-- ============================================

-- Consortiums (Consórcios Municipais)
CREATE TABLE consortiums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    boundary GEOMETRY(MULTIPOLYGON, 4326),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Municipalities (Municípios)
CREATE TABLE municipalities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consortium_id UUID REFERENCES consortiums(id) ON DELETE SET NULL,
    ibge_code VARCHAR(7) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    state_code CHAR(2) NOT NULL,
    boundary GEOMETRY(MULTIPOLYGON, 4326),
    centroid GEOMETRY(POINT, 4326),
    population INTEGER,
    area_km2 DECIMAL(12,2),
    alert_thresholds JSONB DEFAULT '{
        "precipitation_1h": {"attention": 20, "alert": 40, "max_alert": 60},
        "precipitation_24h": {"attention": 50, "alert": 80, "max_alert": 120}
    }',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_municipalities_consortium ON municipalities(consortium_id);
CREATE INDEX idx_municipalities_ibge ON municipalities(ibge_code);
CREATE INDEX idx_municipalities_boundary ON municipalities USING GIST(boundary);

-- ============================================
-- RADAR TABLES
-- ============================================

-- Radar Sites
CREATE TABLE radars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    location GEOMETRY(POINT, 4326) NOT NULL,
    elevation_m DECIMAL(8,2),
    range_km INTEGER DEFAULT 250,
    scan_interval_minutes INTEGER DEFAULT 10,
    manufacturer VARCHAR(50),
    model VARCHAR(50),
    band VARCHAR(10) DEFAULT 'X',  -- X, S, C
    status VARCHAR(20) DEFAULT 'operational',
    last_scan_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_radars_location ON radars USING GIST(location);
CREATE INDEX idx_radars_status ON radars(status);

-- Radar Scans (TimescaleDB hypertable)
CREATE TABLE radar_scans (
    id BIGSERIAL,
    radar_id UUID NOT NULL REFERENCES radars(id) ON DELETE CASCADE,
    scan_time TIMESTAMPTZ NOT NULL,
    elevation_angle DECIMAL(5,2),
    product_type VARCHAR(20) NOT NULL,  -- PPI, CAPPI, MAX-Z, VIL, ECHO-TOP
    file_path VARCHAR(500),
    tile_path VARCHAR(500),
    quality_score DECIMAL(3,2),
    metadata JSONB DEFAULT '{}',
    PRIMARY KEY (id, scan_time)
);

SELECT create_hypertable('radar_scans', 'scan_time', chunk_time_interval => INTERVAL '1 day');

CREATE INDEX idx_radar_scans_radar ON radar_scans(radar_id, scan_time DESC);
CREATE INDEX idx_radar_scans_product ON radar_scans(product_type, scan_time DESC);

-- ============================================
-- PRECIPITATION TABLES
-- ============================================

-- Precipitation Observations (TimescaleDB hypertable)
CREATE TABLE precipitation_observations (
    id BIGSERIAL,
    municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
    location GEOMETRY(POINT, 4326),
    observation_time TIMESTAMPTZ NOT NULL,
    source VARCHAR(20) NOT NULL,  -- radar, gauge, satellite, merged
    source_id VARCHAR(50),  -- ID da estação/radar
    precipitation_mm DECIMAL(8,2),
    reflectivity_dbz DECIMAL(5,1),
    confidence DECIMAL(3,2),
    metadata JSONB DEFAULT '{}',
    PRIMARY KEY (id, observation_time)
);

SELECT create_hypertable('precipitation_observations', 'observation_time', chunk_time_interval => INTERVAL '1 day');

CREATE INDEX idx_precip_municipality ON precipitation_observations(municipality_id, observation_time DESC);
CREATE INDEX idx_precip_source ON precipitation_observations(source, observation_time DESC);

-- Precipitation Accumulated (materialized view for fast queries)
CREATE MATERIALIZED VIEW precipitation_accumulated AS
SELECT
    municipality_id,
    date_trunc('hour', observation_time) AS hour,
    SUM(precipitation_mm) AS total_mm,
    AVG(confidence) AS avg_confidence,
    COUNT(*) AS observation_count
FROM precipitation_observations
WHERE observation_time > NOW() - INTERVAL '7 days'
GROUP BY municipality_id, date_trunc('hour', observation_time);

CREATE UNIQUE INDEX idx_precip_acc ON precipitation_accumulated(municipality_id, hour);

-- ============================================
-- ALERT TABLES
-- ============================================

-- Alert Rules
CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consortium_id UUID REFERENCES consortiums(id) ON DELETE CASCADE,
    municipality_id UUID REFERENCES municipalities(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,  -- precipitation, reflectivity, cell_approach
    conditions JSONB NOT NULL,
    actions JSONB NOT NULL DEFAULT '{"notify": true}',
    cooldown_minutes INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 5,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alert_rules_consortium ON alert_rules(consortium_id);
CREATE INDEX idx_alert_rules_municipality ON alert_rules(municipality_id);
CREATE INDEX idx_alert_rules_active ON alert_rules(is_active) WHERE is_active = true;

-- Alerts
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consortium_id UUID REFERENCES consortiums(id) ON DELETE SET NULL,
    municipality_id UUID REFERENCES municipalities(id) ON DELETE SET NULL,
    rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('observation', 'attention', 'alert', 'max_alert')),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    affected_area GEOMETRY(POLYGON, 4326),
    trigger_value DECIMAL(10,2),
    threshold_value DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'expired')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    notifications_sent JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_alerts_status ON alerts(status) WHERE status = 'active';
CREATE INDEX idx_alerts_severity ON alerts(severity, started_at DESC);
CREATE INDEX idx_alerts_municipality ON alerts(municipality_id, started_at DESC);
CREATE INDEX idx_alerts_consortium ON alerts(consortium_id, started_at DESC);
CREATE INDEX idx_alerts_affected_area ON alerts USING GIST(affected_area);

-- ============================================
-- RISK AREAS
-- ============================================

-- Risk Areas (áreas de risco mapeadas)
CREATE TABLE risk_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_id UUID REFERENCES municipalities(id) ON DELETE CASCADE,
    name VARCHAR(255),
    risk_type VARCHAR(50) NOT NULL,  -- flood, landslide, flashflood, dam_breach
    severity VARCHAR(20) DEFAULT 'medium',
    boundary GEOMETRY(POLYGON, 4326),
    population_at_risk INTEGER,
    source VARCHAR(50),  -- CPRM, CEMADEN, municipal
    source_id VARCHAR(100),
    validation_date DATE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_risk_areas_municipality ON risk_areas(municipality_id);
CREATE INDEX idx_risk_areas_type ON risk_areas(risk_type);
CREATE INDEX idx_risk_areas_boundary ON risk_areas USING GIST(boundary);

-- ============================================
-- EXTERNAL STATIONS
-- ============================================

-- Meteorological Stations
CREATE TABLE stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    source VARCHAR(50) NOT NULL,  -- cemaden, inmet, ana
    station_type VARCHAR(50),  -- automatic, conventional, pluviometer
    location GEOMETRY(POINT, 4326) NOT NULL,
    elevation_m DECIMAL(8,2),
    municipality_id UUID REFERENCES municipalities(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stations_source ON stations(source);
CREATE INDEX idx_stations_location ON stations USING GIST(location);

-- Station Observations (TimescaleDB hypertable)
CREATE TABLE station_observations (
    id BIGSERIAL,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    observation_time TIMESTAMPTZ NOT NULL,
    precipitation_mm DECIMAL(8,2),
    temperature_c DECIMAL(5,2),
    humidity_percent DECIMAL(5,2),
    pressure_hpa DECIMAL(7,2),
    wind_speed_ms DECIMAL(5,2),
    wind_direction_deg INTEGER,
    solar_radiation_wm2 DECIMAL(8,2),
    quality_flag INTEGER DEFAULT 0,
    PRIMARY KEY (id, observation_time)
);

SELECT create_hypertable('station_observations', 'observation_time', chunk_time_interval => INTERVAL '1 day');

CREATE INDEX idx_station_obs_station ON station_observations(station_id, observation_time DESC);

-- ============================================
-- NOWCASTING
-- ============================================

-- Tracked Convective Cells
CREATE TABLE convective_cells (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id VARCHAR(50) NOT NULL,  -- identifier across time steps
    detection_time TIMESTAMPTZ NOT NULL,
    centroid GEOMETRY(POINT, 4326) NOT NULL,
    boundary GEOMETRY(POLYGON, 4326),
    max_reflectivity_dbz DECIMAL(5,1),
    vil DECIMAL(8,2),  -- Vertically Integrated Liquid
    echo_top_km DECIMAL(5,2),
    area_km2 DECIMAL(10,2),
    velocity_ms DECIMAL(5,2),
    direction_deg INTEGER,
    severity VARCHAR(20),  -- weak, moderate, strong, severe
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cells_track ON convective_cells(track_id, detection_time DESC);
CREATE INDEX idx_cells_active ON convective_cells(is_active) WHERE is_active = true;
CREATE INDEX idx_cells_centroid ON convective_cells USING GIST(centroid);

-- Nowcast Forecasts
CREATE TABLE nowcast_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_time TIMESTAMPTZ NOT NULL,
    valid_time TIMESTAMPTZ NOT NULL,
    lead_time_minutes INTEGER NOT NULL,
    forecast_type VARCHAR(50) NOT NULL,  -- precipitation, reflectivity
    data_path VARCHAR(500),
    tile_path VARCHAR(500),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nowcast_issue ON nowcast_forecasts(issue_time DESC);
CREATE INDEX idx_nowcast_valid ON nowcast_forecasts(valid_time);

-- ============================================
-- USERS & AUTH
-- ============================================

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'operator', 'manager', 'viewer', 'api_user')),
    consortium_id UUID REFERENCES consortiums(id) ON DELETE SET NULL,
    municipality_ids UUID[] DEFAULT '{}',
    phone VARCHAR(20),
    avatar_url VARCHAR(500),
    notification_preferences JSONB DEFAULT '{
        "email": true,
        "sms": false,
        "whatsapp": false,
        "push": true,
        "severities": ["alert", "max_alert"]
    }',
    is_active BOOLEAN DEFAULT true,
    email_verified_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_consortium ON users(consortium_id);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

-- Refresh Tokens
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- API Keys
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    permissions JSONB DEFAULT '[]',
    rate_limit INTEGER DEFAULT 1000,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);

-- ============================================
-- AUDIT & LOGGING
-- ============================================

-- Audit Logs (TimescaleDB hypertable)
CREATE TABLE audit_logs (
    id BIGSERIAL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
);

SELECT create_hypertable('audit_logs', 'created_at', chunk_time_interval => INTERVAL '1 month');

CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_consortiums_updated_at
    BEFORE UPDATE ON consortiums
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_municipalities_updated_at
    BEFORE UPDATE ON municipalities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_radars_updated_at
    BEFORE UPDATE ON radars
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_alert_rules_updated_at
    BEFORE UPDATE ON alert_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_risk_areas_updated_at
    BEFORE UPDATE ON risk_areas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_stations_updated_at
    BEFORE UPDATE ON stations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to calculate municipality centroid
CREATE OR REPLACE FUNCTION calculate_centroid()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.boundary IS NOT NULL THEN
        NEW.centroid = ST_Centroid(NEW.boundary);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_municipality_centroid
    BEFORE INSERT OR UPDATE OF boundary ON municipalities
    FOR EACH ROW EXECUTE FUNCTION calculate_centroid();
