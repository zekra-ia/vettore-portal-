// Uçtan uca test: çalışan bir sunucuya karşı tam akış + güvenlik kontrolleri.
// Kullanım: BASE=http://localhost:3100 DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/e2e.mjs
// Yalnızca kurgusal test verisi kullanır. Gerçek müşteri verisi içermez.
import postgres from 'postgres';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const BASE = process.env.BASE || 'http://localhost:3100';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const OUT = process.env.OUT || 'out/e2e';
mkdirSync(OUT, { recursive: true });

const results = [];
let cookie = '';
async function t(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log('✔', name); }
  catch (e) { results.push({ name, ok: false, err: e.message }); console.log('✘', name, '—', e.message); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const req = async (path, { method = 'GET', body, form, headers = {}, auth = true, raw = false } = {}) => {
  const h = { ...headers };
  if (auth && cookie) h.cookie = cookie;
  let payload;
  if (form) { payload = new URLSearchParams(form); h['content-type'] = 'application/x-www-form-urlencoded'; }
  else if (body !== undefined) { payload = JSON.stringify(body); h['content-type'] = 'application/json'; }
  const r = await fetch(BASE + path, { method, headers: h, body: payload, redirect: 'manual' });
  const sc = r.headers.get('set-cookie');
  if (sc && sc.startsWith('zf_admin=')) cookie = sc.split(';')[0];
  if (raw) return r;
  const ct = r.headers.get('content-type') || '';
  return { status: r.status, headers: r.headers, json: ct.includes('json') ? await r.json() : null, text: ct.includes('json') ? null : await r.text() };
};
const pdfText = buf => { writeFileSync(`${OUT}/_tmp.pdf`, buf); return execFileSync('pdftotext', ['-layout', `${OUT}/_tmp.pdf`, '-']).toString(); };

const { sampleCustomer, sampleInternal } = await import('../tests/fixtures.mjs');
let linkUrl, token, ref, appId, token2;

await t('Yönetici olmayan istek panel API\'sine erişemez (401)', async () => {
  const r = await req('/api/admin/links', { method: 'POST', body: {}, auth: false });
  assert(r.status === 401, `durum ${r.status}`);
});
await t('Hatalı parola reddedilir', async () => {
  const r = await req('/api/admin/login', { method: 'POST', body: { slug: 'vettore', email: process.env.ADMIN_EMAIL, password: 'yanlis-parola' }, auth: false });
  assert(r.status === 401, `durum ${r.status}`);
});
await t('Yönetici girişi', async () => {
  const r = await req('/api/admin/login', { method: 'POST', body: { slug: 'vettore', email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
  assert(r.status === 200 && cookie, `durum ${r.status}`);
});
await t('Paylaşım bağlantısı ve QR oluşturulur', async () => {
  const r = await req('/api/admin/links', { method: 'POST', body: { label: 'E2E test bağlantısı' } });
  assert(r.status === 200 && r.json.url.includes('/t/vettore?k='), JSON.stringify(r.json));
  assert(r.json.qr.startsWith('data:image/png;base64,'), 'QR yok');
  linkUrl = r.json.url;
  writeFileSync(`${OUT}/QR_test_baglanti.png`, Buffer.from(r.json.qr.split(',')[1], 'base64'));
});
await t('Karşılama sayfası açılır (test modu uyarısı)', async () => {
  const r = await req(new URL(linkUrl).pathname + new URL(linkUrl).search, { auth: false });
  assert(r.status === 200 && r.text.includes('Formu doldurmaya başla') && r.text.includes('test'), `durum ${r.status}`);
});
await t('Geçersiz paylaşım token\'ı ile başvuru başlatılamaz', async () => {
  const r = await req('/api/public/start', { method: 'POST', form: { slug: 'vettore', k: 'gecersiz-token-gecersiz-token-gecersiz' }, auth: false });
  assert(r.status === 303 && decodeURIComponent(r.headers.get('location')).includes('geçersiz'), `durum ${r.status}`);
});
await t('Bağlantıdan müşteriye özel başvuru açılır', async () => {
  const k = new URL(linkUrl).searchParams.get('k');
  const r = await req('/api/public/start', { method: 'POST', form: { slug: 'vettore', k }, auth: false });
  const loc = r.headers.get('location') || '';
  assert(r.status === 303 && loc.includes('/f/'), `durum ${r.status} ${loc}`);
  token = loc.split('/f/')[1];
});
await t('Müşteri verisinde iç alanlar yok, test olarak işaretli', async () => {
  const r = await req(`/api/f/${token}`, { auth: false });
  assert(r.status === 200 && r.json.is_test === true, `durum ${r.status}`);
  const s = JSON.stringify(r.json);
  assert(!/MÜŞTERİ POTANSİYELİ|RİSK DEĞERLENDİRMESİ|İÇ KULLANIM|MÜŞTERİ KODU/.test(s), 'iç alan sızdı');
  assert(!('internal' in r.json), 'internal alanı döndü');
  assert(r.json.form.sections.map(x => x.no).join(',') === '1,2,3,4,5,6,7,9', r.json.form.sections.map(x => x.no).join(','));
});
await t('Müşteri sayfası render edilir', async () => {
  const r = await req(`/f/${token}`, { auth: false });
  assert(r.status === 200 && r.text.includes('Firma genel bilgileri'), `durum ${r.status}`);
});
await t('Taslak kaydı + biçim uyarısı', async () => {
  const r = await req(`/api/f/${token}`, { method: 'PUT', body: { data: { company: { country: 'TR', trade_name: 'Yarım Taslak Ltd. (TEST)' }, contacts: { legal_rep: { email: 'hatali-adres' } } } }, auth: false });
  assert(r.status === 200 && r.json.errors['contacts.legal_rep.email'], JSON.stringify(r.json));
  const [a] = await sql`select company_name, status from applications where edit_token_hash is not null order by created_at desc limit 1`;
  assert(a.company_name === 'Yarım Taslak Ltd. (TEST)' && a.status === 'draft', JSON.stringify(a));
});
await t('Başka kaynaktan (CSRF) taslak yazılamaz', async () => {
  const r = await req(`/api/f/${token}`, { method: 'PUT', body: { data: {} }, headers: { origin: 'https://evil.example' }, auth: false });
  assert(r.status === 403, `durum ${r.status}`);
});
await t('Eksik form gönderilemez (422 + alan listesi)', async () => {
  const r = await req(`/api/f/${token}/submit`, { method: 'POST', body: { data: { company: { country: 'TR', trade_name: 'X' } } }, auth: false });
  assert(r.status === 422 && Object.keys(r.json.errors).length > 5, `durum ${r.status}`);
});
await t('Müşteri iç alan enjekte edemez; eksiksiz başvuru gönderilir ve numara alır', async () => {
  const r = await req(`/api/f/${token}/submit`, { method: 'POST', body: { data: { ...sampleCustomer, sales_evaluation: { risk_assessment: 'DÜŞÜK' }, approval: { ...sampleCustomer.approval, internal_use: { approval_status: 'ONAYLANDI' } } } }, auth: false });
  assert(r.status === 200 && /^VET-\d{4}-\d{4}$/.test(r.json.ref_no), JSON.stringify(r.json));
  ref = r.json.ref_no;
  const [a] = await sql`select id, internal, data, sensitive_enc, status from applications where ref_no = ${ref}`;
  appId = a.id;
  assert(JSON.stringify(a.internal) === '{}', 'iç alana yazıldı');
  assert(!a.data.sales_evaluation, 'sales_evaluation kaydedildi');
});
await t('IBAN ve T.C. kimlik no veritabanında şifreli', async () => {
  const [a] = await sql`select data::text d, sensitive_enc from applications where id = ${appId}`;
  assert(!a.d.includes('TR400006') && !a.d.includes('10000000146'), 'açık metin bulundu');
  assert(a.sensitive_enc?.startsWith('v1.') && !a.sensitive_enc.includes('TR40'), 'şifreli değil');
});
await t('Gönderilen başvuru müşteri tarafından değiştirilemez', async () => {
  const r = await req(`/api/f/${token}`, { method: 'PUT', body: { data: { company: { trade_name: 'Değiştirildi' } } }, auth: false });
  assert(r.status === 409, `durum ${r.status}`);
});
await t('Onay ekranı: numara ve durum', async () => {
  const r = await req(`/api/f/${token}`, { auth: false });
  assert(r.json.ref_no === ref && r.json.editable === false && r.json.status === 'submitted', JSON.stringify({ ref: r.json.ref_no, st: r.json.status }));
});
await t('Müşteri PDF kopyası: iç değerlendirme yok, TCKN maskeli', async () => {
  const r = await req(`/api/f/${token}/pdf`, { auth: false, raw: true });
  const buf = Buffer.from(await r.arrayBuffer());
  assert(r.status === 200 && buf.subarray(0, 4).toString() === '%PDF', `durum ${r.status}`);
  const txt = pdfText(buf);
  assert(txt.includes(ref) && txt.includes('Örnek Mobilya'), 'içerik yok');
  assert(!txt.includes('İÇ DEĞERLENDİRME') && !txt.includes('10000000146'), 'iç veri veya TCKN sızdı');
  writeFileSync(`${OUT}/${ref}_musteri_kopyasi.pdf`, buf);
});
await t('Bildirim e-postası test modunda gönderilmez, geçmişe yazılır', async () => {
  const ev = await sql`select action, details from application_events where application_id = ${appId} and action like 'email_%'`;
  assert(ev.length >= 1 && ev.every(e => e.action !== 'email_sent'), JSON.stringify(ev.map(e => e.action)));
  assert(ev.some(e => e.action === 'email_blocked'), 'müşteri e-postası engellenmedi');
});
await t('Panel listesinde arama ve filtre', async () => {
  const r = await req(`/admin?status=submitted&q=${encodeURIComponent('örnek mobilya')}`);
  assert(r.status === 200 && r.text.includes(ref), `durum ${r.status}`);
  const r2 = await req(`/admin?status=submitted&q=YOKBOYLEFIRMA`);
  assert(!r2.text.includes(ref), 'filtre çalışmıyor');
});
await t('Detay sayfası açılır ve görüntüleme kaydedilir', async () => {
  const r = await req(`/admin/a/${appId}`);
  assert(r.status === 200 && r.text.includes(ref) && r.text.includes('Müşteri beyanı'), `durum ${r.status}`);
  const [e] = await sql`select count(*)::int n from application_events where application_id = ${appId} and action = 'viewed'`;
  assert(e.n === 1, `viewed=${e.n}`);
});
await t('Geçersiz durum geçişi reddedilir', async () => {
  const r = await req(`/api/admin/applications/${appId}/status`, { method: 'POST', body: { to: 'completed' } });
  assert(r.status === 409, `durum ${r.status}`);
});
await t('İncelemeye alınır', async () => {
  const r = await req(`/api/admin/applications/${appId}/status`, { method: 'POST', body: { to: 'in_review' } });
  assert(r.status === 200, `durum ${r.status}`);
});
await t('İç değerlendirme kaydedilir', async () => {
  const r = await req(`/api/admin/applications/${appId}/internal`, { method: 'PUT', body: { data: { ...sampleInternal, company: { trade_name: 'enjeksiyon' } } } });
  assert(r.status === 200 && r.json.data.sales_evaluation.customer_potential === 'YÜKSEK' && !r.json.data.company, JSON.stringify(r.json));
});
await t('Eksik bilgi talebi: yeni güvenli bağlantı, eski bağlantı geçersiz', async () => {
  const r = await req(`/api/admin/applications/${appId}/request-info`, { method: 'POST', body: { message: 'Lütfen muhasebe yetkilisinin cep telefonunu güncelleyin (test).' } });
  assert(r.status === 200 && r.json.link.includes('/f/'), JSON.stringify(r.json));
  token2 = r.json.link.split('/f/')[1];
  const old = await req(`/api/f/${token}`, { auth: false });
  assert(old.status === 404, `eski bağlantı ${old.status}`);
  const n = await req(`/api/f/${token2}`, { auth: false });
  assert(n.json.status === 'needs_info' && n.json.editable && n.json.info_request.includes('muhasebe'), 'talep görünmüyor');
});
await t('Müşteri eksik bilgiyi tamamlayıp yeniden gönderir (aynı kayıt no)', async () => {
  const d = structuredClone(sampleCustomer); d.contacts.finance_contact.mobile_phone = '+90 532 000 00 22';
  const r = await req(`/api/f/${token2}/submit`, { method: 'POST', body: { data: d }, auth: false });
  assert(r.status === 200 && r.json.ref_no === ref, JSON.stringify(r.json));
});
await t('Onaylanır ve tamamlanır; iç kullanım alanı otomatik dolar', async () => {
  for (const to of ['in_review', 'approved', 'completed']) {
    const r = await req(`/api/admin/applications/${appId}/status`, { method: 'POST', body: { to } });
    assert(r.status === 200, `${to}: ${r.status} ${JSON.stringify(r.json)}`);
  }
  const [a] = await sql`select status, internal from applications where id = ${appId}`;
  assert(a.status === 'completed' && a.internal.approval.internal_use.approval_status === 'ONAYLANDI' && a.internal.approval.internal_use.customer_code === 'VET-C-TEST-001', JSON.stringify(a.internal.approval));
});
await t('Tam PDF ve Word (iç değerlendirme dahil) + müşteri Word', async () => {
  for (const [q, name] of [['format=pdf&variant=internal', `${ref}_tam_ic_dahil.pdf`], ['format=docx&variant=internal', `${ref}_tam_ic_dahil.docx`], ['format=docx', `${ref}_musteri.docx`], ['format=pdf', `${ref}_musteri_panel.pdf`]]) {
    const r = await req(`/api/admin/applications/${appId}/doc?${q}`, { raw: true });
    const buf = Buffer.from(await r.arrayBuffer());
    assert(r.status === 200 && buf.length > 5000, `${q}: ${r.status}`);
    writeFileSync(`${OUT}/${name}`, buf);
  }
  const txt = pdfText(Buffer.from(await (await req(`/api/admin/applications/${appId}/doc?format=pdf&variant=internal`, { raw: true })).arrayBuffer()));
  assert(txt.includes('İÇ DEĞERLENDİRME') && txt.includes('VET-C-TEST-001') && txt.includes('10000000146'), 'iç sayfa eksik');
});
await t('İşlem geçmişi eksiksiz', async () => {
  const ev = (await sql`select action from application_events where application_id = ${appId} order by id`).map(e => e.action);
  for (const a of ['created', 'draft_saved', 'submitted', 'viewed', 'status_changed', 'internal_updated', 'info_requested', 'resubmitted', 'pdf_generated', 'docx_generated']) assert(ev.includes(a), `${a} yok: ${ev.join(',')}`);
});
await t('Dışa aktarma (CSV ve JSON)', async () => {
  const c = await req('/api/admin/export?format=csv');
  assert(c.status === 200 && c.text.includes(ref), `csv ${c.status}`);
  const j = await req('/api/admin/export?format=json');
  assert(j.status === 200 && j.json.applications.some(a => a.ref_no === ref && a.customer.finance.bank_accounts[0].iban), 'json');
});
await t('Aydınlatma bilgisi olmadan canlı aktivasyon yapılamaz', async () => {
  const r = await req('/api/admin/license/activate', { method: 'POST' });
  assert(r.status === 412, `durum ${r.status}`);
});
await t('Veri sorumlusu bilgileri girilip doğrulanır', async () => {
  const r = await req('/api/admin/settings', { method: 'PUT', body: { controller: { name: 'TEST Veri Sorumlusu', email: 'kvkk@example.test', address: 'Test adresi', privacy_text: 'Test aydınlatma metni.', retention: 'Test: 6 ay' }, notify_emails: 'bildirim@example.test', privacy_ready: true } });
  assert(r.status === 200 && r.json.privacy_ready === true, JSON.stringify(r.json));
});
await t('Demo aktivasyonu: 30 gün, sunucu tarafında', async () => {
  const r = await req('/api/admin/license/activate', { method: 'POST' });
  assert(r.status === 200, `durum ${r.status}`);
  const days = (new Date(r.json.expires_at) - new Date(r.json.activated_at)) / 86400000;
  assert(Math.round(days) === 30, `gün ${days}`);
});
let liveToken;
await t('Aktif demoda başvuru canlı (test değil) açılır', async () => {
  const k = new URL(linkUrl).searchParams.get('k');
  const r = await req('/api/public/start', { method: 'POST', form: { slug: 'vettore', k }, auth: false });
  liveToken = (r.headers.get('location') || '').split('/f/')[1];
  const p = await req(`/api/f/${liveToken}`, { auth: false });
  assert(p.json.is_test === false, 'test olarak işaretlendi');
});
await t('Süre dolunca yeni başvuru ve taslak gönderimi durur, veriler korunur', async () => {
  await sql`update tenants set expires_at = now() - interval '1 minute' where slug = 'vettore'`;
  const k = new URL(linkUrl).searchParams.get('k');
  const r = await req('/api/public/start', { method: 'POST', form: { slug: 'vettore', k }, auth: false });
  assert(r.status === 303 && decodeURIComponent(r.headers.get('location')).includes('sona erdi'), `start ${r.status}`);
  const s = await req(`/api/f/${liveToken}/submit`, { method: 'POST', body: { data: sampleCustomer }, auth: false });
  assert(s.status === 403, `submit ${s.status}`);
  const [tt] = await sql`select license_status from tenants where slug = 'vettore'`;
  assert(tt.license_status === 'expired', tt.license_status);
  const [{ n }] = await sql`select count(*)::int n from applications where ref_no = ${ref} and data <> '{}'::jsonb`;
  assert(n === 1, 'veri silindi');
  const panel = await req(`/admin/a/${appId}`);
  assert(panel.status === 200, 'panel erişimi kapandı');
});
await t('Kişisel veri silme (anonimleştirme) kayıt numarasını korur', async () => {
  const [d] = await sql`select id from applications where ref_no is null and anonymized_at is null order by created_at limit 1`;
  const id = d?.id;
  if (!id) throw new Error('taslak yok');
  const r = await req(`/api/admin/applications/${id}/anonymize`, { method: 'POST', body: { confirm: 'SİL' } });
  assert(r.status === 200, `durum ${r.status}`);
  const [a] = await sql`select data, company_name, anonymized_at from applications where id = ${id}`;
  assert(JSON.stringify(a.data) === '{}' && !a.company_name && a.anonymized_at, 'silinmedi');
});
await t('Başka kiracının yöneticisi Vettore başvurusunu göremez (veri izolasyonu)', async () => {
  const [other] = await sql`insert into tenants (slug, name, ref_prefix) values ('baska-firma', 'Başka Firma', 'BSK') on conflict (slug) do update set name = excluded.name returning id`;
  const bcrypt = (await import('bcryptjs')).default;
  await sql`insert into users (tenant_id, email, name, role, password_hash) values (${other.id}, 'admin@baska.test', 'Başka Admin', 'admin', ${await bcrypt.hash('Baska-Test-2026!', 10)}) on conflict do nothing`;
  const saved = cookie; cookie = '';
  await req('/api/admin/login', { method: 'POST', body: { slug: 'baska-firma', email: 'admin@baska.test', password: 'Baska-Test-2026!' } });
  const d = await req(`/api/admin/applications/${appId}/doc?format=pdf`, { raw: true });
  const l = await req(`/admin?status=&q=${encodeURIComponent(ref)}`);
  cookie = saved;
  assert(d.status === 404 && l.status === 200 && !l.text.includes(`/admin/a/${appId}`), `doc ${d.status} list ${l.status}`);
});

await sql.end();
const passed = results.filter(r => r.ok).length;
writeFileSync(`${OUT}/test-sonuclari.json`, JSON.stringify({ at: new Date().toISOString(), base: BASE, passed, total: results.length, results }, null, 2));
console.log(`\n${passed}/${results.length} test geçti`);
process.exit(passed === results.length ? 0 : 1);
