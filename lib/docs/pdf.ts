import PDFDocument from 'pdfkit';
import path from 'node:path';
import { zekraLogo } from '../brand';
import type { Printable, PSection } from './printable';

// Türkçe karakterleri tam destekleyen DejaVu fontları npm paketinden gelir (depoda ikili dosya tutulmaz).
const FONT_DIR = path.join(process.cwd(), 'node_modules', 'dejavu-fonts-ttf', 'ttf');

export async function renderPdf(p: Printable): Promise<Buffer> {
  const { primary, surface, ink } = p.meta.colors;
  const doc = new PDFDocument({ size: 'A4', margins: { top: 46, bottom: 60, left: 42, right: 42 }, bufferPages: true,
    info: { Title: `${p.meta.tenantName} – ${p.meta.formTitle} – ${p.meta.refNo}`, Author: p.meta.tenantName, Creator: 'ZEKRA IA Forms Portal' } });
  doc.registerFont('Sans', path.join(FONT_DIR, 'DejaVuSans.ttf'));
  doc.registerFont('SansBold', path.join(FONT_DIR, 'DejaVuSans-Bold.ttf'));
  doc.registerFont('Brand', path.join(FONT_DIR, 'DejaVuSans-Bold.ttf'));
  doc.registerFont('BrandLight', path.join(FONT_DIR, 'DejaVuSans-ExtraLight.ttf'));
  doc.registerFont('BrandMed', path.join(FONT_DIR, 'DejaVuSans-Bold.ttf'));

  const chunks: Buffer[] = [];
  doc.on('data', c => chunks.push(c));
  const done = new Promise<Buffer>(r => doc.on('end', () => r(Buffer.concat(chunks))));

  const L = doc.page.margins.left;
  const W = doc.page.width - L - doc.page.margins.right;
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  const ensure = (h: number) => { if (doc.y + h > bottom()) doc.addPage(); };

  // Başlık
  const [w1, w2] = p.meta.wordmark;
  doc.font('Brand').fontSize(22).fillColor(ink).text(w1, L, 40, { continued: true, characterSpacing: 1.5 })
    .font('BrandLight').fillColor(primary).text(w2 || '', { characterSpacing: 1.5 });
  doc.font('BrandMed').fontSize(12).fillColor(ink).text(p.meta.formTitle, L, 48, { width: W, align: 'right', characterSpacing: 1 });
  doc.moveTo(L, 74).lineTo(L + W, 74).lineWidth(1.5).strokeColor(primary).stroke();

  const metaLine = [
    `Kayıt No: ${p.meta.refNo}`,
    `Başvuru tarihi: ${p.meta.submittedAt ? new Date(p.meta.submittedAt).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }) : '—'}`,
    p.meta.salesRep ? `Satış temsilcisi: ${p.meta.salesRep}` : null,
    `Durum: ${p.meta.statusLabel}`,
  ].filter(Boolean).join('     ');
  doc.font('Sans').fontSize(8.5).fillColor('#5b5346').text(metaLine, L, 82, { width: W });
  doc.y = 102;

  if (p.meta.isTest) {
    doc.save().rect(L, doc.y, W, 18).fill('#FCE8E6').restore();
    doc.font('SansBold').fontSize(8.5).fillColor('#A3271B').text('TEST BAŞVURUSU – Gerçek müşteri verisi değildir.', L, doc.y + 5, { width: W, align: 'center' });
    doc.y += 10;
  }

  const sectionHeader = (s: PSection) => {
    ensure(46);
    const y = doc.y + 6;
    doc.save().rect(L, y, W, 20).fill(s.internal ? '#EDE7DC' : surface).restore();
    doc.save().rect(L, y, 3, 20).fill(primary).restore();
    doc.font('BrandMed').fontSize(10).fillColor(primary).text(String(s.no), L + 10, y + 5, { width: 18 });
    doc.font('BrandMed').fontSize(9.5).fillColor(ink).text(s.title, L + 28, y + 5.5, { width: W - 36, characterSpacing: 0.6 });
    doc.y = y + 26;
  };

  const LABEL_W = 170;
  const row = (label: string, value: string, opts: { blank?: boolean; boxed?: boolean } = {}) => {
    doc.font('Sans').fontSize(8.5);
    const vw = label ? W - LABEL_W - 8 : W;
    const vh = Math.max(doc.heightOfString(value || ' ', { width: vw }), doc.heightOfString(label || ' ', { width: LABEL_W }));
    const h = opts.blank ? 26 : vh + 7;
    ensure(h + 2);
    const y = doc.y;
    if (label) doc.font('SansBold').fontSize(7.5).fillColor('#6f6655').text(label, L + 4, y + 2, { width: LABEL_W });
    if (opts.blank) {
      doc.moveTo(L + LABEL_W + 8, y + 20).lineTo(L + W - 4, y + 20).lineWidth(0.5).dash(2, { space: 2 }).strokeColor('#b9ae98').stroke().undash();
    } else {
      doc.font('Sans').fontSize(8.5).fillColor(value ? ink : '#b9ae98').text(value || '—', L + (label ? LABEL_W + 8 : 4), y + 1.5, { width: vw - 4 });
    }
    doc.moveTo(L, y + h).lineTo(L + W, y + h).lineWidth(0.3).strokeColor('#e4dccd').stroke();
    doc.y = y + h + 1;
  };

  const table = (headers: string[], rows: string[][]) => {
    const cw = W / headers.length;
    ensure(18 + 18 * Math.min(rows.length, 2));
    let y = doc.y + 2;
    doc.save().rect(L, y, W, 16).fill('#F7F3EC').restore();
    headers.forEach((h, i) => doc.font('SansBold').fontSize(7).fillColor('#6f6655').text(h, L + i * cw + 4, y + 4.5, { width: cw - 8 }));
    y += 16;
    for (const r of rows) {
      doc.font('Sans').fontSize(8);
      const h = Math.max(16, ...r.map(c => doc.heightOfString(c || ' ', { width: cw - 8 }) + 6));
      if (y + h > bottom()) { doc.addPage(); y = doc.y; }
      r.forEach((c, i) => doc.font('Sans').fontSize(8).fillColor(ink).text(c, L + i * cw + 4, y + 4, { width: cw - 8 }));
      doc.rect(L, y, W, h).lineWidth(0.3).strokeColor('#e4dccd').stroke();
      y += h;
    }
    doc.y = y + 4;
  };

  const renderSections = (sections: PSection[]) => {
    for (const s of sections) {
      sectionHeader(s);
      for (const it of s.items) {
        if (it.kind === 'sub') { ensure(22); doc.font('SansBold').fontSize(8).fillColor(primary).text(it.title, L + 4, doc.y + 6, { width: W }); doc.y += 5; }
        else if (it.kind === 'row') row(it.label, it.value, it);
        else if (it.kind === 'table') table(it.headers, it.rows);
        else if (it.kind === 'text') { doc.font('Sans').fontSize(7.5); ensure(doc.heightOfString(it.text, { width: W - 8 }) + 8); doc.fillColor('#5b5346').text(it.text, L + 4, doc.y + 3, { width: W - 8 }); doc.y += 3; }
      }
    }
  };

  doc.font('BrandMed').fontSize(8).fillColor('#8a8170').text('MÜŞTERİ BEYANI', L, doc.y + 6, { characterSpacing: 1.2 });
  renderSections(p.customer);
  ensure(40);
  doc.font('Sans').fontSize(8.5).fillColor(ink).text(p.declaration, L, doc.y + 10, { width: W, align: 'center' });
  if (p.consentLine) doc.font('Sans').fontSize(7).fillColor('#8a8170').text(p.consentLine, L, doc.y + 4, { width: W, align: 'center' });

  if (p.internal.length) {
    doc.addPage();
    doc.save().rect(L, doc.y, W, 24).fill(ink).restore();
    doc.font('BrandMed').fontSize(10).fillColor('#fff').text(`${p.meta.tenantName} İÇ DEĞERLENDİRME – GİZLİ`, L, doc.y + 7, { width: W, align: 'center', characterSpacing: 1 });
    doc.y += 14;
    doc.font('Sans').fontSize(7.5).fillColor('#8a8170').text('Bu sayfa yalnızca yetkili Vettore personeli içindir; müşteriye iletilmez.', L, doc.y, { width: W, align: 'center' });
    renderSections(p.internal);
  }

  // Altbilgi: her sayfada
  const range = doc.bufferedPageRange();
  const logo = zekraLogo();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // altbilgi kenar boşluğuna yazılırken yeni sayfa açılmasın
    const y = doc.page.height - 40;
    doc.moveTo(L, y - 6).lineTo(L + W, y - 6).lineWidth(0.4).strokeColor('#e4dccd').stroke();
    doc.font('Sans').fontSize(7).fillColor('#8a8170')
      .text(`${p.meta.tenantName} · ${p.meta.formTitle} · ${p.meta.refNo} · Oluşturma: ${p.meta.generatedAt.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}`, L, y, { width: W * 0.7, lineBreak: false });
    const right = L + W;
    // Sağ alt: "Powered by [ZEKRA simgesi] ZEKRA IA"
    const lw = logo ? 12 * logo.ratio : 0;
    const textW = 40;
    let x = right - textW;
    doc.font('Brand').fontSize(7.5).fillColor('#1E6FD9').text('ZEKRA', x, y, { continued: true, lineBreak: false }).fillColor('#5b5346').text(' IA', { lineBreak: false });
    if (logo) { x -= lw + 4; doc.image(logo.data, x, y - 3, { height: 12 }); }
    doc.font('Sans').fontSize(6.5).fillColor('#8a8170').text('Powered by', x - 42, y + 0.5, { width: 40, align: 'right', lineBreak: false });
    doc.font('Sans').fontSize(6.5).fillColor('#b0a690').text(`${i + 1} / ${range.count}`, L, y + 10, { width: W, align: 'center', lineBreak: false });
  }
  doc.end();
  return done;
}
