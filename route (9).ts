import { login } from '@/lib/server/auth';
import { tenantBySlug } from '@/lib/server/tenant';
import { logEvent } from '@/lib/server/events';
import { clientIp, fail, json, sameOrigin } from '@/lib/server/request';
import { handle } from '@/lib/server/handle';

export const POST = handle(async (req: Request) => {
  if (!(await sameOrigin())) return fail(403, 'Geçersiz istek kaynağı.');
  const b = await req.json().catch(() => ({}));
  const tenant = await tenantBySlug(String(b.slug || 'vettore'));
  if (!tenant) return fail(401, 'E-posta veya parola hatalı.');
  const ip = await clientIp();
  const r = await login(tenant.id, String(b.email || ''), String(b.password || ''));
  await logEvent(tenant.id, null, { type: 'user', id: r.user?.id, label: r.user?.name || String(b.email || '').replace(/^[^@]+/, '***') }, r.user ? 'login' : 'login_failed', {}, ip);
  return r.user ? json({ ok: true }) : fail(401, r.error!);
});
