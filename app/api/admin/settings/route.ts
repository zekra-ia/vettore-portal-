import { requireApi } from '@/lib/server/admin';
import { db } from '@/lib/server/db';
import { logEvent } from '@/lib/server/events';
import { json } from '@/lib/server/request';
import { handle } from '@/lib/server/handle';

const s = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export const PUT = handle(async (req: Request) => {
  const { tenant, actor } = await requireApi('manage_license');
  const b = await req.json().catch(() => ({}));
  const controller = {
    name: s(b.controller?.name, 200), address: s(b.controller?.address, 400), email: s(b.controller?.email, 200),
    privacy_url: /^https:\/\//.test(s(b.controller?.privacy_url)) ? s(b.controller?.privacy_url) : '',
    privacy_text: s(b.controller?.privacy_text, 20000), retention: s(b.controller?.retention, 500),
  };
  const notify = (Array.isArray(b.notify_emails) ? b.notify_emails : String(b.notify_emails || '').split(/[,\s]+/))
    .map((x: string) => x.trim().toLowerCase()).filter((x: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)).slice(0, 10);
  const ready = controller.name && controller.email && (controller.privacy_url || controller.privacy_text) && controller.retention;
  const privacyReady = Boolean(b.privacy_ready) && Boolean(ready);
  await db()`update tenants set controller = ${db().json(controller)}, notify_emails = ${notify}, privacy_ready = ${privacyReady} where id = ${tenant.id}`;
  await logEvent(tenant.id, null, actor, 'settings_updated', { privacy_ready: privacyReady, notify_count: notify.length });
  return json({ ok: true, privacy_ready: privacyReady, missing: ready ? [] : ['Veri sorumlusu adı, e-posta, aydınlatma metni (bağlantı veya metin) ve saklama süresi zorunludur.'] });
});
