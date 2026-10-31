// Vettore kiracısını, form tanımını ve ilk yönetici hesabını oluşturur (idempotent).
// Kullanım: DATABASE_URL=... ADMIN_EMAIL=... [ADMIN_PASSWORD=...] node scripts/seed.mjs
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NETLIFY_DATABASE_URL;
const sql = postgres(url, { max: 1, onnotice: () => {}, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : 'require' });
const def = JSON.parse(await readFile('forms/vettore-musteri-bilgi-formu.json', 'utf8'));

const brand = {
  wordmark: def.brand.wordmark,
  colors: { primary: def.brand.colors.gold, surface: def.brand.colors.cream, ink: '#1F1B16' },
  welcome: {
    title: 'Müşteri Bilgi Formu',
    text: 'VETTOREHOME ile çalışmaya başlamak için firma bilgilerinizi bu güvenli form üzerinden iletebilirsiniz. Formu dilediğiniz an taslak olarak kaydedip daha sonra devam edebilirsiniz.'
  }
};

const [tenant] = await sql`
  insert into tenants (slug, name, ref_prefix, brand, notify_emails)
  values ('vettore', 'VETTOREHOME', 'VET', ${sql.json(brand)}, ${process.env.NOTIFY_EMAILS ? process.env.NOTIFY_EMAILS.split(',') : []})
  on conflict (slug) do update set brand = excluded.brand
  returning id`;

await sql`
  insert into forms (tenant_id, form_key, version, definition)
  values (${tenant.id}, ${def.formId}, ${def.version}, ${sql.json(def)})
  on conflict (tenant_id, form_key, version) do update set definition = excluded.definition`;

const email = (process.env.ADMIN_EMAIL || 'admin@vettore.demo').toLowerCase();
const [existing] = await sql`select id from users where tenant_id = ${tenant.id} and email = ${email}`;
if (!existing && !process.env.ADMIN_PASSWORD && (process.env.NETLIFY || process.env.VERCEL)) {
  console.log('ADMIN_PASSWORD tanımlı değil: yönetici oluşturulmadı (derleme günlüğüne parola yazılmaz).');
} else if (!existing) {
  const password = process.env.ADMIN_PASSWORD || randomBytes(12).toString('base64url');
  await sql`insert into users (tenant_id, email, name, role, password_hash)
            values (${tenant.id}, ${email}, ${process.env.ADMIN_NAME || 'Vettore Yönetici'}, 'admin', ${await bcrypt.hash(password, 12)})`;
  console.log(`Yönetici oluşturuldu: ${email}`);
  if (!process.env.ADMIN_PASSWORD) console.log(`Geçici parola (bir kez gösterilir): ${password}`);
} else {
  console.log(`Yönetici zaten var: ${email}`);
}
console.log('Kiracı:', tenant.id);
await sql.end();
