import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

function key(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) throw new Error('DATA_ENCRYPTION_KEY tanımlı değil');
  const k = Buffer.from(raw, 'base64');
  if (k.length !== 32) throw new Error('DATA_ENCRYPTION_KEY 32 bayt (base64) olmalı');
  return k;
}

/** AES-256-GCM; çıktı: v1.<iv>.<tag>.<ciphertext> (base64url) */
export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}

export function decryptJson<T = unknown>(payload: string | null | undefined): T | null {
  if (!payload) return null;
  const [v, iv, tag, ct] = payload.split('.');
  if (v !== 'v1') throw new Error('Bilinmeyen şifreleme sürümü');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8'));
}

/** URL'de kullanılan rastgele token (256 bit). Veritabanında yalnızca SHA-256 özeti tutulur. */
export function newToken(): string { return randomBytes(32).toString('base64url'); }
export function hashToken(t: string): string { return createHash('sha256').update(t).digest('hex'); }
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function sha256(buf: Buffer | string) { return createHash('sha256').update(buf).digest('hex'); }
