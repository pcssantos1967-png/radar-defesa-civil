# @radar/web

Frontend Web do Sistema Radar Defesa Civil.

## Tecnologias

- **Next.js 14** - Framework React com App Router
- **TailwindCSS** - Estilização utilitária
- **Recharts** - Gráficos e visualizações
- **MapLibre GL** - Mapas interativos
- **React Query** - Gerenciamento de estado
- **Socket.IO Client** - WebSocket

## Estrutura

```
src/
├── app/                    # App Router (páginas)
│   ├── (auth)/             # Páginas de autenticação
│   │   └── login/
│   └── (dashboard)/        # Páginas do dashboard
│       ├── dashboard/      # Página inicial
│       ├── alertas/        # Gestão de alertas
│       ├── estatisticas/   # Dashboard de estatísticas
│       ├── relatorios/     # Geração de relatórios
│       ├── configuracoes/  # Configurações e usuários
│       └── perfil/         # Perfil do usuário
├── components/
│   ├── charts/             # Componentes de gráficos
│   ├── layout/             # Header, Sidebar, etc.
│   ├── map/                # Componentes de mapa
│   ├── ui/                 # Componentes UI base
│   ├── users/              # Componentes de usuários
│   └── widgets/            # Widgets do dashboard
├── contexts/               # Contextos React
├── hooks/                  # Hooks customizados
├── services/               # Serviços (API client)
├── types/                  # Tipos TypeScript
└── test/                   # Configuração de testes
```

## Scripts

```bash
# Desenvolvimento
pnpm dev

# Build
pnpm build

# Produção
pnpm start

# Testes
pnpm test
pnpm test:ui       # Interface visual
pnpm test:coverage # Com cobertura

# Qualidade
pnpm lint
pnpm typecheck
```

## Variáveis de Ambiente

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token
```

## Páginas

| Rota | Descrição |
|------|-----------|
| `/login` | Página de login |
| `/dashboard` | Dashboard principal com mapa |
| `/alertas` | Lista e gestão de alertas |
| `/estatisticas` | Dashboard de estatísticas |
| `/relatorios` | Geração de relatórios |
| `/configuracoes` | Configurações da conta |
| `/configuracoes/usuarios` | Gestão de usuários (admin) |
| `/perfil` | Perfil do usuário |

## Componentes Principais

### Layout
- `Header` - Cabeçalho com navegação
- `Sidebar` - Menu lateral
- `AlertBanner` - Banner de alertas críticos

### Charts
- `AlertTrendChart` - Tendência de alertas
- `SeverityDistributionChart` - Distribuição por severidade
- `PrecipitationHistoryChart` - Histórico de precipitação
- `MunicipalityComparisonChart` - Comparação entre municípios

### Map
- `MapContainer` - Container do mapa
- `RadarLayer` - Camada de radar
- `AlertOverlay` - Marcadores de alertas

### UI
- `Button`, `Input`, `Card`, `Modal`
- `SeverityBadge` - Badge de severidade

## Temas

O sistema usa tema escuro por padrão com as seguintes cores:

```css
/* Background */
--background: #0F172A
--background-secondary: #1E293B
--background-elevated: #334155

/* Text */
--text: #F8FAFC
--text-secondary: #94A3B8

/* Accent */
--accent: #00E5FF

/* Severity */
--severity-observation: #4CAF50
--severity-attention: #FFD600
--severity-alert: #FF9800
--severity-max-alert: #FF1744
```

## Testes

```bash
# Executar testes
pnpm test

# Modo watch
pnpm test -- --watch

# Interface visual
pnpm test:ui

# Cobertura
pnpm test:coverage
```
