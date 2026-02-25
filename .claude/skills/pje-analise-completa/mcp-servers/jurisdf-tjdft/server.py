# -*- coding: utf-8 -*-
"""
MCP Server: JurisDF - Jurisprudencia do TJDFT
Integrado ao PJe Analise Completa

Acesso a jurisprudencia do Tribunal de Justica do Distrito Federal e Territorios.
Inclui: Acordaos, Decisoes Monocraticas, Decisoes da Presidencia.

API REST publica: https://jurisdf.tjdft.jus.br/api/v1/pesquisa

Baseado no Sistema Marmelstein de George Marmelstein.
"""

from mcp.server.fastmcp import FastMCP
from typing import Optional, List, Dict, Any
from datetime import datetime
import httpx
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from shared.base_juridica import (
    BaseResultadoJuridico,
    formatar_resultados_xml,
    truncar_por_tokens,
    limpar_texto_html,
)

mcp = FastMCP("jurisdf-tjdft")

JURISDF_API_URL = "https://jurisdf.tjdft.jus.br/api/v1/pesquisa"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json",
}

BASES_JURISDF = {
    "acordaos": "Acordaos",
    "acordaos-tr": "Acordaos - Turmas Recursais",
    "decisoes-monocraticas": "Decisoes Monocraticas",
    "decisoes-presidencia": "Decisoes da Presidencia",
    "jurisprudencia-foco": "Jurisprudencia em Foco",
}


def _formatar_data(data_iso: str) -> str:
    """Converte data ISO para formato brasileiro."""
    if not data_iso:
        return ""
    try:
        dt = datetime.fromisoformat(data_iso.replace("Z", "+00:00"))
        return dt.strftime("%d/%m/%Y")
    except Exception:
        return data_iso


async def _fazer_requisicao_api(
    query: str,
    pagina: int = 0,
    tamanho: int = 20,
    sinonimos: bool = True,
) -> dict:
    """Funcao reutilizavel para chamadas a API do JurisDF."""
    payload = {
        "query": query,
        "termosAcessorios": [],
        "pagina": pagina,
        "tamanho": tamanho,
        "sinonimos": sinonimos,
        "espelho": True,
        "inteiroTeor": False,
        "retornaInteiroTeor": False,
        "retornaTotalizacao": True,
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            JURISDF_API_URL,
            json=payload,
            headers=HEADERS,
            timeout=30.0
        )
        response.raise_for_status()
        return response.json()


@mcp.tool()
async def buscar_jurisprudencia_tjdft(
    busca: str,
    max_resultados: int = 20,
    sinonimos: bool = True
) -> str:
    """
    Busca jurisprudencia no JurisDF (TJDFT).

    OPERADORES (em MAIUSCULO):
    - E        : Ambos termos. Ex: furto E estacionamento
    - OU       : Qualquer termo. Ex: (supermercado OU hipermercado)
    - NAO      : Exclui termo. Ex: furto NAO supermercado
    - "aspas"  : Expressao exata. Ex: "dano moral"
    - $        : Wildcard. Ex: bio$ (biologia, biografia)

    EXEMPLOS:
    - "dano moral" E "transporte aereo"
    - "pensao por morte" E homoafetivo
    - consumidor$ E fornecedor
    - DPVAT NAO militar

    Args:
        busca: Query com sintaxe JurisDF
        max_resultados: Maximo de resultados (1-100). Default: 20
        sinonimos: Expandir busca com sinonimos. Default: True

    Returns:
        XML estruturado com jurisprudencia do TJDFT
    """
    try:
        data = await _fazer_requisicao_api(
            query=busca,
            tamanho=max_resultados,
            sinonimos=sinonimos,
        )

        registros = data.get("registros", [])
        hits = data.get("hits", {}).get("value", 0)

        resultados: List[BaseResultadoJuridico] = []

        for reg in registros:
            ementa = reg.get("ementa", "")
            ementa = limpar_texto_html(ementa)
            ementa = truncar_por_tokens(ementa, max_tokens=1500)

            resultado = BaseResultadoJuridico(
                conteudo=ementa,
                fonte=f"https://jurisdf.tjdft.jus.br/acordaos/{reg.get('uuid', '')}",
                tipo=reg.get("base", ""),
                orgao=reg.get("descricaoOrgaoJulgador", ""),
                numero=reg.get("processo", ""),
                relator=reg.get("nomeRelator", ""),
                data=_formatar_data(reg.get("dataJulgamento", "")),
                situacao=reg.get("decisao", ""),
            )
            resultados.append(resultado)

        xml_resultado = formatar_resultados_xml(resultados, "jurisprudencia_tjdft")
        meta = f'<!-- Busca: "{busca}" | Total: {hits} -->\n'

        return meta + xml_resultado

    except Exception as e:
        return f'<erro>Falha na busca JurisDF: {str(e)}</erro>'


@mcp.tool()
async def listar_filtros_tjdft() -> str:
    """Lista filtros e bases disponiveis no JurisDF."""
    linhas = ['<filtros_jurisdf>']

    linhas.append('  <bases>')
    for codigo, nome in BASES_JURISDF.items():
        linhas.append(f'    <base codigo="{codigo}">{nome}</base>')
    linhas.append('  </bases>')

    linhas.append('  <operadores>')
    linhas.append('    <operador codigo="E">Ambos termos obrigatorios</operador>')
    linhas.append('    <operador codigo="OU">Qualquer termo</operador>')
    linhas.append('    <operador codigo="NAO">Exclui termo seguinte</operador>')
    linhas.append('    <operador codigo="aspas">Expressao exata</operador>')
    linhas.append('    <operador codigo="$">Wildcard</operador>')
    linhas.append('  </operadores>')

    linhas.append('</filtros_jurisdf>')

    return "\n".join(linhas)


if __name__ == "__main__":
    mcp.run()
