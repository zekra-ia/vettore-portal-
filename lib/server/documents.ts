import { db } from './db';
import { buildPrintable, type Variant } from '../docs/printable';
import { renderPdf } from '../docs/pdf';
import { renderDocx } from '../docs/docx';
import { fullData, STATUS_LABEL, type AppRow } from './applications';
import { formById, type Tenant } from './tenant';
import { logEvent, type Actor } from './events';
import { sha256 } from './crypto';

export async function generate(app: AppRow, tenant: Tenant, format: 'pdf' | 'docx', variant: Variant, actor: Actor, opts: { maskSensitive: boolean }) {
  if (!app.ref_no) throw new Error('Taslak başvurular için belge üretilmez.');
  const model = await formById(app.form_id);
  let salesRep: string | null = null;
  if (app.sales_rep_id) { const [u] = await db()`select name from users where id = ${app.sales_rep_id}`; salesRep = u?.name ?? null; }
  const p = buildPrintable(model, fullData(app), variant === 'internal' ? app.internal : {}, {
    tenantName: tenant.name, wordmark: tenant.brand.wordmark, colors: tenant.brand.colors, refNo: app.ref_no,
    submittedAt: app.submitted_at, generatedAt: new Date(), salesRep, statusLabel: STATUS_LABEL[app.status], isTest: app.is_test, variant,
  }, opts);
  const buf = format === 'pdf' ? await renderPdf(p) : await renderDocx(p);
  await logEvent(tenant.id, app.id, actor, `${format}_generated`, { variant, sha256: sha256(buf).slice(0, 16), bytes: buf.length });
  const safeName = (app.company_name || 'basvuru').replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40);
  const filename = `${app.ref_no}_${safeName}${variant === 'internal' ? '_IC' : ''}.${format}`;
  return { buf, filename, contentType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
}

export function fileResponse(buf: Buffer, filename: string, contentType: string, inline = false) {
  const ascii = filename.normalize('NFD').replace(/[^\x20-\x7E]/g, '_');
  return new Response(new Uint8Array(buf), { headers: {
    'Content-Type': contentType,
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  } });
}
