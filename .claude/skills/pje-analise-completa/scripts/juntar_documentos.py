# -*- coding: utf-8 -*-
"""
juntar_documentos.py
Junta todos os arquivos TXT em um unico documento.

Uso:
    python juntar_documentos.py PASTA_COM_TXTS

Exemplo:
    python juntar_documentos.py "C:\AGÊNTICO\0738732-18.2025.807.0016"
"""

import sys
from pathlib import Path


def main():
    if len(sys.argv) < 2:
        print("\nUso: python juntar_documentos.py PASTA_COM_TXTS")
        sys.exit(1)

    pasta = Path(sys.argv[1])

    if not pasta.exists():
        print(f"\nERRO: Pasta nao encontrada: {pasta}")
        sys.exit(1)

    print("\n" + "=" * 70)
    print("   JUNTAR DOCUMENTOS TXT")
    print("=" * 70)
    print(f"\n   Pasta: {pasta}")

    # Lista TXTs (exceto PROCESSO_COMPLETO.txt)
    txts = sorted([t for t in pasta.glob("*.txt") if "PROCESSO_COMPLETO" not in t.name and "ANALISE" not in t.name])

    print(f"   Arquivos TXT: {len(txts)}")

    if not txts:
        print("\n   Nenhum arquivo TXT encontrado.")
        sys.exit(1)

    # Arquivo de saida
    arquivo_saida = pasta / "PROCESSO_COMPLETO.txt"

    print(f"\n   Juntando {len(txts)} arquivos...")

    total_chars = 0

    with open(arquivo_saida, "w", encoding="utf-8") as saida:
        for i, txt in enumerate(txts, 1):
            saida.write("=" * 70 + "\n")
            saida.write(f"DOCUMENTO: {txt.stem}\n")
            saida.write("=" * 70 + "\n\n")

            try:
                with open(txt, "r", encoding="utf-8", errors="ignore") as f:
                    conteudo = f.read()
                    saida.write(conteudo)
                    total_chars += len(conteudo)
            except Exception as e:
                saida.write(f"[ERRO AO LER: {e}]\n")

            saida.write("\n\n")

            if i % 20 == 0:
                print(f"      Processados: {i}/{len(txts)}")

    tamanho_kb = arquivo_saida.stat().st_size / 1024

    print("\n" + "=" * 70)
    print("   DOCUMENTO COMPLETO GERADO")
    print("=" * 70)
    print(f"""
   Arquivo: {arquivo_saida.name}
   Documentos: {len(txts)}
   Tamanho: {tamanho_kb:.1f} KB
   Caracteres: {total_chars:,}
""")
    print("=" * 70)
    print("\n   O arquivo PROCESSO_COMPLETO.txt esta pronto para analise!")
    print("=" * 70)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nOperacao cancelada.")
    except Exception as e:
        print(f"\nERRO: {e}")
        sys.exit(1)
