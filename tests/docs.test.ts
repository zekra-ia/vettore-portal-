import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import def from '../forms/vettore-musteri-bilgi-formu.json';
import { normalize } from '../lib/form/definition';
import { validate } from '../lib/form/validate';
import { buildPrintable } from '../lib/docs/printable';
import { renderPdf } from '../lib/docs/pdf';
import { renderDocx } from '../lib/docs/docx';
import { sampleCustomer, sampleInternal } from './fixtures.mjs';

const model = normalize(def);
const meta = (variant: 'customer' | 'internal') => ({
  tenantName: 'VETTOREHOME', wordmark: ['VETTORE', 'HOME'], colors: { primary: '#9D843F', surface: '#F3EDE2', ink: '#1F1B16' },
  refNo: 'VET-2026-0001', submittedAt: new Date('2026-10-31T10:00:00Z'), generatedAt: new Date('2026-10-31T10:05:00Z'),
  salesRep: 'Demo Satış Temsilcisi', statusLabel: 'Onaylandı', isTest: true, variant,
});

describe('belgeler', () => {
  const data = validate(model, sampleCustomer, { mode: 'submit', audience: 'customer' }).clean;
  const internal = validate(model, sampleInternal, { mode: 'draft', audience: 'internal' }).clean;

  it('müşteri kopyası iç değerlendirme içermez ve TCKN maskelenir', () => {
    const p = buildPrintable(model, data, internal, meta('customer'), { maskSensitive: true });
    expect(p.internal).toHaveLength(0);
    const txt = JSON.stringify(p.customer);
    expect(txt).not.toContain('10000000146');
    expect(txt).not.toMatch(/MÜŞTERİ POTANSİYELİ/);
  });

  it('PDF ve DOCX üretilir', async () => {
    mkdirSync('out', { recursive: true });
    for (const v of ['customer', 'internal'] as const) {
      const p = buildPrintable(model, data, internal, meta(v), { maskSensitive: false });
      const pdf = await renderPdf(p);
      const docx = await renderDocx(p);
      expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
      expect(docx.subarray(0, 2).toString()).toBe('PK');
      writeFileSync(`out/test_${v}.pdf`, pdf);
      writeFileSync(`out/test_${v}.docx`, docx);
    }
  });
});
