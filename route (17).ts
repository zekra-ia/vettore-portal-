import { updateInternal } from '@/lib/server/applications';
import { requireApi } from '@/lib/server/admin';
import { json } from '@/lib/server/request';
import { handle } from '@/lib/server/handle';

export const PUT = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { tenant, actor } = await requireApi('edit_internal');
  const { data } = await req.json().catch(() => ({}));
  const clean = await updateInternal(tenant.id, (await params).id, data || {}, actor);
  return json({ ok: true, data: clean });
});
