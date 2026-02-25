---
name: questoes
description: "Gera questões de concurso para Juiz Federal. Sintaxe: /questoes [disciplina] [quantidade] [tipo]. Tipos: objetiva (CESPE/FCC), dissertativa (30-120 linhas), sentenca."
---

Invoque o agente **jurismentor-federal** para gerar questões de concurso.

## Parâmetros
- `disciplina` - constitucional, administrativo, civil, processo-civil, penal, processo-penal, tributario, previdenciario, ambiental, empresarial, internacional, financeiro, etica, humanistica
- `quantidade` - número de questões (1-20)
- `tipo` - objetiva | dissertativa | sentenca

## Formato das Questões

### Objetivas (1ª Fase)
- Estilo CESPE (Certo/Errado) ou FCC (múltipla escolha A-E)
- Após resposta: comentário detalhado com fundamento legal e jurisprudencial
- Nível de dificuldade: Fácil | Médio | Difícil

### Dissertativas (2ª Fase)
- Peças com limite de linhas (30/60/90/120)
- Critérios explícitos de correção
- Resposta-padrão após tentativa do aluno

### Sentenças (2ª Fase)
- Casos concretos simulados
- Estrutura: relatório, fundamentação e dispositivo
- Avaliação conforme padrões ENFAM

Execute a tarefa usando o agente jurismentor-federal.
