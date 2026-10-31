import { getForTenant, AppError } from '@/lib/server/applications';
import { requireApi } from '@/lib/server/admin';
import { can } from '@/lib/server/auth';
import { generate, fileResponse } from '@/lib/server/documents';
import { handle } from '@/lib/server/handle';

export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { user, tenant, actor } = await requireApi('view', false);
  const u = new URL(req.url);
  const format = u.searchParams.get('format') === 'docx' ? 'docx' : 'pdf';
  const variant = u.searchParams.get('variant') === 'internal' ? 'internal' : 'customer';
  if (variant === 'internal' && !can(user, 'edit_internal')) throw new AppError(403, 'İç değerlendirmeyi indirme yetkiniz yok.');
  const app = await getForTenant(tenant.id, (await params).id);
  if (!app.ref_no) throw new AppError(409, 'Taslak başvurular için belge üretilmez.');
  const doc = await generate(app, tenant, format, variant, actor, { maskSensitive: !can(user, 'view_sensitive') });
  return fileResponse(doc.buf, doc.filename, doc.contentType);
});
