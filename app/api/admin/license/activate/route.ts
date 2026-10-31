import { requireApi } from '@/lib/server/admin';
import { activateDemo } from '@/lib/server/license';
import { json } from '@/lib/server/request';
import { handle } from '@/lib/server/handle';

export const POST = handle(async () => {
  const { tenant, actor } = await requireApi('manage_license');
  const t = await activateDemo(tenant, actor);
  return json({ ok: true, activated_at: t?.activated_at, expires_at: t?.expires_at });
});
