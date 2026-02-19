-- Seed data for development

-- Default admin user (password: admin123)
INSERT INTO users (id, email, password_hash, name, role)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@radardefesacivil.gov.br',
    '$2b$10$8KzBYBqRVz4TWXQJ9oqYX.YJwwY1n8FQJqDhE.KnY3KzwXNqCL3PS',
    'Administrador',
    'admin'
);

-- Sample consortium
INSERT INTO consortiums (id, name, code, settings)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'Consórcio Intermunicipal do Vale do Paraíba',
    'CIVAP',
    '{"timezone": "America/Sao_Paulo", "language": "pt-BR"}'
);

-- Sample radar
INSERT INTO radars (id, name, code, location, elevation_m, range_km, manufacturer, model, band)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    'Radar São José dos Campos',
    'RSJC',
    ST_SetSRID(ST_MakePoint(-45.8869, -23.1896), 4326),
    660,
    250,
    'IACIT',
    'WR-2100X',
    'X'
);

-- Sample municipalities (Vale do Paraíba - SP)
INSERT INTO municipalities (id, consortium_id, ibge_code, name, state_code, population)
VALUES
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '3549904', 'São José dos Campos', 'SP', 729737),
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '3554102', 'Taubaté', 'SP', 311854),
    ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', '3518800', 'Guaratinguetá', 'SP', 121073),
    ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', '3513009', 'Cruzeiro', 'SP', 79218),
    ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', '3524402', 'Jacareí', 'SP', 231863);

-- =====================================================
-- ALERT RULES - Based on Cemaden/Defesa Civil standards
-- =====================================================

-- Precipitation 1h Rules (accumulated precipitation in 1 hour)
INSERT INTO alert_rules (id, consortium_id, name, description, type, conditions, actions, cooldown_minutes, priority)
VALUES
    (
        '20000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        'Precipitação 1h - Atenção',
        'Alerta de precipitação acumulada em 1 hora acima de 20mm',
        'precipitation_1h',
        '{
            "id": "precip_1h_attention",
            "source": "precipitation_accumulated",
            "field": "value",
            "operator": "gte",
            "value": 20,
            "timeWindow": "1h",
            "severityMapping": {
                "attention": 20,
                "alert": 30,
                "maxAlert": 50
            }
        }',
        '{"notify": true, "channels": ["email", "push"]}',
        60,
        5
    ),
    (
        '20000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000002',
        'Precipitação 1h - Alerta',
        'Alerta de precipitação acumulada em 1 hora acima de 30mm',
        'precipitation_1h',
        '{
            "id": "precip_1h_alert",
            "source": "precipitation_accumulated",
            "field": "value",
            "operator": "gte",
            "value": 30,
            "timeWindow": "1h",
            "severityMapping": {
                "attention": 30,
                "alert": 40,
                "maxAlert": 60
            }
        }',
        '{"notify": true, "channels": ["email", "sms", "push"], "escalate": true, "escalateAfterMinutes": 30}',
        30,
        3
    ),
    (
        '20000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000002',
        'Precipitação 1h - Alerta Máximo',
        'Alerta máximo de precipitação acumulada em 1 hora acima de 50mm',
        'precipitation_1h',
        '{
            "id": "precip_1h_max",
            "source": "precipitation_accumulated",
            "field": "value",
            "operator": "gte",
            "value": 50,
            "timeWindow": "1h",
            "severityMapping": {
                "attention": 50,
                "alert": 70,
                "maxAlert": 100
            }
        }',
        '{"notify": true, "channels": ["email", "sms", "whatsapp", "push"], "escalate": true, "escalateAfterMinutes": 15}',
        15,
        1
    );

-- Precipitation 24h Rules (accumulated precipitation in 24 hours)
INSERT INTO alert_rules (id, consortium_id, name, description, type, conditions, actions, cooldown_minutes, priority)
VALUES
    (
        '20000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000002',
        'Precipitação 24h - Atenção',
        'Alerta de precipitação acumulada em 24 horas acima de 40mm',
        'precipitation_24h',
        '{
            "id": "precip_24h_attention",
            "source": "precipitation_accumulated",
            "field": "value",
            "operator": "gte",
            "value": 40,
            "timeWindow": "24h",
            "severityMapping": {
                "attention": 40,
                "alert": 60,
                "maxAlert": 100
            }
        }',
        '{"notify": true, "channels": ["email", "push"]}',
        120,
        6
    ),
    (
        '20000000-0000-0000-0000-000000000005',
        '00000000-0000-0000-0000-000000000002',
        'Precipitação 24h - Alerta',
        'Alerta de precipitação acumulada em 24 horas acima de 60mm',
        'precipitation_24h',
        '{
            "id": "precip_24h_alert",
            "source": "precipitation_accumulated",
            "field": "value",
            "operator": "gte",
            "value": 60,
            "timeWindow": "24h",
            "severityMapping": {
                "attention": 60,
                "alert": 80,
                "maxAlert": 120
            }
        }',
        '{"notify": true, "channels": ["email", "sms", "push"], "escalate": true, "escalateAfterMinutes": 60}',
        60,
        4
    ),
    (
        '20000000-0000-0000-0000-000000000006',
        '00000000-0000-0000-0000-000000000002',
        'Precipitação 24h - Alerta Máximo',
        'Alerta máximo de precipitação acumulada em 24 horas acima de 100mm',
        'precipitation_24h',
        '{
            "id": "precip_24h_max",
            "source": "precipitation_accumulated",
            "field": "value",
            "operator": "gte",
            "value": 100,
            "timeWindow": "24h",
            "severityMapping": {
                "attention": 100,
                "alert": 150,
                "maxAlert": 200
            }
        }',
        '{"notify": true, "channels": ["email", "sms", "whatsapp", "push"], "escalate": true, "escalateAfterMinutes": 30}',
        30,
        2
    );

