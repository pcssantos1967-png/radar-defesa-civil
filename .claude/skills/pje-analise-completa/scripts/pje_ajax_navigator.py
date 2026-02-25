# -*- coding: utf-8 -*-
"""
pje_ajax_navigator.py
Navega no PJe simulando requisições AJAX para acessar documentos.
"""

import requests
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlencode

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
        'Content-Type': 'application/x-www-form-urlencoded',
    })
    for name, value in session_data['cookies'].items():
        s.cookies.set(name, value, domain='pje.tjdft.jus.br')
    return s


def extrair_viewstate(html):
    """Extrai o javax.faces.ViewState do HTML."""
    match = re.search(r'name="javax\.faces\.ViewState"[^>]+value="([^"]+)"', html)
    if match:
        return match.group(1)
    return None


def selecionar_processo(session, id_processo, html_consulta):
    """Simula a seleção do processo via AJAX."""
    print(f"\n[1] Selecionando processo ID {id_processo}...")

    base_url = "https://pje.tjdft.jus.br"
    url = f"{base_url}/pje/Processo/ConsultaProcesso/listView.seam"

    # Extrair ViewState
    viewstate = extrair_viewstate(html_consulta)
    print(f"    ViewState: {viewstate[:30] if viewstate else 'Não encontrado'}...")

    # Simular clique para selecionar processo (baseado no onclick encontrado)
    # onclick: A4J.AJAX.Submit('fPP',event,{'parameters':{'idProcessoSelecionado':4388248,...}})

    data = {
        'fPP': 'fPP',
        'autoScroll': '',
        'javax.faces.ViewState': viewstate,
        'idProcessoSelecionado': id_processo,
        'ajaxSingle': f'fPP:processosTable:{id_processo}:j_id494',
        f'fPP:processosTable:{id_processo}:j_id494': f'fPP:processosTable:{id_processo}:j_id494',
        'AJAXREQUEST': 'fPP',
    }

    headers = {
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': url,
    }

    try:
        resp = session.post(url, data=data, headers=headers, timeout=60)
        print(f"    Status: {resp.status_code}, Tamanho: {len(resp.text)} bytes")

        if resp.status_code == 200:
            # Verificar se abriu detalhes do processo
            if 'Autos' in resp.text or 'documento' in resp.text.lower():
                print(f"    Processo selecionado com sucesso!")
                return resp.text

    except Exception as e:
        print(f"    Erro: {e}")

    return None


def acessar_detalhes_processo(session, id_processo):
    """Acessa a página de detalhes do processo."""
    print(f"\n[2] Acessando detalhes do processo...")

    base_url = "https://pje.tjdft.jus.br"

    # Diferentes URLs para acessar detalhes
    urls = [
        f"{base_url}/pje/Processo/ConsultaProcesso/Documentos/listView.seam?idProcessoTrf={id_processo}",
        f"{base_url}/pje/Processo/ConsultaProcesso/listView.seam?idProcessoTrf={id_processo}&conversationPropagation=begin",
        f"{base_url}/pje/Processo/Autos/paginaAutos.seam?idProcessoTrf={id_processo}",
        f"{base_url}/pje/Painel/painel.seam?idProcessoTrf={id_processo}",
    ]

    for url in urls:
        try:
            print(f"    Tentando: {url.split('?')[0].split('/')[-1]}...")
            resp = session.get(url, timeout=60)

            if resp.status_code == 200 and len(resp.text) > 10000:
                print(f"    Status: {resp.status_code}, Tamanho: {len(resp.text)} bytes")

                # Procurar documentos
                docs = []
                patterns = [
                    r'idDocumento["\':=\s]+(\d{6,})',
                    r'idProcessoDocumento["\':=\s]+(\d{6,})',
                    r'download[^"]*?/(\d{6,})',
                ]

                for pattern in patterns:
                    matches = re.findall(pattern, resp.text)
                    docs.extend(matches)

                if docs:
                    docs = list(set(docs))
                    print(f"    Documentos encontrados: {len(docs)}")
                    return docs, resp.text

        except Exception as e:
            print(f"    Erro: {e}")

    return [], None


