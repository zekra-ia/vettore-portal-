import postgres from 'postgres';

declare global { var __sql: ReturnType<typeof postgres> | undefined; } // eslint-disable-line no-var

export function db() {
  if (!globalThis.__sql) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NETLIFY_DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL (veya NETLIFY_DATABASE_URL) tanımlı değil');
    globalThis.__sql = postgres(url, {
      max: Number(process.env.DB_POOL_MAX || 5),
      prepare: !/pooler\.supabase|:6543/.test(url), // Supabase transaction pooler prepared statement desteklemez
      ssl: /localhost|127\.0\.0\.1/.test(url) ? false : 'require',
      onnotice: () => {},
    });
  }
  return globalThis.__sql;
}
