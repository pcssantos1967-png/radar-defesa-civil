# -*- coding: utf-8 -*-
"""
baixar_com_id.py
Baixa documentos do PJe usando ID do processo conhecido.
"""

import requests
import json
import re
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

SCRIPT_DIR = Path(__file__).parent
SESSION_FILE = SCRIPT_DIR / "session_pje.json"
DOWNLOADS_BASE = Path(r"C:\AGÊNTICO")


def carregar_sessao():
    if not SESSION_FILE.exists():
        return None
    with open(SESSION_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def criar_sessao(session_data):
    s = requests.Session()
    s.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Referer': 'https://pje.tjdft.jus.br/pje/',
    })
    for name, value in session_data['cookies'].items():
        s.cookies.set(name, value, domain='pje.tjdft.jus.br')
    return s


def buscar_documentos_do_processo(session, id_processo):
    """Busca lista de documentos do processo."""
    print(f"\n[1] Buscando documentos do processo ID {id_processo}...")

    base_url = "https://pje.tjdft.jus.br"

    # Tentar diferentes endpoints para obter lista de documentos
    endpoints = [
        f"/pje/Processo/ConsultaProcesso/Documentos/listView.seam?idProcesso={id_processo}",
        f"/pje/Processo/ConsultaProcesso/listView.seam?idProcesso={id_processo}",
        f"/pje/seam/resource/rest/pje-legacy/processo/documentos/{id_processo}",
        f"/pje/Processo/Autos/paginaAutos.seam?idProcesso={id_processo}",
    ]

    documentos = []

    for endpoint in endpoints:
        try:
            url = base_url + endpoint
            print(f"    Tentando: {endpoint[:50]}...")
            resp = session.get(url, timeout=60)

            if resp.status_code == 200 and len(resp.text) > 5000:
                print(f"    Status: {resp.status_code}, Tamanho: {len(resp.text)} bytes")

                # Procurar IDs de documentos
                patterns = [
                    r'idDocumento["\':=\s]+(\d+)',
                    r'documento/(\d{6,})',
                    r'idProcessoDocumento["\':=\s]+(\d+)',
                    r'/download/TJDFT/1g/\d+/(\d+)',
                ]

                for pattern in patterns:
                    matches = re.findall(pattern, resp.text)
                    for m in matches:
                        if m not in documentos and len(m) >= 6:
                            documentos.append(m)

                if documentos:
                    print(f"    Documentos encontrados: {len(documentos)}")
                    break

        except Exception as e:
            print(f"    Erro: {e}")

    # Se não encontrou, tentar extrair do HTML da página de consulta
    if not documentos:
        print("\n[1.1] Tentando extrair da página de consulta...")
        html_file = DOWNLOADS_BASE / sys.argv[1] / "consulta_processo.html"
        if html_file.exists():
            with open(html_file, 'r', encoding='utf-8') as f:
                html = f.read()

            for pattern in [r'idDocumento["\':=\s]+(\d+)', r'idProcessoDocumento["\':=\s]+(\d+)']:
                matches = re.findall(pattern, html)
                for m in matches:
                    if m not in documentos and len(m) >= 6:
                        documentos.append(m)

            if documentos:
                print(f"    Documentos do HTML: {len(documentos)}")

    return list(set(documentos))


def acessar_autos_digitais(session, id_processo, download_dir):
    """Acessa os autos digitais para obter lista de documentos."""
    print(f"\n[2] Acessando autos digitais...")

    base_url = "https://pje.tjdft.jus.br"
    url = f"{base_url}/pje/Processo/Autos/paginaAutos.seam"

    # Primeiro, POST para selecionar o processo
    try:
        data = {
            'idProcesso': id_processo,
            'AJAXREQUEST': '_viewRoot',
        }

        resp = session.get(f"{url}?idProcesso={id_processo}", timeout=60)
        print(f"    Status: {resp.status_code}, Tamanho: {len(resp.text)} bytes")

        if resp.status_code == 200:
            # Salvar HTML dos autos
            autos_file = download_dir / "autos_digitais.html"
            with open(autos_file, 'w', encoding='utf-8') as f:
                f.write(resp.text)
            print(f"    HTML dos autos salvo: {autos_file}")

            # Extrair documentos
            docs = re.findall(r'idDocumento["\':=\s]+(\d+)', resp.text)
            docs.extend(re.findall(r'idProcessoDocumento["\':=\s]+(\d+)', resp.text))
            docs.extend(re.findall(r'documento/(\d{6,})', resp.text))

            docs = list(set(docs))
            print(f"    Documentos nos autos: {len(docs)}")
            return docs

    except Exception as e:
        print(f"    Erro: {e}")

    return []


