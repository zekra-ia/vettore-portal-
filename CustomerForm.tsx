'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormModel, Section, Item } from '@/lib/form/definition';
import { conditionHolds, getAt, setAt } from '@/lib/form/definition';
import { validate, type Errors } from '@/lib/form/validate';
import { FieldInput } from './FieldInput';
import { ADD_LABEL, human } from './labels';
import { Wordmark, PoweredBy } from '@/components/Wordmark';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Payload {
  ref_no: string | null; status: string; status_label: string; editable: boolean; is_test: boolean;
  info_request: string | null; submitted_at: string | null; expires_at: string | null;
  data: any; form: FormModel;
  tenant: { name: string; brand: { wordmark: string[] }; controller: { privacy_url?: string; privacy_text?: string; name?: string }; intake: string };
}

const WIDE = ['textarea', 'address', 'multicheck', 'radio', 'checkbox', 'list', 'choice_with_input'];

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: Date } | { kind: 'error'; msg: string };

export default function CustomerForm({ token, initial }: { token: string; initial: Payload }) {
  const [p, setP] = useState(initial);
  const [data, setData] = useState<any>(initial.data || {});
  const [step, setStep] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(new Set());
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const dirty = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  const sections = p.form.sections;
  const reviewStep = sections.length;
  const currency = String(getAt(data, ['finance', 'currency']) || 'TRY');

  const errors = useMemo(() => {
    const e = validate(p.form, data, { mode: 'submit', audience: 'customer' }).errors;
    return { ...e, ...serverErrors };
  }, [p.form, data, serverErrors]);
  const errorsFor = (s: Section) => Object.keys(errors).filter(k => k === s.key || k.startsWith(`${s.key}.`));

  const update = useCallback((path: (string | number)[], v: any) => {
    dirty.current = true;
    setServerErrors(prev => { const k = path.join('.'); if (!(k in prev)) return prev; const n = { ...prev }; delete n[k]; return n; });
    setData((d: any) => setAt(d, path.map(String), v));
  }, []);

  // Otomatik taslak kaydı (2 sn hareketsizlikten sonra)
  const doSave = useCallback(async (d: any) => {
    setSave({ kind: 'saving' });
    try {
      const r = await fetch(`/api/f/${token}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: d }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Kaydedilemedi');
      dirty.current = false;
      setSave({ kind: 'saved', at: new Date(j.savedAt) });
    } catch (e) { setSave({ kind: 'error', msg: (e as Error).message }); }
  }, [token]);

  useEffect(() => {
    if (!dirty.current || !p.editable) return;
    const t = setTimeout(() => doSave(data), 2000);
    return () => clearTimeout(t);
  }, [data, doSave, p.editable]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  const go = (n: number) => {
    setVisited(v => new Set(v).add(step));
    if (dirty.current) doSave(data);
    setStep(n);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const onSubmit = async () => {
    setSubmitting(true); setSubmitError(null);
    try {
      const r = await fetch(`/api/f/${token}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }) });
      const j = await r.json();
      if (!r.ok) {
        if (j.errors) { setServerErrors(j.errors); setVisited(new Set(sections.map((_, i) => i))); }
        throw new Error(j.error || 'Gönderilemedi');
      }
      dirty.current = false;
      const fresh = await fetch(`/api/f/${token}`).then(x => x.json());
      setP(fresh);
      window.scrollTo({ top: 0 });
    } catch (e) { setSubmitError((e as Error).message); }
    finally { setSubmitting(false); }
  };

  if (!p.editable) return <Submitted p={p} token={token} />;

  const totalErrors = Object.keys(errors).length;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 bg-cream/95 backdrop-blur border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <Wordmark parts={p.tenant.brand.wordmark} className="text-xl" />
          <SaveBadge s={save} onRetry={() => doSave(data)} />
        </div>
        {/* Mobil ilerleme bandı */}
        <div className="lg:hidden max-w-6xl mx-auto px-4 pb-2.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium truncate">{step < reviewStep ? human(sections[step].title) : 'Kontrol ve gönderim'}</span>
            <span className="text-muted tabular-nums shrink-0 ml-3">{Math.min(step + 1, reviewStep + 1)} / {reviewStep + 1}</span>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-line overflow-hidden"><div className="h-full bg-gold transition-[width] duration-300" style={{ width: `${((step + 1) / (reviewStep + 1)) * 100}%` }} /></div>
        </div>
      </header>

      <div ref={topRef} className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-10 lg:grid lg:grid-cols-[17rem_1fr] lg:gap-10">
        {/* Bölüm şeridi */}
        <nav aria-label="Form bölümleri" className="hidden lg:block">
          <ol className="sticky top-24 border-l border-line">
            {sections.map((s, i) => {
              const errs = visited.has(i) ? errorsFor(s).length : 0;
              const current = i === step;
              return (
                <li key={s.key}>
                  <button onClick={() => go(i)} aria-current={current ? 'step' : undefined}
                    className={`group relative w-full text-left pl-5 pr-2 py-2.5 -ml-px border-l-2 transition-colors ${current ? 'border-gold' : 'border-transparent hover:border-line'}`}>
                    <span className={`inline-block w-6 tabular-nums ${current ? 'text-gold-ink font-semibold' : 'text-muted'}`}>{s.no}</span>
                    <span className={current ? 'font-medium' : 'text-ink/80'}>{human(s.title)}</span>
                    {errs > 0 && <span className="ml-2 text-xs text-error">{errs} eksik</span>}
                    {visited.has(i) && errs === 0 && <span className="ml-2 text-xs text-ok" aria-label="tamam">✓</span>}
                  </button>
                </li>
              );
            })}
            <li>
              <button onClick={() => go(reviewStep)} aria-current={step === reviewStep ? 'step' : undefined}
                className={`w-full text-left pl-5 py-2.5 -ml-px border-l-2 ${step === reviewStep ? 'border-gold font-medium' : 'border-transparent'}`}>
                <span className="inline-block w-6" />Kontrol ve gönderim
              </button>
            </li>
          </ol>
          <PoweredBy className="mt-10 pl-5" />
        </nav>

        <main>
          {p.is_test && (
            <p className="mb-5 rounded-lg border border-[#E9C9A0] bg-[#FBF1E2] px-4 py-3 text-sm text-[#7A4B12]">Test başvurusu. Lütfen gerçek kişisel veri girmeyin.</p>
          )}
          {p.info_request && (
            <div className="mb-5 rounded-lg border-l-4 border-gold bg-paper px-4 py-3">
              <p className="font-medium">{p.tenant.name} başvurunuz için ek bilgi istedi</p>
              <p className="mt-1 whitespace-pre-line text-[0.95rem]">{p.info_request}</p>
              <p className="mt-2 text-sm text-muted">Bilgileri ekledikten sonra son adımdan başvurunuzu yeniden gönderin.</p>
            </div>
          )}

          {step < reviewStep ? (
            <SectionView section={sections[step]} data={data} errors={errors} showErrors={visited.has(step)} update={update} currency={currency}
              privacy={{ url: p.tenant.controller.privacy_url, text: p.tenant.controller.privacy_text }} />
          ) : (
            <Review sections={sections} errorsFor={errorsFor} go={go} totalErrors={totalErrors} />
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3 justify-between">
            <button className="btn btn-ghost" onClick={() => go(step - 1)} disabled={step === 0}>Geri</button>
            <div className="flex gap-3 ml-auto">
              {step < reviewStep && <button className="btn btn-ghost hidden sm:inline-flex" onClick={() => doSave(data)}>Taslağı kaydet</button>}
              {step < reviewStep
                ? <button className="btn btn-primary" onClick={() => go(step + 1)}>{step === reviewStep - 1 ? 'Kontrol et' : 'Devam'}</button>
                : <button className="btn btn-gold" onClick={onSubmit} disabled={submitting || totalErrors > 0}>{submitting ? 'Gönderiliyor…' : p.status === 'needs_info' ? 'Başvuruyu yeniden gönder' : 'Başvuruyu gönder'}</button>}
            </div>
          </div>
          {submitError && <p role="alert" className="mt-4 text-error text-sm">{submitError}</p>}
          <p className="mt-6 text-xs text-muted sm:hidden">Bilgileriniz her değişiklikte taslak olarak otomatik kaydedilir. Bu sayfanın bağlantısıyla daha sonra devam edebilirsiniz.</p>
          <PoweredBy className="mt-8 lg:hidden" />
        </main>
      </div>
    </div>
  );
}

