import { requestInfo } from '@/lib/server/applications';
import { requireApi } from '@/lib/server/admin';
import { json } from '@/lib/server/request';
import { handle } from '@/lib/server/handle';

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { tenant, actor } = await requireApi('decide');
  const { message } = await req.json().catch(() => ({}));
  const r = await requestInfo(tenant.id, (await params).id, String(message || ''), actor);
  return json({ ok: true, ...r });
});
