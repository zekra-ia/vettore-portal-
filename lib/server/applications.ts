import { db } from './db';
import { decryptJson, encryptJson, hashToken, newToken } from './crypto';
import { logEvent, type Actor } from './events';
import { activeForm, formById, intakeMode, tenantById, type Tenant } from './tenant';
import { mergeSensitive, splitSensitive, validate, type Errors } from '../form/validate';
import { customerView, getAt, type FormModel } from '../form/definition';
import { brandHtml, esc, sendMail } from './notify';
import { baseUrl } from './request';

export type Status = 'draft' | 'submitted' | 'needs_info' | 'in_review' | 'approved' | 'rejected' | 'completed';
export const STATUS_LABEL: Record<Status, string> = {
  draft: 'Taslak', submitted: 'Yeni başvuru', needs_info: 'Eksik bilgi bekleniyor', in_review: 'İncelemede',
  approved: 'Onaylandı', rejected: 'Reddedildi', completed: 'Tamamlandı',
};
export const TRANSITIONS: Record<Status, Status[]> = {
  draft: [],
  submitted: ['in_review', 'needs_info', 'approved', 'rejected'],
  in_review: ['needs_info', 'approved', 'rejected'],
  needs_info: ['in_review', 'rejected'],
  approved: ['completed', 'in_review'],
  rejected: ['in_review'],
  completed: [],
};

const DRAFT_TTL_DAYS = 30;
const INFO_TTL_DAYS = 7;
const START_LIMIT_PER_HOUR = 20;

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AppRow {
  id: string; tenant_id: string; form_id: string; ref_no: string | null; status: Status;
  share_link_id: string | null; sales_rep_id: string | null; company_name: string | null; country: string | null;
  contact_email: string | null; data: any; sensitive_enc: string | null; internal: any; consent: any;
  edit_token_hash: string | null; edit_token_expires_at: Date | null; editable: boolean; info_request: string | null;
  is_test: boolean; created_at: Date; updated_at: Date; submitted_at: Date | null; decided_at: Date | null; anonymized_at: Date | null;
}

export class AppError extends Error { constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) { super(message); } }

/** Genel paylaşım bağlantısından yeni başvuru (taslak) açar ve müşteriye özel düzenleme token'ı döndürür. */
export async function startFromShareLink(tenant: Tenant, shareToken: string, ip: string | null) {
  const mode = intakeMode(tenant);
  if (mode === 'closed') throw new AppError(403, 'Demo süresi sona erdiği için yeni başvuru alınmamaktadır.');
  const [link] = await db()`select * from share_links where tenant_id = ${tenant.id} and token_hash = ${hashToken(shareToken)}`;
  if (!link || link.revoked_at || (link.expires_at && new Date(link.expires_at) < new Date())) throw new AppError(404, 'Bağlantı geçersiz veya süresi dolmuş.');
  if (ip) {
    const [{ n }] = await db()`select count(*)::int n from application_events where tenant_id = ${tenant.id} and action = 'created' and ip = ${ip} and at > now() - interval '1 hour'`;
    if (n >= START_LIMIT_PER_HOUR) throw new AppError(429, 'Çok fazla deneme. Lütfen daha sonra tekrar deneyin.');
  }
  const form = await activeForm(tenant.id);
  const token = newToken();
  const [app] = await db()`
    insert into applications (tenant_id, form_id, share_link_id, sales_rep_id, is_test, edit_token_hash, edit_token_expires_at, created_ip, data)
    values (${tenant.id}, ${form.id}, ${link.id}, ${link.sales_rep_id}, ${mode === 'test'}, ${hashToken(token)},
            now() + make_interval(days => ${DRAFT_TTL_DAYS}), ${ip}, ${db().json({ company: { country: 'TR' } })})
    returning id`;
  await db()`update share_links set uses = uses + 1 where id = ${link.id}`;
  await logEvent(tenant.id, app.id, { type: 'customer' }, 'created', { share_link: link.label, test: mode === 'test' }, ip);
  return { token, applicationId: app.id };
}

export async function loadByToken(token: string) {
  if (!token || token.length < 30) throw new AppError(404, 'Bağlantı geçersiz.');
  const [app] = await db()<AppRow[]>`select * from applications where edit_token_hash = ${hashToken(token)}`;
  if (!app || app.anonymized_at) throw new AppError(404, 'Bağlantı geçersiz.');
  if (app.edit_token_expires_at && new Date(app.edit_token_expires_at) < new Date()) throw new AppError(410, 'Bu bağlantının süresi doldu. Lütfen Vettore yetkilinizden yeni bağlantı isteyin.');
  const tenant = (await tenantById(app.tenant_id))!;
  const model = await formById(app.form_id);
  return { app, tenant, model };
}

