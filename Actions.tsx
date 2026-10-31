'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Section } from '@/lib/form/definition';
import { getAt, setAt } from '@/lib/form/definition';
import { FieldInput } from '@/components/form/FieldInput';
import { human } from '@/components/form/labels';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Props {
  id: string; status: string; hasRef: boolean; transitions: string[]; statusLabels: Record<string, string>;
  canDecide: boolean; canInternal: boolean; canDelete: boolean; internalSections: Section[]; internal: any; contactEmail: string | null; currency: string;
  history: { at: string; who: string; what: string; extra?: string }[];
}

const ACTION_TEXT: Record<string, string> = { in_review: 'İncelemeye al', approved: 'Onayla', rejected: 'Reddet', completed: 'Tamamlandı olarak işaretle', needs_info: 'Eksik bilgi iste' };

export default function Actions(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [askInfo, setAskInfo] = useState(false);
  const [infoText, setInfoText] = useState('');
  const [infoLink, setInfoLink] = useState<string | null>(null);
  const [internal, setInternal] = useState<any>(p.internal);
  const [intErrors, setIntErrors] = useState<Record<string, string>>({});

  async function call(url: string, method: string, body?: unknown) {
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || 'İşlem başarısız'), { errors: j.errors });
    return j;
  }
  async function setStatus(to: string) {
    if (to === 'rejected' && !confirm('Başvuru reddedilsin mi?')) return;
    setBusy(to); setMsg(null);
    try { await call(`/api/admin/applications/${p.id}/status`, 'POST', { to }); setMsg({ ok: true, text: `Durum: ${p.statusLabels[to]}` }); router.refresh(); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(null); }
  }
  async function sendInfo() {
    setBusy('info'); setMsg(null);
    try {
      const j = await call(`/api/admin/applications/${p.id}/request-info`, 'POST', { message: infoText });
      setInfoLink(j.link); setAskInfo(false);
      setMsg({ ok: true, text: j.emailOutcome === 'sent' ? 'Talep müşteriye e-postayla gönderildi.' : 'Talep kaydedildi. Güvenli bağlantıyı müşteriye WhatsApp veya e-postayla iletin.' });
      router.refresh();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(null); }
  }
  async function saveInternal() {
    setBusy('internal'); setIntErrors({});
    try { const j = await call(`/api/admin/applications/${p.id}/internal`, 'PUT', { data: internal }); setInternal(j.data); setMsg({ ok: true, text: 'İç değerlendirme kaydedildi.' }); router.refresh(); }
    catch (e) { setIntErrors((e as any).errors || {}); setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(null); }
  }
  async function anonymize() {
    const c = prompt('Bu başvurunun tüm kişisel verileri geri dönüşsüz silinecek. Onaylamak için SİL yazın.');
    if (c !== 'SİL') return;
    try { await call(`/api/admin/applications/${p.id}/anonymize`, 'POST', { confirm: 'SİL' }); router.refresh(); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  }

  const decisions = p.transitions.filter(t => t !== 'needs_info');
  const waText = infoLink ? `Merhaba, başvurunuz için ek bilgi gerekiyor. Lütfen şu güvenli bağlantıdan başvurunuzu güncelleyin: ${infoLink}` : '';

  return (
    <aside className="grid gap-5 lg:sticky lg:top-6">
      {msg && <p role="status" className={`rounded-lg px-4 py-2.5 text-sm ${msg.ok ? 'bg-[#E3F0E4] text-ok' : 'bg-[#F8E3E1] text-error'}`}>{msg.text}</p>}

      {p.canDecide && p.transitions.length > 0 && (
        <section className="sheet p-4">
          <h2 className="font-medium mb-3">İşlem</h2>
          <div className="flex flex-wrap gap-2">
            {decisions.map(t => (
              <button key={t} onClick={() => setStatus(t)} disabled={!!busy}
                className={`btn btn-sm ${t === 'approved' || t === 'completed' ? 'btn-primary' : t === 'rejected' ? 'btn-ghost !text-error' : 'btn-ghost'}`}>{busy === t ? '…' : ACTION_TEXT[t] || p.statusLabels[t]}</button>
            ))}
            {p.transitions.includes('needs_info') && <button onClick={() => setAskInfo(v => !v)} className="btn btn-sm btn-gold">Eksik bilgi iste</button>}
          </div>
          {askInfo && (
            <div className="mt-4">
              <label className="field-label" htmlFor="info">Müşteriden istenen bilgi</label>
              <textarea id="info" className="input" value={infoText} onChange={e => setInfoText(e.target.value)} placeholder="ör. Vergi levhanızdaki vergi numarasını ve muhasebe yetkilisinin e-posta adresini ekleyin." />
              <p className="hint">Müşteriye 7 gün geçerli yeni bir düzenleme bağlantısı oluşturulur{p.contactEmail ? ' ve e-postasına gönderilir' : ''}.</p>
              <button className="btn btn-primary btn-sm mt-3" onClick={sendInfo} disabled={busy === 'info' || infoText.trim().length < 5}>Talebi oluştur</button>
            </div>
          )}
          {infoLink && (
            <div className="mt-4 rounded-lg bg-cream p-3 text-sm">
              <p className="font-medium">Müşteriye özel düzenleme bağlantısı</p>
              <input readOnly value={infoLink} className="input mt-2 !text-xs" onFocus={e => e.currentTarget.select()} />
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(infoLink)}>Kopyala</button>
                <a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(waText)}`}>WhatsApp ile gönder</a>
              </div>
              <p className="hint">Bu bağlantı yalnızca şimdi gösterilir; güvenlik nedeniyle saklanmaz.</p>
            </div>
          )}
        </section>
      )}

      {p.hasRef && (
        <section className="sheet p-4">
          <h2 className="font-medium mb-1">Belgeler</h2><p className="text-xs text-muted mb-3">Tam belgeler iç değerlendirmeyi de içerir.</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <a className="btn btn-ghost btn-sm" href={`/api/admin/applications/${p.id}/doc?format=pdf`}>Müşteri PDF</a>
            <a className="btn btn-ghost btn-sm" href={`/api/admin/applications/${p.id}/doc?format=docx`}>Müşteri Word</a>
            {p.canInternal && <a className="btn btn-ghost btn-sm" href={`/api/admin/applications/${p.id}/doc?format=pdf&variant=internal`}>Tam PDF</a>}
            {p.canInternal && <a className="btn btn-ghost btn-sm" href={`/api/admin/applications/${p.id}/doc?format=docx&variant=internal`}>Tam Word</a>}
          </div>
        </section>
      )}

      {p.canInternal && p.hasRef && (
        <section className="sheet p-4">
          <h2 className="font-medium">Satış temsilcisi değerlendirmesi</h2>
          <p className="text-xs text-muted mt-0.5 mb-3">Yalnızca Vettore içindir; müşteriye gösterilmez.</p>
          <div className="grid gap-4">
            {p.internalSections.map(s => s.items.map(it => {
              const fields = it.kind === 'field' ? [{ f: it.field, path: [s.key, it.field.key] }] : it.group.fields.map(f => ({ f, path: [s.key, it.group.key, f.key] }));
              return (
                <div key={`${s.key}-${it.kind === 'field' ? it.field.key : it.group.key}`} className="grid gap-4">
                  {it.kind === 'group' && it.group.title && <h3 className="text-sm font-medium text-gold-ink -mb-1">{human(it.group.title)}</h3>}
                  {fields.map(({ f, path }) => (
                    <FieldInput key={path.join('.')} field={f} value={getAt(internal, path)} currency={p.currency} error={intErrors[path.join('.')]}
                      onChange={v => setInternal((d: any) => setAt(d, path, v))} />
                  ))}
                </div>
              );
            }))}
          </div>
          <button className="btn btn-primary btn-sm mt-4" onClick={saveInternal} disabled={busy === 'internal'}>{busy === 'internal' ? 'Kaydediliyor…' : 'Değerlendirmeyi kaydet'}</button>
        </section>
      )}

      <section className="sheet p-4">
        <h2 className="font-medium mb-3">İşlem geçmişi</h2>
        <ol className="grid gap-3 text-sm">
          {p.history.map((h, i) => (
            <li key={i} className="grid grid-cols-[auto_1fr] gap-x-3">
              <span className="mt-1.5 size-2 rounded-full bg-gold" />
              <div>
                <p>{h.what}{h.extra && <span className="text-muted"> · {h.extra}</span>}</p>
                <p className="text-xs text-muted">{new Date(h.at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Istanbul' })} · {h.who}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {p.canDelete && <button onClick={anonymize} className="text-sm text-muted underline justify-self-start">Kişisel verileri sil (KVKK/GDPR talebi)</button>}
    </aside>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
