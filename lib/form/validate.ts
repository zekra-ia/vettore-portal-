// Sunucu tarafı doğrulama ve temizleme. İstemcide de aynı kod çalışır (anlık uyarılar için),
// ancak kaydedilen veri her zaman sunucuda yeniden doğrulanır.
import { conditionHolds, getAt, setAt, type Field, type FormModel, type Group, type Section } from './definition';

export type Mode = 'draft' | 'submit';
export type Errors = Record<string, string>;
type Data = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const MSG = {
  required: 'Bu alan zorunludur.',
  email: 'Geçerli bir e-posta adresi girin.',
  url: 'Geçerli bir web adresi girin (ör. www.firma.com).',
  phone: 'Geçerli bir telefon numarası girin (ör. +90 532 000 00 00).',
  date: 'Geçerli bir tarih girin.',
  year: 'Geçerli bir yıl girin.',
  integer: 'Pozitif bir tam sayı girin.',
  money: 'Geçerli bir tutar girin.',
  percent: '0 ile 100 arasında bir değer girin.',
  option: 'Listeden bir seçim yapın.',
  iban: 'IBAN geçersiz. Lütfen kontrol edin.',
  tckn: 'T.C. kimlik numarası geçersiz.',
  vkn: 'Vergi numarası geçersiz (TR: 10 haneli VKN veya 11 haneli TCKN).',
  vat: 'USt-IdNr./VAT ID biçimi geçersiz (ör. DE123456789).',
  mersis: 'MERSİS numarası 16 haneli olmalıdır.',
  tooLong: 'Metin çok uzun.',
  shareTotal: 'Hisse oranlarının toplamı %100\'ü geçemez.',
  postal: 'Posta kodu geçersiz.',
  day: '1 ile 31 arasında bir gün girin.',
};

export function tcknValid(v: string): boolean {
  if (!/^[1-9]\d{10}$/.test(v)) return false;
  const d = v.split('').map(Number);
  const d10 = ((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10;
  const d11 = d.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
  return ((d10 + 10) % 10) === d[9] && d11 === d[10];
}

export function vknValid(v: string): boolean {
  if (!/^\d{10}$/.test(v)) return false;
  const d = v.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const t = (d[i] + 10 - (i + 1)) % 10;
    let p = (t * Math.pow(2, 10 - (i + 1))) % 9;
    if (t !== 0 && p === 0) p = 9;
    sum += p;
  }
  return (10 - (sum % 10)) % 10 === d[9];
}

export function ibanValid(raw: string): boolean {
  const v = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v)) return false;
  if (v.startsWith('TR') && v.length !== 26) return false;
  if (v.startsWith('DE') && v.length !== 22) return false;
  const re = (v.slice(4) + v.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of re) rem = (rem * 10 + Number(ch)) % 97;
  return rem === 1;
}

const isEmpty = (v: unknown): boolean =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ||
  (Array.isArray(v) && v.filter(x => !isEmpty(x)).length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.values(v as object).every(isEmpty));

const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : '');

