# -*- coding: utf-8 -*-
"""
pje_extrair_id.py
Extrai ID do processo e baixa documentos.
"""

import requests
import json
import re
import sys
from pathlib import Path
from bs4 import BeautifulSoup

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
    })
    for name, value in session_data['cookies'].items():
        s.cookies.set(name, value, domain='pje.tjdft.jus.br')
    return s


def acessar_consulta_processo(session, numero_processo):
    """Acessa a página de consulta do processo e extrai informações."""
    print(f"\n[1] Acessando página do processo...")

    url = f"https://pje.tjdft.jus.br/pje/Processo/ConsultaProcesso/listView.seam"
    params = {'numeroProcesso': numero_processo}

    resp = session.get(url, params=params, timeout=60)
    print(f"    Status: {resp.status_code}")
    print(f"    Tamanho: {len(resp.text)} bytes")

    if resp.status_code == 200:
        # Salvar HTML para análise
        html_file = DOWNLOADS_BASE / numero_processo / "consulta_processo.html"
        html_file.parent.mkdir(parents=True, exist_ok=True)
        with open(html_file, 'w', encoding='utf-8') as f:
            f.write(resp.text)
        print(f"    HTML salvo: {html_file}")

        return resp.text

    return None


def extrair_ids_do_html(html):
    """Extrai todos os IDs relevantes do HTML."""
    print(f"\n[2] Extraindo IDs do HTML...")

    ids_encontrados = {
        'idProcesso': [],
        'idProcessoDocumento': [],
        'idDocumento': [],
        'outros': []
    }

    # Padrões de busca
    padroes = {
        'idProcesso': [
            r'idProcesso["\':=\s]+(\d+)',
            r'processo\.id["\':=\s]+(\d+)',
            r'processoTrf["\':=\s]+(\d+)',
        ],
        'idProcessoDocumento': [
            r'idProcessoDocumento["\':=\s]+(\d+)',
        ],
        'idDocumento': [
            r'idDocumento["\':=\s]+(\d+)',
            r'documento/(\d+)',
            r'documentoId["\':=\s]+(\d+)',
        ]
    }

    for tipo, patterns in padroes.items():
        for pattern in patterns:
            matches = re.findall(pattern, html, re.IGNORECASE)
            ids_encontrados[tipo].extend(matches)

    # Remover duplicatas
    for tipo in ids_encontrados:
        ids_encontrados[tipo] = list(set(ids_encontrados[tipo]))

    # Resumo
    for tipo, ids in ids_encontrados.items():
        if ids:
            print(f"    {tipo}: {len(ids)} IDs - {ids[:5]}...")

    return ids_encontrados


def extrair_links_documentos(html):
    """Extrai links de documentos do HTML."""
    print(f"\n[3] Extraindo links de documentos...")

    links = []

    # Procurar hrefs com documento
    doc_patterns = [
        r'href="([^"]*documento[^"]*)"',
        r'href="([^"]*download[^"]*)"',
        r'onclick="[^"]*documento[^"]*(\d+)[^"]*"',
    ]

    for pattern in doc_patterns:
        matches = re.findall(pattern, html, re.IGNORECASE)
        links.extend(matches)

    links = list(set(links))
    print(f"    Links encontrados: {len(links)}")

    return links


def acessar_autos(session, numero_processo):
    """Tenta acessar a árvore de autos do processo."""
    print(f"\n[4] Tentando acessar autos do processo...")

    # Diferentes endpoints para autos
    endpoints = [
        f"/pje/Processo/ConsultaProcesso/Documentos/listView.seam?numeroProcesso={numero_processo}",
        f"/pje/Processo/ConsultaProcesso/DocumentosJuntados/listView.seam?numeroProcesso={numero_processo}",
        f"/pje/Processo/autos.seam?numeroProcesso={numero_processo}",
    ]

    base = "https://pje.tjdft.jus.br"

    for endpoint in endpoints:
        try:
            url = base + endpoint
            resp = session.get(url, timeout=30)
            print(f"    {endpoint[:50]}... Status: {resp.status_code}")

            if resp.status_code == 200 and len(resp.text) > 5000:
                print(f"    Conteúdo recebido: {len(resp.text)} bytes")

                # Extrair documentos
                docs = re.findall(r'documento[/=](\d+)', resp.text)
                if docs:
                    print(f"    Documentos encontrados: {len(set(docs))}")
                    return list(set(docs))

        except Exception as e:
            print(f"    Erro: {e}")

    return []


def baixar_documento(session, doc_id, download_dir, id_processo=None):
    """Baixa um documento."""
    base = "https://pje.tjdft.jus.br"

    urls = [
        f"{base}/pje/seam/resource/rest/pje-legacy/documento/download/TJDFT/1g/{id_processo}/{doc_id}" if id_processo else None,
        f"{base}/pje/Documento/download/{doc_id}",
        f"{base}/pje/seam/resource/rest/documento/{doc_id}",
    ]

    for url in [u for u in urls if u]:
        try:
            resp = session.get(url, timeout=60, stream=True)
            if resp.status_code == 200 and len(resp.content) > 500:
                arquivo = download_dir / f"doc_{doc_id}.pdf"
                with open(arquivo, 'wb') as f:
                    f.write(resp.content)
                return len(resp.content)
        except:
            pass

    return 0


def main():
    numero_processo = sys.argv[1] if len(sys.argv) > 1 else "0754806-50.2025.8.07.0016"

    print("=" * 70)
    print("   EXTRAIR ID E BAIXAR DOCUMENTOS")
    print("=" * 70)
    print(f"\n   Processo: {numero_processo}")

    # Criar pasta
    download_dir = DOWNLOADS_BASE / numero_processo
    download_dir.mkdir(parents=True, exist_ok=True)

    # Carregar sessão
    session_data = carregar_sessao()
    if not session_data:
        print("\n   ERRO: Sessão não encontrada!")
        return

    session = criar_sessao(session_data)

    # Acessar consulta do processo
    html = acessar_consulta_processo(session, numero_processo)

    if html:
        # Extrair IDs
        ids = extrair_ids_do_html(html)

        # Extrair links
        links = extrair_links_documentos(html)

        # Acessar autos
        docs_autos = acessar_autos(session, numero_processo)

        # Tentar baixar documentos encontrados
        todos_docs = []
        todos_docs.extend(ids.get('idDocumento', []))
        todos_docs.extend(ids.get('idProcessoDocumento', []))
        todos_docs.extend(docs_autos)
        todos_docs = list(set(todos_docs))

        if todos_docs:
            print(f"\n[5] Baixando {len(todos_docs)} documentos...")

            id_processo = ids.get('idProcesso', [None])[0]

            baixados = 0
            for i, doc_id in enumerate(todos_docs[:20]):  # Testar com 20
                tamanho = baixar_documento(session, doc_id, download_dir, id_processo)
                if tamanho > 0:
                    baixados += 1
                    print(f"    [{i+1}] doc_{doc_id}.pdf ({tamanho//1024} KB)")

            print(f"\n   Documentos baixados: {baixados}/{len(todos_docs)}")
        else:
            print("\n   Nenhum documento encontrado para download.")

    # Verificar arquivos baixados
    pdfs = list(download_dir.glob("*.pdf"))
    print(f"\n   PDFs na pasta: {len(pdfs)}")

    print("\n" + "=" * 70)


if __name__ == "__main__":
    main()
