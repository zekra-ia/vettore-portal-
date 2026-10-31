// PDF ve DOCX için ortak, biçimlenmiş içerik modeli. İki çıktı da aynı doğrulanmış veriden üretilir.
import { conditionHolds, getAt, type Field, type FormModel, type Section } from '../form/definition';
import { maskValue } from '../form/validate';

export type Variant = 'customer' | 'internal';
export interface PRow { kind: 'row'; label: string; value: string; boxed?: boolean; blank?: boolean }
export interface PSub { kind: 'sub'; title: string }
export interface PTable { kind: 'table'; headers: string[]; rows: string[][] }
export interface PText { kind: 'text'; text: string }
export type PItem = PRow | PSub | PTable | PText;
export interface PSection { no: number; title: string; internal: boolean; items: PItem[] }

export interface PrintableMeta {
  tenantName: string; wordmark: string[]; colors: { primary: string; surface: string; ink: string };
  refNo: string; formTitle: string; submittedAt: Date | null; generatedAt: Date; salesRep: string | null;
  statusLabel: string; isTest: boolean; variant: Variant;
}
export interface Printable { meta: PrintableMeta; customer: PSection[]; internal: PSection[]; declaration: string; consentLine: string | null }

const BOX = '☐', CHECKED = '☒';
type Data = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function fmtDate(v: unknown) {
  if (!v) return '';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
}
function fmtMoney(v: unknown, cur: string) {
  if (v === undefined || v === null || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ${cur === 'TRY' ? 'TL' : cur}` : String(v);
}

function fmt(f: Field, v: unknown, data: Data, variant: Variant, maskSensitive: boolean): { value: string; boxed?: boolean } {
  const cur = String(getAt(data, ['finance', 'currency']) || 'TRY');
  switch (f.type) {
    case 'address': {
      const a = (v || {}) as Data;
      return { value: [a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(' '), a.region, a.country].filter(Boolean).join(', ') };
    }
    case 'money': return { value: fmtMoney(v, cur) };
    case 'integer': return { value: v === undefined ? '' : `${v}${f.unit ? ` ${f.unit}` : ''}` };
    case 'percent': return { value: v === undefined ? '' : `%${v}` };
    case 'date': return { value: fmtDate(v) };
    case 'select': {
      const o = f.options?.find(x => x.value === v);
      return { value: o ? (f.key === 'country' ? ({ TR: 'Türkiye', DE: 'Almanya', OTHER: 'Diğer' } as Data)[o.value] : o.label) : '' };
    }
    case 'radio':
    case 'multicheck': {
      const chosen = Array.isArray(v) ? v.map(String) : v ? [String(v)] : [];
      return { value: (f.options || []).map(o => `${chosen.includes(o.value) ? CHECKED : BOX} ${o.label}`).join('   '), boxed: true };
    }
    case 'checkbox': return { value: `${v === true ? CHECKED : BOX}`, boxed: true };
    case 'choice_with_input': {
      const o = (v || {}) as Data;
      return {
        value: (f.options || []).map(opt => {
          const on = o.choice === opt.value;
          const label = opt.input ? (opt.label.includes('___') ? opt.label.replace('___', on && o.value ? String(o.value) : '___') : `${opt.label} ${on && o.value ? o.value : '___'}`) : opt.label;
          return `${on ? CHECKED : BOX} ${label}`;
        }).join('   '),
        boxed: true,
      };
    }
    case 'list': {
      const arr = (Array.isArray(v) ? v : []).filter(Boolean);
      return { value: arr.map((x, i) => `${i + 1}) ${x}`).join('    ') };
    }
    case 'text': {
      const s = v === undefined ? '' : String(v);
      return { value: f.key === 'national_id' && (variant === 'customer' || maskSensitive) ? maskValue(s) : s };
    }
    case 'iban': return { value: v ? String(v).replace(/(.{4})/g, '$1 ').trim() : '' };
    default: return { value: v === undefined || v === null ? '' : String(v) };
  }
}

function buildSection(s: Section, data: Data, variant: Variant, audience: 'customer' | 'internal', maskSensitive: boolean): PSection | null {
  const items: PItem[] = [];
  const want = (aud: string) => aud === audience;
  for (const it of s.items) {
    if (it.kind === 'field') {
      const f = it.field;
      if (!want(f.audience) || f.type === 'signature' || !conditionHolds(f.showIf, data, s.key)) continue;
      if (f.text) items.push({ kind: 'text', text: f.text });
      const r = fmt(f, getAt(data, [s.key, f.key]), data, variant, maskSensitive);
      items.push({ kind: 'row', label: f.label, ...r });
      continue;
    }
    const g = it.group;
    if (!want(g.audience) || !conditionHolds(g.showIf, data, s.key)) continue;
    if (g.title) items.push({ kind: 'sub', title: g.title });
    if (g.repeat) {
      const rows = (getAt(data, [s.key, g.key]) || []) as Data[];
      const fields = g.fields.filter(f => conditionHolds(f.showIf, data, s.key));
      const body = rows.map(r => fields.map(f => fmt(f, r?.[f.key], data, variant, maskSensitive).value));
      while (body.length < Math.min(g.repeat.max, 3)) body.push(fields.map(() => ''));
      items.push({ kind: 'table', headers: fields.map(f => f.label), rows: body });
      continue;
    }
    for (const f of g.fields) {
      if (f.audience === 'system' && f.type === 'date') { items.push({ kind: 'row', label: f.label, value: fmtDate(getAt(data, ['__meta', 'submitted_at'])) }); continue; }
      if (f.type === 'signature' || f.type === 'print_only') { items.push({ kind: 'row', label: f.label, value: '', blank: true }); continue; }
      if (!conditionHolds(f.showIf, data, s.key)) continue;
      if (f.type === 'checkbox' && f.label.length > 40) {
        items.push({ kind: 'row', label: '', value: `${getAt(data, [s.key, g.key, f.key]) === true ? CHECKED : BOX} ${f.label}`, boxed: true });
        continue;
      }
      items.push({ kind: 'row', label: f.label, ...fmt(f, getAt(data, [s.key, g.key, f.key]), data, variant, maskSensitive) });
    }
  }
  return items.length ? { no: s.no, title: s.title, internal: audience === 'internal', items } : null;
}

export function buildPrintable(model: FormModel, customerData: Data, internalData: Data, meta: Omit<PrintableMeta, 'formTitle'>, opts: { maskSensitive: boolean }): Printable {
  const data = { ...customerData, __meta: { submitted_at: meta.submittedAt } };
  const customer = model.sections.map(s => buildSection(s, data, meta.variant, 'customer', opts.maskSensitive)).filter((x): x is PSection => !!x);
  const internal = meta.variant === 'internal'
    ? model.sections.map(s => buildSection(s, { ...internalData, finance: customerData.finance }, meta.variant, 'internal', opts.maskSensitive)).filter((x): x is PSection => !!x)
    : [];
  const consent = customerData.preferences || {};
  const consentLine = consent.kvkk_consent ? `KVKK açık rıza: ${consent.kvkk_consent} · Ticari iletişim izni: ${consent.marketing_consent || '—'} · Aydınlatma metni okundu: ${consent.privacy_notice_ack ? 'Evet' : 'Hayır'}` : null;
  return { meta: { ...meta, formTitle: model.title }, customer, internal, declaration: 'Bu formdaki bilgilerin doğruluğunu kabul ve beyan ederim.', consentLine };
}
