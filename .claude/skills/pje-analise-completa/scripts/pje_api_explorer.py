# -*- coding: utf-8 -*-
"""
pje_api_explorer.py
Explora a API do PJe para encontrar processos e documentos.
"""

import requests
import json
import re
import sys
from pathlib import Path
from urllib.parse import urljoin

SCRIPT_DIR = Path(__file__).parent
SESSION_FILE = SCRIPT_DIR / "session_pje.json"
DOWNLOADS_BASE = Path(r"C:\AGÊNTICO")


def carregar_sessao():
    """Carrega cookies da sessão."""
    if not SESSION_FILE.exists():
        return None
    with open(SESSION_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def criar_sessao(session_data):
    """Cria sessão requests."""
    s = requests.Session()
    s.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Connection': 'keep-alive',
        'Referer': 'https://pje.tjdft.jus.br/pje/',
    })

    for name, value in session_data['cookies'].items():
        s.cookies.set(name, value, domain='pje.tjdft.jus.br')
        s.cookies.set(name, value, domain='.tjdft.jus.br')

    return s


def explorar_painel(session):
    """Acessa o painel e extrai informações."""
    print("\n[1] Acessando painel do PJe...")

    urls = [
        "https://pje.tjdft.jus.br/pje/Painel/painel.seam",
        "https://pje.tjdft.jus.br/pje/home.seam",
        "https://pje.tjdft.jus.br/pje/Processo/list.seam",
    ]

    for url in urls:
        try:
            resp = session.get(url, timeout=30, allow_redirects=False)
            print(f"    {url}: Status {resp.status_code}")

            if resp.status_code == 200:
                # Extrair processos da página
                processos = re.findall(r'(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})', resp.text)
                if processos:
                    print(f"    Processos encontrados: {len(set(processos))}")
                    for p in list(set(processos))[:5]:
                        print(f"      - {p}")

                # Extrair IDs de processo
                ids = re.findall(r'idProcesso["\':=\s]+(\d+)', resp.text)
                if ids:
                    print(f"    IDs de processo: {ids[:5]}")

                return resp.text

            elif resp.status_code in [301, 302, 303]:
                redirect = resp.headers.get('Location', '')
                print(f"    Redirecionando para: {redirect[:60]}...")

        except Exception as e:
            print(f"    Erro: {e}")

    return None


def buscar_processo_endpoint(session, numero_processo):
    """Tenta múltiplos endpoints para buscar o processo."""
    print(f"\n[2] Buscando processo via API...")

    base = "https://pje.tjdft.jus.br"
    numero_limpo = re.sub(r'[^0-9]', '', numero_processo)

    endpoints = [
        # Endpoints REST
        f"/pje/seam/resource/rest/pje-legacy/processo/{numero_limpo}",
        f"/pje/seam/resource/rest/processo/{numero_processo}",
        f"/pje/api/processo/{numero_processo}",

        # Endpoints de consulta
        f"/pje/ConsultaPublica/DetalheProcessoConsultaPublica/listView.seam?numeroProcesso={numero_processo}",
        f"/pje/Processo/ConsultaProcesso/listView.seam?numeroProcesso={numero_processo}",

        # Busca
        f"/pje/seam/resource/rest/pesquisaProcesso?numeroProcesso={numero_processo}",
    ]

    for endpoint in endpoints:
        try:
            url = base + endpoint
            resp = session.get(url, timeout=30, allow_redirects=False)

            if resp.status_code == 200:
                print(f"    SUCESSO: {endpoint[:50]}...")

                # Tentar extrair dados
                if 'json' in resp.headers.get('content-type', ''):
                    data = resp.json()
                    print(f"    JSON: {str(data)[:200]}")
                    return data
                else:
                    # Procurar ID do processo no HTML
                    id_match = re.search(r'idProcesso["\':=\s]+(\d+)', resp.text)
                    if id_match:
                        processo_id = id_match.group(1)
                        print(f"    ID do processo encontrado: {processo_id}")
                        return {'id': processo_id}

                    # Verificar se o processo está na página
                    if numero_processo in resp.text:
                        print(f"    Processo encontrado na página")
                        return {'html': resp.text}

            elif resp.status_code != 404:
                print(f"    {endpoint[:40]}... Status {resp.status_code}")

        except Exception as e:
            print(f"    Erro em {endpoint[:30]}: {e}")

    return None