export function fullData(app: AppRow) {
  return mergeSensitive(app.data, decryptJson(app.sensitive_enc) || {});
}

/** Müşteriye dönen veri: iç alanlar hiçbir koşulda yer almaz. */
export function customerPayload(app: AppRow, tenant: Tenant, model: FormModel) {
  return {
    ref_no: app.ref_no, status: app.status, status_label: STATUS_LABEL[app.status], editable: app.editable,
    is_test: app.is_test, info_request: app.status === 'needs_info' ? app.info_request : null,
    submitted_at: app.submitted_at, expires_at: app.edit_token_expires_at,
    data: fullData(app),
    form: customerView(model),
    tenant: { name: tenant.name, brand: tenant.brand, controller: tenant.controller, intake: intakeMode(tenant) },
  };
}

function denormalize(clean: any) {
  return {
    company_name: (getAt(clean, ['company', 'trade_name']) as string) || null,
    country: (getAt(clean, ['company', 'country']) as string) || null,
    contact_email: (getAt(clean, ['contacts', 'legal_rep', 'email']) as string) || (getAt(clean, ['contacts', 'finance_contact', 'email']) as string) || null,
  };
}

async function persistCustomerData(app: AppRow, model: FormModel, clean: any) {
  const { open, sensitive } = splitSensitive(model, clean);
  const hasSecret = JSON.stringify(sensitive) !== '{}';
  const d = denormalize(clean);
  await db()`update applications set data = ${db().json(open)}, sensitive_enc = ${hasSecret ? encryptJson(sensitive) : null},
    company_name = ${d.company_name}, country = ${d.country}, contact_email = ${d.contact_email}, updated_at = now()
    where id = ${app.id}`;
}

export async function saveDraft(token: string, input: any, ip: string | null): Promise<{ errors: Errors }> {
  const { app, model } = await loadByToken(token);
  if (!app.editable) throw new AppError(409, 'Başvuru gönderildi; değişiklik için Vettore yetkilisinin talebi gerekir.');
  const { errors, clean } = validate(model, input, { mode: 'draft', audience: 'customer' });
  await persistCustomerData(app, model, clean);
  const [{ recent }] = await db()`select exists(select 1 from application_events where application_id = ${app.id} and action = 'draft_saved' and at > now() - interval '10 minutes') recent`;
  if (!recent) await logEvent(app.tenant_id, app.id, { type: 'customer' }, 'draft_saved', {}, ip);
  return { errors };
}

async function nextRef(tx: any, tenant: Tenant): Promise<string> {
  const year = new Date().getFullYear();
  const [{ last_no }] = await tx`insert into ref_counters (tenant_id, year, last_no) values (${tenant.id}, ${year}, 1)
    on conflict (tenant_id, year) do update set last_no = ref_counters.last_no + 1 returning last_no`;
  return `${tenant.ref_prefix}-${year}-${String(last_no).padStart(4, '0')}`;
}

