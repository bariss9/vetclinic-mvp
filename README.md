# VetClinic

Veteriner klinik yönetim sistemi — AI destekli anamnez, randevu yönetimi ve aşı takibi içeren minimal bir MVP. Evcil hayvan sahipleri haritadan klinik seçip AI sohbetiyle anamnez doldurarak randevu alır; klinikler randevuları yönetir, takvimde izler ve aşı kayıtları tutar.

---

## Özellikler

- **Rol tabanlı sistem** — iki ayrı panel: **OWNER** (evcil hayvan sahibi: hayvanlarım, randevularım, randevu al) ve **CLINIC** (hastalar, randevu istekleri, takvim)
- **AI destekli anamnez** — Groq (`llama-3.1-8b-instant`) ile 7 soruluk sabit akış; her cevap 0-100 relevans skoruyla doğrulanır, alakasız cevapta soru yeniden sorulur
- **E-posta doğrulama** — kayıt sonrası Resend ile 6 haneli kod, 2 dakika geçerli; doğrulanmadan giriş yapılamaz
- **Randevu sistemi** — harita tabanlı klinik seçimi (Leaflet + OpenStreetMap), slot bazlı rezervasyon (09:00–17:00, saat başı), backend çakışma kontrolü (dolu saate 409), durum yönetimi: `PENDING` / `SCHEDULED` / `COMPLETED` / `NO_SHOW` / `UNCERTAIN` / `CANCELLED` (rol bazlı geçiş kısıtları)
- **Takvim** — klinik paneli aylık takvimi: renk kodlu randevu durumları + planlanmış aşılar
- **Aşı takibi** — klinik ekler/düzenler/siler (sadece kendi oluşturduğu kayıtları), owner salt okunur görüntüler
- **Otomatik bildirimler** —
  - randevudan 1 gün önce hasta sahibine hatırlatma maili (günlük cron 09:00)
  - yeni randevu talebinde kliniğe anlık bildirim maili
  - onay bekleyen (PENDING) randevular için kliniğe 30 dakikada bir hatırlatma (randevu başına max 3)
  - tarihi 2+ gün geçmiş SCHEDULED randevular otomatik `UNCERTAIN` olur (günlük cron 08:00)
- **Güvenlik** — JWT auth (fail-closed: `JWT_SECRET` yoksa uygulama açılmaz), rate limiting (`@nestjs/throttler`), ownership kontrolü (OWNER sadece kendi kayıtlarını görür/değiştirir), verify-email brute-force sayacı

---

## Tech Stack

| Katman | Teknoloji |
|---|---|
| Backend | NestJS (modular monolith), Prisma ORM, PostgreSQL, JWT (HS256), `@nestjs/schedule` (cron), `@nestjs/throttler` |
| Frontend | React 19 + Vite + TypeScript (strict mode), react-router-dom v7, sade CSS |
| AI | Groq REST API — `llama-3.1-8b-instant` (anamnez cevap validasyonu) |
| Mail | Resend API (doğrulama kodları + randevu bildirimleri) |
| Harita | Leaflet.js + Overpass API (OpenStreetMap verisi, 10 km yarıçap) |

---

## Gereksinimler

