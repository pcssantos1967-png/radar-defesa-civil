# -*- coding: utf-8 -*-
"""
MCP Server: BNP API - Banco Nacional de Precedentes (PAGEA/CNJ)
Integrado ao PJe Analise Completa

Busca precedentes vinculantes: Repercussao Geral, Recursos Repetitivos,
Sumulas Vinculantes e IRDRs de todos os tribunais brasileiros.

Baseado no Sistema Marmelstein de George Marmelstein.
"""

from mcp.server.fastmcp import FastMCP
import requests
from typing import Optional, List
from datetime import datetime
from tenacity import retry, wait_exponential, stop_after_attempt
import sys
from pathlib import Path

# Adicionar modulo compartilhado ao path
sys.path.insert(0, str(Path(__file__).parent.parent))
from shared.base_juridica import (
    BaseResultadoJuridico,
    formatar_resultados_xml,
    truncar_por_tokens,
    TIPOS_PRECEDENTES,
)

# Criar servidor MCP
mcp = FastMCP("bnp-api")

# Configuracao da API
BNP_API_URL = "https://pangeabnp.pdpj.jus.br/api/v1/precedentes"


class BNPApi:
    """Cliente da API do BNP com retry automatico."""

    @retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(3))
    def buscar(self, filtro: dict) -> dict:
        """Executa busca com retry automatico."""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }

        response = requests.post(
            BNP_API_URL,
            json={"filtro": filtro},
            headers=headers,
            timeout=30
        )
        response.raise_for_status()
        return response.json()


_api = BNPApi()


@mcp.tool()
def buscar_precedentes(
    busca: str,
    orgaos: str = "STF,STJ",
    tipos: str = "RG,RR,SV,SUM",
    max_resultados: int = 10
) -> str:
    """
    Busca precedentes vinculantes no Banco Nacional de Precedentes (BNP/PAGEA).

    SINTAXE DO BNP:
    - +termo : Palavra OBRIGATORIA (AND)
    - -termo : Palavra EXCLUIDA (NOT)
    - "frase" : Expressao EXATA entre aspas

    EXEMPLOS:
    - +"pensao" +"morte" +homoafetivo
    - "aposentadoria especial" +EPI
    - +teto +previdenciario +"revisao"

    Args:
        busca: Query com sintaxe BNP (+termo, -termo, "frase")
        orgaos: Orgaos separados por virgula. Default: "STF,STJ"
        tipos: Tipos de precedente. Default: "RG,RR,SV,SUM"
        max_resultados: Maximo de resultados (1-50). Default: 10

    Returns:
        XML estruturado com precedentes
    """
    lista_orgaos = [o.strip().upper() for o in orgaos.split(",")]
    lista_tipos = [t.strip().upper() for t in tipos.split(",")]

    filtro = {
        "buscaGeral": busca,
        "todasPalavras": "",
        "quaisquerPalavras": "",
        "semPalavras": "",
        "trechoExato": "",
        "atualizacaoDesde": "",
        "atualizacaoAte": "",
        "cancelados": False,
        "ordenacao": "Text",
        "nr": "",
        "pagina": 1,
        "tamanhoPagina": min(max_resultados, 50),
        "orgaos": lista_orgaos,
        "tipos": lista_tipos
    }

    try:
        data = _api.buscar(filtro)

        resultados: List[BaseResultadoJuridico] = []

        for r in data.get("resultados", []):
            conteudo_partes = []

            questao = r.get("questao", "")
            if questao:
                conteudo_partes.append(f"QUESTAO JURIDICA: {questao}")

            tese = r.get("tese", "")
            if tese:
                conteudo_partes.append(f"TESE: {tese}")

            paradigmas = r.get("processosParadigma", [])
            if paradigmas:
                procs = [p.get("numero", "") for p in paradigmas if p.get("numero")]
                if procs:
                    conteudo_partes.append(f"PROCESSOS PARADIGMA: {', '.join(procs)}")

            conteudo = "\n\n".join(conteudo_partes)
            conteudo = truncar_por_tokens(conteudo, max_tokens=2000)

            fonte = ""
            if paradigmas and paradigmas[0].get("link"):
                fonte = paradigmas[0]["link"]

            resultado = BaseResultadoJuridico(
                conteudo=conteudo,
                fonte=fonte,
                tipo=TIPOS_PRECEDENTES.get(r.get("tipo"), r.get("tipo", "")),
                orgao=r.get("orgao", ""),
                numero=f"{r.get('tipo', '')} {r.get('nr', '')}",
                situacao=r.get("situacao", ""),
                data=r.get("ultimaAtualizacao", ""),
            )
            resultados.append(resultado)

        xml_resultado = formatar_resultados_xml(resultados, "precedentes_bnp")
        meta = f'<!-- Busca: "{busca}" | Total: {data.get("total", len(resultados))} | Orgaos: {orgaos} -->\n'

        return meta + xml_resultado

    except requests.exceptions.RequestException as e:
        return f'<erro>Falha na comunicacao com BNP: {str(e)}</erro>'
    except Exception as e:
        return f'<erro>Erro inesperado: {str(e)}</erro>'


@mcp.tool()
def listar_tipos_precedentes() -> str:
    """Lista todos os tipos de precedentes disponiveis para busca no BNP."""
    linhas = ['<tipos_precedentes>']
    for codigo, descricao in TIPOS_PRECEDENTES.items():
        linhas.append(f'  <tipo codigo="{codigo}">{descricao}</tipo>')
    linhas.append('</tipos_precedentes>')

    return "\n".join(linhas)


if __name__ == "__main__":
    mcp.run()
