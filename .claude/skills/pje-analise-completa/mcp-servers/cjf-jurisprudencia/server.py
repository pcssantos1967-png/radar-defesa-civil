# -*- coding: utf-8 -*-
"""
MCP Server: CJF Jurisprudencia Unificada
Integrado ao PJe Analise Completa

Acesso a jurisprudencia unificada do Conselho da Justica Federal.
Inclui decisoes de: STF, STJ, TRF1, TRF2, TRF3, TRF4, TRF5, TRF6.

Baseado no Sistema Marmelstein de George Marmelstein.
"""

from mcp.server.fastmcp import FastMCP
import requests
from bs4 import BeautifulSoup
import re
from typing import Optional, List, Dict, Any
from datetime import datetime
import html
from tenacity import retry, wait_exponential, stop_after_attempt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from shared.base_juridica import (
    BaseResultadoJuridico,
    formatar_resultados_xml,
    truncar_por_tokens,
    limpar_texto_html,
    TRIBUNAIS,
)

mcp = FastMCP("cjf-jurisprudencia")

CJF_URL = "https://jurisprudencia.cjf.jus.br/unificada/index.xhtml"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/xml, text/xml, */*; q=0.01",
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Faces-Request": "partial/ajax",
    "X-Requested-With": "XMLHttpRequest"
}


class CJFSession:
    """Gerencia sessao com o portal CJF."""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": HEADERS["User-Agent"],
            "Accept-Language": HEADERS["Accept-Language"]
        })
        self.viewstate = None

    @retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(3))
    def obter_viewstate(self) -> str:
        """Obtem ViewState da pagina inicial."""
        resp = self.session.get(CJF_URL, timeout=30)
        resp.raise_for_status()

        match = re.search(r'name="javax\.faces\.ViewState"[^>]*value="([^"]+)"', resp.text)
        if match:
            self.viewstate = match.group(1)
            return self.viewstate

        raise ValueError("ViewState nao encontrado")

    @retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(3))
    def buscar(self, termo: str, tribunais: List[str]) -> str:
        """Faz busca e retorna HTML dos resultados."""
        if not self.viewstate:
            self.obter_viewstate()

        form_data = []
        form_data.append(("javax.faces.partial.ajax", "true"))
        form_data.append(("javax.faces.source", "formulario:actPesquisar"))
        form_data.append(("javax.faces.partial.execute", "@all"))
        form_data.append(("javax.faces.partial.render", "formulario:resultado"))
        form_data.append(("formulario:actPesquisar", "formulario:actPesquisar"))
        form_data.append(("formulario", "formulario"))
        form_data.append(("formulario:textoLivre", termo))

        for trib in tribunais:
            form_data.append(("formulario:j_idt51", trib))

        form_data.append(("javax.faces.ViewState", self.viewstate))

        resp = self.session.post(CJF_URL, data=form_data, headers=HEADERS, timeout=60)
        resp.raise_for_status()
        return resp.text


def extrair_totais(html_content: str) -> Dict[str, int]:
    """Extrai totais de documentos por tribunal."""
    totais = {}
    pattern = r'<td[^>]*>(\w+)</td>\s*<td[^>]*>.*?(\d+)\s*Documento'
    matches = re.findall(pattern, html_content, re.DOTALL)

    for tribunal, count in matches:
        if tribunal in TRIBUNAIS:
            totais[tribunal] = int(count)

    return totais


def extrair_documentos(html_content: str) -> List[Dict[str, Any]]:
    """Extrai documentos detalhados da resposta."""
    documentos = []
    content = html.unescape(html_content)

    cdata_matches = re.findall(r'<!\[CDATA\[(.*?)\]\]>', content, re.DOTALL)
    if cdata_matches:
        content = ''.join(cdata_matches)

    doc_indices = set(re.findall(r'tabelaDocumentos:(\d+):', content))

    for idx in sorted(doc_indices, key=int):
        doc = {"indice": int(idx)}

        campos = [
            ("numero", "Numero"),
            ("classe", "Classe"),
            ("relator", r"Relator\(a\)"),
            ("orgao_julgador", "Orgao julgador"),
            ("data_julgamento", "Data"),
        ]

        for campo, label in campos:
            pattern = rf'tabelaDocumentos:{idx}:.*?label_pontilhada[^>]*>{label}</span>.*?<td[^>]*>([^<]+)</td>'
            match = re.search(pattern, content, re.DOTALL)
            if match:
                doc[campo] = match.group(1).strip()

        documentos.append(doc)

    ementa_pattern = re.compile(r'painel_ementa-([^"]+)"[^>]*>(.*?)</div>', re.DOTALL)
    ementas = []
    for match in ementa_pattern.finditer(content):
        ementa_raw = match.group(2)
        ementa = re.sub(r'<[^>]+>', '', ementa_raw).strip()
        ementa = re.sub(r'\s+', ' ', ementa)
        if len(ementa) > 50:
            ementas.append(ementa)

    for i, doc in enumerate(documentos):
        if i < len(ementas):
            doc["ementa"] = ementas[i]

    return [d for d in documentos if d.get("numero") or d.get("ementa")]


@mcp.tool()
def buscar_jurisprudencia_cjf(
    busca: str,
    tribunais: str = "STF,STJ,TRF1,TRF2,TRF3,TRF4,TRF5,TRF6",
    max_resultados: int = 30
) -> str:
    """
    Busca jurisprudencia unificada no portal do CJF.

    SINTAXE DO CJF (operadores em MAIUSCULO):
    - E        : Ambos termos obrigatorios. Ex: pensao E morte
    - OU       : Qualquer um dos termos. Ex: aposentadoria OU beneficio
    - NAO      : Exclui o segundo termo. Ex: servidor NAO militar
    - ADJ[n]   : Adjacentes NA ordem. Ex: Reparticao ADJ Publica
    - PROX[n]  : Proximos QUALQUER ordem. Ex: aposentadoria PROX3 invalidez
    - [EMEN]   : Busca na ementa. Ex: aposentadoria[EMEN]
    - [REL]    : Busca por relator. Ex: Silva[REL]

    EXEMPLOS:
    - (pensao E morte)[EMEN] E homoafetivo
    - "auxilio-doenca"[EMEN] E pericia
    - Fux[REL] E previdenciario

    Args:
        busca: Query com sintaxe CJF
        tribunais: Tribunais separados por virgula. Default: todos
        max_resultados: Maximo de resultados. Default: 30

    Returns:
        XML estruturado com jurisprudencia
    """
    lista_tribunais = [t.strip().upper() for t in tribunais.split(",")]

    try:
        session = CJFSession()
        html_resultado = session.buscar(busca, lista_tribunais)

        totais = extrair_totais(html_resultado)
        documentos = extrair_documentos(html_resultado)[:max_resultados]

        resultados: List[BaseResultadoJuridico] = []

        for doc in documentos:
            ementa = doc.get("ementa", "")
            ementa = truncar_por_tokens(ementa, max_tokens=1500)

            resultado = BaseResultadoJuridico(
                conteudo=ementa,
                fonte="",
                tipo=doc.get("classe", ""),
                orgao=doc.get("tribunal", ""),
                numero=doc.get("numero", ""),
                relator=doc.get("relator", ""),
                data=doc.get("data_julgamento", ""),
            )
            resultados.append(resultado)

        xml_resultado = formatar_resultados_xml(resultados, "jurisprudencia_cjf")
        totais_str = ", ".join([f"{k}:{v}" for k, v in totais.items()])
        meta = f'<!-- Busca: "{busca}" | Totais: {totais_str} -->\n'

        return meta + xml_resultado

    except Exception as e:
        return f'<erro>Falha na busca CJF: {str(e)}</erro>'


@mcp.tool()
def listar_tribunais_cjf() -> str:
    """Lista todos os tribunais disponiveis para busca no CJF."""
    linhas = ['<tribunais_cjf>']
    for codigo, nome in TRIBUNAIS.items():
        linhas.append(f'  <tribunal codigo="{codigo}">{nome}</tribunal>')
    linhas.append('</tribunais_cjf>')

    return "\n".join(linhas)


if __name__ == "__main__":
    mcp.run()