/** Tek bir alan değerini temizler ve hata mesajı üretir. */
function checkField(f: Field, value: unknown, ctx: { country: string; mode: Mode; required: boolean }): { value: unknown; error?: string } {
  const required = ctx.required && ctx.mode === 'submit';
  if (isEmpty(value)) return { value: undefined, error: required ? MSG.required : undefined };

  switch (f.type) {
    case 'text': {
      const v = str(value, 300);
      if (f.validate === 'digits16') return /^\d{16}$/.test(v) ? { value: v } : { value: v, error: MSG.mersis };
      if (f.validate === 'eu_vat') {
        const n = v.replace(/[\s.-]/g, '').toUpperCase();
        return /^[A-Z]{2}[A-Z0-9]{8,12}$/.test(n) ? { value: n } : { value: v, error: MSG.vat };
      }
      if (f.validate === 'tckn_checksum') {
        const n = v.replace(/\s/g, '');
        return tcknValid(n) ? { value: n } : { value: v, error: MSG.tckn };
      }
      if (f.validate === 'tr_vkn_or_country') {
        const n = v.replace(/\s/g, '');
        if (ctx.country === 'TR') return vknValid(n) || tcknValid(n) ? { value: n } : { value: v, error: MSG.vkn };
        return n.length >= 5 && n.length <= 20 ? { value: v } : { value: v, error: MSG.vkn };
      }
      return { value: v };
    }
    case 'textarea': {
      const v = str(value, 4000);
      return { value: v };
    }
    case 'email': {
      const v = str(value, 254).toLowerCase();
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? { value: v } : { value: v, error: MSG.email };
    }
    case 'url': {
      const v = str(value, 300);
      return /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(v) ? { value: v } : { value: v, error: MSG.url };
    }
    case 'phone': {
      const v = str(value, 30);
      const digits = v.replace(/\D/g, '');
      return /^[+\d][\d\s()./-]+$/.test(v) && digits.length >= 7 && digits.length <= 15 ? { value: v } : { value: v, error: MSG.phone };
    }
    case 'date': {
      const v = str(value, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? { value: v } : { value: v, error: MSG.date };
    }
    case 'year': {
      const n = Number(value);
      return Number.isInteger(n) && n >= 1800 && n <= new Date().getFullYear() ? { value: n } : { value, error: MSG.year };
    }
    case 'integer': {
      const n = Number(value);
      return Number.isInteger(n) && n >= 0 && n < 1e7 ? { value: n } : { value, error: MSG.integer };
    }
    case 'money': {
      const n = typeof value === 'number' ? value : Number(String(value).replace(/\./g, '').replace(',', '.'));
      return Number.isFinite(n) && n >= 0 && n < 1e13 ? { value: n } : { value, error: MSG.money };
    }
    case 'percent': {
      const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
      return Number.isFinite(n) && n >= 0 && n <= 100 ? { value: n } : { value, error: MSG.percent };
    }
    case 'select':
    case 'radio': {
      const v = str(value, 100);
      return f.options?.some(o => o.value === v) ? { value: v } : { value: undefined, error: MSG.option };
    }
    case 'checkbox':
      return value === true ? { value: true } : { value: undefined, error: required ? MSG.required : undefined };
    case 'multicheck': {
      const arr = Array.isArray(value) ? value.map(x => String(x)) : [];
      const ok = arr.filter(v => f.options?.some(o => o.value === v));
      return ok.length ? { value: Array.from(new Set(ok)) } : { value: undefined, error: required ? MSG.required : undefined };
    }
    case 'list': {
      const arr = (Array.isArray(value) ? value : []).slice(0, f.max ?? 10).map(x => str(x, 200));
      return { value: arr };
    }
    case 'iban': {
      const v = str(value, 40).replace(/\s+/g, '').toUpperCase();
      return ibanValid(v) ? { value: v } : { value: v, error: MSG.iban };
    }
    case 'address': {
      const a = (typeof value === 'object' && value) ? (value as Record<string, unknown>) : {};
      const clean = {
        line1: str(a.line1, 200), line2: str(a.line2, 200), postal_code: str(a.postal_code, 12),
        city: str(a.city, 100), region: str(a.region, 100), country: str(a.country, 2).toUpperCase() || ctx.country,
      };
      if (ctx.mode === 'submit' && ctx.required && (!clean.line1 || !clean.city || !clean.postal_code)) return { value: clean, error: 'Adres, posta kodu ve şehir zorunludur.' };
      if (clean.postal_code && (clean.country === 'TR' || clean.country === 'DE') && !/^\d{5}$/.test(clean.postal_code)) return { value: clean, error: MSG.postal };
      return { value: clean };
    }
    case 'choice_with_input': {
      const o = (typeof value === 'object' && value) ? (value as Record<string, unknown>) : {};
      const choice = str(o.choice, 40);
      const opt = f.options?.find(x => x.value === choice);
      if (!opt) return { value: undefined, error: required ? MSG.required : MSG.option };
      if (opt.input?.startsWith('integer')) {
        const n = Number(o.value);
        return Number.isInteger(n) && n >= 1 && n <= 31 ? { value: { choice, value: n } } : { value: { choice, value: o.value }, error: MSG.day };
      }
      return { value: opt.input ? { choice, value: str(o.value, 200) } : { choice } };
    }
    default:
      return { value: undefined };
  }
}

function groupVisible(g: Group, data: Data, sectionKey: string) { return conditionHolds(g.showIf, data, sectionKey); }

export interface ValidateResult { errors: Errors; clean: Data }

/**
 * Veriyi form modeline göre doğrular ve yalnızca izin verilen kitlenin alanlarını içeren temiz bir kopya döndürür.
 * Bilinmeyen anahtarlar atılır; bu sayede müşteri iç kullanım alanlarına veri yazamaz.
 */
export function validate(model: FormModel, input: Data, opts: { mode: Mode; audience: 'customer' | 'internal' }): ValidateResult {
  const errors: Errors = {};
  let clean: Data = {};
  const country = String(input?.company?.country || 'TR');
  const allowed = (aud: string) => (opts.audience === 'customer' ? aud === 'customer' : aud === 'internal');

  const visit = (s: Section, f: Field, path: string[], value: unknown, extraRequired = true) => {
    if (!allowed(f.audience) || f.type === 'print_only' || f.type === 'signature') return;
    if (!conditionHolds(f.showIf, input, s.key)) return;
    const required = (f.required || (!!f.requiredIf && conditionHolds(f.requiredIf, input, s.key))) && extraRequired;
    const r = checkField(f, value, { country, mode: opts.mode, required });
    if (r.value !== undefined) clean = setAt(clean, path, r.value);
    if (r.error) errors[path.join('.')] = r.error;
  };

  for (const s of model.sections) {
    for (const it of s.items) {
      if (it.kind === 'field') {
        visit(s, it.field, [s.key, it.field.key], getAt(input, [s.key, it.field.key]));
        continue;
      }
      const g = it.group;
      if (!allowed(g.audience) || !groupVisible(g, input, s.key)) continue;
      if (g.repeat) {
        const rows: unknown[] = Array.isArray(getAt(input, [s.key, g.key])) ? getAt(input, [s.key, g.key]).slice(0, g.repeat.max) : [];
        const cleanRows: Data[] = [];
        rows.forEach((row, i) => {
          if (isEmpty(row)) return;
          const idx = cleanRows.length;
          for (const f of g.fields) {
            // Tekrarlı satırda bir alan doluysa satırın diğer kilit alanları da istenir.
            const v = (row as Data)?.[f.key];
            const r = checkField(f, v, { country, mode: opts.mode, required: false });
            if (r.value !== undefined) { cleanRows[idx] = { ...(cleanRows[idx] || {}), [f.key]: r.value }; }
            if (r.error) errors[[s.key, g.key, String(i), f.key].join('.')] = r.error;
          }
        });
        if (cleanRows.length) clean = setAt(clean, [s.key, g.key], cleanRows.filter(Boolean));
        if (g.key === 'partners') {
          const total = cleanRows.reduce((a, r) => a + (Number(r?.share_pct) || 0), 0);
          if (total > 100) errors[[s.key, g.key].join('.')] = MSG.shareTotal;
        }
        continue;
      }
      for (const f of g.fields) visit(s, f, [s.key, g.key, f.key], getAt(input, [s.key, g.key, f.key]));
    }
  }
  return { errors, clean };
}

/** Şifrelenecek alanları (IBAN, T.C. kimlik no) veriden ayırır. */
export function splitSensitive(model: FormModel, data: Data): { open: Data; sensitive: Data } {
  let open: Data = structuredClone(data);
  let sensitive: Data = {};
  for (const s of model.sections) for (const it of s.items) {
    if (it.kind !== 'group') continue;
    const enc = it.group.fields.filter(f => f.encrypt);
    if (!enc.length) continue;
    const rows = getAt(open, [s.key, it.group.key]);
    if (!Array.isArray(rows)) continue;
    const secretRows = rows.map(r => Object.fromEntries(enc.map(f => [f.key, r?.[f.key]]).filter(([, v]) => v !== undefined)));
    open = setAt(open, [s.key, it.group.key], rows.map(r => { const c = { ...r }; enc.forEach(f => delete c[f.key]); return c; }));
    sensitive = setAt(sensitive, [s.key, it.group.key], secretRows);
  }
  return { open, sensitive };
}

export function mergeSensitive(open: Data, sensitive: Data): Data {
  let out: Data = structuredClone(open || {});
  for (const [sk, sec] of Object.entries(sensitive || {})) {
    for (const [gk, rows] of Object.entries(sec as Data)) {
      const base = getAt(out, [sk, gk]);
      if (!Array.isArray(rows)) continue;
      const merged = rows.map((r: Data, i: number) => ({ ...(Array.isArray(base) ? base[i] : {}), ...r }));
      out = setAt(out, [sk, gk], merged);
    }
  }
  return out;
}

export function maskValue(v: string): string {
  if (!v) return v;
  return v.length <= 4 ? '••••' : `${'•'.repeat(Math.max(4, v.length - 4))}${v.slice(-4)}`;
}
