// E-posta bildirimleri. Sağlayıcı yapılandırılmadıkça hiçbir e-posta gönderilmez; yalnızca işlem geçmişine yazılır.
// Gerçek gönderim için: EMAIL_PROVIDER=resend, RESEND_API_KEY ve kiracının doğrulanmış sender_email değeri gerekir.
import { logEvent } from './events';
import type { Tenant } from './tenant';

export interface Mail { to: string[]; subject: string; text: string; html?: string }
type Kind = 'new_application' | 'customer_receipt' | 'info_request';

function esc(s: string) { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)); }

export function brandHtml(t: Tenant, body: string) {
  const c = t.brand.colors;
  const [a, b] = t.brand.wordmark;
  return `<div style="font-family:Helvetica,Arial,sans-serif;background:${c.surface};padding:24px;color:${c.ink}">
  <div style="max-width:560px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e6dcc9">
    <div style="padding:20px 24px;border-bottom:3px solid ${c.primary};font-size:20px;letter-spacing:2px"><b>${esc(a)}</b><span style="font-weight:300">${esc(b || '')}</span></div>
    <div style="padding:24px;font-size:15px;line-height:1.55">${body}</div>
    <div style="padding:12px 24px;font-size:11px;color:#8a8170;border-top:1px solid #eee">Powered by ZEKRA IA</div>
  </div></div>`;
}

export async function sendMail(t: Tenant, kind: Kind, mail: Mail, ctx: { applicationId: string; isTest: boolean; toCustomer: boolean }) {
  const provider = process.env.EMAIL_PROVIDER || 'log';
  let to = mail.to.filter(Boolean);
  let outcome: 'sent' | 'logged' | 'blocked' | 'failed' = 'logged';
  let reason = '';

  if (ctx.isTest && ctx.toCustomer) { outcome = 'blocked'; reason = 'Test başvurusu: müşteriye e-posta gönderilmez.'; }
  else if (provider !== 'resend') { outcome = 'logged'; reason = 'E-posta sağlayıcısı yapılandırılmadı (EMAIL_PROVIDER=log).'; }
  else if (!t.sender_email) { outcome = 'logged'; reason = 'Kiracının doğrulanmış gönderici adresi yok.'; }
  else if (!to.length) { outcome = 'logged'; reason = 'Alıcı yok.'; }

  if (outcome === 'logged' && reason === '' ) {
    if (process.env.EMAIL_REDIRECT_TO) { to = [process.env.EMAIL_REDIRECT_TO]; }
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `${t.name} <${t.sender_email}>`, to, subject: mail.subject, text: mail.text, html: mail.html }),
      });
      outcome = r.ok ? 'sent' : 'failed';
      if (!r.ok) reason = `HTTP ${r.status}`;
    } catch (e) { outcome = 'failed'; reason = (e as Error).message; }
  }
  // Alıcı adresleri tam yazılmaz; işlem geçmişinde yalnızca alan adı görünür.
  await logEvent(t.id, ctx.applicationId, { type: 'system' }, `email_${outcome}`, {
    kind, recipients: to.map(x => x.replace(/^[^@]+/, '***')), subject: mail.subject, reason: reason || undefined,
  });
  return outcome;
}

export { esc };
