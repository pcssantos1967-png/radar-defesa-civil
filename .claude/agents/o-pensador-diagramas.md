# O PENSADOR - Biblioteca de Diagramas
## Templates Mermaid para Processos de Decisao

Este arquivo contem templates de diagramas que complementam o agente O Pensador v5.0.
Quando o usuario solicitar diagramas sobre processos de decisao, utilize estes templates como base.

---

## 1. DIAGRAMA PRINCIPAL - Processo de Decisao Completo (7 Fases)

```mermaid
flowchart TB
    START([INICIO:<br/>Situacao Requer Decisao]) --> IDENTIFY

    subgraph FASE1["FASE 1: IDENTIFICACAO E ENQUADRAMENTO"]
        IDENTIFY["Identificar o Problema<br/>Qual e a real questao?<br/>Sintoma vs. Causa Raiz"]
        DEFINE["Definir Escopo<br/>Limites do problema<br/>Stakeholders envolvidos"]
        URGENCY{"E urgente<br/>E importante?"}

        IDENTIFY --> DEFINE
        DEFINE --> URGENCY
    end

    URGENCY -->|"Sim:<br/>Matriz Eisenhower<br/>Quadrante 1"| FAST_TRACK["Fast Track:<br/>Decisao Imediata<br/>com dados disponiveis"]
    URGENCY -->|"Nao:<br/>Tempo para<br/>analise profunda"| GATHER

    subgraph FASE2["FASE 2: COLETA DE INFORMACOES"]
        GATHER["Coletar Dados<br/>Fatos objetivos<br/>Opinioes qualificadas<br/>Precedentes historicos"]
        SOURCES{"Fontes sao<br/>confiaveis e<br/>suficientes?"}
        MORE_DATA["Buscar Mais Dados<br/>Pesquisa adicional<br/>Consulta a especialistas<br/>Dados empiricos"]

        GATHER --> SOURCES
        SOURCES -->|"Nao"| MORE_DATA
        MORE_DATA --> SOURCES
        SOURCES -->|"Sim"| ANALYZE
    end

    subgraph FASE3["FASE 3: ANALISE E GERACAO DE ALTERNATIVAS"]
        ANALYZE["Analisar Informacoes<br/>Padroes e tendencias<br/>Relacoes causais<br/>Lacunas de conhecimento"]
        GENERATE["Gerar Alternativas<br/>Brainstorming<br/>Pensamento lateral<br/>Minimo 3 opcoes viaveis"]
        CREATIVE{"Alternativas<br/>incluem opcoes<br/>criativas?"}
        EXPAND["Expandir Espaco de Solucoes<br/>Questionar pressupostos<br/>Combinar alternativas<br/>Pensar fora da caixa"]

        ANALYZE --> GENERATE
        GENERATE --> CREATIVE
        CREATIVE -->|"Nao"| EXPAND
        EXPAND --> GENERATE
        CREATIVE -->|"Sim"| CRITERIA
    end

    subgraph FASE4["FASE 4: AVALIACAO DE CRITERIOS"]
        CRITERIA["Definir Criterios<br/>Eficacia (atinge objetivo?)<br/>Viabilidade (recursos)<br/>Etica (valores)<br/>Risco (consequencias)"]
        WEIGHT["Ponderar Criterios<br/>Importancia relativa<br/>Trade-offs explicitos"]
        SCORE["Pontuar Alternativas<br/>Matriz de decisao<br/>Scoring sistematico"]
        MULTI["Analise Multi-Criterio<br/>RICE Score<br/>Arvore de decisao<br/>Cenarios prospectivos"]

        CRITERIA --> WEIGHT
        WEIGHT --> SCORE
        SCORE --> MULTI
        MULTI --> BEST
    end

    subgraph FASE5["FASE 5: ESCOLHA E VALIDACAO"]
        BEST{"Alternativa<br/>claramente<br/>superior?"}
        CLOSE["Empate Tecnico<br/>Usar intuicao informada<br/>Phronesis (sabedoria pratica)<br/>Valores pessoais/organizacionais"]
        DECIDE["DECISAO TOMADA"]
        REVERSIBLE{"Decisao e<br/>reversivel?"}
        SAFE["Implementar com<br/>Acompanhamento"]
        VERIFY["Validacao Adicional<br/>Teste piloto<br/>Simulacao<br/>Consulta final"]

        BEST -->|"Sim"| DECIDE
        BEST -->|"Nao"| CLOSE
        CLOSE --> DECIDE
        DECIDE --> REVERSIBLE
        REVERSIBLE -->|"Sim:<br/>Baixo risco"| SAFE
        REVERSIBLE -->|"Nao:<br/>Alto impacto"| VERIFY
        VERIFY --> PLAN
        SAFE --> PLAN
    end

    subgraph FASE6["FASE 6: PLANEJAMENTO E IMPLEMENTACAO"]
        PLAN["Planejar Implementacao<br/>Acoes especificas<br/>Responsaveis<br/>Timeline<br/>Recursos necessarios"]
        EXECUTE["Executar Plano<br/>Comunicar decisao<br/>Mobilizar recursos<br/>Iniciar acoes"]
        MONITOR["Monitorar Execucao<br/>KPIs definidos<br/>Checkpoints regulares<br/>Ajustes taticos"]

        PLAN --> EXECUTE
        EXECUTE --> MONITOR
    end

    subgraph FASE7["FASE 7: FEEDBACK E APRENDIZAGEM"]
        RESULTS["Avaliar Resultados<br/>Objetivos alcancados?<br/>Efeitos colaterais?<br/>Licoes aprendidas"]
        SUCCESS{"Decisao<br/>foi bem-sucedida?"}
        LEARN["Documentar Aprendizado<br/>O que funcionou<br/>O que nao funcionou<br/>Como melhorar"]
        ADJUST["Ajustar ou Reverter<br/>Corrigir curso<br/>Implementar Plano B<br/>Voltar a Fase 3"]
        KNOWLEDGE["Atualizar Base<br/>de Conhecimento<br/>PKM System<br/>Proximas decisoes"]

        MONITOR --> RESULTS
        RESULTS --> SUCCESS
        SUCCESS -->|"Sim"| LEARN
        SUCCESS -->|"Parcial ou Nao"| ADJUST
        ADJUST --> GENERATE
        LEARN --> KNOWLEDGE
    end

    FAST_TRACK --> EXECUTE
    KNOWLEDGE --> END([FIM:<br/>Ciclo de Melhoria Continua])

    classDef phaseStyle fill:#E3F2FD,stroke:#1976D2,stroke-width:3px,color:#000
    classDef processStyle fill:#C8E6C9,stroke:#388E3C,stroke-width:2px,color:#000
    classDef decisionStyle fill:#FFF9C4,stroke:#F57C00,stroke-width:2px,color:#000
    classDef criticalStyle fill:#FFCCBC,stroke:#D84315,stroke-width:2px,color:#000
    classDef successStyle fill:#B2DFDB,stroke:#00796B,stroke-width:2px,color:#000
    classDef startEndStyle fill:#E1BEE7,stroke:#7B1FA2,stroke-width:3px,color:#000

    class IDENTIFY,DEFINE,GATHER,ANALYZE,GENERATE,CRITERIA,WEIGHT,SCORE,MULTI,PLAN,EXECUTE,MONITOR,RESULTS,LEARN processStyle
    class URGENCY,SOURCES,CREATIVE,BEST,REVERSIBLE,SUCCESS decisionStyle
    class FAST_TRACK,VERIFY,ADJUST criticalStyle
    class DECIDE,SAFE,KNOWLEDGE successStyle
    class START,END startEndStyle
```

