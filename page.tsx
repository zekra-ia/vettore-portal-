import { requireAdminPage } from '@/lib/server/admin';
import Shell from '@/components/admin/Shell';
import PasswordForm from '@/components/admin/PasswordForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Hesabım' };

export default async function Account() {
  const { user, tenant } = await requireAdminPage();
  return (
    <Shell user={user} tenant={tenant} active="account">
      <h1 className="text-2xl font-medium">Hesabım</h1>
      <p className="mt-1 text-muted">{user.name} · {user.email}</p>
      <PasswordForm />
    </Shell>
  );
}
