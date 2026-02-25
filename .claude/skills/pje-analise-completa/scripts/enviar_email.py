# -*- coding: utf-8 -*-
"""
enviar_email.py
Envia arquivo por email.

Uso:
    python enviar_email.py ARQUIVO [ASSUNTO]

Exemplo:
    python enviar_email.py "C:\AGÊNTICO\...\ANALISE.pdf" "Análise Processo X"
"""

import sys
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path
import json

# Configuracao
SCRIPT_DIR = Path(__file__).parent
CONFIG_FILE = Path(r"C:\Users\USER\Desktop\.claude\skills\supersapiens-download\scripts\config_email.json")


def carregar_config():
    """Carrega configuracao de email."""
    if not CONFIG_FILE.exists():
        print(f"ERRO: Arquivo de configuracao nao encontrado: {CONFIG_FILE}")
        sys.exit(1)

    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def enviar_email(arquivo, assunto, corpo=None):
    """Envia email com anexo."""
    config = carregar_config()

    arquivo_path = Path(arquivo)
    if not arquivo_path.exists():
        print(f"ERRO: Arquivo nao encontrado: {arquivo}")
        sys.exit(1)

    # Monta mensagem
    msg = MIMEMultipart()
    msg['From'] = config['smtp_usuario']
    msg['To'] = config['email_destino']
    msg['Subject'] = assunto

    # Corpo padrao
    if corpo is None:
        corpo = f"""
Prezado(a),

Segue em anexo o arquivo: {arquivo_path.name}

Atenciosamente,
Sistema de Analise Juridica PJe
"""

    msg.attach(MIMEText(corpo, 'plain', 'utf-8'))

    # Anexa arquivo
    with open(arquivo_path, 'rb') as f:
        anexo = MIMEBase('application', 'octet-stream')
        anexo.set_payload(f.read())
        encoders.encode_base64(anexo)
        anexo.add_header('Content-Disposition', f'attachment; filename="{arquivo_path.name}"')
        msg.attach(anexo)

    # Envia
    try:
        server = smtplib.SMTP(config['smtp_servidor'], config['smtp_porta'])
        server.starttls()
        server.login(config['smtp_usuario'], config['smtp_senha'])
        server.send_message(msg)
        server.quit()
        print(f"Email enviado com sucesso para: {config['email_destino']}")
        return True
    except Exception as e:
        print(f"ERRO ao enviar email: {e}")
        return False


def main():
    if len(sys.argv) < 2:
        print("\nUso: python enviar_email.py ARQUIVO [ASSUNTO]")
        sys.exit(1)

    arquivo = sys.argv[1]
    assunto = sys.argv[2] if len(sys.argv) > 2 else f"[PJe] Arquivo: {Path(arquivo).name}"

    print("\n" + "=" * 60)
    print("   ENVIAR EMAIL")
    print("=" * 60)
    print(f"\n   Arquivo: {arquivo}")
    print(f"   Assunto: {assunto}")

    config = carregar_config()
    print(f"   Destino: {config['email_destino']}")

    print("\n   Enviando...")

    if enviar_email(arquivo, assunto):
        print("\n" + "=" * 60)
        print("   EMAIL ENVIADO COM SUCESSO!")
        print("=" * 60)
    else:
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\nERRO: {e}")
        sys.exit(1)