-- Radar Reflectivity Rules (convective cells)
INSERT INTO alert_rules (id, consortium_id, name, description, type, conditions, actions, cooldown_minutes, priority)
VALUES
    (
        '20000000-0000-0000-0000-000000000007',
        '00000000-0000-0000-0000-000000000002',
        'Refletividade Alta - Atenção',
        'Célula convectiva com refletividade acima de 40 dBZ detectada',
        'reflectivity',
        '{
            "id": "reflectivity_attention",
            "source": "radar_reflectivity",
            "field": "value",
            "operator": "gte",
            "value": 40,
            "severityMapping": {
                "attention": 40,
                "alert": 50,
                "maxAlert": 55
            }
        }',
        '{"notify": true, "channels": ["email", "push"]}',
        30,
        5
    ),
    (
        '20000000-0000-0000-0000-000000000008',
        '00000000-0000-0000-0000-000000000002',
        'Refletividade Intensa - Alerta',
        'Célula convectiva severa com refletividade acima de 50 dBZ detectada',
        'reflectivity',
        '{
            "id": "reflectivity_alert",
            "source": "radar_reflectivity",
            "field": "value",
            "operator": "gte",
            "value": 50,
            "severityMapping": {
                "attention": 50,
                "alert": 55,
                "maxAlert": 60
            }
        }',
        '{"notify": true, "channels": ["email", "sms", "push"], "escalate": true, "escalateAfterMinutes": 15}',
        15,
        3
    ),
    (
        '20000000-0000-0000-0000-000000000009',
        '00000000-0000-0000-0000-000000000002',
        'Refletividade Extrema - Alerta Máximo',
        'Célula convectiva extrema com refletividade acima de 55 dBZ - possibilidade de granizo',
        'reflectivity',
        '{
            "id": "reflectivity_max",
            "source": "radar_reflectivity",
            "field": "value",
            "operator": "gte",
            "value": 55,
            "severityMapping": {
                "attention": 55,
                "alert": 60,
                "maxAlert": 65
            }
        }',
        '{"notify": true, "channels": ["email", "sms", "whatsapp", "push"], "escalate": true, "escalateAfterMinutes": 10}',
        10,
        1
    );

-- Wind Speed Rules
INSERT INTO alert_rules (id, consortium_id, name, description, type, conditions, actions, cooldown_minutes, priority)
VALUES
    (
        '20000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000002',
        'Vento Forte - Atenção',
        'Rajadas de vento acima de 15 m/s (54 km/h)',
        'wind',
        '{
            "id": "wind_attention",
            "source": "station_wind",
            "field": "value",
            "operator": "gte",
            "value": 15
        }',
        '{"notify": true, "channels": ["email", "push"]}',
        60,
        5
    ),
    (
        '20000000-0000-0000-0000-000000000011',
        '00000000-0000-0000-0000-000000000002',
        'Vento Muito Forte - Alerta',
        'Rajadas de vento acima de 20 m/s (72 km/h)',
        'wind',
        '{
            "id": "wind_alert",
            "source": "station_wind",
            "field": "value",
            "operator": "gte",
            "value": 20
        }',
        '{"notify": true, "channels": ["email", "sms", "push"], "escalate": true, "escalateAfterMinutes": 30}',
        30,
        3
    );

-- Compound Rule Example (Precipitation + Risk Area)
INSERT INTO alert_rules (id, consortium_id, name, description, type, conditions, actions, cooldown_minutes, priority)
VALUES
    (
        '20000000-0000-0000-0000-000000000012',
        '00000000-0000-0000-0000-000000000002',
        'Chuva sobre Área de Risco',
        'Precipitação acumulada sobre área de risco de deslizamento',
        'flood_risk',
        '{
            "logic": "AND",
            "conditions": [
                {
                    "id": "precip_risk_area",
                    "source": "precipitation_accumulated",
                    "field": "value",
                    "operator": "gte",
                    "value": 15,
                    "timeWindow": "1h"
                },
                {
                    "id": "risk_area_overlap",
                    "source": "risk_area_overlap",
                    "field": "has_overlap",
                    "operator": "eq",
                    "value": 1
                }
            ],
            "severityMapping": {
                "attention": 15,
                "alert": 25,
                "maxAlert": 40
            }
        }',
        '{"notify": true, "channels": ["email", "sms", "whatsapp", "push"], "escalate": true, "escalateAfterMinutes": 15}',
        15,
        1
    );
