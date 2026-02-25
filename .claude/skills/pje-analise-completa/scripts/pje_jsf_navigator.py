# -*- coding: utf-8 -*-
"""
pje_jsf_navigator.py
Navega no PJe simulando submissões JSF para abrir processo e baixar documentos.
"""

import requests
import json
import re
import sys
from pathlib import Path

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
        session.cookies.set(name, value, domain='pje.tjdft.jus.br')
    return s


def extrair_viewstate(html):
    match = re.search(r'javax\.faces\.ViewState["\s:value=]+([^"&\s]+)', html)
    return match.group(1) if match else None


def abrir_processo_post(session, id_processo, numero_processo):
    """Abre processo via POST simulando clique."""
    print(f"\n[1] Abrindo processo via POST...")

    base_url = "https://pje.tjdft.jus.br"

    # Primeiro, acessar a página de consulta para obter ViewState
    url = f"{base_url}/pje/Processo/ConsultaProcesso/listView.seam?numeroProcesso={numero_processo}"
    resp = session.get(url, timeout=60)
    print(f"    Consulta: {resp.status_code}")

    if resp.status_code != 200:
        return None

    viewstate = extrair_viewstate(resp.text)
    print(f"    ViewState: {viewstate[:30] if viewstate else 'N/A'}...")

    # Simular POST para abrir processo
    # Baseado no onclick: A4J.AJAX.Submit('fPP',event,{'parameters':{'idProcessoSelecionado':4388248...}})

    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': url,
        'X-Requested-With': 'XMLHttpRequest',
        'Faces-Request': 'partial/ajax',
    }

    # Tentar várias combinações de dados do formulário
    form_data_options = [
        # Opção 1: Simular clique no processo
        {
            'fPP': 'fPP',
            'javax.faces.ViewState': viewstate or 'j_id20',
            'idProcessoSelecionado': id_processo,
            f'fPP:processosTable:{id_processo}:j_id494': f'fPP:processosTable:{id_processo}:j_id494',
            'AJAXREQUEST': '_viewRoot',
        },
        # Opção 2: Abrir número do processo
        {
            'fPP': 'fPP',
            'javax.faces.ViewState': viewstate or 'j_id20',
            'idProcessoSelecionado': id_processo,
            f'fPP:processosTable:{id_processo}:j_id501': f'fPP:processosTable:{id_processo}:j_id501',
            'AJAXREQUEST': '_viewRoot',
        }
    ]

    for i, data in enumerate(form_data_options):
        try:
            resp = session.post(url, data=data, headers=headers, timeout=60)
            print(f"    POST opção {i+1}: {resp.status_code}, {len(resp.text)} bytes")

            if resp.status_code == 200 and len(resp.text) > 1000:
                # Verificar se há redirecionamento ou conteúdo de autos
                if 'autos' in resp.text.lower() or 'documento' in resp.text.lower():
                    print(f"    Conteúdo de autos/documentos encontrado!")
                    return resp.text

                # Procurar por URL de redirecionamento
                redirect_match = re.search(r'redirect["\s:]+([^"]+)', resp.text)
                if redirect_match:
                    print(f"    Redirect: {redirect_match.group(1)}")

        except Exception as e:
            print(f"    Erro: {e}")

    return None


def acessar_painel_advogado(session):
    """Acessa o painel do advogado que lista processos com links diretos."""
    print(f"\n[2] Acessando painel do advogado...")

    base_url = "https://pje.tjdft.jus.br"
    url = f"{base_url}/pje/Painel/painel_usuario/advogado.seam"

    try:
        resp = session.get(url, timeout=60)
        print(f"    Status: {resp.status_code}, Size: {len(resp.text)}")

        if resp.status_code == 200:
            # Salvar HTML
            download_dir = DOWNLOADS_BASE / sys.argv[1]
            download_dir.mkdir(parents=True, exist_ok=True)
            with open(download_dir / "painel_advogado.html", 'w', encoding='utf-8') as f:
                f.write(resp.text)

            # Procurar processos
            processos = re.findall(r'(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})', resp.text)
            print(f"    Processos no painel: {len(set(processos))}")

            # Procurar links para autos
            links_autos = re.findall(r'href="([^"]+autos[^"]*)"', resp.text, re.IGNORECASE)
            print(f"    Links de autos: {len(links_autos)}")

            return resp.text

    except Exception as e:
        print(f"    Erro: {e}")

    return None


