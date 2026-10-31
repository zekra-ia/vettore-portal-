// ZEKRA IA simgesi: public/brand/zekra-logo.png (web'de /brand/zekra-logo.png olarak da sunulur).
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

export const ZEKRA_LOGO_PATH = path.join(process.cwd(), 'public', 'brand', 'zekra-logo.png');

/** Logo varsa içeriğini ve en/boy oranını döndürür (PNG IHDR başlığından). */
export function zekraLogo(): { data: Buffer; ratio: number } | null {
  if (!existsSync(ZEKRA_LOGO_PATH)) return null;
  const data = readFileSync(ZEKRA_LOGO_PATH);
  const isPng = data.subarray(1, 4).toString() === 'PNG';
  const w = isPng ? data.readUInt32BE(16) : 1, h = isPng ? data.readUInt32BE(20) : 1;
  return { data, ratio: w && h ? w / h : 1 };
}