---

## 2. VERSAO SIMPLIFICADA (Para Apresentacoes)

```mermaid
flowchart LR
    A([INICIO]) --> B[Identificar<br/>Problema]
    B --> C[Coletar<br/>Informacoes]
    C --> D[Gerar<br/>Alternativas]
    D --> E[Avaliar<br/>Criterios]
    E --> F[Decidir]
    F --> G[Implementar]
    G --> H[Monitorar]
    H --> I{Sucesso?}
    I -->|Sim| J[Aprender]
    I -->|Nao| K[Ajustar]
    K --> D
    J --> L([FIM])

    style A fill:#E1BEE7,stroke:#7B1FA2,stroke-width:2px
    style F fill:#FFCCBC,stroke:#D84315,stroke-width:2px
    style I fill:#FFF9C4,stroke:#F57C00,stroke-width:2px
    style J fill:#B2DFDB,stroke:#00796B,stroke-width:2px
    style L fill:#E1BEE7,stroke:#7B1FA2,stroke-width:2px
```

---

## 3. DIAGRAMA COM SWIMLANES (Responsabilidades)

```mermaid
flowchart TB
    subgraph INDIVIDUAL["NIVEL INDIVIDUAL"]
        I1[Identificar Problema]
        I2[Coletar Dados Iniciais]
        I3[Gerar Ideias]
    end

    subgraph EQUIPE["NIVEL EQUIPE"]
        T1[Brainstorming Coletivo]
        T2[Analise Colaborativa]
        T3[Consenso ou Votacao]
    end

    subgraph LIDERANCA["NIVEL LIDERANCA"]
        L1[Aprovacao Final]
        L2[Alocacao de Recursos]
        L3[Revisao Estrategica]
    end

    I1 --> I2 --> I3
    I3 --> T1
    T1 --> T2 --> T3
    T3 --> L1 --> L2
    L2 --> L3

    style INDIVIDUAL fill:#E3F2FD
    style EQUIPE fill:#C8E6C9
    style LIDERANCA fill:#FFF9C4
```

