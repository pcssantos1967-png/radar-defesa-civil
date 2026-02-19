# @radar/mobile

Aplicativo Mobile do Sistema Radar Defesa Civil.

## Tecnologias

- **React Native** - Framework mobile
- **Expo** - Plataforma de desenvolvimento
- **Expo Router** - Navegação baseada em arquivos
- **react-native-maps** - Mapas nativos

## Estrutura

```
├── app/                    # Expo Router (telas)
│   ├── (auth)/             # Telas de autenticação
│   │   └── login.tsx
│   └── (tabs)/             # Telas do app (tab navigation)
│       ├── index.tsx       # Home/Dashboard
│       ├── alerts.tsx      # Lista de alertas
│       ├── map.tsx         # Mapa
│       └── settings.tsx    # Configurações
├── src/
│   ├── components/
│   │   └── ui/             # Componentes UI
│   ├── contexts/           # Contextos React
│   ├── services/           # API client
│   ├── theme/              # Cores e espaçamentos
│   └── types/              # Tipos TypeScript
└── assets/                 # Imagens e ícones
```

## Requisitos

- Node.js 18+
- Expo CLI
- iOS Simulator (macOS) ou Android Studio

## Instalação

```bash
# Instalar dependências
pnpm install

# Iniciar Expo
pnpm start

# Executar no iOS
pnpm ios

# Executar no Android
pnpm android
```

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz:

```env
EXPO_PUBLIC_API_URL=http://localhost:3001/api/v1
```

## Telas

### Autenticação
- **Login** - Tela de entrada com email/senha

### Tabs
- **Home** - Dashboard com resumo de alertas e ações rápidas
- **Alertas** - Lista filtráável de alertas ativos
- **Mapa** - Mapa com marcadores de alertas e radares
- **Ajustes** - Perfil e preferências de notificação

## Funcionalidades

### Autenticação
- Login com email/senha
- Token armazenado com SecureStore
- Auto-login e refresh de token

### Alertas
- Lista de alertas ativos
- Filtro por severidade
- Detalhes em modal
- Pull-to-refresh

### Mapa
- Visualização de alertas no mapa
- Marcadores de estações de radar
- Localização do usuário
- Tema escuro

### Notificações
- Push notifications configuráveis
- Filtro por severidade
- Preferências por canal

## Build

```bash
# Build de desenvolvimento
eas build --platform all --profile development

# Build de produção
eas build --platform all --profile production
```

## Configuração de Push Notifications

1. Configure o projeto no Expo Dashboard
2. Adicione as credenciais no `app.json`
3. Configure o APNs (iOS) e FCM (Android)

## Tema

O app usa tema escuro consistente com a versão web:

```typescript
colors = {
  background: '#0F172A',
  backgroundSecondary: '#1E293B',
  accent: '#00E5FF',
  severity: {
    observation: '#4CAF50',
    attention: '#FFD600',
    alert: '#FF9800',
    maxAlert: '#FF1744',
  }
}
```
