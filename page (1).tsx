import Link from 'next/link';
import { requireAdminPage } from '@/lib/server/admin';
import { listApplications, statusCounts, STATUS_LABEL, type Status } from '@/lib/server/applications';
import { db } from '@/lib/server/db';
import Shell from '@/components/admin/Shell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Başvurular' };

const TABS: { key: Status | ''; label: string }[] = [
  { key: 'submitted', label: 'Yeni' }, { key: 'needs_info', label: 'Eksik bilgi' }, { key: 'in_review', label: 'İncelemede' },
  { key: 'approved', label: 'Onaylanan' }, { key: 'rejected', label: 'Reddedilen' }, { key: 'completed', label: 'Tamamlanan' },
  { key: 'draft', label: 'Taslak' }, { key: '', label: 'Tümü' },
];

export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { user, tenant } = await requireAdminPage();
  const sp = await searchParams;
  const status = sp.status ?? 'submitted';
  const rows = await listApplications(tenant.id, { status: status || undefined, q: sp.q, rep: sp.rep, from: sp.from, to: sp.to, tests: sp.tests === '0' ? false : undefined });
  const counts = await statusCounts(tenant.id);
  const reps = await db()`select id, name from users where tenant_id = ${tenant.id} and active order by name`;
  const qs = (patch: Record<string, string>) => { const u = new URLSearchParams({ ...(Object.fromEntries(Object.entries(sp).filter(([, v]) => v)) as Record<string, string>), ...patch }); return `?${u}`; };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <Shell user={user} tenant={tenant} active="apps">
      <h1 className="text-2xl font-medium">Başvurular</h1>
      <div className="mt-5 flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(t => {
          const n = t.key ? counts[t.key] || 0 : total;
          const on = status === t.key;
          return (
            <Link key={t.label} href={qs({ status: t.key })} aria-current={on ? 'page' : undefined}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm border ${on ? 'bg-ink text-cream border-ink' : 'bg-paper border-line hover:border-gold'}`}>
              {t.label} <span className={`tabular-nums ${on ? 'text-cream/70' : 'text-muted'}`}>{n}</span>
            </Link>
          );
        })}
      </div>

      <form className="mt-4 grid grid-cols-2 sm:grid-cols-[1fr_12rem_9.5rem_9.5rem_auto] gap-2 items-end" method="get">
        <input type="hidden" name="status" value={status} />
        <div className="col-span-2 sm:col-span-1"><label className="field-label" htmlFor="q">Firma adı veya kayıt no</label><input id="q" name="q" defaultValue={sp.q} className="input" placeholder="Firma adı veya VET-…" /></div>
        <div className="col-span-2 sm:col-span-1"><label className="field-label" htmlFor="rep">Satış temsilcisi</label>
          <select id="rep" name="rep" defaultValue={sp.rep || ''} className="input"><option value="">Tümü</option>{reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
        <div><label className="field-label" htmlFor="from">Başlangıç</label><input id="from" name="from" type="date" defaultValue={sp.from} className="input" /></div>
        <div><label className="field-label" htmlFor="to">Bitiş</label><input id="to" name="to" type="date" defaultValue={sp.to} className="input" /></div>
        <button className="btn btn-primary col-span-2 sm:col-span-1">Filtrele</button>
      </form>

      {rows.length === 0 ? (
        <div className="mt-8 sheet p-8 text-center">
          <p className="font-medium">Bu görünümde başvuru yok.</p>
          <p className="mt-1 text-muted text-sm">Müşterilerinize göndermek için <Link className="underline text-gold-ink" href="/admin/links">bir paylaşım bağlantısı ve QR kod oluşturun</Link>.</p>
        </div>
      ) : (
        <ul className="mt-6 sheet divide-y divide-line overflow-hidden">
          {rows.map(r => (
            <li key={r.id}>
              <Link href={`/admin/a/${r.id}`} className="grid grid-cols-[1fr_auto] sm:grid-cols-[9.5rem_1fr_11rem_9rem_auto] gap-x-4 gap-y-1 items-center px-4 py-3.5 hover:bg-cream/50">
                <span className="tabular-nums font-medium text-sm sm:text-[0.95rem] order-2 sm:order-none text-right sm:text-left">{r.ref_no || <span className="text-muted">Taslak</span>}</span>
                <span className="truncate order-1 sm:order-none">{r.company_name || <span className="text-muted italic">Firma adı girilmedi</span>}{r.is_test && <span className="ml-2 text-xs text-[#8A5310] bg-[#FBEBD3] rounded px-1.5 py-0.5">test</span>}</span>
                <span className="text-sm text-muted order-3 sm:order-none truncate">{r.sales_rep_name || '—'}</span>
                <span className="text-sm text-muted order-4 sm:order-none tabular-nums">{new Date(r.submitted_at || r.updated_at).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}</span>
                <span className="order-5 sm:order-none col-span-2 sm:col-span-1"><span className={`status status-${r.status}`}>{STATUS_LABEL[r.status as Status]}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
