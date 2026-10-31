# ZEKRA IA Forms Portal — VETTOREHOME Akıllı Müşteri Kayıt Portalı

ZIA-001 kapsamında geliştirilen, çok kiracılı (multi-tenant) dijital müşteri kayıt sistemi. İlk kiracı **VETTOREHOME**'dur. Sistem, Vettore'nin Word tabanlı *Müşteri Bilgi Formu*nu mobil uyumlu, güvenli bir web formuna, bir yönetim paneline ve otomatik PDF/Word çıktısına dönüştürür.

## Akış

1. Vettore yetkilisi panelde **Bağlantı ve QR** sayfasından paylaşım bağlantısı oluşturur ve WhatsApp, e-posta veya QR kod ile gönderir.
2. Aday müşteri bağlantıyı açar ve Vettore karşılama ekranını görür. **Formu doldurmaya başla** dediğinde kendisine özel, ayrı bir başvuru ve kişisel düzenleme bağlantısı oluşur.
3. Müşteri formu bölüm bölüm doldurur. Taslak her değişiklikte otomatik kaydedilir; aynı bağlantıyla daha sonra devam edilebilir. Eksik ve hatalı alanlar anlık işaretlenir.
4. Gönderimde başvuru `VET-2026-0001` biçiminde numara alır. Müşteri onay ekranını görür ve PDF kopyasını indirir.
5. Vettore'ye bildirim gider (e-posta yapılandırılmışsa). Yetkili başvuruyu inceler, iç değerlendirmeyi (bölüm 8) doldurur ve onaylar, reddeder ya da **eksik bilgi ister**. Eksik bilgi talebinde müşteriye 7 gün geçerli yeni bir güvenli bağlantı oluşturulur ve eski bağlantı geçersizleşir.
6. Her başvuru için aynı veriden **PDF** ve düzenlenebilir **Word (DOCX)** üretilir: müşteri kopyası ve iç değerlendirmeyi içeren tam sürüm.

## Mimari

| Katman | Teknoloji |
|---|---|
| Uygulama | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Veritabanı | PostgreSQL 15+ (Netlify DB / Neon veya Supabase; düz SQL, ORM yok) |
| Belgeler | pdfkit (A4 PDF, gömülü Türkçe fontlar), docx (Word) |
| Kimlik doğrulama | bcrypt parola özeti + HS256 imzalı, httpOnly oturum çerezi (8 saat) |
| Şifreleme | AES-256-GCM (IBAN, T.C. kimlik no) |
| Barındırma | Netlify (`netlify.toml`), Vercel ile de uyumlu |

```
forms/vettore-musteri-bilgi-formu.json   Form tanımı (alan envanteri) — tek doğruluk kaynağı
lib/form/definition.ts                    Tanımı arayüz/doğrulama/belge modeline çevirir
lib/form/validate.ts                      Sunucu+istemci doğrulama (TCKN, VKN, IBAN, AB KDV no…)
lib/docs/{printable,pdf,docx}.ts          Ortak yazdırma modeli → PDF ve DOCX
lib/server/*                              Veritabanı, şifreleme, oturum, iş akışı, lisans, bildirim
app/t/[slug]                              Kurumsal karşılama (genel paylaşım bağlantısı)
app/f/[token]                             Müşteriye özel form
app/admin/*                               Yönetim paneli
db/migrations/*.sql                       Şema
scripts/{migrate,seed,e2e}.mjs            Kurulum ve uçtan uca test
```

### Çok kiracılı yapı
Her tablo `tenant_id` taşır; tüm sorgular oturumdaki kullanıcının kiracısıyla sınırlanır. Yeni bir firma eklemek için kod değişikliği gerekmez:
- `tenants` satırı (marka adı, renkler, kayıt öneki ör. `BSK`),
- `forms` satırı (o firmanın Word formundan çıkarılan JSON tanımı),
- `users` satırları.

Lisans durumu (`pending` → `active` → `expired` / `paid`) kiracı bazındadır.