def buscar_processo_por_push(session, numero_processo):
    """Tenta encontrar processo via sistema push (notificações)."""
    print(f"\n[3] Verificando processos no Push...")

    base_url = "https://pje.tjdft.jus.br"
    url = f"{base_url}/pje/Push/listView.seam"

    try:
        resp = session.get(url, timeout=60)
        print(f"    Status: {resp.status_code}")

        if resp.status_code == 200:
            if numero_processo.replace('-', '').replace('.', '') in resp.text.replace('-', '').replace('.', ''):
                print(f"    Processo encontrado no Push!")
                return resp.text

    except Exception as e:
        print(f"    Erro: {e}")

    return None


def tentar_download_direto(session, id_processo, download_dir):
    """Tenta baixar documentos usando vários padrões de URL."""
    print(f"\n[4] Tentando download direto de documentos...")

    base_url = "https://pje.tjdft.jus.br"

    # Padrões comuns de IDs de documentos baseados no ID do processo
    # No PJe, IDs de documentos geralmente seguem padrões

    # Tentar alguns IDs próximos ao ID do processo
    doc_ranges = [
        (250000000, 260000000),  # Faixa comum de documentos
        (int(id_processo) * 50, int(id_processo) * 60),
    ]

    # Primeiro, tentar encontrar um documento válido
    print("    Testando faixas de IDs...")

    test_ids = []
    for start, end in doc_ranges:
        # Testar alguns IDs na faixa
        step = (end - start) // 10
        for i in range(10):
            test_ids.append(start + i * step)

    # Testar cada ID
    for test_id in test_ids[:5]:
        url = f"{base_url}/pje/seam/resource/rest/pje-legacy/documento/download/TJDFT/1g/{id_processo}/{test_id}"
        try:
            resp = session.head(url, timeout=5)
            if resp.status_code == 200:
                print(f"    ID válido encontrado: {test_id}")
                return [str(test_id)]
        except:
            pass

    return []


def main():
    numero_processo = sys.argv[1] if len(sys.argv) > 1 else "0754806-50.2025.8.07.0016"
    id_processo = sys.argv[2] if len(sys.argv) > 2 else "4388248"

    print("=" * 70)
    print("   PJe JSF NAVIGATOR")
    print("=" * 70)
    print(f"\n   Processo: {numero_processo}")
    print(f"   ID: {id_processo}")

    download_dir = DOWNLOADS_BASE / numero_processo
    download_dir.mkdir(parents=True, exist_ok=True)

    session_data = carregar_sessao()
    if not session_data:
        print("\n   ERRO: Sessão não encontrada!")
        return

    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
    })
    for name, value in session_data['cookies'].items():
        session.cookies.set(name, value, domain='pje.tjdft.jus.br')

    # Tentar abrir processo via POST
    resultado = abrir_processo_post(session, id_processo, numero_processo)

    # Acessar painel do advogado
    painel = acessar_painel_advogado(session)

    # Verificar push
    push = buscar_processo_por_push(session, numero_processo)

    # Tentar download direto
    docs = tentar_download_direto(session, id_processo, download_dir)

    print("\n" + "=" * 70)
    print("   CONCLUSÃO")
    print("=" * 70)

    if docs:
        print(f"\n   Documentos encontrados para download!")
    else:
        print(f"""
   O PJe utiliza JSF/RichFaces que requer sessão de navegador ativa.

   Para baixar os documentos deste processo, você precisa:

   1. Abrir o Firefox com sua sessão do PJe
   2. Pesquisar o processo: {numero_processo}
   3. Clicar para abrir os autos
   4. Abrir alguns documentos
   5. Salvar HAR (F12 → Rede → Salvar tudo como HAR)
   6. Executar extrair_sessao_pje.py

   Depois disso, os documentos poderão ser baixados automaticamente.
""")

    print("=" * 70)


if __name__ == "__main__":
    main()
