# -*- coding: utf-8 -*-
"""
buscar_processo_pje.py
Busca processo no PJe via API e retorna ID para download.
"""

import requests
import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
SESSION_FILE = SCRIPT_DIR / "session_pje.json"

def carregar_sessao():
    """Carrega cookies da sessão."""
    if not SESSION_FILE.exists():
        return None
    with open(SESSION_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def criar_sessao_requests(session_data):
    """Cria sessão requests com cookies."""
    s = requests.Session()
    s.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    })
    for name, value in session_data['cookies'].items():
        s.cookies.set(name, value, domain='pje.tjdft.jus.br')
    return s

def buscar_processo_consulta_publica(numero_processo):
    """Busca via consulta pública (não requer login)."""
    print(f"\n[1] Tentando consulta pública...")

    # Formatar número do processo
    numero_limpo = re.sub(r'[^0-9]', '', numero_processo)

    urls = [
        f"https://pje.tjdft.jus.br/pje/ConsultaPublica/DetalheProcessoConsultaPublica/listView.seam?numeroProcesso={numero_processo}",
        f"https://pje.tjdft.jus.br/pje/ConsultaPublica/listView.seam",
    ]

    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })

    for url in urls:
        try:
            resp = session.get(url, timeout=30)
            print(f"    URL: {url[:60]}...")
            print(f"    Status: {resp.status_code}")
            if resp.status_code == 200 and 'processo' in resp.text.lower():
                return resp.text
        except Exception as e:
            print(f"    Erro: {e}")

    return None

def buscar_processo_api(session, numero_processo):
    """Busca processo via API REST do PJe."""
    print(f"\n[2] Tentando API REST autenticada...")

    numero_limpo = re.sub(r'[^0-9]', '', numero_processo)

    # Diferentes endpoints de API
    endpoints = [
        f"/pje/api/v1/processo/{numero_processo}",
        f"/pje/api/v1/processos?numero={numero_processo}",
        f"/pje/seam/resource/rest/processo/consulta?numeroProcesso={numero_processo}",
        f"/pje/seam/resource/rest/pje-legacy/processo/dadosBasicos/{numero_limpo}",
        f"/pje/seam/resource/rest/pje-legacy/processo/consultarPorNumero/{numero_processo}",
        "/pje/Processo/list.seam",
        "/pje/Painel/painel.seam",
    ]

    base_url = "https://pje.tjdft.jus.br"

    for endpoint in endpoints:
        try:
            url = base_url + endpoint
            print(f"    Tentando: {endpoint[:50]}...")
            resp = session.get(url, timeout=30)
            print(f"    Status: {resp.status_code}")

            if resp.status_code == 200:
                content_type = resp.headers.get('content-type', '')
                if 'json' in content_type:
                    data = resp.json()
                    print(f"    Resposta JSON: {str(data)[:200]}")
                    return data
                elif len(resp.text) > 100:
                    # Procurar ID do processo no HTML
                    matches = re.findall(r'idProcesso["\s:=]+(\d+)', resp.text)
                    if matches:
                        print(f"    IDs encontrados: {matches[:5]}")
                        return {'ids': matches}
        except Exception as e:
            print(f"    Erro: {e}")

    return None

def buscar_via_pesquisa(session, numero_processo):
    """Busca usando a pesquisa do painel."""
    print(f"\n[3] Tentando pesquisa no painel...")

    base_url = "https://pje.tjdft.jus.br"

    # Primeiro, acessar o painel para obter tokens
    try:
        resp = session.get(f"{base_url}/pje/Painel/painel.seam", timeout=30)
        print(f"    Painel status: {resp.status_code}")

        # Extrair ViewState se existir
        viewstate_match = re.search(r'javax\.faces\.ViewState["\s:value=]+([^"&]+)', resp.text)
        if viewstate_match:
            print(f"    ViewState encontrado")

        # Procurar por processos no painel
        processo_matches = re.findall(r'(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})', resp.text)
        if processo_matches:
            print(f"    Processos no painel: {len(set(processo_matches))}")

        # Buscar IDs de processo
        id_matches = re.findall(r'idProcessoDocumento["\s:=]+(\d+)', resp.text)
        if id_matches:
            print(f"    IDs de documentos: {len(set(id_matches))}")

    except Exception as e:
        print(f"    Erro: {e}")

    # Tentar pesquisa
    search_endpoints = [
        "/pje/Processo/pesquisar.seam",
        "/pje/seam/resource/rest/pesquisa/processo",
    ]

    for endpoint in search_endpoints:
        try:
            # POST com dados de pesquisa
            data = {
                'numeroProcesso': numero_processo,
                'pesquisar': 'Pesquisar'
            }
            resp = session.post(f"{base_url}{endpoint}", data=data, timeout=30)
            print(f"    Pesquisa {endpoint}: {resp.status_code}")

            if resp.status_code == 200:
                # Procurar ID do processo
                matches = re.findall(r'idProcesso["\s:=]+(\d+)', resp.text)
                if matches:
                    print(f"    IDs encontrados: {matches[:5]}")
                    return matches[0]
        except Exception as e:
            print(f"    Erro: {e}")

    return None