## Form tanımı
`forms/vettore-musteri-bilgi-formu.json` kaynak Word formunun **9 bölümünü ve bütün alanlarını** orijinal etiketleriyle içerir. Ekranda etiketler cümle düzeninde gösterilir; PDF ve Word çıktılarında orijinal yazım korunur.

- `audience: internal` alanlar (bölüm 8, satış temsilcisi onayı, iç kullanım alanı) müşteriye hiçbir koşulda dönmez. Müşteri bu alanlara veri gönderse bile sunucu bunları atar.
- Ülkeye bağlı alanlar: TR için vergi dairesi, MERSİS, KEP, e-fatura; DE için USt-IdNr. ve Registergericht. Bu eklemeler `added: true` ile işaretlidir.
- KVKK açık rıza metni birebir korunmuştur. Bunun yanında **ayrı** bir "aydınlatma metnini okudum" onayı ve ayrı ticari iletişim izni vardır. Açık rıza vermemek gönderimi engellemez.

## Güvenlik ve veri koruma (KVKK / GDPR)
- **HTTPS ve güvenlik başlıkları:** HSTS, X-Frame-Options DENY, nosniff, no-referrer; form ve panel sayfaları `noindex` ve `no-store`.
- **Bağlantı token'ları:** 256 bit rastgele. Veritabanında yalnızca SHA-256 özeti tutulur. Taslak bağlantısı 30 gün, eksik bilgi bağlantısı 7 gün geçerlidir. Genel paylaşım bağlantısı ile müşteriye özel düzenleme bağlantısı ayrı mekanizmalardır; paylaşım bağlantısı iptal edilebilir ve süreli yapılabilir.
- **Hassas alanlar:** IBAN ve T.C. kimlik no AES-256-GCM ile şifrelenir. T.C. kimlik no müşteri kopyasında ve yetkisi olmayan rollerde maskelenir; veri minimizasyonu gereği zorunlu değildir.
- **Yetkilendirme:** Roller `admin`, `sales` (değerlendirme ve bağlantı) ve `viewer` (salt okuma). 5 hatalı girişte hesap 15 dakika kilitlenir. Durum değiştiren isteklerde aynı-kaynak (CSRF) kontrolü yapılır. Taslak başlatma IP başına saatte 20 ile sınırlıdır.
- **Denetim kaydı:** Oluşturma, taslak, gönderim, görüntüleme, durum değişikliği, değerlendirme, belge üretimi, e-posta, dışa aktarma, giriş ve silme işlemleri kaydedilir.
- **Dışa aktarma ve silme:** Panelden CSV/JSON dışa aktarma yapılabilir. Başvuru bazında "kişisel verileri sil" işlemi kayıt numarasını ve işlem geçmişini koruyarak veriyi kalıcı olarak siler.
- **Canlı veri ön koşulu:** Veri sorumlusu bilgileri, aydınlatma metni ve saklama süresi girilip doğrulanmadan demo canlıya alınamaz. Bu süre boyunca bağlantılar yalnızca *test başvurusu* oluşturur ve müşteriye e-posta gönderilmez.
- **Yedekleme:** Barındırıcının günlük otomatik yedeklemesi açık olmalıdır (Neon/Supabase). Ek olarak panelden JSON dışa aktarma alınabilir.

## 30 günlük demo lisansı
- Demo, **Lisans ve ayarlar → Demoyu başlat** ile ilk canlı aktivasyonda başlar ve 30 gün sonra biter.
- Süre her istekte **sunucu tarafında** kontrol edilir. Süre bitince yeni başvuru başlatılamaz ve taslaklar gönderilemez. Mevcut veriler silinmez; panel ve dışa aktarma çalışmaya devam eder.
- İzlenen bilgiler: aktivasyon ve bitiş tarihi, oluşturulan, gönderilen, tamamlanan ve onaylanan başvurular, eksik bilgi bekleyenler, taslaklar, PDF/Word çıktı sayısı, e-posta sayısı. Test başvuruları ayrı sayılır.
- Ücretli lisansa geçiş: `update tenants set license_status = 'paid' where slug = 'vettore';`