def navegar_ate_autos(session, numero_processo, id_processo, download_dir):
    """Navegação completa até os autos do processo."""
    print(f"\n[3] Navegando até os autos...")

    base_url = "https://pje.tjdft.jus.br"

    # 1. Acessar página de consulta com número do processo
    url = f"{base_url}/pje/Processo/ConsultaProcesso/listView.seam?numeroProcesso={numero_processo}"

    try:
        resp = session.get(url, timeout=60)
        print(f"    Consulta: Status {resp.status_code}")

        if resp.status_code == 200:
            # Procurar link de acesso aos autos
            # Geralmente há um link como "Ver Autos" ou "Acessar processo"

            # Procurar por links com idProcessoTrf
            links = re.findall(r'href="([^"]+idProcessoTrf=' + str(id_processo) + r'[^"]*)"', resp.text)
            if links:
                print(f"    Links para o processo: {len(links)}")
                for link in links[:3]:
                    print(f"      - {link[:60]}...")

            # Procurar por onclick que abra os autos
            autos_onclick = re.findall(r'onclick="[^"]*autos[^"]*"', resp.text, re.IGNORECASE)
            if autos_onclick:
                print(f"    Eventos de autos: {len(autos_onclick)}")

            # Salvar HTML para análise
            with open(download_dir / "navegacao_consulta.html", 'w', encoding='utf-8') as f:
                f.write(resp.text)

            return resp.text

    except Exception as e:
        print(f"    Erro: {e}")

    return None


def buscar_documentos_por_api(session, id_processo):
    """Tenta buscar documentos via endpoints de API."""
    print(f"\n[4] Buscando documentos via API...")

    base_url = "https://pje.tjdft.jus.br"

    endpoints = [
        f"/pje/seam/resource/rest/pje-legacy/processo/{id_processo}/documentos",
        f"/pje/seam/resource/rest/pje-legacy/processoTrf/{id_processo}/documentos",
        f"/pje/seam/resource/rest/processo/{id_processo}/movimentos",
        f"/pje/api/processo/{id_processo}/documentos",
    ]

    for endpoint in endpoints:
        try:
            url = base_url + endpoint
            resp = session.get(url, timeout=30)
            print(f"    {endpoint.split('/')[-2]}/{endpoint.split('/')[-1]}: {resp.status_code}")

            if resp.status_code == 200:
                # Tentar parsear JSON
                try:
                    data = resp.json()
                    print(f"    JSON recebido: {type(data)}")
                    if isinstance(data, list):
                        print(f"    Itens: {len(data)}")
                    return data
                except:
                    # Procurar IDs no texto
                    docs = re.findall(r'idDocumento["\':=\s]+(\d+)', resp.text)
                    if docs:
                        print(f"    IDs encontrados: {len(set(docs))}")
                        return list(set(docs))

        except Exception as e:
            print(f"    Erro: {e}")

    return None


def baixar_documento(session, doc_id, download_dir, id_processo):
    """Baixa um documento específico."""
    base_url = "https://pje.tjdft.jus.br"

    urls = [
        f"{base_url}/pje/seam/resource/rest/pje-legacy/documento/download/TJDFT/1g/{id_processo}/{doc_id}",
        f"{base_url}/pje/seam/resource/rest/documento/download/{doc_id}",
    ]

    for url in urls:
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
    id_processo = sys.argv[2] if len(sys.argv) > 2 else "4388248"

    print("=" * 70)
    print("   PJe NAVEGADOR AJAX")
    print("=" * 70)
    print(f"\n   Processo: {numero_processo}")
    print(f"   ID: {id_processo}")

    download_dir = DOWNLOADS_BASE / numero_processo
    download_dir.mkdir(parents=True, exist_ok=True)

    session_data = carregar_sessao()
    if not session_data:
        print("\n   ERRO: Sessão não encontrada!")
        return

    session = criar_sessao(session_data)

    # Carregar HTML da consulta se existir
    html_consulta = ""
    consulta_file = download_dir / "consulta_processo.html"
    if consulta_file.exists():
        with open(consulta_file, 'r', encoding='utf-8') as f:
            html_consulta = f.read()

    # Tentar selecionar processo
    if html_consulta:
        selecionar_processo(session, id_processo, html_consulta)

    # Acessar detalhes
    docs, html = acessar_detalhes_processo(session, id_processo)

    # Navegar até autos
    if not docs:
        navegar_ate_autos(session, numero_processo, id_processo, download_dir)

    # Buscar via API
    if not docs:
        api_result = buscar_documentos_por_api(session, id_processo)
        if isinstance(api_result, list):
            docs = api_result

    # Baixar documentos encontrados
    if docs:
        print(f"\n[5] Baixando {len(docs)} documentos...")
        baixados = 0
        for i, doc_id in enumerate(docs[:50]):
            tamanho = baixar_documento(session, doc_id, download_dir, id_processo)
            if tamanho > 0:
                baixados += 1
                print(f"    [{i+1}] doc_{doc_id}.pdf ({tamanho//1024} KB)")
        print(f"\n   Baixados: {baixados}")

    # Resumo
    pdfs = list(download_dir.glob("*.pdf"))
    print(f"\n   PDFs na pasta: {len(pdfs)}")
    print("=" * 70)


if __name__ == "__main__":
    main()
