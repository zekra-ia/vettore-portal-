import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { db } from './db';

const COOKIE = 'zf_admin';
const TTL_H = 8;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET en az 32 karakter olmalı');
  return new TextEncoder().encode(s);
}

let _dummy: string | undefined;
const dummyHash = () => (_dummy ??= bcrypt.hashSync('timing-equalizer', 12));

export interface SessionUser { id: string; tenant_id: string; email: string; name: string; role: 'admin' | 'sales' | 'viewer' }

export async function login(tenantId: string, email: string, password: string): Promise<{ user?: SessionUser; error?: string }> {
  const [u] = await db()`select * from users where tenant_id = ${tenantId} and email = ${email.toLowerCase().trim()}`;
  // Kullanıcı yoksa da bcrypt çalıştır: zamanlama ile hesap varlığı anlaşılmasın.
  if (!u) { await bcrypt.compare(password, dummyHash()); return { error: 'E-posta veya parola hatalı.' }; }
  if (!u.active) return { error: 'Hesap devre dışı.' };
  if (u.locked_until && new Date(u.locked_until) > new Date()) return { error: 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.' };
  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) {
    const fails = u.failed_logins + 1;
    await db()`update users set failed_logins = ${fails >= 5 ? 0 : fails}, locked_until = ${fails >= 5 ? new Date(Date.now() + 15 * 60_000) : null} where id = ${u.id}`;
    return { error: 'E-posta veya parola hatalı.' };
  }
  await db()`update users set failed_logins = 0, locked_until = null, last_login_at = now() where id = ${u.id}`;
  const user: SessionUser = { id: u.id, tenant_id: u.tenant_id, email: u.email, name: u.name, role: u.role };
  const jwt = await new SignJWT({ tid: u.tenant_id }).setProtectedHeader({ alg: 'HS256' }).setSubject(u.id)
    .setIssuedAt().setExpirationTime(`${TTL_H}h`).sign(secret());
  (await cookies()).set(COOKIE, jwt, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: TTL_H * 3600 });
  return { user };
}

export async function logout() { (await cookies()).delete(COOKIE); }

/** Oturumu doğrular ve kullanıcıyı her istekte veritabanından yeniden yükler (devre dışı bırakma anında etkili). */
export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    const [u] = await db()`select id, tenant_id, email, name, role from users where id = ${payload.sub!} and tenant_id = ${payload.tid as string} and active`;
    return (u as unknown as SessionUser) || null;
  } catch { return null; }
}

export function can(u: SessionUser, action: 'view' | 'edit_internal' | 'decide' | 'manage_links' | 'manage_license' | 'export' | 'view_sensitive') {
  if (u.role === 'admin') return true;
  if (u.role === 'sales') return ['view', 'edit_internal', 'manage_links'].includes(action);
  return action === 'view';
}