---

## 4. DECISAO ETICA (Filosofia Aplicada)

```mermaid
flowchart TB
    START([Dilema Etico]) --> FACTS

    FACTS["Levantar Fatos<br/>Quem esta envolvido?<br/>Quais consequencias?"] --> STAKEHOLDERS

    STAKEHOLDERS["Identificar Stakeholders<br/>Direitos afetados<br/>Interesses legitimos"] --> THEORIES

    subgraph ANALISE["ANALISE MULTI-TEORICA"]
        KANT["Deontologia Kant<br/>Qual e meu dever?<br/>E universalizavel?"]
        UTIL["Utilitarismo<br/>Maximiza bem-estar geral?<br/>Maior bem p/ maior numero"]
        VIRTUE["Etica das Virtudes<br/>O que pessoa virtuosa faria?<br/>Cultiva excelencia?"]
        CARE["Etica do Cuidado<br/>Preserva relacoes?<br/>Atende vulneraveis?"]
    end

    THEORIES[Aplicar Teorias Eticas] --> KANT
    THEORIES --> UTIL
    THEORIES --> VIRTUE
    THEORIES --> CARE

    KANT --> INTEGRATE
    UTIL --> INTEGRATE
    VIRTUE --> INTEGRATE
    CARE --> INTEGRATE

    INTEGRATE["Integrar Perspectivas<br/>Pontos de convergencia<br/>Tensoes irreconciliaveis"] --> JUSTIFY

    JUSTIFY["Justificar Decisao<br/>Razoes publicas<br/>Transparencia<br/>Prestacao de contas"] --> ACT

    ACT["Agir com Integridade"] --> REFLECT["Refletir sobre Consequencias"]

    REFLECT --> END([Sabedoria Pratica<br/>Phronesis])

    style START fill:#E1BEE7,stroke:#7B1FA2,stroke-width:2px
    style KANT fill:#BBDEFB
    style UTIL fill:#C8E6C9
    style VIRTUE fill:#FFE0B2
    style CARE fill:#F8BBD9
    style END fill:#B2DFDB,stroke:#00796B,stroke-width:3px
```

