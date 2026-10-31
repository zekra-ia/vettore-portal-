import Link from 'next/link';
import type { SessionUser } from '@/lib/server/auth';
import type { Tenant } from '@/lib/server/tenant';
import { Wordmark, PoweredBy } from '@/components/Wordmark';

function LicenseBanner({ t }: { t: Tenant }) {
  if (t.license_status === 'pending') return <div className="bg-[#FBF1E2] text-[#7A4B12] text-sm px-4 py-2 text-center">Demo henüz etkinleştirilmedi: bağlantılar yalnızca <b>test başvurusu</b> oluşturur. <Link href="/admin/license" className="underline">Lisans ve ayarlar</Link></div>;
  if (t.license_status === 'expired') return <div className="bg-[#F8E3E1] text-error text-sm px-4 py-2 text-center">30 günlük demo süresi sona erdi; yeni başvuru alınmıyor. Mevcut veriler korunur ve dışa aktarılabilir.</div>;
  if (t.license_status === 'active' && t.expires_at) {
    const days = Math.max(0, Math.ceil((new Date(t.expires_at).getTime() - Date.now()) / 86400000));
    return <div className="bg-ink text-cream text-sm px-4 py-2 text-center">Demo aktif · {days} gün kaldı (bitiş {new Date(t.expires_at).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })})</div>;
  }
  return null;
}

export default function Shell({ user, tenant, active, children }: { user: SessionUser; tenant: Tenant; active: 'apps' | 'links' | 'license'; children: React.ReactNode }) {
  const nav = [
    { k: 'apps', href: '/admin', label: 'Başvurular' },
    { k: 'links', href: '/admin/links', label: 'Bağlantı ve QR' },
    ...(user.role === 'admin' ? [{ k: 'license', href: '/admin/license', label: 'Lisans ve ayarlar' }] : []),
  ];
  return (
    <div className="min-h-dvh flex flex-col">
      <LicenseBanner t={tenant} />
      <header className="bg-paper border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
          <Link href="/admin"><Wordmark parts={tenant.brand.wordmark} className="text-xl" /></Link>
          <nav className="flex gap-1 -mb-3 order-3 w-full sm:order-none sm:w-auto overflow-x-auto">
            {nav.map(n => (
              <Link key={n.k} href={n.href} aria-current={active === n.k ? 'page' : undefined}
                className={`px-3 py-2.5 text-[0.95rem] border-b-2 whitespace-nowrap ${active === n.k ? 'border-gold font-medium' : 'border-transparent text-muted hover:text-ink'}`}>{n.label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted hidden sm:inline">{user.name}</span>
            <form action="/api/admin/logout" method="post"><button className="underline text-muted hover:text-ink">Çıkış</button></form>
          </div>
        </div>
      </header>
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</div>
      <footer className="max-w-6xl w-full mx-auto px-4 sm:px-6 pb-6"><PoweredBy /></footer>
    </div>
  );
}
