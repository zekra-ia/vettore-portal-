import { redirect } from 'next/navigation';
import { requireAdminPage } from '@/lib/server/admin';
import { usageStats } from '@/lib/server/license';
import Shell from '@/components/admin/Shell';
import LicenseControls from '@/components/admin/LicenseControls';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Lisans ve ayarlar' };

export default async function LicensePage() {
  const { user, tenant } = await requireAdminPage();
  if (user.role !== 'admin') redirect('/admin');
  const s = await usageStats(tenant.id);
  const fmt = (d: Date | null) => (d ? new Date(d).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Istanbul' }) : '—');
  const STATUS: Record<string, string> = { pending: 'Etkinleştirilmedi (test modu)', active: 'Demo aktif', expired: 'Süresi doldu', paid: 'Ücretli lisans', suspended: 'Askıya alındı' };
  const stats: [string, number][] = [
    ['Oluşturulan başvuru', s.total], ['Gönderilen başvuru', s.submitted], ['Tamamlanan', s.completed], ['Onaylanan', s.approved],
    ['Eksik bilgi bekleyen', s.needs_info], ['Taslak', s.drafts], ['PDF çıktısı', s.events.pdf_generated || 0], ['Word çıktısı', s.events.docx_generated || 0],
    ['Gönderilen e-posta', s.events.email_sent || 0], ['Test başvurusu', s.tests],
  ];
  return (
    <Shell user={user} tenant={tenant} active="license">
      <h1 className="text-2xl font-medium">Lisans ve ayarlar</h1>
      <section className="mt-6 sheet p-5 sm:p-6">
        <h2 className="font-medium">30 günlük demo</h2>
        <dl className="mt-3 grid sm:grid-cols-3 gap-4">
          <div><dt className="text-sm text-muted">Durum</dt><dd className="font-medium">{STATUS[tenant.license_status]}</dd></div>
          <div><dt className="text-sm text-muted">Aktivasyon</dt><dd>{fmt(tenant.activated_at)}</dd></div>
          <div><dt className="text-sm text-muted">Bitiş</dt><dd>{fmt(tenant.expires_at)}</dd></div>
        </dl>
        <p className="mt-3 text-sm text-muted max-w-[70ch]">Demo, ilk canlı aktivasyonla başlar ve {tenant.demo_days} gün sonra sunucu tarafında otomatik kapanır. Süre bitince yeni başvuru alınmaz; mevcut veriler silinmez ve aşağıdan dışa aktarılabilir. Sayımlarda test başvuruları ayrı tutulur.</p>
        <ul className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-px bg-line border border-line rounded-lg overflow-hidden">
          {stats.map(([k, v]) => <li key={k} className="bg-paper px-3 py-3"><p className="text-2xl font-light tabular-nums">{v}</p><p className="text-xs text-muted">{k}</p></li>)}
        </ul>
        <div className="mt-5 flex flex-wrap gap-2">
          <a className="btn btn-ghost btn-sm" href="/api/admin/export?format=csv">Başvuru listesi (CSV)</a>
          <a className="btn btn-ghost btn-sm" href="/api/admin/export?format=json">Tüm veriler (JSON)</a>
        </div>
      </section>
      <LicenseControls status={tenant.license_status} privacyReady={tenant.privacy_ready} controller={tenant.controller} notifyEmails={tenant.notify_emails} senderEmail={tenant.sender_email} emailProvider={process.env.EMAIL_PROVIDER || 'log'} />
    </Shell>
  );
}
