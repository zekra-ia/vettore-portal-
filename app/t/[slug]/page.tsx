import { notFound } from 'next/navigation';
import { tenantBySlug, intakeMode } from '@/lib/server/tenant';
import { Wordmark, PoweredBy } from '@/components/Wordmark';

export const dynamic = 'force-dynamic';

export default async function Welcome({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ k?: string; e?: string }> }) {
  const { slug } = await params;
  const { k, e } = await searchParams;
  const tenant = await tenantBySlug(slug);
  if (!tenant) notFound();
  const mode = intakeMode(tenant);
  const steps = ['Firma ve vergi bilgileri', 'Yetkililer ve teslimat', 'Ödeme ve ticari bilgiler', 'Tercihler ve onay'];

  return (
    <main className="min-h-dvh flex flex-col">
      <div className="flex-1 w-full max-w-xl mx-auto px-5 pt-14 pb-10">
        <Wordmark parts={tenant.brand.wordmark} className="text-[clamp(1.6rem,8.4vw,3.2rem)] block whitespace-nowrap" />
        <div className="h-px bg-gold mt-5 mb-8 w-24" />
        <h1 className="text-[1.65rem] leading-tight font-medium">{tenant.brand.welcome.title}</h1>
        <p className="mt-3 text-muted max-w-[34rem]">{tenant.brand.welcome.text}</p>

        <ol className="mt-8 grid gap-0 border-l border-line">
          {steps.map((s, i) => (
            <li key={s} className="relative pl-6 py-2.5">
              <span className="absolute -left-[5px] top-[1.05rem] size-[9px] rounded-full bg-gold" />
              <span className="text-gold-ink font-medium mr-2 tabular-nums">{i + 1}</span>{s}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted">Yaklaşık 10–15 dakika sürer. Bilgileriniz şifreli bağlantı üzerinden iletilir.</p>

        {mode === 'test' && (
          <p className="mt-6 rounded-lg border border-[#E9C9A0] bg-[#FBF1E2] px-4 py-3 text-sm text-[#7A4B12]">
            Demo test modu: bu bağlantıyla oluşturulan başvurular test olarak işaretlenir. Lütfen gerçek kişisel veri girmeyin.
          </p>
        )}
        {e && <p role="alert" className="mt-6 rounded-lg border border-[#E7B9B3] bg-[#FBEDEB] px-4 py-3 text-sm text-error">{e}</p>}

        {mode === 'closed' ? (
          <p className="mt-8 sheet px-5 py-4">Şu anda yeni başvuru alınmamaktadır. Bilgi için {tenant.name} yetkilinizle iletişime geçin.</p>
        ) : !k ? (
          <p className="mt-8 sheet px-5 py-4">Bu sayfaya Vettore yetkilinizin gönderdiği kişisel bağlantıyla ulaşmanız gerekir.</p>
        ) : (
          <form action="/api/public/start" method="post" className="mt-8">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="k" value={k} />
            <button className="btn btn-primary w-full sm:w-auto px-8 py-3.5 text-[1.05rem]">Formu doldurmaya başla</button>
          </form>
        )}
      </div>
      <footer className="w-full max-w-xl mx-auto px-5 pb-8 flex items-center justify-between gap-4 text-xs text-muted">
        <span>{tenant.controller.privacy_url ? <a className="underline" href={tenant.controller.privacy_url} target="_blank" rel="noreferrer">Aydınlatma metni</a> : null}</span>
        <PoweredBy />
      </footer>
    </main>
  );
}