def tentar_ids_sequenciais(session, numero_processo, download_dir):
    """Tenta encontrar documentos baseado em IDs sequenciais."""
    print(f"\n[3] Tentando IDs sequenciais...")

    # Baseado no processo anterior: 0738732-18.2025.807.0016
    # O ID do processo era algo como 4314564
    # O novo processo é: 0754806-50.2025.8.07.0016

    # Diferença no número sequencial: 754806 - 738732 = 16074
    # Estimativa de ID: 4314564 + (proporcional)

    base_url = "https://pje.tjdft.jus.br"
    id_processo_anterior = 4314564
    seq_anterior = 738732
    seq_novo = 754806

    # Estimar ID do novo processo
    diferenca = seq_novo - seq_anterior
    id_estimado = id_processo_anterior + diferenca

    print(f"    Processo anterior: 0738732 -> ID ~4314564")
    print(f"    Processo novo: 0754806")
    print(f"    ID estimado: ~{id_estimado}")

    # Tentar uma faixa de IDs
    range_start = id_estimado - 5000
    range_end = id_estimado + 5000

    print(f"    Tentando faixa: {range_start} a {range_end}")

    # Primeiro, testar se o ID estimado funciona
    test_ids = [id_estimado, id_estimado + 1000, id_estimado - 1000]

    for test_id in test_ids:
        url = f"{base_url}/pje/seam/resource/rest/pje-legacy/documento/download/TJDFT/1g/{test_id}/0"
        try:
            resp = session.head(url, timeout=10)
            print(f"    ID {test_id}: {resp.status_code}")
            if resp.status_code == 200:
                print(f"    ENCONTRADO ID VÁLIDO: {test_id}")
                return test_id
        except:
            pass

    return None


def consulta_publica(numero_processo):
    """Tenta consulta pública sem autenticação."""
    print(f"\n[4] Tentando consulta pública (sem login)...")

    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    })

    url = f"https://pje.tjdft.jus.br/pje/ConsultaPublica/DetalheProcessoConsultaPublica/listView.seam"
    params = {'numeroProcesso': numero_processo}

    try:
        resp = session.get(url, params=params, timeout=30)
        print(f"    Status: {resp.status_code}")

        if resp.status_code == 200:
            # Verificar se encontrou o processo
            if numero_processo in resp.text or 'processo' in resp.text.lower():
                print(f"    Processo acessível via consulta pública!")

                # Extrair informações
                titulo_match = re.search(r'<title>([^<]+)</title>', resp.text)
                if titulo_match:
                    print(f"    Título: {titulo_match.group(1)}")

                # Procurar documentos públicos
                docs = re.findall(r'documento[/=](\d+)', resp.text)
                if docs:
                    print(f"    Documentos públicos: {len(set(docs))}")
                    return list(set(docs))

                return {'html': resp.text}

    except Exception as e:
        print(f"    Erro: {e}")

    return None


def listar_processos_recentes(session):
    """Lista processos recentes no painel."""
    print(f"\n[5] Listando processos recentes...")

    url = "https://pje.tjdft.jus.br/pje/Painel/painel.seam"

    try:
        resp = session.get(url, timeout=30)

        if resp.status_code == 200:
            # Extrair todos os processos
            processos = re.findall(r'(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})', resp.text)
            processos_unicos = list(set(processos))

            if processos_unicos:
                print(f"    Processos no painel: {len(processos_unicos)}")
                for p in processos_unicos[:10]:
                    print(f"      - {p}")

                # Mapear processos para IDs
                for proc in processos_unicos:
                    # Procurar ID associado
                    pattern = rf'{proc}.*?idProcesso["\':=\s]+(\d+)'
                    match = re.search(pattern, resp.text, re.DOTALL)
                    if match:
                        print(f"      {proc} -> ID: {match.group(1)}")

                return processos_unicos

    except Exception as e:
        print(f"    Erro: {e}")

    return []


def main():
    numero_processo = sys.argv[1] if len(sys.argv) > 1 else "0754806-50.2025.8.07.0016"

    print("=" * 70)
    print("   PJe API EXPLORER")
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
    print(f"   Cookies carregados: {len(session_data['cookies'])}")

    # Explorar painel
    html_painel = explorar_painel(session)

    # Buscar processo
    resultado = buscar_processo_endpoint(session, numero_processo)

    # Consulta pública
    docs_publicos = consulta_publica(numero_processo)

    # Listar processos recentes
    processos = listar_processos_recentes(session)

    # Tentar IDs sequenciais
    id_encontrado = tentar_ids_sequenciais(session, numero_processo, download_dir)

    print("\n" + "=" * 70)
    print("   RESUMO")
    print("=" * 70)

    if resultado:
        print(f"   Dados encontrados: {type(resultado)}")
    if docs_publicos:
        print(f"   Documentos públicos: {len(docs_publicos) if isinstance(docs_publicos, list) else 'Sim'}")
    if processos:
        print(f"   Processos no painel: {len(processos)}")
    if id_encontrado:
        print(f"   ID do processo: {id_encontrado}")

    if not any([resultado, docs_publicos, id_encontrado]):
        print("\n   CONCLUSÃO:")
        print("   O PJe requer que o usuário navegue até o processo")
        print("   para capturar os IDs dos documentos no HAR.")
        print("\n   Para acessar este processo específico:")
        print("   1. Abra o Firefox com sua sessão do PJe")
        print("   2. Navegue até o processo 0754806-50.2025.8.07.0016")
        print("   3. Abra alguns documentos")
        print("   4. Salve o HAR e execute extrair_sessao_pje.py")

    print("=" * 70)


if __name__ == "__main__":
    main()
