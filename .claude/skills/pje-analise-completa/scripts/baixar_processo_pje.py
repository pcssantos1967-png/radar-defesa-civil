# -*- coding: utf-8 -*-
"""
baixar_processo_pje.py
Baixa TODOS os documentos de um processo do PJe TJDFT.

Uso:
    python baixar_processo_pje.py NUMERO_PROCESSO

Exemplo:
    python baixar_processo_pje.py 0738732-18.2025.807.0016
"""

import sys
import json
import re
import requests
from pathlib import Path
from datetime import datetime
import time

# Configuracoes
SCRIPT_DIR = Path(__file__).parent
SESSION_FILE = SCRIPT_DIR / "session_pje.json"
BASE_URL = "https://pje.tjdft.jus.br"
DOWNLOADS_BASE = Path(r"C:\AGÊNTICO")


def carregar_sessao():
    """Carrega cookies de sessao."""
    if not SESSION_FILE.exists():
        print("ERRO: Sessao nao encontrada.")
        print("Execute primeiro: python extrair_sessao_pje.py")
        sys.exit(1)

    with open(SESSION_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    return data.get("cookies", {})


def criar_sessao(cookies):
    """Cria sessao HTTP com cookies."""
    session = requests.Session()

    for nome, valor in cookies.items():
        session.cookies.set(nome, valor, domain="pje.tjdft.jus.br")

    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0',
        'Accept': 'application/pdf,*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Referer': 'https://pje.tjdft.jus.br/pje/Processo/ConsultaProcesso/Detalhe/listProcessoCompletoAdvogado.seam',
    })

    return session


def buscar_ids_documentos(session, numero_processo):
    """Busca IDs de documentos do processo via pagina web."""
    print(f"\n[2/4] Buscando lista de documentos...")

    # Remove formatacao do numero
    numero_limpo = re.sub(r'[^\d]', '', numero_processo)

    # Tenta diferentes endpoints para obter a lista de documentos
    endpoints = [
        f"/pje/Processo/ConsultaProcesso/Detalhe/listProcessoCompletoAdvogado.seam?processo={numero_processo}",
        f"/pje/ConsultaPublica/DetalheProcessoConsultaPublica/listProcessoCompleto.seam?processo={numero_processo}",
    ]

    for endpoint in endpoints:
        url = BASE_URL + endpoint
        try:
            response = session.get(url, timeout=60)
            if response.status_code == 200:
                # Busca IDs de documentos no HTML/JavaScript
                ids = extrair_ids_do_html(response.text)
                if ids:
                    print(f"      Documentos encontrados: {len(ids)}")
                    return ids
        except Exception as e:
            continue

    return []


def extrair_ids_do_html(html):
    """Extrai IDs de documentos do HTML da pagina."""
    ids = set()

    # Padrao 1: listaIdsDocumentos = [...]
    match = re.search(r'listaIdsDocumentos\s*=\s*\[([\d,\s-]+)\]', html)
    if match:
        ids_str = match.group(1)
        for id_str in re.findall(r'-?\d+', ids_str):
            id_num = int(id_str)
            if id_num > 0:  # Ignora IDs negativos (2o grau)
                ids.add(id_num)

    # Padrao 2: download/NUMERO
    for match in re.findall(r'/documento/download/(\d{8,})', html):
        ids.add(int(match))

    # Padrao 3: idDocumento: NUMERO
    for match in re.findall(r'"idDocumento"\s*:\s*(\d+)', html):
        ids.add(int(match))

    return list(ids)


def obter_id_processo_trf(session, numero_processo):
    """Obtem o ID interno do processo no TRF."""
    # Busca na pagina do processo
    url = f"{BASE_URL}/pje/Processo/ConsultaProcesso/Detalhe/listProcessoCompletoAdvogado.seam"
    params = {'processo': numero_processo}

    try:
        response = session.get(url, params=params, timeout=30)
        if response.status_code == 200:
            # Busca idProcessoTrf no HTML
            match = re.search(r'idProcessoTrf["\s:=]+(\d+)', response.text)
            if match:
                return match.group(1)
    except:
        pass

    return None


