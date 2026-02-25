# -*- coding: utf-8 -*-
"""
pje_selenium_automation.py
Automação completa do PJe usando Selenium com cookies de sessão existentes.
"""

import json
import time
import re
import os
import sys
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.firefox import GeckoDriverManager

SCRIPT_DIR = Path(__file__).parent
SESSION_FILE = SCRIPT_DIR / "session_pje.json"
DOWNLOADS_BASE = Path(r"C:\AGÊNTICO")


def carregar_sessao():
    """Carrega cookies da sessão."""
    if not SESSION_FILE.exists():
        return None
    with open(SESSION_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def criar_driver(download_dir):
    """Cria driver Firefox configurado para downloads."""
    options = Options()

    # Configurar pasta de download
    options.set_preference("browser.download.folderList", 2)
    options.set_preference("browser.download.dir", str(download_dir))
    options.set_preference("browser.download.useDownloadDir", True)
    options.set_preference("browser.helperApps.neverAsk.saveToDisk",
                          "application/pdf,application/octet-stream")
    options.set_preference("pdfjs.disabled", True)

    # Usar perfil do usuário para ter certificado
    # profile_path = os.path.expanduser(r"~\AppData\Roaming\Mozilla\Firefox\Profiles")
    # profiles = list(Path(profile_path).glob("*.default-release"))
    # if profiles:
    #     options.set_preference("profile", str(profiles[0]))

    service = Service(GeckoDriverManager().install())
    driver = webdriver.Firefox(service=service, options=options)

    return driver


def injetar_cookies(driver, session_data):
    """Injeta cookies da sessão no browser."""
    # Primeiro acessar o domínio para poder setar cookies
    driver.get("https://pje.tjdft.jus.br/pje/")
    time.sleep(2)

    # Limpar cookies existentes
    driver.delete_all_cookies()

    # Injetar cookies da sessão
    for name, value in session_data['cookies'].items():
        try:
            cookie = {
                'name': name,
                'value': value,
                'domain': 'pje.tjdft.jus.br',
                'path': '/',
            }
            driver.add_cookie(cookie)
            print(f"    Cookie injetado: {name}")
        except Exception as e:
            print(f"    Erro ao injetar {name}: {e}")

    # Recarregar página com cookies
    driver.refresh()
    time.sleep(3)

    return True


def navegar_para_processo(driver, numero_processo):
    """Navega até o processo especificado."""
    print(f"\n[2] Navegando para processo {numero_processo}...")

    # URLs possíveis para acessar processo
    urls = [
        f"https://pje.tjdft.jus.br/pje/Processo/ConsultaProcesso/listView.seam?numeroProcesso={numero_processo}",
        f"https://pje.tjdft.jus.br/pje/Painel/painel.seam",
    ]

    for url in urls:
        try:
            print(f"    Tentando: {url[:60]}...")
            driver.get(url)
            time.sleep(3)

            # Verificar se está logado
            if "login" in driver.current_url.lower() or "sso" in driver.current_url.lower():
                print("    Redirecionado para login - sessão expirada")
                continue

            # Procurar campo de pesquisa
            try:
                # Tentar encontrar campo de número do processo
                campos = driver.find_elements(By.XPATH,
                    "//input[contains(@id, 'numeroProcesso') or contains(@name, 'numeroProcesso')]")

                if campos:
                    campo = campos[0]
                    campo.clear()
                    campo.send_keys(numero_processo)
                    campo.send_keys(Keys.RETURN)
                    print(f"    Processo pesquisado: {numero_processo}")
                    time.sleep(3)
                    return True

            except NoSuchElementException:
                pass

            # Verificar se processo foi carregado
            page_source = driver.page_source
            if numero_processo in page_source:
                print(f"    Processo encontrado na página!")
                return True

        except Exception as e:
            print(f"    Erro: {e}")

    return False


def extrair_documentos(driver):
    """Extrai lista de documentos do processo."""
    print("\n[3] Extraindo lista de documentos...")

    documentos = []

    try:
        # Esperar carregar
        time.sleep(3)

        # Procurar links para documentos
        links = driver.find_elements(By.XPATH, "//a[contains(@href, 'documento')]")
        print(f"    Links de documentos encontrados: {len(links)}")

        for link in links:
            href = link.get_attribute('href')
            if href and 'documento' in href:
                # Extrair ID do documento
                match = re.search(r'documento[/=](\d+)', href)
                if match:
                    doc_id = match.group(1)
                    if doc_id not in documentos:
                        documentos.append(doc_id)

        # Também procurar por IDs em onclick
        elementos = driver.find_elements(By.XPATH, "//*[contains(@onclick, 'documento')]")
        for elem in elementos:
            onclick = elem.get_attribute('onclick')
            if onclick:
                matches = re.findall(r'(\d{6,})', onclick)
                for match in matches:
                    if match not in documentos:
                        documentos.append(match)

        print(f"    Total de documentos: {len(documentos)}")

    except Exception as e:
        print(f"    Erro ao extrair documentos: {e}")

    return documentos


def clicar_em_abas(driver):
    """Clica nas abas para carregar documentos."""
    print("\n[4] Navegando pelas abas do processo...")

    abas_encontradas = []

    try:
        # Procurar abas do processo
        abas = driver.find_elements(By.XPATH,
            "//a[contains(@class, 'tab') or contains(@id, 'tab') or contains(@href, 'tab')]")

        for aba in abas:
            try:
                texto = aba.text.strip()
                if texto:
                    abas_encontradas.append(texto)
                    print(f"    Clicando em: {texto}")
                    aba.click()
                    time.sleep(2)
            except:
                pass

        # Também procurar links de documentos/movimentações
        links_nav = driver.find_elements(By.XPATH,
            "//a[contains(text(), 'Documento') or contains(text(), 'Movimenta')]")

        for link in links_nav:
            try:
                texto = link.text.strip()
                if texto and texto not in abas_encontradas:
                    print(f"    Clicando em: {texto}")
                    link.click()
                    time.sleep(2)
            except:
                pass

    except Exception as e:
        print(f"    Erro: {e}")

    return abas_encontradas


def salvar_har(driver, numero_processo, download_dir):
    """Captura tráfego de rede (simulado via page source)."""
    print("\n[5] Salvando dados da página...")

    try:
        # Salvar HTML da página
        html_file = download_dir / "pagina_processo.html"
        with open(html_file, 'w', encoding='utf-8') as f:
            f.write(driver.page_source)
        print(f"    HTML salvo: {html_file}")

        # Extrair todos os IDs de documentos do HTML
        doc_ids = set()
        patterns = [
            r'idDocumento["\s:=]+(\d+)',
            r'documento[/=](\d+)',
            r'downloadDocumento[("]+(\d+)',
            r'visualizarDocumento[("]+(\d+)',
        ]

        for pattern in patterns:
            matches = re.findall(pattern, driver.page_source)
            doc_ids.update(matches)

        print(f"    IDs de documentos encontrados: {len(doc_ids)}")

        # Salvar IDs para uso posterior
        ids_file = download_dir / "documento_ids.json"
        with open(ids_file, 'w', encoding='utf-8') as f:
            json.dump(list(doc_ids), f, indent=2)
        print(f"    IDs salvos: {ids_file}")

        return list(doc_ids)

    except Exception as e:
        print(f"    Erro: {e}")
        return []


def baixar_documentos_selenium(driver, doc_ids, download_dir, session_data):
    """Baixa documentos usando requests com cookies do Selenium."""
    import requests

    print(f"\n[6] Baixando {len(doc_ids)} documentos...")

    # Criar sessão requests com cookies do Selenium
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
    })

    # Copiar cookies do Selenium
    for cookie in driver.get_cookies():
        session.cookies.set(cookie['name'], cookie['value'])

    # Também adicionar cookies originais
    for name, value in session_data['cookies'].items():
        session.cookies.set(name, value)

    # Baixar cada documento
    baixados = 0
    base_url = "https://pje.tjdft.jus.br"

    for i, doc_id in enumerate(doc_ids[:50]):  # Limitar a 50 para teste
        try:
            # Tentar diferentes URLs de download
            urls = [
                f"{base_url}/pje/seam/resource/rest/pje-legacy/documento/download/TJDFT/1g/{doc_id}",
                f"{base_url}/pje/Documento/download/{doc_id}",
            ]

            for url in urls:
                resp = session.get(url, timeout=30, stream=True)

                if resp.status_code == 200 and len(resp.content) > 1000:
                    arquivo = download_dir / f"doc_{doc_id}.pdf"
                    with open(arquivo, 'wb') as f:
                        f.write(resp.content)
                    baixados += 1
                    print(f"    [{i+1}/{len(doc_ids)}] doc_{doc_id}.pdf ({len(resp.content)//1024} KB)")
                    break

        except Exception as e:
            print(f"    Erro doc_{doc_id}: {e}")

    return baixados


