import { customerPayload, loadByToken, saveDraft, AppError } from '@/lib/server/applications';
import { clientIp, json, sameOrigin } from '@/lib/server/request';
import { handle } from '@/lib/server/handle';

type Ctx = { params: Promise<{ token: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { app, tenant, model } = await loadByToken((await params).token);
  return json(customerPayload(app, tenant, model));
});

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  if (!(await sameOrigin())) throw new AppError(403, 'Geçersiz istek kaynağı.');
  const body = await req.json().catch(() => null);
  if (!body || typeof body.data !== 'object') throw new AppError(400, 'Geçersiz veri.');
  if (JSON.stringify(body.data).length > 200_000) throw new AppError(413, 'Veri çok büyük.');
  const { errors } = await saveDraft((await params).token, body.data, await clientIp());
  return json({ ok: true, savedAt: new Date().toISOString(), errors });
});