---

## 5. MIND MAP - Processo de Decisao

```mermaid
mindmap
  root((PROCESSO DE<br/>DECISAO))
    FASE 1 - IDENTIFICAR
      Definir problema
      Escopo e limites
      Stakeholders
      Urgencia vs Importancia
    FASE 2 - COLETAR
      Dados objetivos
      Opinioes qualificadas
      Precedentes
      Validar fontes
    FASE 3 - ANALISAR
      Padroes e tendencias
      Relacoes causais
      Gerar alternativas
      Pensamento criativo
    FASE 4 - AVALIAR
      Definir criterios
      Ponderar importancia
      Matriz de decisao
      RICE Score
    FASE 5 - DECIDIR
      Escolher melhor opcao
      Validar se necessario
      Phronesis
      Compromisso
    FASE 6 - IMPLEMENTAR
      Plano de acao
      Responsaveis
      Timeline
      Recursos
    FASE 7 - APRENDER
      Monitorar resultados
      Avaliar sucesso
      Documentar licoes
      Ciclo continuo
```

---

## 6. QUADRANT CHART - Matriz Eisenhower

```mermaid
quadrantChart
    title Matriz de Decisao Eisenhower
    x-axis Baixa Urgencia --> Alta Urgencia
    y-axis Baixa Importancia --> Alta Importancia
    quadrant-1 FAZER AGORA
    quadrant-2 AGENDAR
    quadrant-3 DELEGAR
    quadrant-4 ELIMINAR
    Crise: [0.85, 0.9]
    Deadline Projeto: [0.75, 0.85]
    Planejamento: [0.25, 0.8]
    Desenvolvimento: [0.35, 0.75]
    Interrupcoes: [0.8, 0.3]
    Reunioes desnecessarias: [0.7, 0.25]
    Redes sociais: [0.3, 0.2]
    Emails triviais: [0.4, 0.15]
```

---

## FRAMEWORK TEORICO

Este conjunto de diagramas integra:

| Origem | Conceito Aplicado |
|--------|------------------|
| Herbert Simon | Racionalidade limitada, satisficing |
| Daniel Kahneman | Sistema 1 (intuitivo) e Sistema 2 (analitico) |
| Aristoteles | Phronesis (sabedoria pratica) |
| Matriz Eisenhower | Urgencia vs. Importancia |
| RICE Framework | Priorizacao sistematica |
| Chess.h.AI | Pensamento N-jogadas a frente |
| Ciclo PDCA | Plan-Do-Check-Act (Deming) |
| Etica Aplicada | Multi-perspectiva normativa |

---

## COMO USAR ESTES DIAGRAMAS

1. **Copie o codigo Mermaid** e cole em:
   - Obsidian (com plugin Mermaid)
   - GitHub/GitLab (suporte nativo)
   - Notion (via embed)
   - VS Code (com extensao Mermaid)
   - https://mermaid.live/ (editor online)

2. **Personalize conforme necessario:**
   - Adicione/remova etapas
   - Ajuste cores e estilos
   - Adapte ao seu contexto especifico

3. **Export para apresentacoes:**
   - Via Mermaid.live: SVG, PNG, PDF
   - Via Kroki API: multiplos formatos

---

## 7. ARQUITETURA DE SOFTWARE - Visao Geral do Sistema