def baixar_documento(session, doc_id, destino, id_processo_trf=None):
    """Baixa um documento."""
    # Tenta diferentes formatos de URL
    urls = []

    if id_processo_trf:
        urls.append(f"{BASE_URL}/pje/seam/resource/rest/pje-legacy/documento/download/TJDFT/1g/{id_processo_trf}/{doc_id}")

    urls.append(f"{BASE_URL}/pje/seam/resource/rest/pje-legacy/documento/download/{doc_id}")

    for url in urls:
        try:
            response = session.get(url, stream=True, timeout=60, allow_redirects=True)

            if response.status_code == 200:
                content_type = response.headers.get('Content-Type', '')

                # Verifica se eh conteudo valido
                if 'html' in content_type.lower() and len(response.content) < 5000:
                    continue

                # Determina extensao
                if 'pdf' in content_type:
                    ext = '.pdf'
                else:
                    ext = '.pdf'

                arquivo_final = destino.with_suffix(ext)

                with open(arquivo_final, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)

                tamanho = arquivo_final.stat().st_size
                if tamanho > 1000:
                    return True, tamanho, arquivo_final

        except Exception as e:
            continue

    return False, 0, "NAO_ENCONTRADO"


def main():
    if len(sys.argv) < 2:
        print("\nUso: python baixar_processo_pje.py NUMERO_PROCESSO")
        print("Exemplo: python baixar_processo_pje.py 0738732-18.2025.807.0016")
        sys.exit(1)

    numero_processo = sys.argv[1]

    print("\n" + "=" * 70)
    print("   BAIXAR DOCUMENTOS - PJe TJDFT")
    print("=" * 70)
    print(f"\n   Processo: {numero_processo}")

    # Carrega sessao
    print("\n[1/4] Carregando sessao...")
    cookies = carregar_sessao()
    session = criar_sessao(cookies)
    print(f"      Cookies: {len(cookies)}")

    # Obtem ID do processo
    id_processo_trf = obter_id_processo_trf(session, numero_processo)
    if id_processo_trf:
        print(f"      ID Processo TRF: {id_processo_trf}")

    # Busca IDs de documentos
    documento_ids = buscar_ids_documentos(session, numero_processo)

    if not documento_ids:
        print("\n   AVISO: Nao foi possivel obter lista automatica de documentos.")
        print("   Tente capturar um novo HAR navegando pelos documentos do processo.")
        sys.exit(1)

    # Cria pasta de downloads
    downloads_dir = DOWNLOADS_BASE / numero_processo
    downloads_dir.mkdir(parents=True, exist_ok=True)
    print(f"\n[3/4] Pasta: {downloads_dir}")

    # Baixa documentos
    print(f"\n[4/4] Baixando {len(documento_ids)} documentos...")
    print("-" * 70)

    sucesso = 0
    falha = 0
    total_bytes = 0

    for i, doc_id in enumerate(documento_ids, 1):
        nome_arquivo = f"doc_{doc_id}"
        destino = downloads_dir / nome_arquivo

        print(f"   [{i:3d}/{len(documento_ids)}] ID {doc_id}...", end=" ", flush=True)

        ok, tamanho, resultado = baixar_documento(session, doc_id, destino, id_processo_trf)

        if ok:
            sucesso += 1
            total_bytes += tamanho
            tamanho_kb = tamanho / 1024
            print(f"OK ({tamanho_kb:.1f} KB)")
        else:
            falha += 1
            print(f"FALHA")

        time.sleep(0.3)

    # Resumo
    print("\n" + "=" * 70)
    print("   RESUMO DO DOWNLOAD")
    print("=" * 70)
    print(f"""
   Documentos baixados: {sucesso}/{len(documento_ids)}
   Falhas:              {falha}
   Total baixado:       {total_bytes / (1024*1024):.2f} MB

   Pasta: {downloads_dir}
""")
    print("=" * 70)
    print("\n   PROXIMO PASSO:")
    print(f"   Execute: python converter_pdfs.py \"{downloads_dir}\"")
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
