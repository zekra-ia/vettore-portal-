import { loadByToken, AppError } from '@/lib/server/applications';
import { generate, fileResponse } from '@/lib/server/documents';
import { handle } from '@/lib/server/handle';

/** Müşterinin kendi başvurusunun PDF kopyası: yalnızca müşteri beyanı, iç değerlendirme hiçbir zaman yer almaz. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { app, tenant } = await loadByToken((await params).token);
  if (!app.ref_no) throw new AppError(409, 'PDF kopyası başvuru gönderildikten sonra oluşturulur.');
  const doc = await generate(app, tenant, 'pdf', 'customer', { type: 'customer' }, { maskSensitive: true });
  return fileResponse(doc.buf, doc.filename, doc.contentType);
});
