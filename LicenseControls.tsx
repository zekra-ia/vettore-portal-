'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props { status: string; privacyReady: boolean; controller: Record<string, string | undefined>; notifyEmails: string[]; senderEmail: string | null; emailProvider: string }

export default function LicenseControls(p: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const f = new FormData(e.currentTarget);
    const body = {
      controller: { name: f.get('name'), address: f.get('address'), email: f.get('email'), privacy_url: f.get('privacy_url'), privacy_text: f.get('privacy_text'), retention: f.get('retention') },
      notify_emails: f.get('notify'), privacy_ready: f.get('ready') === 'on',
    };
    const r = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json(); setBusy(false);
    setMsg(r.ok ? { ok: true, text: j.privacy_ready ? 'Kaydedildi. Veri koruma bilgileri doğrulandı olarak işaretlendi.' : `Kaydedildi. ${j.missing?.[0] || ''}` } : { ok: false, text: j.error });
    router.refresh();
  }
  async function activate() {
    if (!confirm('30 günlük demo şimdi başlasın mı? Bu andan itibaren bağlantılar gerçek başvuru kabul eder ve süre geri alınamaz.')) return;
    const r = await fetch('/api/admin/license/activate', { method: 'POST' }); const j = await r.json();
    setMsg(r.ok ? { ok: true, text: `Demo başladı. Bitiş: ${new Date(j.expires_at).toLocaleString('tr-TR')}` } : { ok: false, text: j.error });
    router.refresh();
  }
  const c = p.controller;
  return (
    <>
      {msg && <p role="status" className={`mt-5 rounded-lg px-4 py-2.5 text-sm ${msg.ok ? 'bg-[#E3F0E4] text-ok' : 'bg-[#F8E3E1] text-error'}`}>{msg.text}</p>}
      <form onSubmit={save} className="mt-6 sheet p-5 sm:p-6 grid gap-4">
        <div>
          <h2 className="font-medium">Veri sorumlusu ve aydınlatma</h2>
          <p className="text-sm text-muted mt-1 max-w-[70ch]">Gerçek müşterilerden veri toplanmadan önce Vettore'nin veri sorumlusu bilgileri, KVKK/GDPR aydınlatma metni ve saklama süresi girilmeli ve onaylanmalıdır. Bu bilgiler müşteri formunda gösterilir.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="field-label" htmlFor="name">Veri sorumlusu (ticari ünvan)</label><input id="name" name="name" defaultValue={c.name} className="input" /></div>
          <div><label className="field-label" htmlFor="email">KVKK başvuru e-postası</label><input id="email" name="email" type="email" defaultValue={c.email} className="input" /></div>
          <div className="sm:col-span-2"><label className="field-label" htmlFor="address">Adres</label><input id="address" name="address" defaultValue={c.address} className="input" /></div>
          <div className="sm:col-span-2"><label className="field-label" htmlFor="privacy_url">Aydınlatma metni bağlantısı (https)</label><input id="privacy_url" name="privacy_url" type="url" defaultValue={c.privacy_url} className="input" placeholder="https://..." /></div>
          <div className="sm:col-span-2"><label className="field-label" htmlFor="privacy_text">veya aydınlatma metni</label><textarea id="privacy_text" name="privacy_text" defaultValue={c.privacy_text} className="input min-h-32" /></div>
          <div className="sm:col-span-2"><label className="field-label" htmlFor="retention">Saklama süresi ve silme politikası</label><input id="retention" name="retention" defaultValue={c.retention} className="input" placeholder="ör. Reddedilen başvurular 6 ay, onaylananlar ticari ilişki süresince + 10 yıl" /></div>
          <div className="sm:col-span-2"><label className="field-label" htmlFor="notify">Yeni başvuru bildirimi alacak e-postalar</label><input id="notify" name="notify" defaultValue={p.notifyEmails.join(', ')} className="input" placeholder="satis@vettore..., yonetim@vettore..." /></div>
        </div>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="ready" defaultChecked={p.privacyReady} className="mt-0.5 size-4 accent-[#6B5824]" />Bu bilgiler Vettore tarafından doğrulandı; gerçek müşteri verisi toplanabilir.</label>
        <p className="text-sm text-muted">E-posta gönderimi: {p.emailProvider === 'resend' && p.senderEmail ? `etkin (${p.senderEmail})` : 'kapalı — bildirimler yalnızca işlem geçmişine yazılır. Vettore\'nin doğrulanmış gönderici adresi tanımlanınca açılır.'}</p>
        <div><button className="btn btn-primary" disabled={busy}>Kaydet</button></div>
      </form>
      {p.status === 'pending' && (
        <section className="mt-6 sheet p-5 sm:p-6">
          <h2 className="font-medium">Canlı aktivasyon</h2>
          <p className="text-sm text-muted mt-1 max-w-[70ch]">Aktivasyonla 30 günlük demo başlar. Bundan önce bağlantılar yalnızca test başvurusu oluşturur.</p>
          <button className="btn btn-gold mt-4" onClick={activate} disabled={!p.privacyReady}>Demoyu başlat</button>
          {!p.privacyReady && <p className="hint">Önce veri sorumlusu ve aydınlatma bilgilerini girip doğrulayın.</p>}
        </section>
      )}
    </>
  );
}
