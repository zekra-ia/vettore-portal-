'use client';
import { useId } from 'react';
import type { Field } from '@/lib/form/definition';
import { COUNTRY_NAMES, CURRENCY_SUFFIX, human } from './labels';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface FieldProps {
  field: Field;
  value: any;
  onChange: (v: any) => void;
  error?: string;
  currency: string;
  privacy?: { url?: string; text?: string };
  sameAs?: { label: string; value: any } | null;
}

export function FieldInput({ field: f, value, onChange, error, currency, privacy, sameAs }: FieldProps) {
  const id = useId();
  const errId = `${id}-err`;
  const aria = { 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? errId : undefined } as const;
  const label = human(f.label);
  const Label = ({ htmlFor = id }: { htmlFor?: string }) => (
    <label htmlFor={htmlFor} className="field-label">{label}{f.required && <span className="req" aria-hidden>*</span>}{f.required && <span className="sr-only"> (zorunlu)</span>}</label>
  );
  const Err = () => (error ? <p id={errId} className="err" role="alert">{error}</p> : null);
  const Hint = ({ text }: { text?: string }) => (text ? <p className="hint">{text}</p> : null);

  switch (f.type) {
    case 'text': case 'email': case 'url': case 'phone': case 'iban': {
      const type = f.type === 'phone' ? 'tel' : f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : 'text';
      const placeholder: Record<string, string> = { phone: '+90 5xx xxx xx xx', email: 'ad@firma.com', url: 'www.firma.com', iban: 'TR00 0000 0000 0000 0000 0000 00' };
      const autoComplete: Record<string, string> = { email: 'email', phone: 'tel', url: 'url' };
      return (
        <div>
          <Label />
          <input id={id} className="input" type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder[f.type]}
            autoComplete={autoComplete[f.type] || (f.key === 'full_name' ? 'name' : f.key === 'trade_name' ? 'organization' : 'off')}
            inputMode={f.type === 'iban' ? 'text' : undefined} spellCheck={false} {...aria} />
          <Hint text={f.key === 'national_id' ? 'Şifrelenerek saklanır; listelerde maskelenir. Zorunlu değildir.' : f.key === 'tax_number' ? (undefined) : undefined} />
          <Err />
        </div>
      );
    }
    case 'textarea':
      return <div><Label /><textarea id={id} className="input" value={value ?? ''} onChange={e => onChange(e.target.value)} {...aria} /><Err /></div>;
    case 'date':
      return <div><Label /><input id={id} className="input" type="date" value={value ?? ''} onChange={e => onChange(e.target.value)} {...aria} /><Err /></div>;
    case 'year': case 'integer':
      return (
        <div>
          <Label />
          <div className="relative">
            <input id={id} className="input pr-16" inputMode="numeric" value={value ?? ''} onChange={e => onChange(e.target.value.replace(/[^\d]/g, ''))} {...aria} />
            {f.unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{human(f.unit)}</span>}
          </div>
          <Err />
        </div>
      );
    case 'money': case 'percent':
      return (
        <div>
          <Label />
          <div className="relative">
            <input id={id} className="input pr-14" inputMode="decimal" value={value ?? ''} onChange={e => onChange(e.target.value.replace(/[^\d.,]/g, ''))} {...aria} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{f.type === 'percent' ? '%' : CURRENCY_SUFFIX[currency] || currency}</span>
          </div>
          <Err />
        </div>
      );
    case 'select':
      return (
        <div>
          <Label />
          <select id={id} className="input" value={value ?? ''} onChange={e => onChange(e.target.value)} {...aria}>
            {!value && <option value="">Seçin</option>}
            {f.options?.map(o => <option key={o.value} value={o.value}>{f.key === 'country' ? COUNTRY_NAMES[o.value] : human(o.label)}</option>)}
          </select>
          <Err />
        </div>
      );
    case 'radio': case 'multicheck': {
      const multi = f.type === 'multicheck';
      const arr: string[] = multi ? (Array.isArray(value) ? value : []) : [];
      return (
        <fieldset aria-describedby={error ? errId : undefined}>
          <legend className="field-label">{label}{f.required && <span className="req" aria-hidden>*</span>}</legend>
          {f.text && <p className="text-sm text-muted mb-3 leading-relaxed max-w-[62ch]">{f.text}</p>}
          <div className="flex flex-wrap gap-2">
            {f.options?.map(o => (
              <label key={o.value} className="choice">
                <input type={multi ? 'checkbox' : 'radio'} name={id} checked={multi ? arr.includes(o.value) : value === o.value}
                  onChange={e => onChange(multi ? (e.target.checked ? [...arr, o.value] : arr.filter(x => x !== o.value)) : o.value)} />
                {human(o.label)}
              </label>
            ))}
          </div>
          {f.key === 'marketing_consent' && <p className="hint">İsteğe bağlıdır; seçiminiz başvurunuzu etkilemez.</p>}
          {f.key === 'kvkk_consent' && <p className="hint">Açık rıza vermemeniz başvurunuzun gönderilmesine engel değildir.</p>}
          <Err />
        </fieldset>
      );
    }
    case 'checkbox': {
      const isPrivacy = f.key === 'privacy_notice_ack';
      return (
        <div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" className="mt-1 size-5 accent-[#6B5824] shrink-0" checked={value === true} onChange={e => onChange(e.target.checked ? true : undefined)} {...aria} />
            <span className="text-[0.95rem]">
              {isPrivacy ? <>Kişisel verilerin işlenmesine ilişkin aydınlatma metnini okudum.</> : label}
              {f.required && <span className="text-gold-ink" aria-hidden> *</span>}
            </span>
          </label>
          {isPrivacy && (
            privacy?.url ? <p className="hint ml-8"><a className="underline text-gold-ink" href={privacy.url} target="_blank" rel="noreferrer">Aydınlatma metnini aç</a></p>
            : privacy?.text ? <details className="ml-8 mt-2 text-sm text-muted"><summary className="cursor-pointer text-gold-ink">Aydınlatma metnini göster</summary><p className="mt-2 whitespace-pre-line leading-relaxed">{privacy.text}</p></details>
            : <p className="hint ml-8">Aydınlatma metni, canlı kullanıma geçmeden önce veri sorumlusu tarafından eklenecektir.</p>
          )}
          <Err />
        </div>
      );
    }
    case 'list': {
      const arr: string[] = Array.isArray(value) ? value : [];
      const n = f.max ?? 4;
      return (
        <fieldset>
          <legend className="field-label">{label}</legend>
          <div className="grid sm:grid-cols-2 gap-2">
            {Array.from({ length: n }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm text-muted w-5 tabular-nums">{i + 1})</span>
                <input aria-label={`${label} ${i + 1}`} className="input" value={arr[i] ?? ''} onChange={e => { const next = [...arr]; next[i] = e.target.value; onChange(next); }} />
              </div>
            ))}
          </div>
          <Err />
        </fieldset>
      );
    }
    case 'address': {
      const a = value || {};
      const set = (k: string, v: string) => onChange({ ...a, [k]: v });
      const same = sameAs && sameAs.value && JSON.stringify(sameAs.value) === JSON.stringify(value);
      return (
        <fieldset aria-describedby={error ? errId : undefined}>
          <legend className="field-label">{label}{f.required && <span className="req" aria-hidden>*</span>}</legend>
          {sameAs && (
            <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer">
              <input type="checkbox" className="size-4 accent-[#6B5824]" checked={!!same} onChange={e => onChange(e.target.checked ? structuredClone(sameAs.value) : {})} />
              {sameAs.label} ile aynı
            </label>
          )}
          {!same && (
            <div className="grid gap-2">
              <input aria-label={`${label}: adres satırı`} className="input" placeholder="Mahalle, cadde/sokak, no" value={a.line1 ?? ''} onChange={e => set('line1', e.target.value)} autoComplete="address-line1" />
              <input aria-label={`${label}: adres satırı 2`} className="input" placeholder="Bina, kat, daire (isteğe bağlı)" value={a.line2 ?? ''} onChange={e => set('line2', e.target.value)} autoComplete="address-line2" />
              <div className="grid grid-cols-[7rem_1fr] gap-2">
                <input aria-label={`${label}: posta kodu`} className="input" placeholder="Posta kodu" inputMode="numeric" value={a.postal_code ?? ''} onChange={e => set('postal_code', e.target.value)} autoComplete="postal-code" />
                <input aria-label={`${label}: şehir`} className="input" placeholder="Şehir" value={a.city ?? ''} onChange={e => set('city', e.target.value)} autoComplete="address-level2" />
              </div>
              <input aria-label={`${label}: ilçe veya eyalet`} className="input" placeholder="İlçe / Bundesland (isteğe bağlı)" value={a.region ?? ''} onChange={e => set('region', e.target.value)} />
            </div>
          )}
          <Err />
        </fieldset>
      );
    }
    case 'choice_with_input': {
      const v = value || {};
      return (
        <fieldset>
          <legend className="field-label">{label}{f.required && <span className="req" aria-hidden>*</span>}</legend>
          <div className="flex flex-wrap gap-2 items-center">
            {f.options?.map(o => {
              const on = v.choice === o.value;
              const parts = human(o.label).split('___');
              return (
                <label key={o.value} className="choice">
                  <input type="radio" name={id} checked={on} onChange={() => onChange({ choice: o.value })} />
                  {o.input && on ? (
                    <span className="inline-flex items-center gap-1.5">
                      {parts[0]}
                      <input aria-label="Değer" className="input !py-1 !px-2 w-16 text-center" inputMode={o.input.startsWith('integer') ? 'numeric' : 'text'}
                        value={v.value ?? ''} onChange={e => onChange({ choice: o.value, value: e.target.value })} onClick={e => e.stopPropagation()} />
                      {parts[1]}
                    </span>
                  ) : parts.join('…')}
                </label>
              );
            })}
          </div>
          <Err />
        </fieldset>
      );
    }
    default:
      return null;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
