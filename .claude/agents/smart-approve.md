---
name: smart-approve
description: "Use this agent when developing or modifying the Smart Approve application - a desktop platform for Brazilian public exam preparation (concursos publicos). This includes working on the Electron + React + TypeScript codebase, managing SQLite database with Drizzle ORM, implementing question banks from different bancas (CEBRASPE, FGV, VUNESP, CESGRANRIO, AOCP), adding new subjects (materias), creating simulados, implementing authentication/licensing features, or integrating Claude API for AI-generated questions.

<example>
Context: User wants to add questions for a new subject.
user: \"Adicione questoes de Direito Tributario ao banco de questoes\"
assistant: \"I'll use the smart-approve agent to add tax law questions following the existing question structure and patterns.\"
<commentary>
Since the user wants to add questions to Smart Approve, use the smart-approve agent which understands the Question interface and data structure.
</commentary>
</example>

<example>
Context: User needs to implement a new feature in the study platform.
user: \"Implemente um sistema de flashcards no Smart Approve\"
assistant: \"I'll use the smart-approve agent to design and implement the flashcard system following the existing React + TypeScript patterns.\"
<commentary>
Since this is a feature request for Smart Approve, use the smart-approve agent which knows the codebase architecture.
</commentary>
</example>

<example>
Context: User wants to add questions from a new banca.
user: \"Adicione questoes da banca IBFC ao sistema\"
assistant: \"I'll use the smart-approve agent to add IBFC questions following the existing bancas pattern.\"
<commentary>
Since the user is adding a new banca to Smart Approve, use the smart-approve agent which understands the question bank structure.
</commentary>
</example>

<example>
Context: User is debugging the Electron app.
user: \"O app esta travando ao carregar as questoes\"
assistant: \"I'll use the smart-approve agent to diagnose and fix the question loading issue in the Electron environment.\"
<commentary>
Since this is a debugging task for Smart Approve, use the smart-approve agent which knows the Electron + React architecture.
</commentary>
</example>"
model: sonnet
color: emerald
---

# SMART APPROVE - Agente de Desenvolvimento

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║    ███████╗███╗   ███╗ █████╗ ██████╗ ████████╗     █████╗ ██████╗ ██████╗   ║
║    ██╔════╝████╗ ████║██╔══██╗██╔══██╗╚══██╔══╝    ██╔══██╗██╔══██╗██╔══██╗  ║
║    ███████╗██╔████╔██║███████║██████╔╝   ██║       ███████║██████╔╝██████╔╝  ║
║    ╚════██║██║╚██╔╝██║██╔══██║██╔══██╗   ██║       ██╔══██║██╔═══╝ ██╔═══╝   ║
║    ███████║██║ ╚═╝ ██║██║  ██║██║  ██║   ██║       ██║  ██║██║     ██║       ║
║    ╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝       ╚═╝  ╚═╝╚═╝     ╚═╝       ║
║                                                                              ║
║              Plataforma de Preparacao para Concursos Publicos                ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## VISAO GERAL DO PROJETO

**Smart Approve** e uma plataforma desktop para preparacao de concursos publicos brasileiros, construida com tecnologias modernas e focada em uma experiencia de estudo eficiente.

### Stack Tecnologico

| Camada | Tecnologia | Proposito |
|--------|-----------|-----------|
| **Desktop** | Electron | Aplicacao desktop multiplataforma |
| **Frontend** | React + TypeScript | Interface de usuario reativa |
| **Estilizacao** | Tailwind CSS + Framer Motion | Design responsivo e animacoes |
| **Banco de Dados** | SQLite + Drizzle ORM | Persistencia local de dados |
| **IA** | Claude API | Geracao inteligente de questoes |

---

## ESTRUTURA DO PROJETO

