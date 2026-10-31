import {
  AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, Packer, PageNumber, Paragraph, ShadingType, Table, TableCell,
  TableRow, TextRun, WidthType,
} from 'docx';
import { zekraLogo } from '../brand';
import type { Printable, PSection } from './printable';

const hex = (c: string) => c.replace('#', '').toUpperCase();
const FONT = 'Calibri';
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const HAIR = { style: BorderStyle.SINGLE, size: 2, color: 'E4DCCD' };

export async function renderDocx(p: Printable): Promise<Buffer> {
  const { primary, surface, ink } = p.meta.colors;
  const logo = zekraLogo();

  const sectionHeading = (s: PSection) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: NONE, bottom: NONE, left: { style: BorderStyle.SINGLE, size: 18, color: hex(primary) }, right: NONE, insideHorizontal: NONE, insideVertical: NONE },
    rows: [new TableRow({ children: [new TableCell({
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: s.internal ? 'EDE7DC' : hex(surface) },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({ children: [
        new TextRun({ text: `${s.no}  `, bold: true, color: hex(primary), font: FONT, size: 20 }),
        new TextRun({ text: s.title, bold: true, color: hex(ink), font: FONT, size: 19 }),
      ] })],
    })] })],
  });

  const rowsTable = (rows: { label: string; value: string; blank?: boolean }[]) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: HAIR, insideVertical: NONE },
    columnWidths: [3000, 6600],
    rows: rows.map(r => new TableRow({ children: [
      new TableCell({ width: { size: 32, type: WidthType.PERCENTAGE }, margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [new Paragraph({ children: [new TextRun({ text: r.label ? `${r.label} :` : '', bold: true, size: 15, color: '6F6655', font: FONT })] })] }),
      new TableCell({ width: { size: 68, type: WidthType.PERCENTAGE }, margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: (r.blank ? ['______________________________'] : (r.value || '').split('\n')).map(line =>
          new Paragraph({ children: [new TextRun({ text: line, size: 17, color: hex(ink), font: FONT })] })) }),
    ] })),
  });

  const repeatTable = (headers: string[], rows: string[][]) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: HAIR, bottom: HAIR, left: HAIR, right: HAIR, insideHorizontal: HAIR, insideVertical: HAIR },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map(h => new TableCell({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F7F3EC' }, margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 14, color: '6F6655', font: FONT })] })] })) }),
      ...rows.map(r => new TableRow({ children: r.map(c => new TableCell({ margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [new Paragraph({ children: [new TextRun({ text: c, size: 16, font: FONT })] })] })) })),
    ],
  });

  const renderSection = (s: PSection) => {
    const out: (Paragraph | Table)[] = [new Paragraph({ spacing: { before: 160 } }), sectionHeading(s)];
    let buffer: { label: string; value: string; blank?: boolean }[] = [];
    const flush = () => { if (buffer.length) { out.push(rowsTable(buffer)); buffer = []; } };
    for (const it of s.items) {
      if (it.kind === 'row') { buffer.push(it); continue; }
      flush();
      if (it.kind === 'sub') out.push(new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: it.title, bold: true, size: 16, color: hex(primary), font: FONT })] }));
      if (it.kind === 'table') out.push(repeatTable(it.headers, it.rows));
      if (it.kind === 'text') out.push(new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: it.text, size: 15, color: '5B5346', font: FONT, italics: true })] }));
    }
    flush();
    return out;
  };

  const [w1, w2] = p.meta.wordmark;
  const header = new Header({ children: [
    new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: hex(primary), space: 4 } }, tabStops: [{ type: 'right' as never, position: 9600 }], children: [
      new TextRun({ text: w1, bold: true, size: 36, color: hex(ink), font: FONT, characterSpacing: 30 }),
      new TextRun({ text: w2 || '', size: 36, color: hex(primary), font: FONT, characterSpacing: 30 }),
      new TextRun({ text: `\t${p.meta.formTitle}`, bold: true, size: 20, color: hex(ink), font: FONT }),
    ] }),
  ] });

  const footerRuns: (TextRun | ImageRun)[] = [
    new TextRun({ text: `${p.meta.tenantName} · ${p.meta.refNo} · Sayfa `, size: 13, color: '8A8170', font: FONT }),
    new TextRun({ children: [PageNumber.CURRENT], size: 13, color: '8A8170', font: FONT }),
    new TextRun({ text: '      Powered by ', size: 13, color: '8A8170', font: FONT }),
  ];
  if (logo) footerRuns.push(new ImageRun({ type: 'png', data: logo.data, transformation: { width: Math.round(14 * logo.ratio), height: 14 } }), new TextRun({ text: ' ', size: 13, font: FONT }));
  footerRuns.push(new TextRun({ text: 'ZEKRA', bold: true, size: 14, color: '1E6FD9', font: FONT }), new TextRun({ text: ' IA', bold: true, size: 14, color: '5B5346', font: FONT }));
  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: footerRuns })] });

  const metaPara = new Paragraph({ spacing: { after: 120 }, children: [
    new TextRun({ text: `KAYIT NO : ${p.meta.refNo}     TARİH : ${p.meta.submittedAt ? new Date(p.meta.submittedAt).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }) : '___ / ___ / ______'}     SATIŞ TEMSİLCİSİ : ${p.meta.salesRep || '______________'}     DURUM : ${p.meta.statusLabel}`, size: 16, color: '5B5346', font: FONT }),
  ] });

  const children: (Paragraph | Table)[] = [metaPara];
  if (p.meta.isTest) children.push(new Paragraph({ alignment: AlignmentType.CENTER, shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FCE8E6' }, children: [new TextRun({ text: 'TEST BAŞVURUSU – Gerçek müşteri verisi değildir.', bold: true, size: 16, color: 'A3271B', font: FONT })] }));
  p.customer.forEach(s => children.push(...renderSection(s)));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240 }, children: [new TextRun({ text: p.declaration, size: 17, font: FONT })] }));
  if (p.consentLine) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: p.consentLine, size: 13, color: '8A8170', font: FONT })] }));

  const sections = [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1200, bottom: 1000, left: 1000, right: 1000 } } },
    headers: { default: header }, footers: { default: footer }, children,
  }];
  if (p.internal.length) {
    const inner: (Paragraph | Table)[] = [
      new Paragraph({ alignment: AlignmentType.CENTER, shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(ink) }, children: [new TextRun({ text: `${p.meta.tenantName} İÇ DEĞERLENDİRME – GİZLİ`, bold: true, color: 'FFFFFF', size: 20, font: FONT })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Bu bölüm yalnızca yetkili Vettore personeli içindir; müşteriye iletilmez.', size: 14, color: '8A8170', font: FONT })] }),
    ];
    p.internal.forEach(s => inner.push(...renderSection(s)));
    sections.push({ ...sections[0], children: inner });
  }
  const doc = new Document({ creator: p.meta.tenantName, title: `${p.meta.formTitle} – ${p.meta.refNo}`, description: 'ZEKRA IA Forms Portal', sections });
  return Packer.toBuffer(doc);
}
