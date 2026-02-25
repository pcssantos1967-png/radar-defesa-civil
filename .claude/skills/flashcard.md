---
name: flashcard
description: "Gera flashcard do programa de 720 dias para concurso de Juiz Federal. Use '/flashcard hoje' para o flashcard do dia, '/flashcard N' para dia específico (1-720), ou '/flashcard status' para ver progresso."
---

Invoque o agente **jurismentor-federal** para gerar o flashcard solicitado.

## Parâmetros
- `hoje` - Gera o flashcard do dia atual
- `N` (número 1-720) - Gera o flashcard do dia específico
- `status` - Mostra o dia atual, progresso e disciplinas próximas

## Estrutura do Flashcard
Cada flashcard deve conter:
1. **CONCEITO-CHAVE** (3-5 linhas com dispositivo legal e autor de referência)
2. **BASE LEGAL** (dispositivos e súmulas aplicáveis)
3. **JURISPRUDÊNCIA EM DESTAQUE** (julgado paradigmático com tribunal, órgão, número, relator, data, tese)
4. **DICA DE PROVA** 🎯 (como o tema aparece em provas, pegadinhas típicas)
5. **QUESTÃO-RELÂMPAGO** ⚡ (uma questão C/E com gabarito e comentário de 2 linhas)
6. **CONEXÃO INTERDISCIPLINAR** 🔗 (ligação com outra disciplina do edital)
7. **REVISÃO ESPAÇADA** (dias N-1, N-3, N-7, N-30 para revisar)

## Distribuição por Dia da Semana
- Segunda: Constitucional OU Administrativo
- Terça: Civil OU Processual Civil
- Quarta: Penal OU Processual Penal
- Quinta: Tributário OU Previdenciário
- Sexta: Ambiental, Internacional, Empresarial (rodízio)
- Sábado: Financeiro/Econômico, Ética, Humanística (rodízio)
- Domingo: REVISÃO INTEGRATIVA - flashcard interdisciplinar

Execute a tarefa usando o agente jurismentor-federal.
