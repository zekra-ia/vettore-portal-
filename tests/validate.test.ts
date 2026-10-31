import { describe, expect, it } from 'vitest';
import def from '../forms/vettore-musteri-bilgi-formu.json';
import { normalize, customerView, internalView } from '../lib/form/definition';
import { validate, ibanValid, tcknValid, vknValid, splitSensitive, mergeSensitive } from '../lib/form/validate';
import { sampleCustomer, sampleInternal } from './fixtures.mjs';

const model = normalize(def);

describe('form modeli', () => {
  it('dokuz bölümü korur', () => {
    expect(model.sections.map(s => s.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it('müşteri görünümünde bölüm 8 ve iç alanlar yoktur', () => {
    const cv = customerView(model);
    expect(cv.sections.find(s => s.no === 8)).toBeUndefined();
    const s9 = cv.sections.find(s => s.no === 9)!;
    expect(s9.items.map(i => (i.kind === 'group' ? i.group.key : i.field.key))).toEqual(['company_signatory']);
    expect(JSON.stringify(cv)).not.toMatch(/MÜŞTERİ POTANSİYELİ|RİSK DEĞERLENDİRMESİ|İÇ KULLANIM/);
  });
  it('iç görünüm bölüm 8 ve iç kullanım alanını içerir', () => {
    const iv = internalView(model);
    expect(iv.map(s => s.no)).toEqual([8, 9]);
  });
});

describe('doğrulayıcılar', () => {
  it('TCKN, VKN, IBAN', () => {
    expect(tcknValid('10000000146')).toBe(true);
    expect(tcknValid('10000000147')).toBe(false);
    expect(vknValid('1234567808')).toBe(true);
    expect(vknValid('1234567809')).toBe(false);
    expect(ibanValid('TR40 0006 2000 0000 0000 0000 01')).toBe(true);
    expect(ibanValid('DE89370400440532013000')).toBe(true);
    expect(ibanValid('TR400006200000000000000002')).toBe(false);
  });
});

describe('validate()', () => {
  it('eksiksiz örnek başvuru gönderimde hatasızdır', () => {
    const r = validate(model, sampleCustomer, { mode: 'submit', audience: 'customer' });
    expect(r.errors).toEqual({});
    expect(r.clean.company.trade_name).toContain('Örnek');
  });
  it('boş form gönderimde zorunlu alanları işaretler', () => {
    const r = validate(model, { company: { country: 'TR' } }, { mode: 'submit', audience: 'customer' });
    for (const k of ['company.trade_name', 'company.registry_tax.tax_office', 'company.registry_tax.tax_number', 'contacts.legal_rep.email', 'finance.payment_methods', 'preferences.kvkk_consent', 'preferences.privacy_notice_ack', 'approval.company_signatory.declaration']) {
      expect(r.errors[k], k).toBeTruthy();
    }
  });
  it('taslakta zorunluluk aranmaz ama biçim hataları bildirilir', () => {
    const r = validate(model, { company: { country: 'TR', trade_name: 'X' }, contacts: { legal_rep: { email: 'hatali' } } }, { mode: 'draft', audience: 'customer' });
    expect(Object.keys(r.errors)).toEqual(['contacts.legal_rep.email']);
  });
  it('müşteri iç alanlara veri yazamaz', () => {
    const r = validate(model, { ...sampleCustomer, ...sampleInternal }, { mode: 'draft', audience: 'customer' });
    expect(r.clean.sales_evaluation).toBeUndefined();
    expect(r.clean.approval?.internal_use).toBeUndefined();
  });
  it('ülkeye göre alanlar: DE için vergi dairesi istenmez, USt-IdNr doğrulanır', () => {
    const de = structuredClone(sampleCustomer) as any;
    de.company.country = 'DE';
    de.company.registry_tax = { tax_number: '21/815/08150', vat_id: 'DE 123456789', registry_court: 'Amtsgericht Köln', trade_registry_no: 'HRB 12345' };
    delete de.company.einvoice;
    de.ownership.partners = [{ full_name: 'Max Muster', role: 'Geschäftsführer', share_pct: 100 }];
    const r = validate(model, de, { mode: 'submit', audience: 'customer' });
    expect(r.errors).toEqual({});
    expect(r.clean.company.registry_tax.vat_id).toBe('DE123456789');
    expect(r.clean.company.registry_tax.tax_office).toBeUndefined();
  });
  it('hisse toplamı %100 üstü reddedilir', () => {
    const x = structuredClone(sampleCustomer) as any;
    x.ownership.partners[1].share_pct = 50;
    expect(validate(model, x, { mode: 'submit', audience: 'customer' }).errors['ownership.partners']).toBeTruthy();
  });
  it('hassas alanlar ayrılır ve geri birleştirilir', () => {
    const { clean } = validate(model, sampleCustomer, { mode: 'submit', audience: 'customer' });
    const { open, sensitive } = splitSensitive(model, clean);
    expect(JSON.stringify(open)).not.toContain('TR400006');
    expect(JSON.stringify(open)).not.toContain('10000000146');
    expect(mergeSensitive(open, sensitive)).toEqual(clean);
  });
  it('iç değerlendirme doğrulanır', () => {
    const r = validate(model, sampleInternal, { mode: 'draft', audience: 'internal' });
    expect(r.errors).toEqual({});
    expect(r.clean.company).toBeUndefined();
  });
});