```mermaid
flowchart TB
    subgraph CLIENTS["CAMADA DE CLIENTES"]
        WEB["Web App<br/>React/Vue/Angular"]
        MOBILE["Mobile App<br/>iOS/Android"]
        DESKTOP["Desktop App<br/>Electron"]
        CLI["CLI Tool"]
    end

    subgraph GATEWAY["CAMADA DE ENTRADA"]
        LB["Load Balancer<br/>nginx/HAProxy"]
        CDN["CDN<br/>CloudFlare/Fastly"]
        WAF["WAF<br/>Web Application Firewall"]
        API_GW["API Gateway<br/>Kong/AWS API GW"]
    end

    subgraph SERVICES["CAMADA DE SERVICOS"]
        AUTH["Auth Service<br/>JWT/OAuth2"]
        USER["User Service"]
        BUSINESS["Business Logic<br/>Core Domain"]
        NOTIFY["Notification Service<br/>Email/SMS/Push"]
        SEARCH["Search Service<br/>Elasticsearch"]
    end

    subgraph DATA["CAMADA DE DADOS"]
        DB_PRIMARY["Database Primary<br/>PostgreSQL/MySQL"]
        DB_REPLICA["Database Replica<br/>Read Replicas"]
        CACHE["Cache Layer<br/>Redis/Memcached"]
        QUEUE["Message Queue<br/>RabbitMQ/Kafka"]
        STORAGE["Object Storage<br/>S3/MinIO"]
    end

    subgraph INFRA["INFRAESTRUTURA"]
        MONITOR["Monitoring<br/>Prometheus/Grafana"]
        LOG["Logging<br/>ELK Stack"]
        TRACE["Tracing<br/>Jaeger/Zipkin"]
        CI_CD["CI/CD<br/>GitHub Actions"]
    end

    WEB --> CDN
    MOBILE --> LB
    DESKTOP --> LB
    CLI --> API_GW

    CDN --> WAF
    LB --> WAF
    WAF --> API_GW

    API_GW --> AUTH
    API_GW --> USER
    API_GW --> BUSINESS
    API_GW --> SEARCH

    AUTH --> CACHE
    USER --> DB_PRIMARY
    BUSINESS --> DB_PRIMARY
    BUSINESS --> QUEUE
    QUEUE --> NOTIFY
    SEARCH --> DB_REPLICA

    DB_PRIMARY --> DB_REPLICA
    NOTIFY --> STORAGE

    SERVICES --> MONITOR
    SERVICES --> LOG
    SERVICES --> TRACE

    classDef clientStyle fill:#E3F2FD,stroke:#1976D2,stroke-width:2px
    classDef gatewayStyle fill:#FFF9C4,stroke:#F57C00,stroke-width:2px
    classDef serviceStyle fill:#C8E6C9,stroke:#388E3C,stroke-width:2px
    classDef dataStyle fill:#FFCCBC,stroke:#D84315,stroke-width:2px
    classDef infraStyle fill:#E1BEE7,stroke:#7B1FA2,stroke-width:2px

    class WEB,MOBILE,DESKTOP,CLI clientStyle
    class LB,CDN,WAF,API_GW gatewayStyle
    class AUTH,USER,BUSINESS,NOTIFY,SEARCH serviceStyle
    class DB_PRIMARY,DB_REPLICA,CACHE,QUEUE,STORAGE dataStyle
    class MONITOR,LOG,TRACE,CI_CD infraStyle
```

---

## 8. ARQUITETURA MICROSERVICES

