import { AppError } from './applications';
import { fail } from './request';

/** Rota işleyicilerini sarmalar: AppError → anlamlı HTTP yanıtı, diğer hatalar → genel 500 (ayrıntı sızdırmadan). */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try { return await fn(...args); }
    catch (e) {
      if (e instanceof AppError) return fail(e.status, e.message, e.extra);
      console.error('[api]', e);
      return fail(500, 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.');
    }
  };
}