- **Node.js** 18+
- **PostgreSQL** 18
- **Groq API key** — ücretsiz: [console.groq.com](https://console.groq.com)
- **Resend API key** — ücretsiz: [resend.com](https://resend.com). Test modunda mail **sadece Resend hesabına kayıtlı adrese** gider; başka adreslere göndermek için [resend.com/domains](https://resend.com/domains)'de bir domain doğrulayıp `backend/src/mail/mail.service.ts`'deki `from` adresini o domaine çevirin.

---

## Kurulum

### 1. PostgreSQL

İlk kurulumda (data dizini boşsa):

```
initdb -D C:\pgdata -U postgres --locale=C --encoding=UTF8
```

> **Not:** `--locale=C` önemli — Windows Türkçe locale'i PostgreSQL'i kırıyor. Windows kullanıcı adınızda Türkçe karakter varsa varsayılan data dizini de sorun çıkarabilir; `C:\pgdata` gibi ASCII bir yol kullanın.

Sunucuyu başlatın (Windows service kayıtlı değilse her oturumda gerekir):

```
pg_ctl start -D C:\pgdata
```

Veritabanını oluşturun:

```sql
CREATE DATABASE vetclinic;
ALTER USER postgres WITH PASSWORD 'postgres';
```

### 2. Backend

```bash
cd backend
npm install
```

`backend/.env.example` dosyasını `backend/.env` olarak kopyalayıp değerleri doldurun (aşağıdaki tabloya bakın), ardından:

```bash
npx prisma migrate deploy   # migration'ları uygular
npx prisma generate         # TypeScript client'ı üretir
npm run start:dev
```

> Şema yönetimi migration tabanlıdır — `prisma db push` kullanmayın. Yeni şema değişikliği için: `npx prisma migrate dev --name <açıklayıcı_isim>`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Ortam Değişkenleri (`backend/.env`)

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `DATABASE_URL` | Evet | PostgreSQL bağlantı string'i — örn. `postgresql://postgres:postgres@localhost:5432/vetclinic` |
| `JWT_SECRET` | Evet | JWT imzalama secret'ı — tanımlı değilse backend açılmaz (fail-closed) |
| `GROQ_API_KEY` | Evet | Anamnez cevap validasyonu için Groq API anahtarı |
| `ANTHROPIC_API_KEY` | Hayır | Placeholder — AI tanı endpoint'i şu an structured mock döner, ileride kullanılacak |
| `RESEND_API_KEY` | Evet | E-posta doğrulama kodları ve randevu bildirimleri için Resend API anahtarı |
| `TEST_EMAIL_TO` | Hayır | Lokal mail testleri için hedef adres — sadece geliştirmede kullanılır |

Frontend'in geliştirme ortamında env değişkeni yoktur.

---

## Varsayılan URL'ler

| Servis | URL |
|---|---|
| Backend API | http://localhost:3000 |
| Frontend | http://localhost:5173 |

---

## Proje Yapısı

```
VetClinic-MVP/
├── backend/
│   ├── src/
│   │   ├── users/            # Kayıt + giriş, e-posta doğrulama, JWT üretimi, rate limiting
│   │   ├── auth/             # JwtAuthGuard — Bearer token doğrular, req.user set eder
│   │   ├── patients/         # Hasta (hayvan) CRUD, ownership filtreleme
│   │   ├── medical-records/  # Tıbbi kayıtlar: semptomlar, AI sonucu, anamnez JSON
│   │   ├── appointments/     # Randevu CRUD, available-slots, durum geçişleri, cron'lar
│   │   ├── ai/               # POST /ai/diagnose — tanı destek endpoint'i (şu an mock)
│   │   ├── anamnesis/        # 7 soruluk validasyon akışı (Groq skorlama)
│   │   ├── vaccinations/     # Aşı kayıtları — CLINIC yazar, OWNER okur
│   │   ├── mail/             # MailService (Resend) — @Global modül
│   │   └── prisma/           # PrismaService
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/       # git'te takip edilir — migrate deploy ile uygulanır
└── frontend/
    └── src/
        ├── pages/
        │   ├── LoginPage.tsx            # Giriş — token bellekte tutulur
        │   ├── RegisterPage.tsx         # Kayıt — OWNER/CLINIC rol seçimi
        │   ├── VerifyEmailPage.tsx      # 6 haneli kod + 120 sn geri sayım
        │   ├── PatientsPage.tsx         # OWNER: "Evcil Hayvanlarım" / CLINIC: "Hastalar"
        │   ├── PatientDetailPage.tsx    # Tıbbi kayıtlar, AI tanı, anamnez, aşı takibi
        │   ├── RandevularimPage.tsx     # OWNER: kendi randevuları
        │   ├── RandevuAlPage.tsx        # OWNER: harita → hasta → anamnez → slot → randevu
        │   ├── RandevuIstekleriPage.tsx # CLINIC: bekleyen istekler + planlanmış randevular
        │   └── TakvimPage.tsx           # CLINIC: aylık takvim (randevular + aşı planları)
        └── components/                  # Layout, AnamnesisChat, AnamnesisStructured
```

Tüm arayüz metinleri Türkçedir.

---

## Bilinen Kısıtlar

- **Resend test modu** — doğrulanmış domain olmadan mail yalnızca Resend hesabına kayıtlı adrese gider. Diğer adreslere gönderim sessizce başarısız olur: kayıt/doğrulama akışında kullanıcıya 503 döner, randevu bildirimlerinde ise sadece WARN loglanır (randevu oluşmaya devam eder).
- **verify-email deneme sayacı in-memory** — e-posta başına max 5 hatalı deneme / 10 dk sınırı process belleğinde tutulur; tek instance için geçerlidir, çok-instance üretimde Redis gibi paylaşımlı bir store'a taşınmalıdır.
- **Klinik bildirimi isim eşleşmesine bağlı** — randevudaki klinik adı Overpass'tan (OpenStreetMap) gelir; kliniğe mail gidebilmesi için sistemde kayıtlı `Clinic.name` değerinin bu adla **birebir** (büyük/küçük harf dahil) eşleşmesi gerekir. Eşleşme yoksa bildirim atlanır ve WARN loglanır.
- **AI tanı çıktısı yalnızca karar desteğidir** — veteriner hekim kararının yerini almaz; tanı endpoint'i şu an structured mock döndürür.
