import { requireApi } from '@/lib/server/admin';
import { db } from '@/lib/server/db';
import { logEvent } from '@/lib/server/events';
import { fullData, STATUS_LABEL, type AppRow } from '@/lib/server/applications';
import { handle } from '@/lib/server/handle';

/** Kiracının tüm başvurularını dışa aktarır (JSON: tam veri; CSV: özet liste). İşlem kayıt altına alınır. */
export const GET = handle(async (req: Request) => {
  const { tenant, actor } = await requireApi('export', false);
  const format = new URL(req.url).searchParams.get('format') === 'csv' ? 'csv' : 'json';
  const rows = await db()<(AppRow & { sales_rep_name: string | null })[]>`select a.*, u.name sales_rep_name from applications a left join users u on u.id = a.sales_rep_id where a.tenant_id = ${tenant.id} order by a.created_at`;
  await logEvent(tenant.id, null, actor, 'exported', { format, count: rows.length });
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'json') {
    const out = rows.map(a => ({ ref_no: a.ref_no, status: a.status, is_test: a.is_test, created_at: a.created_at, submitted_at: a.submitted_at,
      decided_at: a.decided_at, sales_rep: a.sales_rep_name, anonymized_at: a.anonymized_at, customer: a.anonymized_at ? null : fullData(a), internal: a.internal, consent: a.consent }));
    return new Response(JSON.stringify({ tenant: tenant.name, exported_at: new Date(), applications: out }, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${tenant.slug}-export-${stamp}.json"`, 'Cache-Control': 'no-store' } });
  }
  const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const header = ['Kayıt No', 'Durum', 'Firma', 'Ülke', 'Satış temsilcisi', 'Oluşturma', 'Gönderim', 'Karar', 'Test'];
  const lines = rows.map(a => [a.ref_no, STATUS_LABEL[a.status], a.company_name, a.country, a.sales_rep_name, a.created_at?.toISOString(), a.submitted_at?.toISOString(), a.decided_at?.toISOString(), a.is_test ? 'evet' : 'hayır'].map(esc).join(';'));
  return new Response('﻿' + [header.join(';'), ...lines].join('\r\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${tenant.slug}-basvurular-${stamp}.csv"`, 'Cache-Control': 'no-store' } });
});
