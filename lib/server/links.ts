import QRCode from 'qrcode';
import { db } from './db';
import { decryptJson, encryptJson, hashToken, newToken } from './crypto';
import { logEvent, type Actor } from './events';
import { baseUrl } from './request';

export function publicUrl(slug: string, token: string) { return `${baseUrl()}/t/${slug}?k=${token}`; }

export async function createShareLink(tenantId: string, slug: string, label: string, salesRepId: string | null, expiresDays: number | null, actor: Actor) {
  const token = newToken();
  const [row] = await db()`insert into share_links (tenant_id, token_hash, token_enc, token_hint, label, sales_rep_id, created_by, expires_at)
    values (${tenantId}, ${hashToken(token)}, ${encryptJson(token)}, ${token.slice(-4)}, ${label.trim().slice(0, 80) || 'Genel bağlantı'}, ${salesRepId}, ${actor.id ?? null},
            ${expiresDays ? new Date(Date.now() + expiresDays * 86400_000) : null})
    returning id`;
  await logEvent(tenantId, null, actor, 'link_created', { label, link_id: row.id });
  const url = publicUrl(slug, token);
  return { id: row.id, url, qr: await qrDataUrl(url) };
}

export async function listShareLinks(tenantId: string) {
  return db()`select l.id, l.label, l.token_hint, l.uses, l.created_at, l.expires_at, l.revoked_at, u.name sales_rep_name
    from share_links l left join users u on u.id = l.sales_rep_id where l.tenant_id = ${tenantId} order by l.created_at desc`;
}

/** Yönetici için bağlantıyı yeniden üretir (token şifreli saklandığı için). */
export async function revealShareLink(tenantId: string, slug: string, id: string) {
  const [l] = await db()`select token_enc, revoked_at from share_links where id = ${id} and tenant_id = ${tenantId}`;
  if (!l?.token_enc || l.revoked_at) return null;
  const url = publicUrl(slug, decryptJson<string>(l.token_enc)!);
  return { url, qr: await qrDataUrl(url) };
}

export async function revokeShareLink(tenantId: string, id: string, actor: Actor) {
  await db()`update share_links set revoked_at = now() where id = ${id} and tenant_id = ${tenantId} and revoked_at is null`;
  await logEvent(tenantId, null, actor, 'link_revoked', { link_id: id });
}

export async function qrDataUrl(url: string) {
  return QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 512, color: { dark: '#1F1B16', light: '#FFFFFF' } });
}
export async function qrPng(url: string) {
  return QRCode.toBuffer(url, { errorCorrectionLevel: 'M', margin: 2, width: 1024, color: { dark: '#1F1B16', light: '#FFFFFF' } });
}
