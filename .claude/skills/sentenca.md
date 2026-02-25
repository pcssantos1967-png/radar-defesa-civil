---
name: sentenca
description: "Gera caso prático para treino de sentença judicial. Sintaxe: /sentenca [area]. Áreas: civel, criminal, tributaria, previdenciaria. Avaliação conforme critérios ENFAM."
---

Invoque o agente **jurismentor-federal** para gerar um caso prático de sentença.

## Parâmetros
- `civel` - Sentença cível (JEF ou vara federal)
- `criminal` - Sentença criminal federal
- `tributaria` - Sentença em execução fiscal ou anulatória
- `previdenciaria` - Sentença em benefício previdenciário (concessão, revisão, BPC)

## Estrutura da Sentença
O caso deve permitir elaboração de sentença com:
1. **RELATÓRIO** - Síntese dos fatos e pedidos
2. **FUNDAMENTAÇÃO** - Análise jurídica com legislação e jurisprudência
3. **DISPOSITIVO** - Decisão clara com consequências processuais

## Critérios de Avaliação (ENFAM)
- Adequação técnica do relatório
- Profundidade da fundamentação
- Coerência entre fundamentação e dispositivo
- Linguagem jurídica adequada
- Observância de precedentes vinculantes
- Completude do dispositivo (custas, honorários, reexame necessário)

## Tipos de Casos por Área
- **Cível:** Responsabilidade civil da União, desapropriação, contratos administrativos
- **Criminal:** Tráfico internacional, contrabando, crimes previdenciários, lavagem
- **Tributária:** Execução fiscal, exceção de pré-executividade, repetição de indébito
- **Previdenciária:** Aposentadoria por tempo/idade/invalidez, auxílio-doença, BPC/LOAS

Execute a tarefa usando o agente jurismentor-federal.
