'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface L { id: string; label: string; hint: string; uses: number; created_at: string; expires_at: string | null; revoked: boolean; rep: string | null }

export default function LinkManager({ links, reps, isSales }: { links: L[]; reps: { id: string; name: string }[]; isSales: boolean }) {
  const router = useRouter();
  const [shown, setShown] = useState<{ id?: string; url: string; qr: string; label: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr(null);
    const f = new FormData(e.currentTarget);
    const r = await fetch('/api/admin/links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: f.get('label'), sales_rep_id: f.get('rep') || null, expires_days: f.get('days') || null }) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) return setErr(j.error);
    setShown({ id: j.id, url: j.url, qr: j.qr, label: String(f.get('label') || 'Genel bağlantı') });
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }
  async function reveal(l: L) {
    const r = await fetch(`/api/admin/links/${l.id}`); const j = await r.json();
    if (r.ok) setShown({ id: l.id, url: j.url, qr: j.qr, label: l.label }); else setErr(j.error);
  }
  async function revoke(l: L) {
    if (!confirm(`"${l.label}" bağlantısı iptal edilsin mi? Bu bağlantıyla yeni başvuru başlatılamaz; mevcut başvurular etkilenmez.`)) return;
    await fetch(`/api/admin/links/${l.id}`, { method: 'DELETE' }); if (shown?.id === l.id) setShown(null); router.refresh();
  }
  const msg = shown ? `Merhaba, VETTOREHOME müşteri kaydınızı bu güvenli bağlantıdan tamamlayabilirsiniz: ${shown.url}` : '';

  return (
    <div className="mt-6 grid lg:grid-cols-[1fr_22rem] gap-6 items-start">
      <div className="grid gap-6">
        <form onSubmit={create} className="sheet p-4 sm:p-5 grid sm:grid-cols-[1fr_12rem_8rem_auto] gap-3 items-end">
          <div><label className="field-label" htmlFor="label">Bağlantı adı</label><input id="label" name="label" className="input" placeholder="ör. İstanbul fuarı standı" maxLength={80} /></div>
          {!isSales && <div><label className="field-label" htmlFor="rep">Satış temsilcisi</label><select id="rep" name="rep" className="input"><option value="">Atanmasın</option>{reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>}
          <div><label className="field-label" htmlFor="days">Geçerlilik</label><select id="days" name="days" className="input"><option value="">Süresiz</option><option value="7">7 gün</option><option value="30">30 gün</option><option value="90">90 gün</option></select></div>
          <button className="btn btn-primary" disabled={busy}>Bağlantı oluştur</button>
          {err && <p role="alert" className="err sm:col-span-4">{err}</p>}
        </form>

        {links.length === 0 ? <p className="text-muted">Henüz bağlantı yok. Yukarıdan ilk bağlantınızı oluşturun.</p> : (
          <ul className="sheet divide-y divide-line">
            {links.map(l => (
              <li key={l.id} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                <div className="min-w-0 flex-1">
                  <p className={`font-medium truncate ${l.revoked ? 'line-through text-muted' : ''}`}>{l.label}</p>
                  <p className="text-xs text-muted">…{l.hint} · {l.uses} başvuru{l.rep ? ` · ${l.rep}` : ''} · {new Date(l.created_at).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}{l.expires_at ? ` · bitiş ${new Date(l.expires_at).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}` : ''}{l.revoked ? ' · iptal edildi' : ''}</p>
                </div>
                {!l.revoked && <div className="flex gap-2"><button className="btn btn-ghost btn-sm" onClick={() => reveal(l)}>Göster / QR</button><button className="btn btn-ghost btn-sm" onClick={() => revoke(l)}>İptal et</button></div>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside className="sheet p-5 lg:sticky lg:top-6">
        {shown ? (
          <div>
            <p className="font-medium">{shown.label}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shown.qr} alt={`${shown.label} için QR kod`} className="mt-3 w-full max-w-[16rem] mx-auto rounded-lg border border-line" />
            <input readOnly value={shown.url} className="input mt-3 !text-xs" onFocus={e => e.currentTarget.select()} aria-label="Bağlantı adresi" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(shown.url)}>Kopyala</button>
              <a className="btn btn-ghost btn-sm" href={shown.qr} download={`QR-${shown.label.replace(/\W+/g, '_')}.png`}>QR indir</a>
              <a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(msg)}`}>WhatsApp</a>
              <a className="btn btn-ghost btn-sm" href={`mailto:?subject=${encodeURIComponent('VETTOREHOME müşteri bilgi formu')}&body=${encodeURIComponent(msg)}`}>E-posta</a>
            </div>
          </div>
        ) : <p className="text-muted text-sm">Bir bağlantı oluşturun veya listeden "Göster / QR" seçin; QR kod ve paylaşım seçenekleri burada görünür.</p>}
      </aside>
    </div>
  );
}
