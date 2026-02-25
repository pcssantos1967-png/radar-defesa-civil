# MCPs de Jurisprudencia - PJe Analise Completa

Servidores MCP para busca de jurisprudencia integrados ao PJe Analise Completa.

Baseados no Sistema Marmelstein de George Marmelstein.

## Servidores Disponiveis

| MCP | Fonte | Escopo |
|-----|-------|--------|
| **bnp-api** | Banco Nacional de Precedentes (CNJ) | STF, STJ, Sumulas, IRDRs |
| **cjf-jurisprudencia** | Portal CJF | STF, STJ, TRF1-6 |
| **jurisdf-tjdft** | JurisDF | Jurisprudencia local TJDFT |

## Instalacao

### 1. Dependencias Python

```bash
pip install mcp requests beautifulsoup4 httpx tenacity pydantic
```

### 2. Configurar no Claude Code

Adicione ao arquivo `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "bnp-api": {
      "command": "python",
      "args": ["C:/Users/USER/Desktop/.claude/skills/pje-analise-completa/mcp-servers/bnp-api/server.py"]
    },
    "cjf-jurisprudencia": {
      "command": "python",
      "args": ["C:/Users/USER/Desktop/.claude/skills/pje-analise-completa/mcp-servers/cjf-jurisprudencia/server.py"]
    },
    "jurisdf-tjdft": {
      "command": "python",
      "args": ["C:/Users/USER/Desktop/.claude/skills/pje-analise-completa/mcp-servers/jurisdf-tjdft/server.py"]
    }
  }
}
```

### 3. Testar MCPs

```bash
# BNP API
python .claude/skills/pje-analise-completa/mcp-servers/bnp-api/server.py

# CJF
python .claude/skills/pje-analise-completa/mcp-servers/cjf-jurisprudencia/server.py

# JurisDF
python .claude/skills/pje-analise-completa/mcp-servers/jurisdf-tjdft/server.py
```

## Sintaxe de Busca

### BNP-API (Precedentes)

```
+termo     : Obrigatorio (AND)
-termo     : Excluido (NOT)
"frase"    : Expressao exata

Exemplos:
  +"pensao" +"morte" +homoafetivo
  "aposentadoria especial" +EPI
  +teto +previdenciario -militar
```

### CJF (Jurisprudencia Unificada)

```
E          : Ambos termos
OU         : Qualquer termo
NAO        : Exclui termo
ADJ[n]     : Adjacentes na ordem
PROX[n]    : Proximos qualquer ordem
[EMEN]     : Busca na ementa
[REL]      : Busca por relator

Exemplos:
  (pensao E morte)[EMEN] E homoafetivo
  "auxilio-doenca"[EMEN] E pericia
  Fux[REL] E previdenciario
```

### JurisDF (TJDFT)

```
E          : Ambos termos
OU         : Qualquer termo
NAO        : Exclui termo
"aspas"    : Expressao exata
$          : Wildcard

Exemplos:
  "dano moral" E "transporte aereo"
  consumidor$ E fornecedor
  DPVAT NAO militar
```

## Ferramentas Disponiveis

### BNP-API

- `buscar_precedentes(busca, orgaos, tipos, max_resultados)`
- `listar_tipos_precedentes()`

### CJF-Jurisprudencia

- `buscar_jurisprudencia_cjf(busca, tribunais, max_resultados)`
- `listar_tribunais_cjf()`

### JurisDF-TJDFT

- `buscar_jurisprudencia_tjdft(busca, max_resultados, sinonimos)`
- `listar_filtros_tjdft()`

## Exemplo de Uso no Claude

```
Analise o processo 0738732-18.2025.807.0016 e busque precedentes relevantes
sobre prestacao de contas no STF e STJ.
```

O Claude usara automaticamente os MCPs para buscar jurisprudencia
e fundamentar a analise.
