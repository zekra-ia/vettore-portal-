import { AppError, customerPayload, loadByToken } from '@/lib/server/applications';
import CustomerForm, { type Payload } from '@/components/form/CustomerForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Müşteri Bilgi Formu', referrer: 'no-referrer' };

export default async function FormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const { app, tenant, model } = await loadByToken(token);
    const payload = JSON.parse(JSON.stringify(customerPayload(app, tenant, model))) as Payload;
    return <CustomerForm token={token} initial={payload} />;
  } catch (e) {
    if (!(e instanceof AppError)) throw e;
    return (
      <main className="min-h-dvh grid place-items-center p-6">
        <div className="sheet max-w-md p-6">
          <h1 className="text-lg font-medium">Bağlantı açılamadı</h1>
          <p className="mt-2 text-muted">{e.message}</p>
        </div>
      </main>
    );
  }
}
