import { headers } from 'next/headers';

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const ip = (h.get('x-forwarded-for') || h.get('x-real-ip') || '').split(',')[0].trim();
  return /^[0-9a-f.:]+$/i.test(ip) ? ip : null;
}

export function baseUrl(): string {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
export function fail(status: number, message: string, extra: Record<string, unknown> = {}) {
  return json({ error: message, ...extra }, status);
}

/** Durum değiştiren isteklerde aynı kaynak kontrolü (CSRF'e karşı, SameSite çerezine ek olarak). */
export async function sameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get('origin');
  if (!origin) return true; // sunucu-sunucu veya eski tarayıcı; çerez SameSite=Lax yine korur
  const host = h.get('x-forwarded-host') || h.get('host');
  try { return new URL(origin).host === host; } catch { return false; }
}
