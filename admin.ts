import { redirect } from 'next/navigation';
import { can, currentUser, type SessionUser } from './auth';
import { AppError } from './applications';
import { tenantById, type Tenant } from './tenant';
import { sameOrigin } from './request';
import type { Actor } from './events';

export async function requireAdminPage(): Promise<{ user: SessionUser; tenant: Tenant }> {
  const user = await currentUser();
  if (!user) redirect('/admin/login');
  const tenant = (await tenantById(user.tenant_id))!;
  return { user, tenant };
}

export async function requireApi(permission: Parameters<typeof can>[1], mutating = true): Promise<{ user: SessionUser; tenant: Tenant; actor: Actor }> {
  if (mutating && !(await sameOrigin())) throw new AppError(403, 'Geçersiz istek kaynağı.');
  const user = await currentUser();
  if (!user) throw new AppError(401, 'Oturum açmanız gerekiyor.');
  if (!can(user, permission)) throw new AppError(403, 'Bu işlem için yetkiniz yok.');
  const tenant = (await tenantById(user.tenant_id))!;
  return { user, tenant, actor: { type: 'user', id: user.id, label: user.name } };
}