## E-posta bildirimleri
Varsayılan `EMAIL_PROVIDER=log` ayarında **hiçbir e-posta gönderilmez**; bildirimler işlem geçmişine "kaydedildi (gönderilmedi)" olarak yazılır. Gerçek gönderim için şunlar gerekir:
1. Vettore'nin doğrulanmış gönderici alan adı (ör. Resend'de DNS doğrulaması),
2. `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`,
3. `update tenants set sender_email = 'bildirim@vettore…' where slug = 'vettore';`

Test başvurularında müşteriye e-posta hiçbir zaman gönderilmez. `EMAIL_REDIRECT_TO` ile ön izleme ortamındaki tüm e-postalar tek adrese yönlendirilebilir.

## Kurulum (Netlify)
1. Depoyu Netlify'da **Import from Git** ile içe aktarın (ayarlar `netlify.toml`'dan gelir).
2. **Extensions → Netlify DB** ile Postgres veritabanını Frankfurt bölgesinde etkinleştirin (`NETLIFY_DATABASE_URL` otomatik eklenir).
3. **Site configuration → Environment variables** bölümüne şunları ekleyin:
   - `APP_URL` — sitenin adresi, ör. `https://vettore-portal.netlify.app`
   - `SESSION_SECRET` — `openssl rand -base64 48`
   - `DATA_ENCRYPTION_KEY` — `openssl rand -base64 32` (**kaybedilirse şifreli alanlar okunamaz; güvenli yerde saklayın**)
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` — ilk yönetici (yalnızca ilk derlemede kullanılır)
4. **Deploy.** Her derlemede şema güncellenir (`scripts/migrate.mjs`) ve kiracı ile form tanımı yüklenir (`scripts/seed.mjs`, idempotent).

## Kurulum (Vercel)
1. Vercel → **Add New → Project** → GitHub'dan depoyu içe aktarın (bölge ve derleme komutu `vercel.json`'dan gelir: `fra1`).
2. Projede **Storage → Create Database → Neon (Postgres)**, bölge **Frankfurt**; projeye bağlayın (`DATABASE_URL`/`POSTGRES_URL` otomatik eklenir).
3. **Settings → Environment Variables:** `APP_URL`, `SESSION_SECRET`, `DATA_ENCRYPTION_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (yukarıdaki açıklamalarla aynı).
4. **Redeploy.** Şema ve kiracı her derlemede otomatik güncellenir.

## Yerel geliştirme ve test
```bash
cp .env.example .env.local   # değerleri doldurun
npm install
npm run db:migrate && ADMIN_PASSWORD='…' npm run db:seed
npm run dev                  # http://localhost:3000/admin/login
npm test                     # birim testleri (doğrulama, belge üretimi)
npm run build && npm start   # ardından:
BASE=http://localhost:3000 ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run e2e   # 36 uçtan uca test
```
Uçtan uca testler yalnızca kurgusal veri kullanır ve ayrı bir test veritabanında çalıştırılmalıdır (lisans durumunu değiştirir).

## Bilinen sınırlamalar ve açık konular
- Vettore'nin resmi logosu ve web sitesi doğrulanamadı. Arayüz Word formundaki "VETTOREHOME" yazı markasını ve renkleri (#9D843F, #F3EDE2) kullanır. Logo dosyası gelince `brand` ayarına eklenecek.
- ZEKRA IA logosu için `assets/brand/zekra-logo.png` dosyası eklenince PDF ve Word altbilgisinde otomatik kullanılır. Dosya yokken yazılı "ZEKRA IA" gösterilir.
- Islak imza ve kaşe alanları PDF/Word çıktısında boş bırakılır. Dijital onay; beyan kutusu, ad/ünvan, zaman damgası ve IP kaydıyla yapılır. Nitelikli e-imza kapsam dışıdır.
- KVKK açık rıza metni orijinal haliyle korunmuştur. Metnin "üçüncü kişilerle paylaşım" kapsamı ve açık rıza ile aydınlatmanın ayrılması için Vettore hukuk danışmanının gözden geçirmesi önerilir.
- Kullanıcı yönetimi (yeni satış temsilcisi ekleme) şu an veritabanı/seed betiği üzerindendir; panel ekranı sonraki sürümdedir.
