# PJe Análise Completa

Sistema de automação para download, processamento e análise jurídica de processos do PJe (Processo Judicial Eletrônico) do TJDFT.

**Integrado com MCPs de Jurisprudência do Sistema Marmelstein (George Marmelstein).**

## Funcionalidades

- **Download automático** de todos os documentos de um processo
- **Conversão PDF → TXT** com suporte a OCR para documentos escaneados
- **Concatenação** de todos os documentos em arquivo único
- **Análise jurídica** com geração de parecer e probabilidade de sucesso
- **Busca de precedentes** via MCPs (BNP, CJF, JurisDF)
- **Envio por email** dos documentos e análises

## Instalação

### 1. Dependências Python

```bash
pip install requests pdfplumber pytesseract pdf2image reportlab mcp beautifulsoup4 httpx tenacity pydantic
```

### 2. Tesseract OCR

Baixe e instale o Tesseract OCR:
- https://github.com/UB-Mannheim/tesseract/wiki

Instale em: `C:\Program Files\Tesseract-OCR`

### 3. Poppler

Baixe o Poppler para Windows:
- https://github.com/oschwartz10612/poppler-windows/releases

Extraia em: `C:\Users\USER\Desktop\poppler-extract\`

## Como Usar

### Opção 1: Atalho na Área de Trabalho

Execute o arquivo `PJe Analise Completa.bat` na Área de Trabalho.

### Opção 2: Linha de Comando

#### Passo 1: Capturar Sessão

1. Abra o Firefox e acesse https://pje.tjdft.jus.br
2. Faça login com certificado digital
3. Pressione F12 → Aba "Rede"
4. Navegue pelo processo desejado
5. Clique direito → "Salvar tudo como HAR"
6. Salve na pasta Downloads

```bash
python extrair_sessao_pje.py
```

#### Passo 2: Baixar Processo

```bash
python baixar_processo_pje.py 0738732-18.2025.807.0016
```

#### Passo 3: Converter PDFs

```bash
python converter_pdfs.py "C:\AGÊNTICO\0738732-18.2025.807.0016"
```

#### Passo 4: Juntar Documentos

```bash
python juntar_documentos.py "C:\AGÊNTICO\0738732-18.2025.807.0016"
```

#### Fluxo Completo (tudo de uma vez)

```bash
python pje_completo.py 0738732-18.2025.807.0016
```

### Opção 3: Via Claude

Solicite ao Claude:

```
Baixe o processo 0738732-18.2025.807.0016 do PJe, converta para TXT e faça análise jurídica completa
```

## Estrutura de Arquivos

```
C:\Users\USER\Desktop\.claude\skills\pje-analise-completa\
├── skill.md                    # Definição do skill
├── README.md                   # Este arquivo
├── scripts\
│   ├── extrair_sessao_pje.py   # Extrai cookies do HAR
│   ├── baixar_processo_pje.py  # Baixa documentos do PJe
│   ├── converter_pdfs.py       # Converte PDFs para TXT
│   ├── juntar_documentos.py    # Concatena TXTs
│   ├── enviar_email.py         # Envia por email
│   └── pje_completo.py         # Fluxo completo
└── mcp-servers\                # MCPs de Jurisprudência
    ├── shared\                 # Código compartilhado
    │   └── base_juridica.py
    ├── bnp-api\                # Banco Nacional Precedentes
    │   └── server.py
    ├── cjf-jurisprudencia\     # Portal CJF
    │   └── server.py
    └── jurisdf-tjdft\          # JurisDF TJDFT
        └── server.py

C:\AGÊNTICO\
└── [NÚMERO_PROCESSO]\
    ├── doc_*.pdf               # PDFs originais
    ├── doc_*.txt               # TXTs convertidos
    ├── PROCESSO_COMPLETO.txt   # Documento único
    ├── ANALISE_JURIDICA_COMPLETA.txt
    └── ANALISE_JURIDICA_COMPLETA.pdf
```

## Análise Jurídica

A análise gerada pelo Claude inclui:

1. **Síntese do caso** - Partes, objeto, valor da causa
2. **Petição inicial** - Argumentos, pedidos, provas
3. **Contestação** - Defesa, preliminares, documentos
4. **Valoração de provas** - Peso de cada documento
5. **Sentença** - Análise crítica do julgamento
6. **Apelação** - Razões recursais, contrarrazões
7. **Parecer de mérito** - Como Desembargadores
8. **Acórdão proposto** - Ementa e dispositivo
9. **Probabilidade de sucesso** - Percentual estimado

## Configuração de Email

Edite o arquivo `config_email.json`:

```json
{
  "email_destino": "seu_email@gmail.com",
  "smtp_servidor": "smtp.gmail.com",
  "smtp_porta": 587,
  "smtp_usuario": "seu_email@gmail.com",
  "smtp_senha": "sua_senha_de_app"
}
```

**Nota:** Use uma "Senha de App" do Gmail, não a senha normal.

## Solução de Problemas

### Sessão expirada
```
ERRO: Sessao nao encontrada
```
**Solução:** Capture um novo arquivo HAR do PJe.

### Tesseract não encontrado
```
TesseractNotFoundError
```
**Solução:** Instale o Tesseract em `C:\Program Files\Tesseract-OCR`

### Poppler não encontrado
```
Unable to get page count
```
**Solução:** Instale o Poppler e configure o caminho no script.

### Documentos não baixados
```
Nenhum documento encontrado
```
**Solução:** Navegue pelos documentos no PJe antes de salvar o HAR.

## Autor

Desenvolvido para **Paulo César Santos**
Procurador Federal - Advocacia-Geral da União (AGU)

## MCPs de Jurisprudência (Integração Marmelstein)

O sistema inclui 3 servidores MCP para busca de jurisprudência:

| MCP | Fonte | Escopo |
|-----|-------|--------|
| **bnp-api** | Banco Nacional de Precedentes | STF, STJ, Súmulas, IRDRs |
| **cjf-jurisprudencia** | Portal CJF | STF, STJ, TRF1-6 |
| **jurisdf-tjdft** | JurisDF | Jurisprudência local TJDFT |

### Configurar MCPs

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

### Usar com Claude

Após configurar, o Claude poderá buscar precedentes automaticamente:

```
Analise o processo X e busque jurisprudência relevante sobre o tema.
```

## Créditos

- **PJe Análise**: Desenvolvido para Paulo César Santos (AGU)
- **MCPs Jurisprudência**: Baseados no Sistema Marmelstein de George Marmelstein

## Versão

v3.0 - Fevereiro 2026 (com integração Marmelstein)
