import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/server/admin';
import { can } from '@/lib/server/auth';
import { AppError, events, fullData, getForTenant, STATUS_LABEL, TRANSITIONS } from '@/lib/server/applications';
import { formById } from '@/lib/server/tenant';
import { internalView } from '@/lib/form/definition';
import { buildPrintable } from '@/lib/docs/printable';
import { db } from '@/lib/server/db';
import { logEvent } from '@/lib/server/events';
import Shell from '@/components/admin/Shell';
import Actions from '@/components/admin/Actions';
import { human } from '@/components/form/labels';

export const dynamic = 'force-dynamic';

const ACTION_LABEL: Record<string, string> = {
  created: 'Başvuru bağlantısı açıldı', draft_saved: 'Taslak kaydedildi', submitted: 'Başvuru gönderildi', resubmitted: 'Başvuru güncellenip yeniden gönderildi',
  viewed: 'Görüntülendi', status_changed: 'Durum değişti', info_requested: 'Eksik bilgi talep edildi', internal_updated: 'İç değerlendirme güncellendi',
  pdf_generated: 'PDF oluşturuldu', docx_generated: 'Word belgesi oluşturuldu', email_sent: 'E-posta gönderildi', email_logged: 'E-posta kaydedildi (gönderilmedi)',
  email_blocked: 'E-posta engellendi', email_failed: 'E-posta gönderilemedi', anonymized: 'Kişisel veriler silindi',
};

export default async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { user, tenant } = await requireAdminPage();
  const { id } = await params;
  let app;
  try { app = await getForTenant(tenant.id, id); } catch (e) { if (e instanceof AppError) notFound(); throw e; }
  const model = await formById(app.form_id);
  const mask = !can(user, 'view_sensitive');

  const [{ recent }] = await db()`select exists(select 1 from application_events where application_id = ${app.id} and action = 'viewed' and actor_id = ${user.id} and at > now() - interval '30 minutes') recent`;
  if (!recent) await logEvent(tenant.id, app.id, { type: 'user', id: user.id, label: user.name }, 'viewed');

  const printable = buildPrintable(model, fullData(app), {}, { tenantName: tenant.name, wordmark: tenant.brand.wordmark, colors: tenant.brand.colors, refNo: app.ref_no || '—',
    submittedAt: app.submitted_at, generatedAt: new Date(), salesRep: null, statusLabel: STATUS_LABEL[app.status], isTest: app.is_test, variant: 'internal' }, { maskSensitive: mask });
  const history = await events(app.id);
  const [rep] = app.sales_rep_id ? await db()`select name from users where id = ${app.sales_rep_id}` : [];

  return (
    <Shell user={user} tenant={tenant} active="apps">
      <Link href="/admin" className="text-sm text-muted underline">Başvurulara dön</Link>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="text-2xl font-medium">{app.company_name || 'Firma adı girilmedi'}</h1>
        <span className={`status status-${app.status}`}>{STATUS_LABEL[app.status]}</span>
        {app.is_test && <span className="text-xs text-[#8A5310] bg-[#FBEBD3] rounded px-1.5 py-0.5">test</span>}
      </div>
      <p className="mt-1 text-muted text-sm tabular-nums">
        {app.ref_no || 'Henüz gönderilmedi'}{app.submitted_at && <> · gönderim {new Date(app.submitted_at).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul' })}</>}{rep && <> · temsilci {rep.name}</>}
      </p>

      {app.anonymized_at ? (
        <p className="mt-6 sheet p-5">Bu başvurunun kişisel verileri {new Date(app.anonymized_at).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })} tarihinde silindi. Kayıt numarası ve işlem geçmişi korunmaktadır.</p>
      ) : (
        <div className="mt-6 grid lg:grid-cols-[1fr_22rem] gap-6 items-start">
          <div className="grid gap-5 min-w-0">
            {app.status === 'needs_info' && app.info_request && (
              <div className="rounded-lg border-l-4 border-gold bg-paper px-4 py-3"><p className="text-sm text-muted">Müşteriden istenen bilgi</p><p className="mt-1 whitespace-pre-line">{app.info_request}</p></div>
            )}
            <h2 className="text-lg font-medium">Müşteri beyanı</h2>
            {printable.customer.map(s => (
              <section key={s.no} className="sheet p-4 sm:p-6">
                <h3 className="flex items-baseline gap-3 pb-3 mb-3 border-b border-line"><span className="text-xl font-light text-gold tabular-nums">{s.no}</span><span className="font-medium">{human(s.title)}</span></h3>
                <dl className="grid gap-y-2">
                  {s.items.map((it, i) => it.kind === 'sub' ? <dt key={i} className="mt-3 text-sm font-medium text-gold-ink">{human(it.title)}</dt>
                    : it.kind === 'row' ? (it.blank ? null : (
                      <div key={i} className="grid sm:grid-cols-[13rem_1fr] gap-x-4">
                        <dt className="text-sm text-muted">{human(it.label)}</dt>
                        <dd className="break-words">{it.value || <span className="text-muted">—</span>}</dd>
                      </div>))
                    : it.kind === 'table' ? (
                      <div key={i} className="overflow-x-auto"><table className="w-full text-sm mt-1"><thead><tr>{it.headers.map(h => <th key={h} className="text-left font-medium text-muted py-1.5 pr-3 border-b border-line">{human(h)}</th>)}</tr></thead>
                        <tbody>{it.rows.filter(r => r.some(Boolean)).map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} className="py-1.5 pr-3 border-b border-line/60 tabular-nums">{c || '—'}</td>)}</tr>)}</tbody></table></div>)
                    : <p key={i} className="text-sm text-muted">{it.text}</p>)}
                </dl>
              </section>
            ))}
            {app.consent?.at && (
              <section className="sheet p-4 sm:p-6 text-sm">
                <h3 className="font-medium mb-2">Onay ve rıza kaydı</h3>
                <p>Beyan: {app.consent.declaration ? 'onaylandı' : '—'} · {app.consent.signatory?.name} ({app.consent.signatory?.title})</p>
                <p className="text-muted mt-1">{new Date(app.consent.at).toLocaleString('tr-TR')} · IP {app.consent.ip || '—'} · form sürümü {app.consent.form_version}</p>
              </section>
            )}
          </div>
          <Actions
            id={app.id} status={app.status} hasRef={!!app.ref_no} transitions={TRANSITIONS[app.status]} statusLabels={STATUS_LABEL}
            canDecide={can(user, 'decide')} canInternal={can(user, 'edit_internal')} canDelete={can(user, 'export')}
            internalSections={JSON.parse(JSON.stringify(internalView(model)))} internal={app.internal || {}} contactEmail={app.contact_email}
            currency={String(app.data?.finance?.currency || 'TRY')}
            history={history.map(h => ({ at: h.at.toISOString(), who: h.actor_label || (h.actor_type === 'system' ? 'Sistem' : h.actor_type === 'customer' ? 'Müşteri' : 'Kullanıcı'), what: ACTION_LABEL[h.action] || h.action,
              extra: h.action === 'status_changed' ? `${STATUS_LABEL[h.details.from as keyof typeof STATUS_LABEL]} → ${STATUS_LABEL[h.details.to as keyof typeof STATUS_LABEL]}` : h.action === 'info_requested' ? h.details.message : h.action.startsWith('email_') ? h.details.reason || h.details.subject : h.details.variant === 'internal' ? 'iç değerlendirme dahil' : undefined }))}
          />
        </div>
      )}
    </Shell>
  );
}