```mermaid
flowchart LR
    subgraph FRONTEND["FRONTEND"]
        SPA["SPA<br/>Single Page App"]
        BFF["BFF<br/>Backend for Frontend"]
    end

    subgraph CORE["CORE SERVICES"]
        direction TB
        US["User Service"]
        PS["Product Service"]
        OS["Order Service"]
        PAY["Payment Service"]
        INV["Inventory Service"]
    end

    subgraph SUPPORT["SUPPORT SERVICES"]
        direction TB
        AUTH["Auth Service"]
        NOTIF["Notification"]
        ANALYTICS["Analytics"]
    end

    subgraph INFRA["INFRASTRUCTURE"]
        direction TB
        GATEWAY["API Gateway"]
        REGISTRY["Service Registry<br/>Consul/Eureka"]
        CONFIG["Config Server"]
        MQ["Message Broker<br/>Kafka/RabbitMQ"]
    end

    subgraph DATA["DATA STORES"]
        direction TB
        DB1[("Users DB")]
        DB2[("Products DB")]
        DB3[("Orders DB")]
        REDIS[("Redis Cache")]
    end

    SPA --> BFF
    BFF --> GATEWAY
    GATEWAY --> REGISTRY

    GATEWAY --> US
    GATEWAY --> PS
    GATEWAY --> OS
    GATEWAY --> PAY

    US --> DB1
    PS --> DB2
    OS --> DB3
    OS --> MQ

    MQ --> INV
    MQ --> NOTIF
    MQ --> ANALYTICS

    US --> REDIS
    PS --> REDIS

    AUTH --> REGISTRY
    CONFIG --> REGISTRY

    style FRONTEND fill:#E3F2FD
    style CORE fill:#C8E6C9
    style SUPPORT fill:#FFF9C4
    style INFRA fill:#FFCCBC
    style DATA fill:#E1BEE7
```

---

## 9. ARQUITETURA HEXAGONAL (Ports & Adapters)

```mermaid
flowchart TB
    subgraph ADAPTERS_IN["ADAPTERS - INPUT (Driving)"]
        REST["REST API<br/>Controller"]
        GRAPHQL["GraphQL<br/>Resolver"]
        CLI["CLI<br/>Commands"]
        EVENTS_IN["Event Consumer<br/>Message Handler"]
    end

    subgraph PORTS_IN["PORTS - INPUT"]
        USE_CASES["Use Cases<br/>Application Services"]
    end

    subgraph DOMAIN["DOMAIN (Core)"]
        ENTITIES["Entities"]
        VALUE_OBJ["Value Objects"]
        DOMAIN_SVC["Domain Services"]
        EVENTS["Domain Events"]
        REPO_INT["Repository Interfaces"]
    end

    subgraph PORTS_OUT["PORTS - OUTPUT"]
        REPO_PORT["Repository Port"]
        EVENT_PORT["Event Publisher Port"]
        EXTERNAL_PORT["External Service Port"]
    end

    subgraph ADAPTERS_OUT["ADAPTERS - OUTPUT (Driven)"]
        DB_ADAPTER["Database Adapter<br/>PostgreSQL/MongoDB"]
        EVENT_ADAPTER["Event Publisher<br/>Kafka/RabbitMQ"]
        HTTP_ADAPTER["HTTP Client<br/>External APIs"]
        CACHE_ADAPTER["Cache Adapter<br/>Redis"]
    end

    REST --> USE_CASES
    GRAPHQL --> USE_CASES
    CLI --> USE_CASES
    EVENTS_IN --> USE_CASES

    USE_CASES --> ENTITIES
    USE_CASES --> DOMAIN_SVC
    ENTITIES --> VALUE_OBJ
    DOMAIN_SVC --> EVENTS
    DOMAIN_SVC --> REPO_INT

    REPO_INT --> REPO_PORT
    EVENTS --> EVENT_PORT
    DOMAIN_SVC --> EXTERNAL_PORT

    REPO_PORT --> DB_ADAPTER
    REPO_PORT --> CACHE_ADAPTER
    EVENT_PORT --> EVENT_ADAPTER
    EXTERNAL_PORT --> HTTP_ADAPTER

    classDef adapterIn fill:#E3F2FD,stroke:#1976D2,stroke-width:2px
    classDef portIn fill:#BBDEFB,stroke:#1976D2,stroke-width:2px
    classDef domain fill:#C8E6C9,stroke:#388E3C,stroke-width:3px
    classDef portOut fill:#FFE0B2,stroke:#F57C00,stroke-width:2px
    classDef adapterOut fill:#FFCCBC,stroke:#D84315,stroke-width:2px

    class REST,GRAPHQL,CLI,EVENTS_IN adapterIn
    class USE_CASES portIn
    class ENTITIES,VALUE_OBJ,DOMAIN_SVC,EVENTS,REPO_INT domain
    class REPO_PORT,EVENT_PORT,EXTERNAL_PORT portOut
    class DB_ADAPTER,EVENT_ADAPTER,HTTP_ADAPTER,CACHE_ADAPTER adapterOut
```