export async function submit(token: string, input: any, ip: string | null) {
  const { app, tenant, model } = await loadByToken(token);
  if (!app.editable) throw new AppError(409, 'Bu başvuru zaten gönderildi.');
  if (app.status === 'draft' && intakeMode(tenant) === 'closed') throw new AppError(403, 'Demo süresi sona erdiği için yeni başvuru alınmamaktadır.');
  const { errors, clean } = validate(model, input, { mode: 'submit', audience: 'customer' });
  if (Object.keys(errors).length) {
    await persistCustomerData(app, model, validate(model, input, { mode: 'draft', audience: 'customer' }).clean);
    throw new AppError(422, 'Lütfen işaretli alanları düzeltin.', { errors });
  }
  await persistCustomerData(app, model, clean);
  const consent = {
    privacy_notice_ack: getAt(clean, ['preferences', 'privacy_notice_ack']) === true,
    kvkk_consent: getAt(clean, ['preferences', 'kvkk_consent']) || null,
    marketing_consent: getAt(clean, ['preferences', 'marketing_consent']) || null,
    declaration: getAt(clean, ['approval', 'company_signatory', 'declaration']) === true,
    signatory: { name: getAt(clean, ['approval', 'company_signatory', 'full_name']), title: getAt(clean, ['approval', 'company_signatory', 'title']) },
    at: new Date().toISOString(), ip, privacy_notice_url: tenant.controller.privacy_url || null, form_version: model.version,
  };
  const wasResubmit = app.status === 'needs_info';
  const ref = await db().begin(async tx => {
    const ref = app.ref_no || (await nextRef(tx, tenant));
    await tx`update applications set ref_no = ${ref}, status = 'submitted', editable = false, info_request = null,
      submitted_at = coalesce(submitted_at, now()), consent = ${tx.json(consent)},
      edit_token_expires_at = greatest(edit_token_expires_at, now() + interval '30 days') where id = ${app.id}`;
    return ref;
  });
  await logEvent(tenant.id, app.id, { type: 'customer', label: consent.signatory.name as string }, wasResubmit ? 'resubmitted' : 'submitted', { ref_no: ref }, ip);

  const company = (getAt(clean, ['company', 'trade_name']) as string) || '—';
  const adminLink = `${baseUrl()}/admin/a/${app.id}`;
  await sendMail(tenant, 'new_application', {
    to: tenant.notify_emails,
    subject: `${app.is_test ? '[TEST] ' : ''}${wasResubmit ? 'Güncellenen' : 'Yeni'} müşteri başvurusu: ${ref} – ${company}`,
    text: `${company} firmasının ${ref} numaralı başvurusu ${wasResubmit ? 'güncellendi' : 'alındı'}.\nİncelemek için: ${adminLink}`,
    html: brandHtml(tenant, `<p><b>${esc(company)}</b> firmasının <b>${ref}</b> numaralı başvurusu ${wasResubmit ? 'güncellendi' : 'alındı'}.</p><p><a href="${adminLink}">Başvuruyu yönetim panelinde aç</a></p>`),
  }, { applicationId: app.id, isTest: app.is_test, toCustomer: false });
  const contact = denormalize(clean).contact_email;
  if (contact) {
    await sendMail(tenant, 'customer_receipt', {
      to: [contact],
      subject: `${tenant.name} – Başvurunuz alındı (${ref})`,
      text: `Sayın yetkili,\n\n${company} adına yaptığınız başvuru ${ref} numarasıyla alınmıştır. Başvurunuzun kopyasını aşağıdaki bağlantıdan görüntüleyebilirsiniz.\n${baseUrl()}/f/${token}\n\n${tenant.name}`,
      html: brandHtml(tenant, `<p>Sayın yetkili,</p><p><b>${esc(company)}</b> adına yaptığınız başvuru <b>${ref}</b> numarasıyla alınmıştır.</p><p><a href="${baseUrl()}/f/${token}">Başvurunuzu görüntüleyin ve PDF kopyasını indirin</a></p>`),
    }, { applicationId: app.id, isTest: app.is_test, toCustomer: true });
  }
  return { ref_no: ref };
}

/* ---------- Yönetim paneli ---------- */

export interface ListFilter { status?: string; q?: string; rep?: string; from?: string; to?: string; tests?: boolean }

export async function listApplications(tenantId: string, f: ListFilter) {
  const sql = db();
  const q = f.q?.trim() ? `%${f.q.trim().toLowerCase()}%` : null;
  return sql`
    select a.id, a.ref_no, a.status, a.company_name, a.country, a.is_test, a.created_at, a.updated_at, a.submitted_at,
           u.name as sales_rep_name
    from applications a left join users u on u.id = a.sales_rep_id
    where a.tenant_id = ${tenantId} and a.anonymized_at is null
      ${f.status ? sql`and a.status = ${f.status}` : sql``}
      ${q ? sql`and (lower(coalesce(a.company_name,'')) like ${q} or lower(coalesce(a.ref_no,'')) like ${q})` : sql``}
      ${f.rep ? sql`and a.sales_rep_id = ${f.rep}` : sql``}
      ${f.from ? sql`and coalesce(a.submitted_at, a.created_at) >= ${f.from}::date` : sql``}
      ${f.to ? sql`and coalesce(a.submitted_at, a.created_at) < (${f.to}::date + 1)` : sql``}
      ${f.tests === false ? sql`and not a.is_test` : sql``}
    order by coalesce(a.submitted_at, a.updated_at) desc
    limit 500`;
}

export async function statusCounts(tenantId: string) {
  const rows = await db()`select status, count(*)::int n from applications where tenant_id = ${tenantId} and anonymized_at is null group by status`;
  return Object.fromEntries(rows.map(r => [r.status, r.n])) as Record<Status, number>;
}

export async function getForTenant(tenantId: string, id: string): Promise<AppRow> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AppError(404, 'Başvuru bulunamadı.');
  const [app] = await db()<AppRow[]>`select * from applications where id = ${id} and tenant_id = ${tenantId}`;
  if (!app) throw new AppError(404, 'Başvuru bulunamadı.');
  return app;
}

export async function events(appId: string) {
  return db()`select at, actor_type, actor_label, action, details from application_events where application_id = ${appId} order by at desc, id desc limit 200`;
}

