import bcrypt from 'bcryptjs';
import { requireApi } from '@/lib/server/admin';
import { db } from '@/lib/server/db';
import { logEvent } from '@/lib/server/events';
import { AppError } from '@/lib/server/applications';
import { json } from '@/lib/server/request';
import { handle } from '@/lib/server/handle';

/** Oturumdaki kullanıcının kendi parolasını değiştirmesi (mevcut parola doğrulanır). */
export const PUT = handle(async (req: Request) => {
  const { user, tenant, actor } = await requireApi('view');
  const b = await req.json().catch(() => ({}));
  const current = String(b.current || ''), next = String(b.next || '');
  if (next.length < 10) throw new AppError(400, 'Yeni parola en az 10 karakter olmalıdır.');
  if (next === current) throw new AppError(400, 'Yeni parola mevcut paroladan farklı olmalıdır.');
  const [u] = await db()`select password_hash from users where id = ${user.id}`;
  if (!u || !(await bcrypt.compare(current, u.password_hash))) throw new AppError(400, 'Mevcut parola hatalı.');
  await db()`update users set password_hash = ${await bcrypt.hash(next, 12)} where id = ${user.id}`;
  await logEvent(tenant.id, null, actor, 'password_changed', {});
  return json({ ok: true });
});
