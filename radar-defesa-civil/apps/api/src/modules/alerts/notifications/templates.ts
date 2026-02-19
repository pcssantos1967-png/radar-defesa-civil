// Notification Templates
// Templates for different alert severities and channels

import type { NotificationTemplate } from './types.js';

// Template variable placeholders
const VARIABLES = {
  alertTitle: '{{alertTitle}}',
  alertDescription: '{{alertDescription}}',
  municipalityName: '{{municipalityName}}',
  severity: '{{severity}}',
  severityLabel: '{{severityLabel}}',
  triggerValue: '{{triggerValue}}',
  thresholdValue: '{{thresholdValue}}',
  unit: '{{unit}}',
  alertTime: '{{alertTime}}',
  alertId: '{{alertId}}',
  recipientName: '{{recipientName}}',
  dashboardUrl: '{{dashboardUrl}}',
};

// Severity labels in Portuguese
export const SEVERITY_LABELS: Record<string, string> = {
  observation: 'Observação',
  attention: 'Atenção',
  alert: 'Alerta',
  max_alert: 'Alerta Máximo',
};

// Email templates
export const emailTemplates: Record<string, NotificationTemplate> = {
  alert_new: {
    id: 'email_alert_new',
    name: 'Novo Alerta',
    channel: 'email',
    subject: `[${VARIABLES.severityLabel}] ${VARIABLES.alertTitle} - ${VARIABLES.municipalityName}`,
    bodyTemplate: `
Olá ${VARIABLES.recipientName},

Um novo alerta foi emitido para ${VARIABLES.municipalityName}:

ALERTA: ${VARIABLES.alertTitle}
Severidade: ${VARIABLES.severityLabel}
Município: ${VARIABLES.municipalityName}
Hora: ${VARIABLES.alertTime}

${VARIABLES.alertDescription}

Valor registrado: ${VARIABLES.triggerValue} ${VARIABLES.unit}
Limiar: ${VARIABLES.thresholdValue} ${VARIABLES.unit}

Acesse o painel para mais detalhes:
${VARIABLES.dashboardUrl}

---
Sistema de Alerta - Defesa Civil
Este é um e-mail automático. Não responda.
    `.trim(),
    htmlTemplate: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #0B1120 0%, #1A2744 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .severity-observation { border-left: 4px solid #4CAF50; }
    .severity-attention { border-left: 4px solid #FFD600; }
    .severity-alert { border-left: 4px solid #FF9800; }
    .severity-max_alert { border-left: 4px solid #FF1744; }
    .content { background: #f5f5f5; padding: 20px; }
    .alert-box { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .values { display: flex; justify-content: space-between; margin: 10px 0; }
    .value-box { text-align: center; padding: 10px; }
    .value-number { font-size: 24px; font-weight: bold; }
    .cta-button { display: inline-block; background: #00E5FF; color: #0B1120; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">⚠️ ${VARIABLES.alertTitle}</h1>
      <p style="margin: 10px 0 0 0;">Severidade: <strong>${VARIABLES.severityLabel}</strong></p>
    </div>
    <div class="content severity-${VARIABLES.severity}">
      <div class="alert-box">
        <h2 style="margin-top: 0;">${VARIABLES.municipalityName}</h2>
        <p>${VARIABLES.alertDescription}</p>
        <div class="values">
          <div class="value-box">
            <div class="value-number" style="color: #FF9800;">${VARIABLES.triggerValue}</div>
            <div>Valor Atual (${VARIABLES.unit})</div>
          </div>
          <div class="value-box">
            <div class="value-number" style="color: #666;">${VARIABLES.thresholdValue}</div>
            <div>Limiar (${VARIABLES.unit})</div>
          </div>
        </div>
        <p><strong>Data/Hora:</strong> ${VARIABLES.alertTime}</p>
      </div>
      <center>
        <a href="${VARIABLES.dashboardUrl}" class="cta-button">Ver Detalhes no Painel</a>
      </center>
    </div>
    <div class="footer">
      <p>Sistema de Alerta Meteorológico - Defesa Civil</p>
      <p>Este é um e-mail automático. Não responda.</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
    variables: Object.keys(VARIABLES),
    isActive: true,
  },

  alert_escalated: {
    id: 'email_alert_escalated',
    name: 'Alerta Escalonado',
    channel: 'email',
    subject: `[URGENTE] Escalonamento: ${VARIABLES.alertTitle} - ${VARIABLES.municipalityName}`,
    bodyTemplate: `
ATENÇÃO - ALERTA ESCALONADO

Olá ${VARIABLES.recipientName},

O alerta a seguir foi escalonado para ${VARIABLES.severityLabel}:

ALERTA: ${VARIABLES.alertTitle}
Município: ${VARIABLES.municipalityName}
Nova Severidade: ${VARIABLES.severityLabel}

${VARIABLES.alertDescription}

Ação imediata pode ser necessária.

Acesse o painel: ${VARIABLES.dashboardUrl}

---
Sistema de Alerta - Defesa Civil
    `.trim(),
    variables: Object.keys(VARIABLES),
    isActive: true,
  },

  alert_resolved: {
    id: 'email_alert_resolved',
    name: 'Alerta Resolvido',
    channel: 'email',
    subject: `[Resolvido] ${VARIABLES.alertTitle} - ${VARIABLES.municipalityName}`,
    bodyTemplate: `
Olá ${VARIABLES.recipientName},

O alerta a seguir foi RESOLVIDO:

ALERTA: ${VARIABLES.alertTitle}
Município: ${VARIABLES.municipalityName}
Resolvido em: ${VARIABLES.alertTime}

---
Sistema de Alerta - Defesa Civil
    `.trim(),
    variables: Object.keys(VARIABLES),
    isActive: true,
  },
};

// SMS templates (shorter versions)
export const smsTemplates: Record<string, NotificationTemplate> = {
  alert_new: {
    id: 'sms_alert_new',
    name: 'Novo Alerta SMS',
    channel: 'sms',
    subject: '',
    bodyTemplate: `[${VARIABLES.severityLabel}] ${VARIABLES.alertTitle} - ${VARIABLES.municipalityName}. Valor: ${VARIABLES.triggerValue}${VARIABLES.unit}. Acesse: ${VARIABLES.dashboardUrl}`,
    variables: Object.keys(VARIABLES),
    isActive: true,
  },

  alert_escalated: {
    id: 'sms_alert_escalated',
    name: 'Alerta Escalonado SMS',
    channel: 'sms',
    subject: '',
    bodyTemplate: `URGENTE: Alerta escalonado para ${VARIABLES.severityLabel} em ${VARIABLES.municipalityName}. ${VARIABLES.alertTitle}. Ação necessária.`,
    variables: Object.keys(VARIABLES),
    isActive: true,
  },

  alert_critical: {
    id: 'sms_alert_critical',
    name: 'Alerta Crítico SMS',
    channel: 'sms',
    subject: '',
    bodyTemplate: `⚠️ ALERTA MÁXIMO: ${VARIABLES.alertTitle} - ${VARIABLES.municipalityName}. ${VARIABLES.triggerValue}${VARIABLES.unit}. AÇÃO IMEDIATA REQUERIDA.`,
    variables: Object.keys(VARIABLES),
    isActive: true,
  },
};

// WhatsApp templates (using template format)
export const whatsAppTemplates: Record<string, NotificationTemplate> = {
  alert_new: {
    id: 'whatsapp_alert_new',
    name: 'Novo Alerta WhatsApp',
    channel: 'whatsapp',
    subject: '',
    bodyTemplate: `🚨 *ALERTA: ${VARIABLES.alertTitle}*

📍 *Município:* ${VARIABLES.municipalityName}
⚠️ *Severidade:* ${VARIABLES.severityLabel}
🕐 *Hora:* ${VARIABLES.alertTime}

${VARIABLES.alertDescription}

📊 *Valor:* ${VARIABLES.triggerValue} ${VARIABLES.unit}
📏 *Limiar:* ${VARIABLES.thresholdValue} ${VARIABLES.unit}

👉 Acesse o painel: ${VARIABLES.dashboardUrl}`,
    variables: Object.keys(VARIABLES),
    isActive: true,
  },

  alert_critical: {
    id: 'whatsapp_alert_critical',
    name: 'Alerta Crítico WhatsApp',
    channel: 'whatsapp',
    subject: '',
    bodyTemplate: `🔴🔴🔴 *ALERTA MÁXIMO* 🔴🔴🔴

*${VARIABLES.alertTitle}*

📍 ${VARIABLES.municipalityName}
🕐 ${VARIABLES.alertTime}

⚠️ *AÇÃO IMEDIATA NECESSÁRIA*

${VARIABLES.alertDescription}

📊 Valor: *${VARIABLES.triggerValue} ${VARIABLES.unit}*

👉 ${VARIABLES.dashboardUrl}`,
    variables: Object.keys(VARIABLES),
    isActive: true,
  },
};

// Get template by channel and type
export function getTemplate(
  channel: 'email' | 'sms' | 'whatsapp',
  type: string
): NotificationTemplate | undefined {
  const templates = {
    email: emailTemplates,
    sms: smsTemplates,
    whatsapp: whatsAppTemplates,
  };

  return templates[channel]?.[type];
}

// Render template with variables
export function renderTemplate(
  template: NotificationTemplate,
  variables: Record<string, string | number>
): { subject: string; body: string; html?: string } {
  let subject = template.subject;
  let body = template.bodyTemplate;
  let html = template.htmlTemplate;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    const strValue = String(value);

    subject = subject.replace(new RegExp(placeholder, 'g'), strValue);
    body = body.replace(new RegExp(placeholder, 'g'), strValue);
    if (html) {
      html = html.replace(new RegExp(placeholder, 'g'), strValue);
    }
  }

  return { subject, body, html };
}
