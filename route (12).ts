import { revealShareLink, revokeShareLink } from '@/lib/server/links';
import { requireApi } from '@/lib/server/admin';
import { fail, json } from '@/lib/server/request';
import { handle } from '@/lib/server/handle';

type Ctx = { params: Promise<{ id: string }> };
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { tenant } = await requireApi('manage_links', false);
  const r = await revealShareLink(tenant.id, tenant.slug, (await params).id);
  return r ? json(r) : fail(404, 'Bağlantı iptal edilmiş veya bulunamadı.');
});
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { tenant, actor } = await requireApi('manage_links');
  await revokeShareLink(tenant.id, (await params).id, actor);
  return json({ ok: true });
});