---

## 10. ARQUITETURA C4 MODEL - Context Diagram

```mermaid
flowchart TB
    subgraph EXTERNAL["SISTEMAS EXTERNOS"]
        PAYMENT_GW["Payment Gateway<br/>Stripe/PayPal"]
        EMAIL_SVC["Email Service<br/>SendGrid/SES"]
        SMS_SVC["SMS Service<br/>Twilio"]
        ANALYTICS["Analytics<br/>Google Analytics"]
    end

    subgraph USERS["USUARIOS"]
        CUSTOMER["Customer<br/>Usa o sistema para<br/>fazer compras"]
        ADMIN["Admin<br/>Gerencia produtos<br/>e pedidos"]
        SUPPORT["Support Team<br/>Atende clientes"]
    end

    SYSTEM["SISTEMA PRINCIPAL<br/>E-Commerce Platform<br/><br/>Permite aos clientes<br/>navegar, comprar e<br/>acompanhar pedidos"]

    CUSTOMER -->|"Navega, compra,<br/>acompanha pedidos"| SYSTEM
    ADMIN -->|"Gerencia catalogo,<br/>processa pedidos"| SYSTEM
    SUPPORT -->|"Consulta pedidos,<br/>resolve problemas"| SYSTEM

    SYSTEM -->|"Processa pagamentos"| PAYMENT_GW
    SYSTEM -->|"Envia emails<br/>transacionais"| EMAIL_SVC
    SYSTEM -->|"Envia SMS<br/>de confirmacao"| SMS_SVC
    SYSTEM -->|"Envia eventos<br/>de tracking"| ANALYTICS

    classDef userStyle fill:#1168BD,stroke:#0B4884,color:#fff,stroke-width:2px
    classDef systemStyle fill:#438DD5,stroke:#2E6295,color:#fff,stroke-width:3px
    classDef externalStyle fill:#999999,stroke:#6B6B6B,color:#fff,stroke-width:2px

    class CUSTOMER,ADMIN,SUPPORT userStyle
    class SYSTEM systemStyle
    class PAYMENT_GW,EMAIL_SVC,SMS_SVC,ANALYTICS externalStyle
```

---

## 11. ARQUITETURA CLEAN ARCHITECTURE (Camadas)

```mermaid
flowchart TB
    subgraph LAYER1["CAMADA 1: FRAMEWORKS & DRIVERS"]
        direction LR
        WEB_FW["Web Framework<br/>Express/FastAPI"]
        DB_DRV["Database Driver<br/>pg/mongoose"]
        UI["UI Framework<br/>React/Vue"]
        EXTERNAL["External APIs"]
    end

    subgraph LAYER2["CAMADA 2: INTERFACE ADAPTERS"]
        direction LR
        CONTROLLERS["Controllers"]
        PRESENTERS["Presenters"]
        GATEWAYS["Gateways"]
        REPOS["Repositories Impl"]
    end

    subgraph LAYER3["CAMADA 3: APPLICATION BUSINESS RULES"]
        direction LR
        USE_CASES["Use Cases"]
        DTOs["DTOs"]
        PORTS["Ports/Interfaces"]
    end

    subgraph LAYER4["CAMADA 4: ENTERPRISE BUSINESS RULES"]
        direction LR
        ENTITIES["Entities"]
        VALUE_OBJ["Value Objects"]
        DOMAIN_SVC["Domain Services"]
    end

    LAYER1 --> LAYER2
    LAYER2 --> LAYER3
    LAYER3 --> LAYER4

    classDef layer1 fill:#FFCCBC,stroke:#D84315,stroke-width:2px
    classDef layer2 fill:#FFF9C4,stroke:#F57C00,stroke-width:2px
    classDef layer3 fill:#C8E6C9,stroke:#388E3C,stroke-width:2px
    classDef layer4 fill:#BBDEFB,stroke:#1976D2,stroke-width:3px

    class WEB_FW,DB_DRV,UI,EXTERNAL layer1
    class CONTROLLERS,PRESENTERS,GATEWAYS,REPOS layer2
    class USE_CASES,DTOs,PORTS layer3
    class ENTITIES,VALUE_OBJ,DOMAIN_SVC layer4
```

