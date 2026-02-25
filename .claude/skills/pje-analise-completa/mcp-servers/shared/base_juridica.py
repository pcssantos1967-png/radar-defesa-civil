# -*- coding: utf-8 -*-
"""
Modulo Base para Ferramentas de Busca Juridica
Integrado ao PJe Analise Completa

Baseado no Sistema Marmelstein de George Marmelstein.
"""

from dataclasses import dataclass, field
from typing import Optional, List
from datetime import datetime
import re


@dataclass
class BaseResultadoJuridico:
    """Resultado padronizado de busca juridica."""
    conteudo: str
    fonte: str
    tipo: str = ""
    orgao: str = ""
    numero: str = ""
    relator: str = ""
    data: str = ""
    situacao: str = ""
    metadata: dict = field(default_factory=dict)


def formatar_resultados_xml(resultados: List[BaseResultadoJuridico],
                            tag_raiz: str = "resultados_juridicos") -> str:
    """Formata resultados em XML estruturado."""
    if not resultados:
        return f"<{tag_raiz}>\n<mensagem>Nenhum resultado encontrado.</mensagem>\n</{tag_raiz}>"

    linhas = [f"<{tag_raiz} total=\"{len(resultados)}\">"]

    for i, r in enumerate(resultados, 1):
        linhas.append(f'  <item indice="{i}">')

        if r.tipo:
            linhas.append(f'    <tipo>{escape_xml(r.tipo)}</tipo>')
        if r.numero:
            linhas.append(f'    <numero>{escape_xml(r.numero)}</numero>')
        if r.orgao:
            linhas.append(f'    <orgao>{escape_xml(r.orgao)}</orgao>')
        if r.relator:
            linhas.append(f'    <relator>{escape_xml(r.relator)}</relator>')
        if r.data:
            linhas.append(f'    <data>{escape_xml(r.data)}</data>')
        if r.situacao:
            linhas.append(f'    <situacao>{escape_xml(r.situacao)}</situacao>')

        linhas.append('    <conteudo>')
        linhas.append(f'      {escape_xml(r.conteudo)}')
        linhas.append('    </conteudo>')

        if r.fonte:
            linhas.append(f'    <fonte>{escape_xml(r.fonte)}</fonte>')

        linhas.append('  </item>')

    linhas.append(f"</{tag_raiz}>")

    return "\n".join(linhas)


def escape_xml(text: str) -> str:
    """Escapa caracteres especiais para XML."""
    if not text:
        return ""
    text = str(text)
    text = text.replace("&", "&amp;")
    text = text.replace("<", "&lt;")
    text = text.replace(">", "&gt;")
    text = text.replace('"', "&quot;")
    text = text.replace("'", "&apos;")
    return text


def truncar_por_tokens(texto: str, max_tokens: int = 5000) -> str:
    """Trunca texto por numero aproximado de tokens."""
    if not texto:
        return ""

    max_chars = max_tokens * 4

    if len(texto) <= max_chars:
        return texto.strip()

    texto_truncado = texto[:max_chars]

    ultimo_ponto = texto_truncado.rfind('.')
    if ultimo_ponto > max_chars * 0.8:
        texto_truncado = texto_truncado[:ultimo_ponto + 1]

    return texto_truncado.strip() + " [...]"


def limpar_texto_html(texto: str) -> str:
    """Remove tags HTML e normaliza espacos."""
    if not texto:
        return ""

    texto = re.sub(r'<[^>]+>', '', texto)
    texto = re.sub(r'\s+', ' ', texto)

    return texto.strip()


# Constantes
TIPOS_PRECEDENTES = {
    "RG": "Repercussao Geral",
    "RR": "Recurso Repetitivo",
    "SV": "Sumula Vinculante",
    "SUM": "Sumula",
    "IRDR": "Incidente de Resolucao de Demandas Repetitivas",
    "IAC": "Incidente de Assuncao de Competencia",
}

TRIBUNAIS = {
    "STF": "Supremo Tribunal Federal",
    "STJ": "Superior Tribunal de Justica",
    "TRF1": "Tribunal Regional Federal da 1a Regiao",
    "TRF2": "Tribunal Regional Federal da 2a Regiao",
    "TRF3": "Tribunal Regional Federal da 3a Regiao",
    "TRF4": "Tribunal Regional Federal da 4a Regiao",
    "TRF5": "Tribunal Regional Federal da 5a Regiao",
    "TRF6": "Tribunal Regional Federal da 6a Regiao",
    "TJDFT": "Tribunal de Justica do Distrito Federal e Territorios",
}