```
smart-approve/
├── src/
│   ├── main.tsx              # Entry point React
│   ├── App.tsx               # Roteamento principal
│   ├── components/           # Componentes reutilizaveis
│   │   ├── Layout.tsx        # Layout principal
│   │   ├── Sidebar.tsx       # Menu lateral
│   │   ├── Topbar.tsx        # Barra superior
│   │   ├── TrialBanner.tsx   # Banner de trial
│   │   ├── OnboardingModal.tsx
│   │   └── ui/               # Componentes UI base
│   ├── pages/                # Paginas da aplicacao
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── QuestionsPage.tsx
│   │   ├── LeiSecaPage.tsx
│   │   ├── JurisprudenciaPage.tsx
│   │   ├── SimuladoPage.tsx
│   │   ├── StatsPage.tsx
│   │   ├── PlansPage.tsx
│   │   └── SettingsPage.tsx
│   ├── stores/               # Estado global (Zustand)
│   │   ├── authStore.ts
│   │   ├── uiStore.ts
│   │   └── questionStore.ts
│   ├── data/                 # Dados de questoes
│   │   └── questions/
│   │       ├── index.ts
│   │       ├── direito-constitucional.ts
│   │       ├── direito-administrativo.ts
│   │       ├── direito-civil.ts
│   │       ├── direito-penal.ts
│   │       ├── lingua-portuguesa.ts
│   │       ├── raciocinio-logico.ts
│   │       ├── informatica.ts
│   │       ├── legislacao-especial.ts
│   │       └── bancas/
│   │           ├── index.ts
│   │           ├── cebraspe.ts
│   │           ├── fgv.ts
│   │           ├── cesgranrio.ts
│   │           ├── vunesp.ts
│   │           └── aocp.ts
│   └── types/                # Tipos TypeScript
│       ├── index.ts
│       └── global.d.ts
├── public/
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## TIPOS PRINCIPAIS

### Question (Interface de Questao)

```typescript
interface Question {
  id: string
  banca: string                    // CEBRASPE, FGV, VUNESP, etc.
  origin_exam?: string             // Prova de origem
  year?: number                    // Ano da questao
  subject: string                  // Materia (Direito Constitucional, etc.)
  subtopic?: string                // Subtopico
  level: 'facil' | 'medio' | 'dificil'
  statement: string                // Enunciado
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  option_e: string
  answer: 'A' | 'B' | 'C' | 'D' | 'E'
  justification_correct?: string   // Justificativa da resposta correta
  justification_a?: string         // Justificativa alternativa A
  justification_b?: string
  justification_c?: string
  justification_d?: string
  justification_e?: string
  law_reference?: string           // Referencia legal
  jurisprudence?: string           // Jurisprudencia relacionada
  tags?: string[]
  type?: 'lei_seca' | 'jurisprudencia' | 'doutrina' | 'caso_pratico'
  is_ai_generated?: boolean
  ai_rating?: number
  created_at?: string
}
```

### User (Interface de Usuario)

```typescript
interface User {
  id: string
  name: string
  email: string
  plan: 'free' | 'basic' | 'approval' | 'elite'
  trial_start: string
  trial_end: string
  target_exam?: string
  study_level: 'iniciante' | 'intermediario' | 'avancado'
  streak_days: number
  last_study_date?: string
  created_at: string
}
```

---

## MATERIAS SUPORTADAS

```typescript
const MATERIAS = [
  'Direito Constitucional',
  'Direito Administrativo',
  'Direito Civil',
  'Direito Penal',
  'Direito Processual Civil',
  'Direito Processual Penal',
  'Direito do Trabalho',
  'Direito Tributario',
  'Direito Eleitoral',
  'Legislacao Especial',
  'Lingua Portuguesa',
  'Raciocinio Logico',
  'Informatica',
  'Administracao Publica',
  'Atualidades',
  'Etica no Servico Publico',
  'Contabilidade Publica',
]
```

---

## BANCAS EXAMINADORAS

```typescript
const BANCAS = [
  'CESPE/CEBRASPE',
  'CEBRASPE',
  'FCC',
  'VUNESP',
  'FGV',
  'CESGRANRIO',
  'QUADRIX',
  'IBFC',
  'AOCP',
  'IADES',
  'IDECAN',
  'Propria',
]
```

---

## CONCURSOS SUPORTADOS

| Categoria | Sigla | Nome |
|-----------|-------|------|
| **Poder Judiciario** | TJ | Tribunal de Justica |
| | TRF | Tribunal Regional Federal |
| | STJ | Superior Tribunal de Justica |
| | STF | Supremo Tribunal Federal |
| | TST | Tribunal Superior do Trabalho |
| | TRT | Tribunal Regional do Trabalho |
| | TRE | Tribunal Regional Eleitoral |
| **Ministerio Publico** | MPE | Ministerio Publico Estadual |
| | MPF | Ministerio Publico Federal |
| | DPE | Defensoria Publica Estadual |
| | DPU | Defensoria Publica da Uniao |
| **Seguranca Publica** | PF | Policia Federal |
| | PRF | Policia Rodoviaria Federal |
| | PC | Policia Civil |
| | PM | Policia Militar |
| | CBM | Corpo de Bombeiros Militar |
| **Executivo/Legislativo** | INSS | Instituto Nacional do Seguro Social |
| | RF | Receita Federal |
| | TCU | Tribunal de Contas da Uniao |
| | TCE | Tribunal de Contas Estadual |
| | CD | Camara dos Deputados |
| | SF | Senado Federal |

---

## FUNCIONALIDADES PRINCIPAIS

### 1. Modulos de Estudo

| Modulo | Descricao | Rota |
|--------|-----------|------|
| **Dashboard** | Visao geral do progresso | `/` |
| **Questoes** | Pratica de questoes por materia/banca | `/questions` |
| **Lei Seca** | Questoes de texto de lei | `/lei-seca` |
| **Jurisprudencia** | Questoes baseadas em decisoes | `/jurisprudencia` |
| **Simulado** | Provas simuladas completas | `/simulado` |
| **Estatisticas** | Analise de desempenho | `/stats` |

### 2. Sistema de Licenciamento

- **Trial**: Periodo gratuito de teste
- **Planos**: free, basic, approval, elite
- Verificacao automatica de licenca
- Banner de trial com dias restantes

### 3. Gamificacao

- Sistema de streak (dias consecutivos)
- Conquistas (achievements)
- Estatisticas por materia e banca
- Grafico de atividade

---

## PADRAO DE QUESTOES

### Estrutura de Arquivo de Questoes

```typescript
// src/data/questions/direito-constitucional.ts

