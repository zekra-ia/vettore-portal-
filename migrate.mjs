// Basit migration çalıştırıcı: db/migrations/*.sql dosyalarını sırayla bir kez uygular.
import postgres from 'postgres';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NETLIFY_DATABASE_URL;
if (!url) { console.error('DATABASE_URL tanımlı değil'); process.exit(1); }
const sql = postgres(url, { max: 1, onnotice: () => {}, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : 'require' });

await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
const dir = path.resolve('db/migrations');
const files = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort();
for (const f of files) {
  const [done] = await sql`select 1 from schema_migrations where name = ${f}`;
  if (done) continue;
  const body = await readFile(path.join(dir, f), 'utf8');
  await sql.begin(async tx => {
    await tx.unsafe(body);
    await tx`insert into schema_migrations (name) values (${f})`;
  });
  console.log('uygulandı:', f);
}
await sql.end();
