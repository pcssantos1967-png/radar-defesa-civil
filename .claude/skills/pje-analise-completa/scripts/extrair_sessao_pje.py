# -*- coding: utf-8 -*-
"""
extrair_sessao_pje.py
Extrai cookies de sessao do PJe a partir de um arquivo HAR.

Uso:
    python extrair_sessao_pje.py                    (busca automatica)
    python extrair_sessao_pje.py caminho/arquivo.har (caminho especifico)
"""

import sys
import json
import os
from pathlib import Path
from datetime import datetime

# Configuracoes
DOMINIOS_PJE = ["pje.tjdft.jus.br", "pje2.tjdft.jus.br"]
SCRIPT_DIR = Path(__file__).parent
SESSION_FILE = SCRIPT_DIR / "session_pje.json"


def obter_pastas_usuario():
    """Retorna caminhos de Desktop e Downloads."""
    user_home = Path.home()

    pastas = [
        user_home / "Desktop",
        user_home / "Downloads",
        Path(os.environ.get("USERPROFILE", "")) / "Desktop",
        Path(os.environ.get("USERPROFILE", "")) / "Downloads",
    ]

    pastas_unicas = []
    for p in pastas:
        if p.exists() and p.resolve() not in [x.resolve() for x in pastas_unicas]:
            pastas_unicas.append(p)

    return pastas_unicas


def extrair_timestamp_nome(nome_arquivo):
    """Extrai timestamp do nome do arquivo HAR."""
    import re
    # Formato: [YY-MM-DD HH-MM-SS] ou [DD-MM-YY HH-MM-SS]
    match = re.search(r'\[(\d{2})-(\d{2})-(\d{2})\s+(\d{2})-(\d{2})-(\d{2})\]', nome_arquivo)
    if match:
        g1, g2, g3, h, m, s = match.groups()
        # Tenta YY-MM-DD primeiro
        try:
            ano = 2000 + int(g1)
            mes = int(g2)
            dia = int(g3)
            if 1 <= mes <= 12 and 1 <= dia <= 31:
                return datetime(ano, mes, dia, int(h), int(m), int(s))
        except:
            pass
        # Tenta DD-MM-YY
        try:
            dia = int(g1)
            mes = int(g2)
            ano = 2000 + int(g3)
            if 1 <= mes <= 12 and 1 <= dia <= 31:
                return datetime(ano, mes, dia, int(h), int(m), int(s))
        except:
            pass
    return None


def buscar_har_pje():
    """Busca arquivo HAR do PJe automaticamente."""
    pastas = obter_pastas_usuario()
    arquivos = []

    print("\n[1/3] Buscando arquivo HAR do PJe...")

    for pasta in pastas:
        print(f"      - {pasta}")
        for arquivo in pasta.glob("*.har"):
            nome = arquivo.name.lower()
            if "pje" in nome or "tjdft" in nome:
                arquivos.append(arquivo)

    if not arquivos:
        return None

    # Ordena por timestamp no nome ou data de modificacao
    def get_sort_key(arq):
        ts = extrair_timestamp_nome(arq.name)
        if ts:
            return ts.timestamp()
        return arq.stat().st_mtime

    arquivos.sort(key=get_sort_key, reverse=True)

    if len(arquivos) > 1:
        print(f"\n      Encontrados {len(arquivos)} arquivos:")
        for i, arq in enumerate(arquivos[:3]):
            mtime = datetime.fromtimestamp(arq.stat().st_mtime)
            marcador = " <-- selecionado" if i == 0 else ""
            print(f"        {i+1}. {arq.name} ({mtime.strftime('%H:%M:%S')}){marcador}")

    return arquivos[0]


def extrair_cookies(har_path):
    """Extrai cookies do arquivo HAR."""

    print(f"\n[2/3] Extraindo cookies...")
    print(f"      Arquivo: {har_path.name}")

    with open(har_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    entries = data.get("log", {}).get("entries", [])
    print(f"      Requisicoes: {len(entries)}")

    cookies = {}
    pje_reqs = 0

    for entry in entries:
        url = entry.get("request", {}).get("url", "")

        is_pje = any(d in url for d in DOMINIOS_PJE)
        if not is_pje:
            continue

        pje_reqs += 1

        # Extrai cookies do header Cookie
        for header in entry.get("request", {}).get("headers", []):
            if header.get("name", "").lower() == "cookie":
                cookie_str = header.get("value", "")
                for par in cookie_str.split(";"):
                    if "=" in par:
                        nome, valor = par.strip().split("=", 1)
                        cookies[nome.strip()] = valor.strip()

        # Extrai cookies da resposta
        for cookie in entry.get("response", {}).get("cookies", []):
            nome = cookie.get("name")
            valor = cookie.get("value")
            if nome and valor:
                cookies[nome] = valor

    print(f"      Requisicoes PJe: {pje_reqs}")
    print(f"      Cookies encontrados: {len(cookies)}")

    return cookies, pje_reqs


def salvar_sessao(cookies):
    """Salva sessao em arquivo JSON."""

    print(f"\n[3/3] Salvando sessao...")

    sessao = {
        "metadata": {
            "extraido_em": datetime.now().isoformat(),
            "sistema": "PJe-TJDFT",
            "total_cookies": len(cookies),
            "versao": "2.0"
        },
        "cookies": cookies,
        "base_url": "https://pje.tjdft.jus.br"
    }

    with open(SESSION_FILE, "w", encoding="utf-8") as f:
        json.dump(sessao, f, indent=2, ensure_ascii=False)

    print(f"      Arquivo: {SESSION_FILE}")

    return SESSION_FILE


def main():
    print("\n" + "=" * 60)
    print("   EXTRATOR DE SESSAO - PJe TJDFT")
    print("=" * 60)

    if len(sys.argv) >= 2:
        har_path = Path(sys.argv[1])
    else:
        har_path = buscar_har_pje()

    if not har_path or not har_path.exists():
        print("\n   ERRO: Arquivo HAR nao encontrado.")
        print("   Capture o HAR do PJe e tente novamente.")
        sys.exit(1)

    cookies, pje_reqs = extrair_cookies(har_path)

    if not cookies:
        print("\n   ERRO: Nenhum cookie encontrado.")
        print("   Certifique-se de estar logado no PJe ao capturar o HAR.")
        sys.exit(1)

    salvar_sessao(cookies)

    print("\n" + "=" * 60)
    print("   SESSAO EXTRAIDA COM SUCESSO!")
    print("=" * 60)
    print(f"\n   COOKIES ENCONTRADOS: {len(cookies)}")

    for nome in list(cookies.keys())[:5]:
        valor = cookies[nome][:30] + "..." if len(cookies[nome]) > 30 else cookies[nome]
        print(f"      - {nome}: {valor}")

    if len(cookies) > 5:
        print(f"      ... e mais {len(cookies) - 5} cookies")

    print("\n" + "=" * 60)
    print("   PROXIMO PASSO:")
    print("   Execute: python baixar_todos_documentos.py NUMERO_PROCESSO")
    print("=" * 60)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n   ERRO: {e}")
        sys.exit(1)
