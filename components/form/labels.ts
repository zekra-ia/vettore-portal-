// Kaynak formdaki BÜYÜK HARF etiketleri ekranda cümle düzeninde gösterir (anlam değişmez; belgeler orijinal yazımı korur).
const KEEP = ['KEP', 'MERSİS', 'IBAN', 'T.C.', 'KVKK', 'SMS', 'USt-IdNr.', 'VAT', 'ID', 'TL', 'IHK', 'HRB', 'HRA', 'VKN', 'TCKN', 'E-POSTA'];
const KEEP_LOWER: Record<string, string> = { 'E-POSTA': 'e-posta' };

export function human(label: string): string {
  if (!label) return label;
  if (label !== label.toLocaleUpperCase('tr')) return label; // zaten karışık yazım (ör. "Registergericht")
  let s = label.toLocaleLowerCase('tr');
  s = s.charAt(0).toLocaleUpperCase('tr') + s.slice(1);
  for (const k of KEEP) {
    const low = k.toLocaleLowerCase('tr');
    const re = new RegExp(`(^|[\\s(/])${low.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[\\s)/:,])`, 'giu');
    s = s.replace(re, (_m, pre) => pre + (KEEP_LOWER[k] && pre ? KEEP_LOWER[k] : k));
  }
  return s.replace(/^E-posta/, 'E-posta');
}

export const COUNTRY_NAMES: Record<string, string> = { TR: 'Türkiye', DE: 'Almanya', OTHER: 'Diğer ülke' };
export const ADD_LABEL: Record<string, string> = { partners: 'Ortak ekle', bank_accounts: 'Banka hesabı ekle' };
export const CURRENCY_SUFFIX: Record<string, string> = { TRY: 'TL', EUR: '€', USD: '$' };