def baixar_documento(session, doc_id, download_dir, id_processo):
    """Baixa um documento."""
    base_url = "https://pje.tjdft.jus.br"

    urls = [
        f"{base_url}/pje/seam/resource/rest/pje-legacy/documento/download/TJDFT/1g/{id_processo}/{doc_id}",
        f"{base_url}/pje/Documento/download/{doc_id}",
        f"{base_url}/pje/seam/resource/rest/documento/download/{doc_id}",
    ]

    for url in urls:
        try:
            resp = session.get(url, timeout=60, stream=True)

            if resp.status_code == 200:
                content_type = resp.headers.get('content-type', '')
                content_length = len(resp.content)

                if content_length > 500:  # Arquivo válido
                    # Determinar extensão
                    ext = '.pdf'
                    if 'html' in content_type:
                        ext = '.html'
                    elif 'text' in content_type:
                        ext = '.txt'

                    arquivo = download_dir / f"doc_{doc_id}{ext}"
                    with open(arquivo, 'wb') as f:
                        f.write(resp.content)

                    return content_length

        except Exception as e:
            pass

    return 0


def gerar_faixa_ids(id_processo):
    """Gera faixa de IDs de documentos para tentar."""
    # Baseado na experiência, IDs de documentos geralmente estão em faixas próximas
    # Processo ID 4388248 - documentos provavelmente começam em faixa similar

    # Tentar algumas faixas baseadas no ID do processo
    base_id = int(str(id_processo)[:4]) * 10000  # Ex: 4388 -> 43880000

    ids = []

    # Faixas comuns de documentos
    faixas = [
        (250000000, 260000000, 100000),  # Faixa alta
        (230000000, 240000000, 100000),
        (id_processo * 50, id_processo * 60, 10000),  # Baseado no processo
    ]

    return ids


def main():
    numero_processo = sys.argv[1] if len(sys.argv) > 1 else "0754806-50.2025.8.07.0016"
    id_processo = sys.argv[2] if len(sys.argv) > 2 else "4388248"

    print("=" * 70)
    print("   BAIXAR DOCUMENTOS COM ID DO PROCESSO")
    print("=" * 70)
    print(f"\n   Processo: {numero_processo}")
    print(f"   ID: {id_processo}")

    # Criar pasta
    download_dir = DOWNLOADS_BASE / numero_processo
    download_dir.mkdir(parents=True, exist_ok=True)
    print(f"   Pasta: {download_dir}")

    # Carregar sessão
    session_data = carregar_sessao()
    if not session_data:
        print("\n   ERRO: Sessão não encontrada!")
        return

    session = criar_sessao(session_data)

    # Buscar documentos
    documentos = buscar_documentos_do_processo(session, id_processo)

    # Acessar autos digitais
    docs_autos = acessar_autos_digitais(session, id_processo, download_dir)
    documentos.extend(docs_autos)
    documentos = list(set(documentos))

    if documentos:
        print(f"\n[3] Baixando {len(documentos)} documentos...")

        baixados = 0
        falhas = 0

        for i, doc_id in enumerate(documentos):
            tamanho = baixar_documento(session, doc_id, download_dir, id_processo)
            if tamanho > 0:
                baixados += 1
                print(f"    [{i+1}/{len(documentos)}] doc_{doc_id}.pdf ({tamanho//1024} KB)")
            else:
                falhas += 1

            # Progresso a cada 10
            if (i + 1) % 10 == 0:
                print(f"    --- Progresso: {i+1}/{len(documentos)} ---")

        print(f"\n   Baixados: {baixados}")
        print(f"   Falhas: {falhas}")

    else:
        print("\n   Nenhum ID de documento encontrado automaticamente.")
        print("\n   Tentando buscar documentos via página de autos...")

        # Tentar acessar página de autos diretamente
        autos_url = f"https://pje.tjdft.jus.br/pje/Processo/ConsultaProcesso/Documentos/listView.seam"
        resp = session.get(autos_url, params={'idProcesso': id_processo}, timeout=60)

        if resp.status_code == 200:
            # Salvar para análise
            with open(download_dir / "autos_page.html", 'w', encoding='utf-8') as f:
                f.write(resp.text)
            print(f"   Página de autos salva para análise manual.")

    # Resumo
    pdfs = list(download_dir.glob("*.pdf"))
    print(f"\n   PDFs na pasta: {len(pdfs)}")

    print("\n" + "=" * 70)


if __name__ == "__main__":
    main()
