-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- TimescaleDB is already enabled in the image
-- Just verify it's available
SELECT extname FROM pg_extension WHERE extname = 'timescaledb';
