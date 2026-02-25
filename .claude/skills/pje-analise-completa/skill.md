# PJe Análise Completa - Agente de Automação Jurídica

## Descrição
Agente especializado para download, processamento e análise jurídica de processos do PJe (Processo Judicial Eletrônico) do TJDFT. Automatiza todo o fluxo desde a captura de sessão até a geração de parecer jurídico completo.

## Comandos Disponíveis

### 1. /pje-sessao
Extrai cookies de sessão do PJe a partir de arquivo HAR capturado no navegador.

### 2. /pje-baixar [número_processo]
Baixa todos os documentos de um processo do PJe.

### 3. /pje-converter [pasta]
Converte todos os PDFs de uma pasta para TXT (usando OCR quando necessário).

### 4. /pje-analisar [pasta]
Realiza análise jurídica completa do processo e gera parecer.

### 5. /pje-completo [número_processo]
Executa todo o fluxo: baixar → converter → analisar → enviar por email.

## Pré-requisitos

1. **Python 3.x** com as bibliotecas:
   - requests
   - pdfplumber
   - pytesseract
   - pdf2image
   - reportlab

2. **Tesseract OCR** instalado em `C:\Program Files\Tesseract-OCR`

3. **Poppler** em `C:\Users\USER\Desktop\poppler-extract\poppler-24.08.0\Library\bin`

4. **Sessão PJe ativa** - Capturar arquivo HAR do navegador

## Fluxo de Trabalho

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FLUXO COMPLETO DE ANÁLISE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. CAPTURAR SESSÃO                                                 │
│     └── Navegador → DevTools → Network → Salvar HAR                 │
│                         │                                           │
│                         ▼                                           │
│  2. EXTRAIR COOKIES                                                 │
│     └── extrair_sessao_pje.py                                       │
│                         │                                           │
│                         ▼                                           │
│  3. BAIXAR DOCUMENTOS                                               │
│     └── baixar_todos_documentos.py                                  │
│                         │                                           │
│                         ▼                                           │
│  4. CONVERTER PDF → TXT                                             │
│     └── converter_pdfs.py (pdfplumber + OCR)                        │
│                         │                                           │
│                         ▼                                           │
│  5. JUNTAR DOCUMENTOS                                               │
│     └── juntar_documentos.py                                        │
│                         │                                           │
│                         ▼                                           │
│  6. ANALISAR PROCESSO                                               │
│     └── Claude analisa e gera parecer                               │
│                         │                                           │
│                         ▼                                           │
│  7. GERAR PDF E ENVIAR                                              │
│     └── enviar_email.py                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Estrutura de Pastas

```
C:\AGÊNTICO\
└── [NÚMERO_PROCESSO]\
    ├── doc_*.pdf           # Documentos originais
    ├── doc_*.txt           # Documentos convertidos
    ├── PROCESSO_COMPLETO.txt   # Todos os docs concatenados
    ├── ANALISE_JURIDICA_COMPLETA.txt
    └── ANALISE_JURIDICA_COMPLETA.pdf
```

## Instruções de Uso

### Passo 1: Capturar Sessão do PJe

1. Abra o Firefox e acesse https://pje.tjdft.jus.br
2. Faça login com certificado digital
3. Pressione F12 → Aba "Rede" (Network)
4. Navegue pelo processo desejado
5. Clique com botão direito → "Salvar tudo como HAR"
6. Salve como `pje.har` na pasta Downloads

### Passo 2: Executar Extração

```bash
python extrair_sessao_pje.py
```

### Passo 3: Baixar Processo

```bash
python baixar_todos_documentos.py
```

### Passo 4: Converter e Analisar

O agente Claude realizará automaticamente:
- Conversão de PDFs para TXT
- OCR em documentos escaneados
- Análise jurídica completa
- Geração de parecer com probabilidade de sucesso

## Configuração de Email

Arquivo: `config_email.json`
```json
{
  "email_destino": "seu_email@gmail.com",
  "smtp_servidor": "smtp.gmail.com",
  "smtp_porta": 587,
  "smtp_usuario": "seu_email@gmail.com",
  "smtp_senha": "sua_senha_de_app"
}
```

## Análise Jurídica Gerada

O parecer inclui:
1. Síntese do caso
2. Argumentações da petição inicial
3. Argumentações da contestação
4. Análise das provas documentais
5. Valoração das provas
6. Análise da sentença
7. Análise da apelação e contrarrazões
8. Parecer de mérito (como Desembargadores)
9. Esboço de acórdão proposto
10. Probabilidade de sucesso (%)

## Autor
Desenvolvido para Paulo César Santos - Procurador Federal (AGU)
