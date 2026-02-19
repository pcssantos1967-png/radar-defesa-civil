# Radar Defesa Civil

Sistema de Monitoramento Meteorológico em Tempo Real para Defesa Civil.

## Visão Geral

O Radar Defesa Civil é uma plataforma completa para monitoramento meteorológico, gestão de alertas e comunicação com a população em situações de risco. O sistema integra dados de radares meteorológicos, estações pluviométricas e modelos de previsão para fornecer alertas em tempo real.

## Arquitetura

```
radar-defesa-civil/
├── apps/
│   ├── api/              # Backend Fastify (Node.js)
│   ├── web/              # Frontend Next.js
│   ├── mobile/           # App React Native (Expo)
│   └── radar-processor/  # Processador de dados de radar (Python)
├── packages/
│   ├── types/            # Tipos TypeScript compartilhados
│   ├── utils/            # Utilitários compartilhados
│   └── config/           # Configurações (ESLint, Prettier, TSConfig)
├── infrastructure/
│   └── docker/           # Configurações Docker e Kubernetes
└── docs/                 # Documentação
```

## Tecnologias

### Backend (API)
- **Fastify** - Framework web de alta performance
- **Prisma** - ORM para PostgreSQL
- **Redis** - Cache e pub/sub para eventos em tempo real
- **BullMQ** - Filas de processamento em background
- **Socket.IO** - WebSocket para atualizações em tempo real

### Frontend (Web)
- **Next.js 14** - Framework React com App Router
- **TailwindCSS** - Estilização
- **Recharts** - Gráficos e visualizações
- **MapLibre GL** - Mapas interativos
- **React Query** - Gerenciamento de estado do servidor

### Mobile
- **React Native** - Framework mobile cross-platform
- **Expo** - Plataforma de desenvolvimento
- **React Navigation** - Navegação
- **react-native-maps** - Mapas nativos

### Processador de Radar
- **Python 3.11+** - Processamento de dados
- **NumPy/SciPy** - Computação científica
- **Wradlib** - Processamento de dados de radar

## Requisitos

- Node.js 20+
- pnpm 8+
- PostgreSQL 15+ com PostGIS
- Redis 7+
- Python 3.11+ (para radar-processor)

## Instalação

1. Clone o repositório:
```bash
git clone https://github.com/defesacivil/radar-defesa-civil.git
cd radar-defesa-civil
```

2. Instale as dependências:
```bash
pnpm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. Configure o banco de dados:
```bash
cd apps/api
pnpm db:migrate
pnpm db:seed
```

5. Inicie o ambiente de desenvolvimento:
```bash
# Na raiz do projeto
pnpm dev
```

## Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `pnpm dev` | Inicia todos os apps em modo desenvolvimento |
| `pnpm build` | Compila todos os apps |
| `pnpm test` | Executa todos os testes |
| `pnpm lint` | Executa linting em todos os apps |
| `pnpm typecheck` | Verifica tipos TypeScript |

## Estrutura de Branches

- `main` - Produção
- `staging` - Homologação
- `develop` - Desenvolvimento
- `feature/*` - Novas funcionalidades
- `bugfix/*` - Correções de bugs

## Variáveis de Ambiente

Veja `.env.example` para a lista completa de variáveis necessárias.

### Principais

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | URL de conexão PostgreSQL |
| `REDIS_URL` | URL de conexão Redis |
| `JWT_SECRET` | Chave secreta para tokens JWT |
| `API_PORT` | Porta da API (padrão: 3001) |

## Documentação

- [Documentação da API](./docs/api.md)
- [Guia de Contribuição](./docs/contributing.md)
- [Arquitetura do Sistema](./docs/architecture.md)

## Funcionalidades Principais

### Sistema de Alertas
- Regras configuráveis por severidade
- Notificações multi-canal (Email, SMS, WhatsApp, Push)
- Escalação automática
- Histórico e auditoria

### Monitoramento de Radar
- Visualização em tempo real
- Produtos: MAX-Z, CMAX, PPI, RHI
- Nowcasting (previsão de curto prazo)
- Tracking de células

### Dashboard
- Mapa interativo com camadas
- Gráficos de tendência
- Estatísticas por município
- Relatórios exportáveis (PDF/CSV)

### Gestão de Usuários
- Autenticação JWT
- Roles: Admin, Manager, Operator, Viewer
- Preferências de notificação
- Auditoria de ações

## Licença

Propriedade da Defesa Civil do Brasil. Todos os direitos reservados.

## Contato

- Email: suporte@defesacivil.gov.br
- Documentação: https://docs.radar.defesacivil.gov.br
