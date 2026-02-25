# -*- coding: utf-8 -*-
"""
pje_completo.py
Script principal que executa todo o fluxo de analise de processo PJe.

Uso:
    python pje_completo.py NUMERO_PROCESSO

Exemplo:
    python pje_completo.py 0738732-18.2025.807.0016

Fluxo:
    1. Verifica sessao PJe
    2. Baixa todos os documentos
    3. Converte PDFs para TXT
    4. Junta todos os documentos
    5. Prepara para analise

Requisitos:
    - Sessao PJe ativa (executar extrair_sessao_pje.py antes)
    - Python com bibliotecas: requests, pdfplumber, pytesseract, pdf2image
    - Tesseract OCR instalado
    - Poppler instalado
"""

import sys
import subprocess
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
DOWNLOADS_BASE = Path(r"C:\AGÊNTICO")


def executar_script(script_name, *args):
    """Executa um script Python."""
    script_path = SCRIPT_DIR / script_name
    cmd = [sys.executable, str(script_path)] + list(args)

    print(f"\n>>> Executando: {script_name}")
    result = subprocess.run(cmd, capture_output=False)
    return result.returncode == 0


def main():
    if len(sys.argv) < 2:
        print("\n" + "=" * 70)
        print("   PJe ANALISE COMPLETA")
        print("=" * 70)
        print("""
   Uso: python pje_completo.py NUMERO_PROCESSO

   Exemplo: python pje_completo.py 0738732-18.2025.807.0016

   Este script executa automaticamente:
   1. Download de todos os documentos do processo
   2. Conversao de PDFs para TXT (com OCR se necessario)
   3. Concatenacao em arquivo unico para analise

   Pre-requisito:
   - Executar extrair_sessao_pje.py com HAR do PJe
""")
        print("=" * 70)
        sys.exit(1)

    numero_processo = sys.argv[1]
    pasta_processo = DOWNLOADS_BASE / numero_processo

    print("\n" + "=" * 70)
    print("   PJe ANALISE COMPLETA - FLUXO AUTOMATIZADO")
    print("=" * 70)
    print(f"\n   Processo: {numero_processo}")
    print(f"   Pasta: {pasta_processo}")

    # Etapa 1: Baixar documentos
    print("\n" + "-" * 70)
    print("   ETAPA 1/3: DOWNLOAD DOS DOCUMENTOS")
    print("-" * 70)

    if not executar_script("baixar_processo_pje.py", numero_processo):
        print("\n   ERRO na etapa de download!")
        sys.exit(1)

    # Verifica se ha PDFs
    pdfs = list(pasta_processo.glob("*.pdf"))
    if not pdfs:
        print("\n   ERRO: Nenhum PDF baixado!")
        sys.exit(1)

    print(f"\n   PDFs baixados: {len(pdfs)}")

    # Etapa 2: Converter PDFs
    print("\n" + "-" * 70)
    print("   ETAPA 2/3: CONVERSAO PDF -> TXT")
    print("-" * 70)

    if not executar_script("converter_pdfs.py", str(pasta_processo)):
        print("\n   AVISO: Alguns PDFs podem nao ter sido convertidos.")

    # Etapa 3: Juntar documentos
    print("\n" + "-" * 70)
    print("   ETAPA 3/3: CONCATENAR DOCUMENTOS")
    print("-" * 70)

    if not executar_script("juntar_documentos.py", str(pasta_processo)):
        print("\n   ERRO ao juntar documentos!")
        sys.exit(1)

    # Resumo final
    txts = list(pasta_processo.glob("*.txt"))
    processo_completo = pasta_processo / "PROCESSO_COMPLETO.txt"

    print("\n" + "=" * 70)
    print("   PROCESSAMENTO CONCLUIDO!")
    print("=" * 70)
    print(f"""
   Processo: {numero_processo}
   Pasta: {pasta_processo}

   Arquivos:
   - PDFs baixados: {len(pdfs)}
   - TXTs gerados: {len(txts)}
   - Arquivo completo: PROCESSO_COMPLETO.txt
""")

    if processo_completo.exists():
        tamanho = processo_completo.stat().st_size / 1024
        print(f"   Tamanho do arquivo completo: {tamanho:.1f} KB")

    print("""
   PROXIMO PASSO:
   Solicite ao Claude a analise juridica do processo:
   "Analise o processo em C:\\AGENTICO\\{numero}\\PROCESSO_COMPLETO.txt"
""".format(numero=numero_processo))
    print("=" * 70)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nOperacao cancelada.")
    except Exception as e:
        print(f"\nERRO: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
