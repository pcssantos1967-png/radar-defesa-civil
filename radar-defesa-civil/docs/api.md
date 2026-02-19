# Documentação da API

Base URL: `https://api.radar.defesacivil.gov.br/api/v1`

## Autenticação

A API usa autenticação JWT. Inclua o token no header de todas as requisições protegidas:

```
Authorization: Bearer <access_token>
```

---

## Auth

### POST /auth/login

Autentica um usuário e retorna tokens de acesso.

**Request:**
```json
{
  "email": "usuario@exemplo.com",
  "password": "senha123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "usuario@exemplo.com",
      "name": "Nome do Usuário",
      "role": "operator",
      "consortiumId": "uuid"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": 900
    }
  }
}
```

**Errors:**
- `401` - Credenciais inválidas
- `403` - Conta desativada ou bloqueada

---

### POST /auth/refresh

Renova o token de acesso usando o refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": 900
    }
  }
}
```

---

### POST /auth/logout

Invalida o refresh token do usuário.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### POST /auth/change-password

Altera a senha do usuário autenticado.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "currentPassword": "senhaAtual123",
  "newPassword": "novaSenha456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

### GET /auth/me

Retorna informações do usuário autenticado.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "usuario@exemplo.com",
      "name": "Nome do Usuário",
      "role": "operator",
      "consortiumId": "uuid",
      "phone": "+5511999999999",
      "notificationPreferences": {
        "email": true,
        "sms": false,
        "whatsapp": true,
        "severityFilter": ["attention", "alert", "max_alert"]
      }
    }
  }
}
```

---

## Users

### GET /users

Lista usuários com paginação e filtros.

**Headers:** `Authorization: Bearer <token>` (Admin ou Manager)

**Query Parameters:**
| Param | Tipo | Descrição |
|-------|------|-----------|
| page | number | Página (default: 1) |
| limit | number | Itens por página (default: 10) |
| role | string | Filtrar por role |
| isActive | boolean | Filtrar por status |
| search | string | Buscar por nome ou email |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "usuario@exemplo.com",
      "name": "Nome do Usuário",
      "role": "operator",
      "isActive": true,
      "lastLoginAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

---

### POST /users

Cria um novo usuário.

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Request:**
```json
{
  "email": "novo@exemplo.com",
  "password": "senha123",
  "name": "Novo Usuário",
  "role": "operator",
  "consortiumId": "uuid",
  "municipalityIds": ["uuid1", "uuid2"],
  "phone": "+5511999999999"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "novo@exemplo.com",
      "name": "Novo Usuário",
      "role": "operator"
    }
  }
}
```

---

### PUT /users/:id

Atualiza um usuário.

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Request:**
```json
{
  "name": "Nome Atualizado",
  "role": "manager",
  "phone": "+5511988888888"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Nome Atualizado",
      "role": "manager"
    }
  }
}
```

---

### DELETE /users/:id

Desativa um usuário (soft delete).

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Response (200):**
```json
{
  "success": true,
  "message": "User deactivated"
}
```

---

### POST /users/:id/activate

Reativa um usuário desativado.

**Headers:** `Authorization: Bearer <token>` (Admin only)

**Response (200):**
```json
{
  "success": true,
  "message": "User activated"
}
```

---

## Alerts

### GET /alerts

Lista alertas com filtros.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
| Param | Tipo | Descrição |
|-------|------|-----------|
| status | string | active, acknowledged, resolved, expired |
| severity | string | observation, attention, alert, max_alert |
| municipalityId | uuid | Filtrar por município |
| start | ISO date | Data inicial |
| end | ISO date | Data final |
| limit | number | Limite de resultados |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "precipitation_1h",
      "severity": "alert",
      "status": "active",
      "title": "Precipitação intensa detectada",
      "description": "Acumulado de 45mm na última hora",
      "municipalityId": "uuid",
      "municipalityName": "São Paulo",
      "latitude": -23.5505,
      "longitude": -46.6333,
      "triggeredAt": "2024-01-15T10:30:00Z",
      "triggeredValue": 45.2,
      "expiresAt": "2024-01-15T14:30:00Z"
    }
  ]
}
```

---

### GET /alerts/:id

Retorna detalhes de um alerta.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "alert": {
      "id": "uuid",
      "type": "precipitation_1h",
      "severity": "alert",
      "status": "active",
      "title": "Precipitação intensa detectada",
      "description": "Acumulado de 45mm na última hora",
      "municipalityId": "uuid",
      "municipality": {
        "id": "uuid",
        "name": "São Paulo",
        "state": "SP"
      },
      "rule": {
        "id": "uuid",
        "name": "Precipitação 1h - Alerta"
      },
      "triggeredAt": "2024-01-15T10:30:00Z",
      "triggeredValue": 45.2,
      "acknowledgedAt": null,
      "acknowledgedBy": null,
      "resolvedAt": null,
      "resolutionNotes": null
    }
  }
}
```

---

### POST /alerts/:id/acknowledge

Reconhece um alerta.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "notes": "Equipe notificada"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "alert": {
      "id": "uuid",
      "status": "acknowledged",
      "acknowledgedAt": "2024-01-15T10:35:00Z"
    }
  }
}
```

---

### POST /alerts/:id/resolve

Resolve um alerta.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "notes": "Situação normalizada. Precipitação cessou."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "alert": {
      "id": "uuid",
      "status": "resolved",
      "resolvedAt": "2024-01-15T12:00:00Z"
    }
  }
}
```

---

## Statistics

### GET /statistics/overview

Retorna visão geral das estatísticas.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
| Param | Tipo | Descrição |
|-------|------|-----------|
| start | ISO date | Data inicial |
| end | ISO date | Data final |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "total_alerts": 150,
    "active_alerts": 12,
    "resolved_alerts": 138,
    "avg_resolution_time_minutes": 45,
    "total_municipalities_affected": 25,
    "period": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-01-15T23:59:59Z"
    }
  }
}
```

---

### GET /statistics/alerts/timeseries

Retorna série temporal de alertas.

**Query Parameters:**
| Param | Tipo | Descrição |
|-------|------|-----------|
| start | ISO date | Data inicial |
| end | ISO date | Data final |
| interval | string | hour, day, week, month |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "period": "2024-01-01T00:00:00Z",
      "observation": 5,
      "attention": 3,
      "alert": 2,
      "max_alert": 1,
      "total": 11
    }
  ]
}
```

---

## Reports

### GET /reports/alerts

Gera relatório de alertas em PDF ou CSV.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
| Param | Tipo | Descrição |
|-------|------|-----------|
| start | ISO date | Data inicial |
| end | ISO date | Data final |
| format | string | pdf ou csv |
| severity | string | Filtrar por severidade |

**Response:** Arquivo binário (PDF ou CSV)

---

### GET /reports/executive-summary

Gera resumo executivo em PDF.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
| Param | Tipo | Descrição |
|-------|------|-----------|
| start | ISO date | Data inicial |
| end | ISO date | Data final |

**Response:** Arquivo PDF

---

## Códigos de Erro

| Código | Descrição |
|--------|-----------|
| 400 | Bad Request - Dados inválidos |
| 401 | Unauthorized - Token inválido ou expirado |
| 403 | Forbidden - Sem permissão |
| 404 | Not Found - Recurso não encontrado |
| 409 | Conflict - Conflito (ex: email duplicado) |
| 429 | Too Many Requests - Rate limit excedido |
| 500 | Internal Server Error |

## Rate Limiting

- 100 requisições por minuto por IP
- Headers de resposta incluem:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`