def main():
    numero_processo = sys.argv[1] if len(sys.argv) > 1 else "0754806-50.2025.8.07.0016"

    print("=" * 70)
    print("   PJe AUTOMAÇÃO COM SELENIUM")
    print("=" * 70)
    print(f"\n   Processo: {numero_processo}")

    # Criar pasta de download
    download_dir = DOWNLOADS_BASE / numero_processo
    download_dir.mkdir(parents=True, exist_ok=True)
    print(f"   Pasta: {download_dir}")

    # Carregar sessão
    session_data = carregar_sessao()
    if not session_data:
        print("\n   ERRO: Sessão não encontrada!")
        return

    driver = None

    try:
        print("\n[1] Iniciando Firefox...")
        driver = criar_driver(download_dir)

        # Injetar cookies
        print("\n[1.1] Injetando cookies da sessão...")
        injetar_cookies(driver, session_data)

        # Navegar para processo
        if not navegar_para_processo(driver, numero_processo):
            print("\n   Não foi possível navegar automaticamente.")
            print("   Tentando método alternativo...")

        # Clicar nas abas
        clicar_em_abas(driver)

        # Extrair documentos
        documentos = extrair_documentos(driver)

        # Salvar dados
        doc_ids = salvar_har(driver, numero_processo, download_dir)

        # Combinar IDs encontrados
        todos_ids = list(set(documentos + doc_ids))

        if todos_ids:
            # Baixar documentos
            baixados = baixar_documentos_selenium(driver, todos_ids, download_dir, session_data)
            print(f"\n   Documentos baixados: {baixados}")
        else:
            print("\n   Nenhum documento encontrado automaticamente.")
            print("\n   INSTRUÇÃO MANUAL:")
            print("   O navegador está aberto. Navegue até o processo e")
            print("   os documentos serão salvos na pasta configurada.")
            print("\n   Pressione ENTER quando terminar...")
            input()

    except Exception as e:
        print(f"\n   ERRO: {e}")
        import traceback
        traceback.print_exc()

    finally:
        if driver:
            print("\n   Fechando navegador...")
            driver.quit()

    print("\n" + "=" * 70)
    print("   AUTOMAÇÃO CONCLUÍDA")
    print("=" * 70)


if __name__ == "__main__":
    main()
