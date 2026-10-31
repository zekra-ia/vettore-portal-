import { submit, AppError } from '@/lib/server/applications';
import { clientIp, json, sameOrigin } from '@/lib/server/request';
import { handle } from '@/lib/server/handle';

export const POST = handle(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  if (!(await sameOrigin())) throw new AppError(403, 'Geçersiz istek kaynağı.');
  const body = await req.json().catch(() => null);
  if (!body || typeof body.data !== 'object') throw new AppError(400, 'Geçersiz veri.');
  const r = await submit((await params).token, body.data, await clientIp());
  return json({ ok: true, ...r });
});
