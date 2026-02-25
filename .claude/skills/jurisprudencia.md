---
name: jurisprudencia
description: "Pesquisa jurisprudência atualizada do STF, STJ e TNU sobre tema específico. Sintaxe: /jurisprudencia [tema]. Retorna julgados paradigmáticos com tese, fundamentos e aplicação em provas."
---

Invoque o agente **jurismentor-federal** para pesquisar jurisprudência.

## Parâmetros
- `tema` - Descrição do tema jurídico a pesquisar

## Fontes de Pesquisa
- **STF** - Informativos, Teses de Repercussão Geral, Súmulas Vinculantes
- **STJ** - Informativos, Jurisprudência em Teses, Súmulas, Recursos Repetitivos
- **TNU** - Teses da Turma Nacional de Uniformização (JEFs)
- **Dizer o Direito** - Comentários de julgados

## Formato da Resposta
Para cada julgado relevante:
1. **Tribunal/Órgão** - STF/Pleno, STJ/1ª Seção, etc.
2. **Tipo/Número** - RE 123456, REsp 789012, etc.
3. **Relator** - Min. Nome
4. **Data de Julgamento**
5. **Informativo** - Número do informativo (se houver)
6. **TESE** - Enunciado da tese firmada
7. **FUNDAMENTOS** - Principais argumentos do voto
8. **APLICAÇÃO EM PROVAS** - Como o tema já foi cobrado ou pode ser cobrado

## Alertas
- Indicar se há mudança de entendimento recente
- Apontar divergências entre STF e STJ
- Destacar temas com repercussão geral pendente
- Mencionar súmulas superadas ou canceladas

Execute a tarefa usando o agente jurismentor-federal com acesso a WebSearch para buscar jurisprudência atualizada.
