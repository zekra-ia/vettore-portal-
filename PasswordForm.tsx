'use client';
import { useState } from 'react';

export default function PasswordForm() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMsg(null);
    const form = e.currentTarget; const f = new FormData(form);
    if (f.get('next') !== f.get('again')) return setMsg({ ok: false, text: 'Yeni parolalar birbiriyle aynı değil.' });
    setBusy(true);
    const r = await fetch('/api/admin/account/password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current: f.get('current'), next: f.get('next') }) });
    const j = await r.json(); setBusy(false);
    if (r.ok) { form.reset(); setMsg({ ok: true, text: 'Parolanız değiştirildi.' }); } else setMsg({ ok: false, text: j.error });
  }
  const type = show ? 'text' : 'password';
  return (
    <form onSubmit={onSubmit} className="mt-6 sheet p-5 sm:p-6 grid gap-4 max-w-md">
      <h2 className="font-medium">Parola değiştir</h2>
      <div><label className="field-label" htmlFor="current">Mevcut parola</label><input id="current" name="current" type={type} autoComplete="current-password" required className="input" /></div>
      <div><label className="field-label" htmlFor="next">Yeni parola</label><input id="next" name="next" type={type} autoComplete="new-password" minLength={10} required className="input" /><p className="hint">En az 10 karakter.</p></div>
      <div><label className="field-label" htmlFor="again">Yeni parola (tekrar)</label><input id="again" name="again" type={type} autoComplete="new-password" minLength={10} required className="input" /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[#6B5824]" checked={show} onChange={e => setShow(e.target.checked)} />Parolaları göster</label>
      {msg && <p role="status" className={msg.ok ? 'text-ok text-sm' : 'err'}>{msg.text}</p>}
      <div><button className="btn btn-primary" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Parolayı değiştir'}</button></div>
    </form>
  );
}