---

## 12. ARQUITETURA EVENT-DRIVEN

```mermaid
flowchart LR
    subgraph PRODUCERS["PRODUCERS"]
        P1["Order Service"]
        P2["User Service"]
        P3["Payment Service"]
    end

    subgraph BROKER["EVENT BROKER"]
        direction TB
        TOPIC1["orders.created"]
        TOPIC2["users.registered"]
        TOPIC3["payments.completed"]
        TOPIC4["inventory.updated"]
    end

    subgraph CONSUMERS["CONSUMERS"]
        C1["Notification Service"]
        C2["Analytics Service"]
        C3["Inventory Service"]
        C4["Email Service"]
        C5["Audit Service"]
    end

    P1 -->|publish| TOPIC1
    P2 -->|publish| TOPIC2
    P3 -->|publish| TOPIC3

    TOPIC1 -->|subscribe| C1
    TOPIC1 -->|subscribe| C2
    TOPIC1 -->|subscribe| C3

    TOPIC2 -->|subscribe| C4
    TOPIC2 -->|subscribe| C2

    TOPIC3 -->|subscribe| C1
    TOPIC3 -->|subscribe| C5

    C3 -->|publish| TOPIC4
    TOPIC4 -->|subscribe| C2

    classDef producer fill:#C8E6C9,stroke:#388E3C,stroke-width:2px
    classDef topic fill:#FFF9C4,stroke:#F57C00,stroke-width:2px
    classDef consumer fill:#BBDEFB,stroke:#1976D2,stroke-width:2px

    class P1,P2,P3 producer
    class TOPIC1,TOPIC2,TOPIC3,TOPIC4 topic
    class C1,C2,C3,C4,C5 consumer
```

---

## 13. MIND MAP - Arquitetura de Software

```mermaid
mindmap
  root((ARQUITETURA<br/>DE SOFTWARE))
    PADROES
      Monolito
      Microservices
      Serverless
      Event-Driven
      Hexagonal
      Clean Architecture
    CAMADAS
      Presentation
      Application
      Domain
      Infrastructure
      Data
    COMUNICACAO
      REST API
      GraphQL
      gRPC
      WebSocket
      Message Queue
      Event Bus
    DADOS
      SQL Databases
      NoSQL Databases
      Cache Layer
      Object Storage
      Data Lake
    INFRAESTRUTURA
      Load Balancer
      API Gateway
      CDN
      Container Orchestration
      Service Mesh
    OBSERVABILIDADE
      Logging
      Monitoring
      Tracing
      Alerting
      Dashboards
    SEGURANCA
      Authentication
      Authorization
      Encryption
      WAF
      Rate Limiting
```

---

## REFERENCIAS DE ARQUITETURA

| Padrao | Quando Usar |
|--------|-------------|
| **Monolito** | MVPs, equipes pequenas, dominios simples |
| **Microservices** | Escala, equipes independentes, dominios complexos |
| **Hexagonal** | Testabilidade, inversao de dependencia |
| **Clean Architecture** | Separacao de concerns, longevidade |
| **Event-Driven** | Desacoplamento, processamento assincrono |
| **Serverless** | Cargas variaveis, custos por uso |
| **C4 Model** | Documentacao, comunicacao com stakeholders |

---

*Arquivo gerado por O Pensador v5.0 - Arquiteto do Pensamento Profundo*
