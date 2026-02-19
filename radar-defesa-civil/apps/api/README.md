# @radar/api

Backend API do Sistema Radar Defesa Civil.

## Tecnologias

- **Fastify** - Framework web
- **Prisma** - ORM
- **PostgreSQL** - Banco de dados
- **Redis** - Cache e pub/sub
- **BullMQ** - Filas de background
- **Socket.IO** - WebSocket

## Estrutura

```
src/
├── config/           # Configurações (database, redis, env)
├── middleware/       # Middlewares (auth, error-handler)
├── modules/          # Módulos da aplicação
│   ├── auth/         # Autenticação
│   ├── users/        # Gestão de usuários
│   ├── alerts/       # Sistema de alertas
│   ├── radar/        # Dados de radar
│   ├── municipalities/ # Municípios
│   ├── statistics/   # Estatísticas
│   └── reports/      # Relatórios
├── services/         # Serviços compartilhados
├── jobs/             # Jobs de background
├── utils/            # Utilitários
└── test/             # Configuração de testes
```

## Scripts

```bash
# Desenvolvimento
pnpm dev

# Build
pnpm build

# Testes
pnpm test
pnpm test:integration

# Banco de dados
pnpm db:migrate      # Executar migrations
pnpm db:seed         # Popular banco
pnpm db:studio       # Abrir Prisma Studio
```

## Variáveis de Ambiente

```env
NODE_ENV=development
API_PORT=3001
API_HOST=0.0.0.0

DATABASE_URL=postgresql://user:pass@localhost:5432/radar
REDIS_URL=redis://localhost:6379

JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
```

## Autenticação

A API usa JWT para autenticação. Endpoints protegidos requerem o header:

```
Authorization: Bearer <access_token>
```

### Roles

| Role | Nível | Descrição |
|------|-------|-----------|
| admin | 100 | Acesso total |
| manager | 75 | Gerenciamento de usuários e configurações |
| operator | 50 | Operação do sistema |
| viewer | 25 | Apenas visualização |
| api_user | 10 | Acesso via API |

## Endpoints Principais

### Auth
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Renovar token
- `POST /api/v1/auth/logout` - Logout
- `POST /api/v1/auth/change-password` - Alterar senha
- `GET /api/v1/auth/me` - Usuário atual

### Users
- `GET /api/v1/users` - Listar usuários
- `POST /api/v1/users` - Criar usuário
- `PUT /api/v1/users/:id` - Atualizar usuário
- `DELETE /api/v1/users/:id` - Desativar usuário

### Alerts
- `GET /api/v1/alerts` - Listar alertas
- `GET /api/v1/alerts/:id` - Detalhes do alerta
- `POST /api/v1/alerts/:id/acknowledge` - Reconhecer alerta
- `POST /api/v1/alerts/:id/resolve` - Resolver alerta

### Statistics
- `GET /api/v1/statistics/overview` - Visão geral
- `GET /api/v1/statistics/alerts` - Estatísticas de alertas
- `GET /api/v1/statistics/precipitation` - Estatísticas de precipitação

### Reports
- `GET /api/v1/reports/alerts` - Relatório de alertas (PDF/CSV)
- `GET /api/v1/reports/executive-summary` - Resumo executivo

## Testes

```bash
# Testes unitários
pnpm test

# Testes de integração (requer banco de teste)
pnpm test:integration

# Com cobertura
pnpm test -- --coverage
```

## Documentação da API

Acesse `/docs` para a documentação Swagger interativa.
