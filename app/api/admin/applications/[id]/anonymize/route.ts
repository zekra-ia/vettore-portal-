import { anonymize } from '@/lib/server/applications';
import { requireApi } from '@/lib/server/admin';
import { json } from '@/lib/server/request';
import { handle } from '@/lib/server/handle';

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { tenant, actor } = await requireApi('export');
  const { confirm } = await req.json().catch(() => ({}));
  if (confirm !== 'SİL') return json({ error: 'Onay için "SİL" yazın.' }, 400);
  await anonymize(tenant.id, (await params).id, actor);
  return json({ ok: true });
});
