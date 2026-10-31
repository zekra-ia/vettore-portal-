import { requireAdminPage } from '@/lib/server/admin';
import { listShareLinks } from '@/lib/server/links';
import { db } from '@/lib/server/db';
import Shell from '@/components/admin/Shell';
import LinkManager from '@/components/admin/LinkManager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bağlantı ve QR' };

export default async function LinksPage() {
  const { user, tenant } = await requireAdminPage();
  const links = await listShareLinks(tenant.id);
  const reps = await db()`select id, name from users where tenant_id = ${tenant.id} and active order by name`;
  return (
    <Shell user={user} tenant={tenant} active="links">
      <h1 className="text-2xl font-medium">Bağlantı ve QR</h1>
      <p className="mt-1 text-muted max-w-[62ch]">Aday müşterilerinize WhatsApp, e-posta veya QR kod ile gönderebileceğiniz başvuru bağlantıları. Her bağlantı açıldığında müşteriye özel, ayrı bir başvuru oluşur; müşteriler birbirlerinin bilgilerini göremez.</p>
      <LinkManager isSales={user.role === 'sales'} reps={reps.map(r => ({ id: r.id, name: r.name }))}
        links={links.map(l => ({ id: l.id, label: l.label, hint: l.token_hint, uses: l.uses, created_at: l.created_at.toISOString(), expires_at: l.expires_at?.toISOString() || null, revoked: !!l.revoked_at, rep: l.sales_rep_name }))} />
    </Shell>
  );
}
