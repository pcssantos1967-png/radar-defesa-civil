# -*- coding: utf-8 -*-
"""
converter_pdfs.py
Converte todos os PDFs de uma pasta para TXT.
Usa pdfplumber para PDFs com texto e OCR (Tesseract) para PDFs escaneados.

Uso:
    python converter_pdfs.py PASTA_COM_PDFS

Exemplo:
    python converter_pdfs.py "C:\AGÊNTICO\0738732-18.2025.807.0016"
"""

import sys
from pathlib import Path

# Configuracoes
TESSERACT_PATH = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
POPPLER_PATH = r'C:\Users\USER\Desktop\poppler-extract\poppler-24.08.0\Library\bin'


def converter_com_pdfplumber(pdf_path):
    """Tenta extrair texto com pdfplumber."""
    import pdfplumber

    texto = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                texto.append(page_text)

    return "\n\n".join(texto)


def converter_com_ocr(pdf_path):
    """Converte PDF escaneado usando OCR."""
    import pytesseract
    from pdf2image import convert_from_path

    pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH

    # Converte PDF para imagens
    images = convert_from_path(pdf_path, poppler_path=POPPLER_PATH, dpi=200)

    texto_completo = []
    for page_num, image in enumerate(images):
        texto = pytesseract.image_to_string(image, lang='por')
        if texto.strip():
            texto_completo.append(texto)

    return "\n\n".join(texto_completo)


def converter_pdf(pdf_path, txt_path):
    """Converte um PDF para TXT."""
    # Primeira tentativa: pdfplumber (mais rapido)
    try:
        texto = converter_com_pdfplumber(pdf_path)
        if texto and len(texto.strip()) > 100:
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(texto)
            return True, len(texto), "PDFPLUMBER"
    except Exception as e:
        pass

    # Segunda tentativa: OCR
    try:
        texto = converter_com_ocr(pdf_path)
        if texto and len(texto.strip()) > 50:
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(texto)
            return True, len(texto), "OCR"
    except Exception as e:
        return False, 0, str(e)[:30]

    return False, 0, "SEM_TEXTO"


def main():
    if len(sys.argv) < 2:
        print("\nUso: python converter_pdfs.py PASTA_COM_PDFS")
        print("Exemplo: python converter_pdfs.py \"C:\\AGÊNTICO\\0738732-18.2025.807.0016\"")
        sys.exit(1)

    pasta = Path(sys.argv[1])

    if not pasta.exists():
        print(f"\nERRO: Pasta nao encontrada: {pasta}")
        sys.exit(1)

    print("\n" + "=" * 70)
    print("   CONVERSOR PDF -> TXT")
    print("=" * 70)
    print(f"\n   Pasta: {pasta}")

    # Lista PDFs
    pdfs = list(pasta.glob("*.pdf"))
    print(f"   Total de PDFs: {len(pdfs)}")

    if not pdfs:
        print("\n   Nenhum PDF encontrado na pasta.")
        sys.exit(1)

    # Separa PDFs ja convertidos
    pdfs_pendentes = [p for p in pdfs if not p.with_suffix(".txt").exists()]
    print(f"   PDFs pendentes: {len(pdfs_pendentes)}")

    if not pdfs_pendentes:
        print("\n   Todos os PDFs ja foram convertidos!")
        return

    print("\n" + "-" * 70)

    sucesso_pdfplumber = 0
    sucesso_ocr = 0
    falhas = 0

    for i, pdf_path in enumerate(pdfs_pendentes, 1):
        txt_path = pdf_path.with_suffix(".txt")

        print(f"   [{i:3d}/{len(pdfs_pendentes)}] {pdf_path.name}...", end=" ", flush=True)

        ok, chars, metodo = converter_pdf(pdf_path, txt_path)

        if ok:
            if metodo == "PDFPLUMBER":
                sucesso_pdfplumber += 1
            else:
                sucesso_ocr += 1
            print(f"OK ({metodo}, {chars} chars)")
        else:
            falhas += 1
            print(f"FALHA ({metodo})")

    # Resumo
    print("\n" + "=" * 70)
    print("   RESUMO DA CONVERSAO")
    print("=" * 70)
    print(f"""
   Convertidos (pdfplumber): {sucesso_pdfplumber}
   Convertidos (OCR):        {sucesso_ocr}
   Falhas:                   {falhas}
   Total:                    {sucesso_pdfplumber + sucesso_ocr}/{len(pdfs_pendentes)}
""")
    print("=" * 70)
    print("\n   PROXIMO PASSO:")
    print(f"   Execute: python juntar_documentos.py \"{pasta}\"")
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
