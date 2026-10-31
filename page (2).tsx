'use client';
import { useState } from 'react';
import { PoweredBy } from '@/components/Wordmark';

export default function Login() {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const f = new FormData(e.currentTarget);
    const slug = new URLSearchParams(location.search).get('t') || 'vettore';
    const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, email: f.get('email'), password: f.get('password') }) });
    if (r.ok) location.href = '/admin';
    else { setErr((await r.json()).error || 'Giriş yapılamadı.'); setBusy(false); }
  }
  return (
    <main className="min-h-dvh grid place-items-center p-5">
      <div className="w-full max-w-sm">
        <p className="wordmark text-2xl"><b>VETTORE</b><span>HOME</span></p>
        <h1 className="mt-6 text-xl font-medium">Yönetim paneline giriş</h1>
        <form onSubmit={onSubmit} className="mt-5 sheet p-5 grid gap-4">
          <div><label className="field-label" htmlFor="email">E-posta</label><input id="email" name="email" type="email" autoComplete="username" required className="input" /></div>
          <div>
            <label className="field-label" htmlFor="password">Parola</label>
            <div className="relative">
              <input id="password" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required className="input pr-20" />
              <button type="button" onClick={() => setShow(v => !v)} aria-pressed={show} className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gold-ink underline px-2 py-1">{show ? 'Gizle' : 'Göster'}</button>
            </div>
          </div>
          {err && <p role="alert" className="err">{err}</p>}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Giriş yapılıyor…' : 'Giriş yap'}</button>
        </form>
        <PoweredBy className="mt-6 text-center" />
      </div>
    </main>
  );
}
