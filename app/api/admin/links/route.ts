import { createShareLink } from '@/lib/server/links';
import { requireApi } from '@/lib/server/admin';
import { json } from '@/lib/server/request';
import { handle } from '@/lib/server/handle';
import { db } from '@/lib/server/db';

export const POST = handle(async (req: Request) => {
  const { user, tenant, actor } = await requireApi('manage_links');
  const b = await req.json().catch(() => ({}));
  let rep: string | null = b.sales_rep_id || null;
  if (rep) { const [u] = await db()`select id from users where id = ${rep} and tenant_id = ${tenant.id}`; rep = u?.id ?? null; }
  if (user.role === 'sales') rep = user.id;
  const days = Number(b.expires_days) > 0 ? Math.min(Number(b.expires_days), 365) : null;
  return json(await createShareLink(tenant.id, tenant.slug, String(b.label || ''), rep, days, actor));
});