import type { Question } from '../../types'

export const questoesDireitoConstitucional: Question[] = [
  {
    id: 'dc-001',
    banca: 'CEBRASPE',
    origin_exam: 'TRF5 2023',
    year: 2023,
    subject: 'Direito Constitucional',
    subtopic: 'Principios Fundamentais',
    level: 'medio',
    statement: 'Considerando os principios fundamentais da Constituicao Federal...',
    option_a: '...',
    option_b: '...',
    option_c: '...',
    option_d: '...',
    option_e: '...',
    answer: 'C',
    justification_correct: 'A alternativa C esta correta porque...',
    law_reference: 'Art. 1o, CF/88',
    type: 'lei_seca',
    tags: ['principios', 'fundamentos', 'republica']
  },
  // ... mais questoes
]
```

### Estrutura de Arquivo de Banca

```typescript
// src/data/questions/bancas/cebraspe.ts

import type { Question } from '../../../types'

export const questoesCebraspe: Question[] = [
  // Questoes especificas da banca CEBRASPE
  // Seguem estilo CERTO/ERRADO caracteristico
]
```

---

## COMANDOS DE DESENVOLVIMENTO

```bash
# Instalacao
npm install

# Desenvolvimento web
npm run dev

# Desenvolvimento Electron
npm run electron:dev

# Build de producao
npm run build

# Popular banco com questoes
npm run db:seed

# Testes
npm run test
```

---

## DIRETRIZES DE DESENVOLVIMENTO

### Adicionar Novas Questoes

1. Criar arquivo em `src/data/questions/[materia].ts`
2. Seguir interface `Question`
3. Incluir `id` unico com prefixo da materia
4. Exportar no `src/data/questions/index.ts`

### Adicionar Nova Banca

1. Criar arquivo em `src/data/questions/bancas/[banca].ts`
2. Seguir padrao especifico da banca
3. Exportar no `src/data/questions/bancas/index.ts`
4. Adicionar ao array `BANCAS` em `src/types/index.ts`

### Adicionar Nova Materia

1. Criar arquivo em `src/data/questions/[materia].ts`
2. Adicionar ao array `MATERIAS` em `src/types/index.ts`
3. Exportar no `src/data/questions/index.ts`

### Adicionar Nova Pagina

1. Criar componente em `src/pages/[Nome]Page.tsx`
2. Adicionar rota em `src/App.tsx`
3. Adicionar item no `Sidebar.tsx` se necessario

---

## INTEGRACAO COM CLAUDE API

O Smart Approve utiliza a Claude API para:

- Geracao de questoes personalizadas
- Criacao de justificativas detalhadas
- Analise de desempenho com sugestoes
- Recomendacoes de estudo inteligentes

### Uso Tipico

```typescript
// Gerar questao via Claude API
const generateQuestion = async (subject: string, level: string) => {
  // Chamar API Claude com prompt especifico
  // Retornar questao no formato Question
}
```

---

## LOCALIZACAO DO PROJETO

```
C:\Users\USER\Desktop\smart-approve\
```

---

*Smart Approve - Sua aprovacao comeca aqui*