def extrair_id_processo_do_numero(numero_processo):
    """Tenta derivar o ID do número do processo."""
    print(f"\n[4] Tentando derivar ID do número...")

    # Padrão: NNNNNNN-DD.AAAA.J.TR.OOOO
    # Exemplo: 0754806-50.2025.8.07.0016

    match = re.match(r'(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})', numero_processo)
    if match:
        sequencial = match.group(1)  # 0754806
        digito = match.group(2)       # 50
        ano = match.group(3)          # 2025
        justica = match.group(4)      # 8
        tribunal = match.group(5)     # 07
        origem = match.group(6)       # 0016

        print(f"    Sequencial: {sequencial}")
        print(f"    Ano: {ano}")
        print(f"    Tribunal: {tribunal} (TJDFT)")
        print(f"    Origem: {origem}")

        # IDs geralmente são sequenciais, podemos tentar estimar
        # baseado no processo anterior que sabemos: 0738732-18.2025.807.0016 -> ID ~4314564

        return {
            'sequencial': int(sequencial),
            'ano': int(ano),
            'tribunal': tribunal,
            'origem': origem
        }
    return None

def buscar_documentos_direto(session, numero_processo):
    """Tenta buscar documentos diretamente."""
    print(f"\n[5] Buscando documentos diretamente...")

    base_url = "https://pje.tjdft.jus.br"

    # Tentar diferentes padrões de URL de documentos
    endpoints = [
        f"/pje/Processo/ConsultaProcesso/Documentos/list.seam?numeroProcesso={numero_processo}",
        f"/pje/seam/resource/rest/pje-legacy/processo/documentos?numeroProcesso={numero_processo}",
    ]

    for endpoint in endpoints:
        try:
            url = base_url + endpoint
            resp = session.get(url, timeout=30)
            print(f"    {endpoint[:50]}... Status: {resp.status_code}")

            if resp.status_code == 200:
                # Procurar IDs de documentos
                doc_matches = re.findall(r'documento[/=](\d+)', resp.text)
                if doc_matches:
                    print(f"    Documentos encontrados: {len(set(doc_matches))}")
                    return list(set(doc_matches))
        except Exception as e:
            print(f"    Erro: {e}")

    return None

def main():
    numero_processo = sys.argv[1] if len(sys.argv) > 1 else "0754806-50.2025.8.07.0016"

    print("=" * 70)
    print("   BUSCAR PROCESSO NO PJe")
    print("=" * 70)
    print(f"\n   Processo: {numero_processo}")

    # Carregar sessão
    session_data = carregar_sessao()
    if not session_data:
        print("\n   ERRO: Sessão não encontrada!")
        return None

    session = criar_sessao_requests(session_data)
    print(f"   Sessão carregada: {len(session_data['cookies'])} cookies")

    # Tentar diferentes métodos
    resultado = None

    # Método 1: Consulta pública
    resultado = buscar_processo_consulta_publica(numero_processo)

    # Método 2: API REST
    if not resultado:
        resultado = buscar_processo_api(session, numero_processo)

    # Método 3: Pesquisa no painel
    if not resultado:
        resultado = buscar_via_pesquisa(session, numero_processo)

    # Método 4: Análise do número
    info = extrair_id_processo_do_numero(numero_processo)

    # Método 5: Documentos diretos
    docs = buscar_documentos_direto(session, numero_processo)

    print("\n" + "=" * 70)
    if resultado or docs:
        print("   RESULTADO DA BUSCA")
        if resultado:
            print(f"   Dados: {str(resultado)[:200]}")
        if docs:
            print(f"   Documentos: {len(docs)}")
    else:
        print("   NENHUM RESULTADO AUTOMÁTICO")
        print("\n   O PJe requer navegação autenticada para acessar processos.")
        print("   Capture um HAR navegando pelo processo desejado.")
    print("=" * 70)

    return resultado

if __name__ == "__main__":
    main()