function SaveBadge({ s, onRetry }: { s: SaveState; onRetry: () => void }) {
  if (s.kind === 'saving') return <span className="text-sm text-muted">Kaydediliyor…</span>;
  if (s.kind === 'saved') return <span className="text-sm text-muted">Taslak kaydedildi {s.at.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>;
  if (s.kind === 'error') return <button onClick={onRetry} className="text-sm text-error underline">Kaydedilemedi, tekrar dene</button>;
  return <span className="text-sm text-muted hidden sm:inline">Değişiklikler otomatik kaydedilir</span>;
}

function SectionView({ section: s, data, errors, showErrors, update, currency, privacy }: {
  section: Section; data: any; errors: Errors; showErrors: boolean; update: (p: (string | number)[], v: any) => void; currency: string; privacy: { url?: string; text?: string };
}) {
  const err = (k: string) => (showErrors ? errors[k] : undefined);
  const sameAsFor = (key?: string) => {
    if (!key) return null;
    const v = getAt(data, ['company', key]);
    return v ? { label: 'Fatura adresi', value: v } : null;
  };
  return (
    <section className="sheet p-5 sm:p-8" aria-labelledby={`sec-${s.key}`}>
      <div className="flex items-baseline gap-3 pb-5 mb-6 border-b border-line">
        <span className="text-3xl font-light text-gold tabular-nums leading-none">{s.no}</span>
        <h1 id={`sec-${s.key}`} className="text-xl sm:text-2xl font-medium leading-tight">{human(s.title)}</h1>
      </div>
      <div className="grid gap-6">
        {s.items.map(it => <ItemView key={it.kind === 'field' ? it.field.key : it.group.key} it={it} s={s} data={data} err={err} update={update} currency={currency} privacy={privacy} sameAsFor={sameAsFor} errors={errors} showErrors={showErrors} />)}
      </div>
    </section>
  );
}

function ItemView({ it, s, data, err, update, currency, privacy, sameAsFor, errors, showErrors }: any) {
  if (it.kind === 'field') {
    const f = it.field;
    if (!conditionHolds(f.showIf, data, s.key)) return null;
    return <FieldInput field={f} value={getAt(data, [s.key, f.key])} onChange={v => update([s.key, f.key], v)} error={err(`${s.key}.${f.key}`)} currency={currency} privacy={privacy} sameAs={f.sameAsOption ? sameAsFor(f.sameAsOption) : null} />;
  }
  const g = (it as Extract<Item, { kind: 'group' }>).group;
  if (!conditionHolds(g.showIf, data, s.key)) return null;
  const visible = g.fields.filter((f: any) => conditionHolds(f.showIf, data, s.key));
  if (g.repeat) {
    const rows: any[] = Array.isArray(getAt(data, [s.key, g.key])) ? getAt(data, [s.key, g.key]) : [];
    const list = rows.length ? rows : [{}];
    return (
      <div>
        {g.title && <h2 className="text-base font-medium text-gold-ink mb-3">{human(g.title)}</h2>}
        <div className="grid gap-4">
          {list.map((row, i) => (
            <div key={i} className="rounded-xl border border-line bg-white/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted">{g.key === 'partners' ? 'Ortak' : g.key === 'bank_accounts' ? 'Hesap' : 'Satır'} {i + 1}</span>
                {list.length > 1 || Object.keys(row || {}).length ? (
                  <button type="button" className="text-sm text-muted underline" onClick={() => update([s.key, g.key], list.filter((_, j) => j !== i))}>Kaldır</button>
                ) : null}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {visible.map((f: any) => (
                  <FieldInput key={f.key} field={f} value={row?.[f.key]} currency={currency}
                    onChange={v => update([s.key, g.key], list.map((r, j) => (j === i ? { ...r, [f.key]: v } : r)))}
                    error={showErrors ? errors[`${s.key}.${g.key}.${i}.${f.key}`] : undefined} />
                ))}
              </div>
            </div>
          ))}
        </div>
        {err(`${s.key}.${g.key}`) && <p className="err">{err(`${s.key}.${g.key}`)}</p>}
        {list.length < g.repeat.max && (
          <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={() => update([s.key, g.key], [...list, {}])}>+ {ADD_LABEL[g.key] || 'Satır ekle'}</button>
        )}
      </div>
    );
  }
  return (
    <div className="pt-1">
      {g.title && <h2 className="text-base font-medium text-gold-ink mb-3">{human(g.title)}</h2>}
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-5">
        {visible.map((f: any) => (
          <div key={f.key} className={WIDE.includes(f.type) ? 'sm:col-span-2' : ''}>
            <FieldInput field={f} value={getAt(data, [s.key, g.key, f.key])} onChange={v => update([s.key, g.key, f.key], v)} error={err(`${s.key}.${g.key}.${f.key}`)} currency={currency} privacy={privacy} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Review({ sections, errorsFor, go, totalErrors }: { sections: Section[]; errorsFor: (s: Section) => string[]; go: (n: number) => void; totalErrors: number }) {
  return (
    <section className="sheet p-5 sm:p-8">
      <h1 className="text-xl sm:text-2xl font-medium">Kontrol ve gönderim</h1>
      <p className="mt-2 text-muted max-w-[60ch]">
        {totalErrors === 0 ? 'Tüm zorunlu alanlar tamam. Göndermeden önce bilgilerinizi bir kez daha gözden geçirebilirsiniz.' : 'Göndermeden önce aşağıda işaretli bölümlerdeki eksikleri tamamlayın.'}
      </p>
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {sections.map((s, i) => {
          const n = errorsFor(s).length;
          return (
            <li key={s.key} className="flex items-center justify-between gap-3 py-3">
              <span><span className="inline-block w-7 text-gold-ink tabular-nums">{s.no}</span>{human(s.title)}</span>
              <span className="flex items-center gap-3 shrink-0">
                {n ? <span className="text-sm text-error">{n} alan eksik/hatalı</span> : <span className="text-sm text-ok">Tamam</span>}
                <button className="text-sm underline text-gold-ink" onClick={() => go(i)}>{n ? 'Düzelt' : 'Gözden geçir'}</button>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 text-sm text-muted">Gönderdikten sonra başvuru numaranızı alacak ve başvurunuzun PDF kopyasını indirebileceksiniz.</p>
    </section>
  );
}

function Submitted({ p, token }: { p: Payload; token: string }) {
  return (
    <main className="min-h-dvh flex flex-col">
      <div className="flex-1 w-full max-w-xl mx-auto px-5 pt-14 pb-10">
        <Wordmark parts={p.tenant.brand.wordmark} className="text-[clamp(1.5rem,7vw,1.9rem)] block whitespace-nowrap" />
        <div className="h-px bg-gold mt-5 mb-10 w-24" />
        <p className="text-muted">Başvuru numaranız</p>
        <p className="text-[2.4rem] sm:text-5xl font-semibold tracking-wide tabular-nums mt-1">{p.ref_no}</p>
        <p className="mt-6 text-lg">Başvurunuz {p.tenant.name} ekibine ulaştı.</p>
        <p className="mt-2 text-muted max-w-[52ch]">Başvurunuz incelendikten sonra sizinle iletişime geçilecektir. Ek bilgi gerekirse size yeni bir güvenli bağlantı gönderilir.</p>
        <dl className="mt-8 sheet px-5 py-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[0.95rem]">
          <dt className="text-muted">Durum</dt><dd><span className={`status status-${p.status}`}>{p.status_label}</span></dd>
          {p.submitted_at && <><dt className="text-muted">Gönderim</dt><dd>{new Date(p.submitted_at).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Istanbul' })}</dd></>}
        </dl>
        <a className="btn btn-primary mt-8" href={`/api/f/${token}/pdf`}>PDF kopyasını indir</a>
        {p.is_test && <p className="mt-6 text-sm text-[#7A4B12]">Bu bir test başvurusudur.</p>}
      </div>
      <footer className="w-full max-w-xl mx-auto px-5 pb-8"><PoweredBy /></footer>
    </main>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
