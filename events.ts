import { db } from './db';

export interface Actor { type: 'customer' | 'user' | 'system'; id?: string | null; label?: string | null }

export async function logEvent(tenantId: string, applicationId: string | null, actor: Actor, action: string, details: Record<string, unknown> = {}, ip: string | null = null) {
  await db()`insert into application_events (tenant_id, application_id, actor_type, actor_id, actor_label, action, details, ip)
             values (${tenantId}, ${applicationId}, ${actor.type}, ${actor.id ?? null}, ${actor.label ?? null}, ${action}, ${db().json(details as never)}, ${ip})`;
}
