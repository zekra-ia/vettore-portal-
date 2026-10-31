// Tamamen kurgusal test verisi. Gerçek kişi/firma bilgisi içermez.
export const sampleCustomer = {
  company: {
    country: 'TR',
    trade_name: 'Örnek Mobilya Dekorasyon Ticaret Ltd. Şti. (TEST)',
    billing_address: { line1: 'Test Mahallesi Deneme Caddesi No: 1', line2: 'Kat 2', postal_code: '34000', city: 'İstanbul', region: 'Kadıköy', country: 'TR' },
    hq_address: { line1: 'Test Mahallesi Deneme Caddesi No: 1', postal_code: '34000', city: 'İstanbul', country: 'TR' },
    sector: 'Mobilya perakende',
    activity_description: 'Ev ve ofis mobilyası satışı, iç mimari danışmanlık (örnek açıklama).',
    founded_year: 2012, employee_count: 24, capital: 1500000,
    registry_tax: {
      tax_office: 'Örnek Vergi Dairesi', tax_number: '1234567808', trade_registry_no: '123456-0', mersis_no: '0123456789000016',
      chamber: 'İstanbul Ticaret Odası', chamber_registry_no: '987654', kep: 'ornek.mobilya@hs01.kep.tr', website: 'www.ornek-mobilya.test',
    },
    einvoice: { einvoice_status: ['E-FATURA MÜKELLEFİ', 'E-İRSALİYE KULLANICISI'], einvoice_email: 'efatura@ornek-mobilya.test' },
  },
  contacts: {
    legal_rep: { full_name: 'Ayşe Örnek', position: 'Genel Müdür', direct_phone: '+90 212 000 00 01', mobile_phone: '+90 532 000 00 01', email: 'ayse@ornek-mobilya.test' },
    finance_contact: { full_name: 'Mehmet Deneme', position: 'Muhasebe Müdürü', direct_phone: '+90 212 000 00 02', mobile_phone: '+90 532 000 00 02', email: 'muhasebe@ornek-mobilya.test' },
    purchasing_contact: { full_name: 'Zeynep Test', position: 'Satın Alma Uzmanı', mobile_phone: '+90 532 000 00 03', email: 'satinalma@ornek-mobilya.test' },
  },
  delivery: {
    delivery_address: { line1: 'Örnek Lojistik Depo, Test Sokak No: 5', postal_code: '41400', city: 'Kocaeli', region: 'Gebze', country: 'TR' },
    delivery_contact: { full_name: 'Ali Kurgu', position: 'Depo Sorumlusu', phone: '+90 262 000 00 04', mobile_phone: '+90 532 000 00 04' },
    delivery_hours: 'Hafta içi 08:30 – 17:30',
    delivery_notes: 'Rampa mevcut. Teslimattan 1 gün önce arayınız.',
  },
  finance: {
    currency: 'TRY', requested_term_days: 60, requested_credit_limit: 750000, avg_monthly_purchase: 250000, annual_purchase_estimate: 3000000,
    payment_methods: ['HAVALE', 'EFT'], payment_day: { choice: 'DAY_OF_MONTH', value: 15 },
    bank_accounts: [{ bank_name: 'Örnek Bankası', branch: 'Test Şubesi', iban: 'TR400006200000000000000001', account_holder: 'Örnek Mobilya Ltd. Şti.' }],
  },
  ownership: { partners: [
    { full_name: 'Ayşe Örnek', national_id: '10000000146', role: 'Ortak / Müdür', share_pct: 60 },
    { full_name: 'Can Örnek', role: 'Ortak', share_pct: 40 },
  ] },
  commercial: { other_suppliers: ['Örnek Tedarikçi A', 'Örnek Tedarikçi B'], references: ['Test Referans Ltd.', 'Deneme İnşaat A.Ş.'] },
  preferences: { invoice_delivery: ['E-FATURA', 'E-POSTA'], invoice_email: 'fatura@ornek-mobilya.test', marketing_consent: 'HAYIR', privacy_notice_ack: true, kvkk_consent: 'KABUL EDİYORUM' },
  approval: { company_signatory: { full_name: 'Ayşe Örnek', title: 'Genel Müdür', declaration: true } },
};

export const sampleInternal = {
  sales_evaluation: { customer_potential: 'YÜKSEK', risk_assessment: 'DÜŞÜK', suggested_term_days: 45, suggested_credit_limit: 500000, estimated_annual_revenue: 2400000, notes: 'Test değerlendirmesi: showroom ziyareti olumlu.' },
  approval: { sales_rep_approval: { full_name: 'Demo Satış Temsilcisi', date: '2026-10-31' }, internal_use: { customer_code: 'VET-C-TEST-001' } },
};
