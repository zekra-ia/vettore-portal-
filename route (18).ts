import { tenantBySlug } from '@/lib/server/tenant';
import { AppError, startFromShareLink } from '@/lib/server/applications';
import { baseUrl, clientIp } from '@/lib/server/request';

export async function POST(req: Request) {
  const form = await req.formData();
  const slug = String(form.get('slug') || '');
  const k = String(form.get('k') || '');
  const back = (msg: string) => Response.redirect(`${baseUrl()}/t/${encodeURIComponent(slug)}?k=${encodeURIComponent(k)}&e=${encodeURIComponent(msg)}`, 303);
  const tenant = await tenantBySlug(slug);
  if (!tenant) return new Response('Bulunamadı', { status: 404 });
  try {
    const { token } = await startFromShareLink(tenant, k, await clientIp());
    return Response.redirect(`${baseUrl()}/f/${token}`, 303);
  } catch (e) {
    if (e instanceof AppError) return back(e.message);
    throw e;
  }
}
