import { db } from './db';
import { logEvent, type Actor } from './events';
import { tenantById, type Tenant } from './tenant';
import { AppError } from './applications';

/** Demo, ilk canlı aktivasyonda başlar ve demo_days gün sonra sunucu tarafında kapanır. */
export async function activateDemo(tenant: Tenant, actor: Actor) {
  if (tenant.license_status !== 'pending') throw new AppError(409, 'Demo zaten etkinleştirilmiş.');
  if (!tenant.privacy_ready) throw new AppError(412, 'Gerçek veri toplamadan önce veri sorumlusu bilgileri ve aydınlatma metni doğrulanmalıdır.');
  await db()`update tenants set license_status = 'active', activated_at = now(), expires_at = now() + make_interval(days => demo_days)
             where id = ${tenant.id} and license_status = 'pending'`;
  await logEvent(tenant.id, null, actor, 'license_activated', { days: tenant.demo_days });
  return tenantById(tenant.id);
}

export async function usageStats(tenantId: string) {
  const sql = db();
  const [a] = await sql<{ total: number; submitted: number; completed: number; approved: number; needs_info: number; drafts: number; tests: number }[]>`select
      count(*) filter (where not is_test)::int total,
      count(*) filter (where not is_test and status <> 'draft')::int submitted,
      count(*) filter (where not is_test and status = 'completed')::int completed,
      count(*) filter (where not is_test and status = 'approved')::int approved,
      count(*) filter (where not is_test and status = 'needs_info')::int needs_info,
      count(*) filter (where not is_test and status = 'draft')::int drafts,
      count(*) filter (where is_test)::int tests
    from applications where tenant_id = ${tenantId}`;
  const ev = await sql`select action, count(*)::int n from application_events where tenant_id = ${tenantId}
      and action in ('pdf_generated','docx_generated','email_sent','email_logged','email_blocked','info_requested','viewed','exported','link_created')
      group by action`;
  return { ...a, events: Object.fromEntries(ev.map(r => [r.action, r.n])) as Record<string, number> };
}
