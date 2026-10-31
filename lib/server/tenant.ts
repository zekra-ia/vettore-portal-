import { db } from './db';
import { normalize, type FormModel } from '../form/definition';

export interface Tenant {
  id: string; slug: string; name: string; ref_prefix: string;
  brand: { wordmark: string[]; colors: { primary: string; surface: string; ink: string }; welcome: { title: string; text: string } };
  controller: { name?: string; address?: string; email?: string; privacy_url?: string; privacy_text?: string; retention?: string };
  notify_emails: string[]; sender_email: string | null; privacy_ready: boolean;
  demo_days: number; license_status: 'pending' | 'active' | 'expired' | 'paid' | 'suspended';
  activated_at: Date | null; expires_at: Date | null;
}

export async function tenantBySlug(slug: string): Promise<Tenant | null> {
  const [t] = await db()<Tenant[]>`select * from tenants where slug = ${slug}`;
  return t ? refreshLicense(t) : null;
}
export async function tenantById(id: string): Promise<Tenant | null> {
  const [t] = await db()<Tenant[]>`select * from tenants where id = ${id}`;
  return t ? refreshLicense(t) : null;
}

/** Süre dolmuşsa durumu sunucu tarafında 'expired' yapar. İstemci saatine asla güvenilmez. */
/** Eksik marka/ayar alanlarını güvenli varsayılanlarla tamamlar (yeni kiracı henüz yapılandırılmamış olabilir). */
function withDefaults(t: Tenant): Tenant {
  const b = (t.brand || {}) as Partial<Tenant['brand']>;
  return {
    ...t,
    brand: {
      wordmark: Array.isArray(b.wordmark) && b.wordmark.length ? b.wordmark : [t.name, ''],
      colors: { primary: '#6B5824', surface: '#F3EDE2', ink: '#29241E', ...(b.colors || {}) },
      welcome: { title: 'Müşteri Bilgi Formu', text: `${t.name} ile çalışmaya başlamak için firma bilgilerinizi bu güvenli form üzerinden iletebilirsiniz.`, ...(b.welcome || {}) },
    },
    controller: t.controller || {},
    notify_emails: t.notify_emails || [],
  };
}

async function refreshLicense(raw: Tenant): Promise<Tenant> {
  const t = withDefaults(raw);
  if (t.license_status === 'active' && t.expires_at && new Date(t.expires_at).getTime() <= Date.now()) {
    await db()`update tenants set license_status = 'expired' where id = ${t.id} and license_status = 'active'`;
    await db()`insert into application_events (tenant_id, actor_type, action, details) values (${t.id}, 'system', 'license_expired', ${db().json({ expires_at: t.expires_at })})`;
    return { ...t, license_status: 'expired' };
  }
  return t;
}

export type IntakeMode = 'live' | 'test' | 'closed';
/** pending: yalnızca test başvurusu; active/paid: canlı; expired/suspended: yeni başvuru kapalı. */
export function intakeMode(t: Tenant): IntakeMode {
  if (t.license_status === 'active' || t.license_status === 'paid') return 'live';
  if (t.license_status === 'pending') return 'test';
  return 'closed';
}

export async function activeForm(tenantId: string): Promise<{ id: string; model: FormModel }> {
  const [f] = await db()`select id, definition from forms where tenant_id = ${tenantId} and active order by created_at desc limit 1`;
  if (!f) throw new Error('Aktif form bulunamadı');
  return { id: f.id, model: normalize(f.definition) };
}
export async function formById(id: string): Promise<FormModel> {
  const [f] = await db()`select definition from forms where id = ${id}`;
  return normalize(f.definition);
}
