import { logout } from '@/lib/server/auth';
import { baseUrl } from '@/lib/server/request';
export async function POST() { await logout(); return Response.redirect(`${baseUrl()}/admin/login`, 303); }