export async function changeStatus(tenantId: string, id: string, to: Status, actor: Actor) {
  const app = await getForTenant(tenantId, id);
  if (!TRANSITIONS[app.status].includes(to)) throw new AppError(409, `"${STATUS_LABEL[app.status]}" durumundan "${STATUS_LABEL[to]}" durumuna geçilemez.`);
  const decided = to === 'approved' || to === 'rejected';
  await db()`update applications set status = ${to}, decided_at = ${decided ? new Date() : null}, updated_at = now() where id = ${id}`;
  if (decided) {
    // Bölüm 9 iç kullanım alanını otomatik doldur.
    const internal = { ...(app.internal || {}) };
    internal.approval = { ...(internal.approval || {}) };
    internal.approval.internal_use = {
      ...(internal.approval.internal_use || {}),
      approval_status: to === 'approved' ? 'ONAYLANDI' : 'REDDEDİLDİ',
      approval_date: new Date().toISOString().slice(0, 10),
      registered_at: internal.approval.internal_use?.registered_at || new Date(app.submitted_at || app.created_at).toISOString().slice(0, 10),
      registered_by: internal.approval.internal_use?.registered_by || actor.label,
    };
    await db()`update applications set internal = ${db().json(internal)} where id = ${id}`;
  }
  await logEvent(tenantId, id, actor, 'status_changed', { from: app.status, to });
}

export async function requestInfo(tenantId: string, id: string, message: string, actor: Actor) {
  const app = await getForTenant(tenantId, id);
  if (!TRANSITIONS[app.status].includes('needs_info')) throw new AppError(409, 'Bu durumda eksik bilgi talep edilemez.');
  const msg = message.trim().slice(0, 2000);
  if (msg.length < 5) throw new AppError(400, 'Lütfen müşteriden istenen bilgiyi yazın.');
  const token = newToken();
  await db()`update applications set status = 'needs_info', editable = true, info_request = ${msg}, edit_token_hash = ${hashToken(token)},
    edit_token_expires_at = now() + make_interval(days => ${INFO_TTL_DAYS}), updated_at = now() where id = ${id}`;
  await logEvent(tenantId, id, actor, 'info_requested', { message: msg, link_valid_days: INFO_TTL_DAYS });
  const tenant = (await tenantById(tenantId))!;
  const link = `${baseUrl()}/f/${token}`;
  let emailOutcome: string | null = null;
  if (app.contact_email) {
    emailOutcome = await sendMail(tenant, 'info_request', {
      to: [app.contact_email],
      subject: `${tenant.name} – Başvurunuz için ek bilgi gerekiyor (${app.ref_no})`,
      text: `Sayın yetkili,\n\n${app.ref_no} numaralı başvurunuz için aşağıdaki bilgilere ihtiyacımız var:\n\n${msg}\n\nBaşvurunuzu güncellemek için (bağlantı ${INFO_TTL_DAYS} gün geçerlidir):\n${link}\n\n${tenant.name}`,
      html: brandHtml(tenant, `<p>Sayın yetkili,</p><p><b>${app.ref_no}</b> numaralı başvurunuz için şu bilgilere ihtiyacımız var:</p><blockquote style="border-left:3px solid ${tenant.brand.colors.primary};margin:0;padding:8px 12px;background:#faf7f1">${esc(msg).replace(/\n/g, '<br>')}</blockquote><p><a href="${link}">Başvurunuzu güncelleyin</a> (bağlantı ${INFO_TTL_DAYS} gün geçerlidir)</p>`),
    }, { applicationId: id, isTest: app.is_test, toCustomer: true });
  }
  return { link, emailOutcome };
}

export async function updateInternal(tenantId: string, id: string, input: any, actor: Actor) {
  const app = await getForTenant(tenantId, id);
  const model = await formById(app.form_id);
  const { errors, clean } = validate(model, input, { mode: 'draft', audience: 'internal' });
  if (Object.keys(errors).length) throw new AppError(422, 'Lütfen işaretli alanları düzeltin.', { errors });
  await db()`update applications set internal = ${db().json(clean)}, updated_at = now() where id = ${id}`;
  await logEvent(tenantId, id, actor, 'internal_updated', {});
  return clean;
}

/** Bir başvurunun kişisel verilerini geri dönüşsüz siler (kayıt numarası ve işlem geçmişi korunur). */
export async function anonymize(tenantId: string, id: string, actor: Actor) {
  const app = await getForTenant(tenantId, id);
  await db()`update applications set data = '{}'::jsonb, sensitive_enc = null, internal = '{}'::jsonb, consent = '{}'::jsonb,
    company_name = null, contact_email = null, edit_token_hash = null, editable = false, anonymized_at = now() where id = ${id}`;
  await db()`update application_events set details = '{}'::jsonb, ip = null where application_id = ${id} and action <> 'anonymized'`;
  await logEvent(tenantId, id, actor, 'anonymized', { ref_no: app.ref_no });
}
/* eslint-enable @typescript-eslint/no-explicit-any */
