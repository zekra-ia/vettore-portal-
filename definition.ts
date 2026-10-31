// Kaynak JSON form tanımını (forms/*.json) arayüz, doğrulama ve belge üretiminin
// ortak kullandığı düz bir modele dönüştürür. Yeni bir firma formu = yeni bir JSON.

export type Audience = 'customer' | 'internal' | 'system';
export type FieldType =
  | 'text' | 'textarea' | 'email' | 'url' | 'phone' | 'date' | 'year' | 'integer' | 'money' | 'percent'
  | 'select' | 'radio' | 'checkbox' | 'multicheck' | 'address' | 'list' | 'iban' | 'choice_with_input'
  | 'signature' | 'print_only';

export interface ChoiceOption { value: string; label: string; input?: string }

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  audience: Audience;
  options?: ChoiceOption[];
  unit?: string;
  max?: number;
  text?: string;               // uzun açıklama metni (ör. KVKK rıza metni)
  note?: string;
  validate?: string;
  encrypt?: boolean;
  maskInLists?: boolean;
  showIf?: Record<string, string | string[]>;
  requiredIf?: Record<string, string>;
  sameAsOption?: string;
  default?: string;
  added?: boolean;
}

export interface Group {
  key: string;
  title?: string;
  audience: Audience;
  fields: Field[];
  repeat?: { min: number; max: number };
  showIf?: Record<string, string | string[]>;
  sensitive?: boolean;
}

export type Item = { kind: 'field'; field: Field } | { kind: 'group'; group: Group };

export interface Section {
  no: number;
  key: string;
  title: string;
  audience: Audience;          // bölümün baskın kitlesi
  items: Item[];
  sensitive?: boolean;
}

export interface FormModel {
  formId: string;
  version: string;
  title: string;
  brand: { wordmark: string[]; colors: Record<string, string> };
  sections: Section[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function normOptions(opts: any[] | undefined): ChoiceOption[] | undefined {
  if (!opts) return undefined;
  return opts.map(o => (typeof o === 'string' ? { value: o, label: o } : { value: o.value, label: o.label, input: o.input }));
}

function normField(raw: any, inherited: Audience, requiredOverride?: boolean): Field {
  return {
    key: raw.key,
    label: raw.label,
    type: raw.type,
    required: requiredOverride ?? !!raw.required,
    audience: (raw.audience as Audience) || inherited,
    options: normOptions(raw.options),
    unit: raw.unit,
    max: raw.max,
    text: raw.text,
    note: raw.note,
    validate: raw.validate,
    encrypt: !!raw.encrypt,
    maskInLists: !!raw.maskInLists,
    showIf: raw.showIf,
    requiredIf: raw.requiredIf,
    sameAsOption: raw.sameAsOption,
    default: raw.default,
    added: !!raw.added,
  };
}

export function normalize(def: any): FormModel {
  const sections: Section[] = def.sections.map((s: any) => {
    const secAud: Audience = s.audience || 'customer';
    const items: Item[] = [];
    for (const f of s.fields || []) items.push({ kind: 'field', field: normField(f, secAud) });
    for (const g of s.groups || []) {
      const gAud: Audience = g.audience || secAud;
      let fields: Field[];
      if (s.repeatTemplate && !g.fields) {
        const req: string[] = Array.isArray(g.required) ? g.required : [];
        fields = s.repeatTemplate.fields.map((f: any) => normField(f, gAud, req.includes(f.key)));
      } else {
        fields = (g.fields || []).map((f: any) => normField(f, gAud));
      }
      items.push({ kind: 'group', group: { key: g.key, title: g.title, audience: gAud, fields, repeat: g.repeat, showIf: g.showIf, sensitive: !!g.sensitive } });
    }
    return { no: s.no, key: s.key, title: s.title, audience: secAud, items, sensitive: !!s.sensitive };
  });
  return { formId: def.formId, version: def.version, title: def.title, brand: def.brand, sections };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Müşteriye gösterilecek görünüm: iç alanlar ve sistem alanları tamamen çıkarılır. */
export function customerView(model: FormModel): FormModel {
  const sections = model.sections
    .map(s => ({
      ...s,
      items: s.items
        .map((it): Item | null => {
          if (it.kind === 'field') return it.field.audience === 'customer' && renderable(it.field) ? it : null;
          if (it.group.audience !== 'customer') return null;
          const fields = it.group.fields.filter(f => f.audience === 'customer' && renderable(f));
          return fields.length ? { kind: 'group', group: { ...it.group, fields } } : null;
        })
        .filter((x): x is Item => x !== null),
    }))
    .filter(s => s.items.length > 0);
  return { ...model, sections };
}

/** Yalnızca iç kullanım alanları (bölüm 8, satış temsilcisi onayı, iç kullanım alanı). */
export function internalView(model: FormModel): Section[] {
  return model.sections
    .map(s => ({
      ...s,
      items: s.items
        .map((it): Item | null => {
          if (it.kind === 'field') return it.field.audience === 'internal' && renderable(it.field) ? it : null;
          if (it.group.audience !== 'internal') return null;
          const fields = it.group.fields.filter(f => renderable(f));
          return fields.length ? { kind: 'group', group: { ...it.group, fields } } : null;
        })
        .filter((x): x is Item => x !== null),
    }))
    .filter(s => s.items.length > 0);
}

function renderable(f: Field) {
  return f.type !== 'print_only' && f.type !== 'signature' && f.audience !== 'system';
}

/** Bir alanın veri içindeki yolu. */
export function fieldPath(sectionKey: string, field: Field, groupKey?: string): string[] {
  return groupKey ? [sectionKey, groupKey, field.key] : [sectionKey, field.key];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function getAt(obj: any, path: string[]): any {
  return path.reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
export function setAt(obj: any, path: string[], value: any): any {
  const root = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  let cur = root;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    const next = cur[k];
    cur[k] = Array.isArray(next) ? [...next] : { ...(next || {}) };
    cur = cur[k];
  }
  cur[path[path.length - 1]] = value;
  return root;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** showIf / requiredIf koşullarını değerlendirir. Anahtar önce aynı bölümde, sonra 'company' bölümünde aranır. */
export function conditionHolds(
  cond: Record<string, string | string[]> | undefined,
  data: Record<string, unknown>,
  sectionKey: string,
): boolean {
  if (!cond) return true;
  return Object.entries(cond).every(([key, expected]) => {
    const sec = (data[sectionKey] as Record<string, unknown>) || {};
    const comp = (data['company'] as Record<string, unknown>) || {};
    const actual = key in sec ? sec[key] : comp[key];
    const exp = Array.isArray(expected) ? expected : [expected];
    if (Array.isArray(actual)) return actual.some(a => exp.includes(String(a)));
    return exp.includes(String(actual ?? ''));
  });
}
