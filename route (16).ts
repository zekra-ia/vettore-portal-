import { changeStatus, TRANSITIONS, AppError, type Status } from '@/lib/server/applications';
import { requireApi } from '@/lib/server/admin';
import { json } from '@/lib/server/request';
import { handle } from '@/lib/server/handle';

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { tenant, actor } = await requireApi('decide');
  const { to } = await req.json().catch(() => ({}));
  if (!(to in TRANSITIONS)) throw new AppError(400, 'Geçersiz durum.');
  await changeStatus(tenant.id, (await params).id, to as Status, actor);
  return json({ ok: true });
});
