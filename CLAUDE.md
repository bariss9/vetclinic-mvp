# VetClinic AI — Claude Code Project Rules (MVP)

## PROJECT TYPE
This is a MINIMAL MVP Veterinary Clinical AI System.

It is NOT an enterprise system.

The goal is:
- working backend + frontend MVP
- AI-assisted diagnosis support
- simple clinical workflow

---

## CURRENT PROJECT STATUS (updated 2026-07-05)

### Completed — All modules built and working

#### Backend (NestJS, running on http://localhost:3000)
- **users** — register + login, JWT auth; User model has `role` enum (OWNER/CLINIC, default OWNER), optional `name`; JWT payload includes `{ sub, email, role }`; e-posta doğrulama akışı: `isVerified`, `verificationCode`, `verificationCodeExpiresAt` alanları (migration: `add_email_verification`); POST /auth/register artık JWT dönmüyor, kod gönderip mesaj dönüyor; POST /auth/verify-email → JWT; POST /auth/resend-verification; kod süresi 2 dakika
- **Clinic model** — linked 1:1 to User (userId unique FK); created automatically on register if role=CLINIC and clinicName provided
- **auth** — `src/auth/jwt-auth.guard.ts`: Bearer token doğrular, `req.user = { sub, email, role }` set eder; patients, medical-records, appointments controller'larında `@UseGuards(JwtAuthGuard)` ile kullanılıyor
- **patients** — full CRUD, ownerId from JWT; cascade deletes on MedicalRecord and Appointment FKs; **JWT guard + ownership filtering**: OWNER sadece kendi kayıtlarını görür/değiştirir (yabancı kayıt → 403), CLINIC filtresiz erişim
- **medical-records** — CRUD, symptoms[], aiResult JSON, anamnesis JSON, notes; **JWT guard + ownership filtering** (patients ile aynı pattern: `record.patient.ownerId`)
- **appointments** — CRUD, status enum (PENDING/SCHEDULED/COMPLETED/CANCELLED/NO_SHOW/UNCERTAIN — migration: `add_appointment_status_values`); GET returns full patient + owner info; **JWT guard + ownership filtering**; **rol bazlı status geçiş kısıtları** (bkz. Randevu Durum Yönetimi); `reminderSent Boolean @default(false)` alanı (migration: `add_appointment_reminder`); günlük cron (09:00) yarınki SCHEDULED randevular için owner'a hatırlatma maili; günlük cron (08:00) tarihi 2+ gün geçmiş SCHEDULED randevuları UNCERTAIN'e çeker; DEV-ONLY: POST /appointments/trigger-reminders
- **mail** — `src/mail/mail.module.ts` (@Global); `MailService.sendMail(to, subject, html): Promise<boolean>` — Resend API, başarıda `true`, hatada `false` (exception fırlatmaz, logger.error loglar); **çağıranlar dönüş değerini kontrol etmeli**
- **ai** — POST /ai/diagnose (Anthropic key placeholder, currently returns structured mock)
- **anamnesis** — POST /anamnesis/next-question (start flow), POST /anamnesis/validate-answer (Groq 0-100 score, threshold 55), POST /anamnesis/chat (legacy, kept), POST /anamnesis/save
- **vaccinations** — `src/vaccinations/`; VaccinationRecord entity; migration: `add_vaccination_tracking`; GET /vaccinations?patientId=N (OWNER kendi hastasıyla sınırlı, CLINIC filtresiz), POST/PUT/DELETE sadece CLINIC (OWNER → 403); PUT/DELETE ek kısıt: sadece oluşturan klinik kendi kaydını değiştirebilir (`createdByClinicId === clinic.id`); `resolveClinic(userId)` helper clinic ID'yi JWT sub'undan çeker

#### Frontend (React + Vite, running on http://localhost:5173)

**Shared / Auth**
- **LoginPage** — JWT stored in memory (not localStorage); decodes role from JWT via parseJwt()
- **RegisterPage** — name, email, password, role toggle (Hasta Sahibi/Klinik), conditional clinicName field; başarılı kayıt sonrası `/verify-email`'e yönlendirir (email state ile)
- **VerifyEmailPage** — 6 haneli kod girişi; 120 saniyelik geri sayım (MM:SS); süre dolunca "Kodun süresi doldu" + "Yeni Kod Gönder" butonu öne çıkar; resend başarısında sayaç sıfırlanır; doğrulama başarılıysa `auth.login()` → `/patients`
- **AuthContext** — stores userId + role (OWNER|CLINIC); role-conditional route guards in App.tsx; token sadece verify-email veya login başarılıysa set edilir

**OWNER panel** (OwnerRoute guard — CLINIC users redirected to /patients)
- **PatientsPage** — "Evcil Hayvanlarım"; list + add patient form (basic fields only)
- **PatientDetailPage** — medical records, AI diagnosis form; shows anamnesis records only for CLINIC role; "Aşı Takibi" bölümü salt okunur (OWNER aşı ekleyemez/düzenleyemez)
- **RandevularimPage** — lists own appointments with status badges
- **RandevuAlPage** — full booking flow: Leaflet map → patient select → anamnesis chatbot → time slot picker → POST /appointments

**CLINIC panel** (ClinicRoute guard — OWNER users redirected to /patients)
- **PatientsPage** — "Hastalar"; add patient includes optional 7-topic anamnesis form + Hekim Notu; delete patient button with custom confirm modal; cascade delete on backend
- **PatientDetailPage** — shows anamnesis MedicalRecords in collapsible accordion (AnamnesisStructured); shows Hekim Notu if set; "Aşı Takibi" bölümü: ekleme/düzenleme/silme formu (CLINIC), salt okunur liste (OWNER); Uygulananlar (ADMINISTERED) ve Planlanmış (PLANNED) ayrı gruplandırılmış
- **RandevuIstekleriPage** — sidebar adı "Randevular"; iki sekme (`tab-bar`): **"Randevu İstekleri"** (PENDING; approve → SCHEDULED, reject → CANCELLED — onaylanan kart anında ikinci sekmeye taşınır) ve **"Planlanmış Randevular"** (SCHEDULED; "Yapıldı" → COMPLETED, "Gerçekleşmedi" → NO_SHOW); her kartta AnamnesisStructured
- **TakvimPage** — monthly calendar grid (Mon-Sun, Monday-start); **tüm status'lar** gösterilir, renk haritası: SCHEDULED lacivert (varsayılan), COMPLETED yeşil, NO_SHOW kırmızı, UNCERTAIN sarı, CANCELLED gri+üstü çizili, PENDING soluk lacivert; click → modal (Türkçe status rozeti, owner name, patient info, AnamnesisStructured); iptal butonu sadece PENDING/SCHEDULED'da görünür, iptal sonrası kart takvimde gri/çizgili kalır

**Components**
- **AnamnesisChat** — chatbot UI; now uses validation-based flow (next-question + validate-answer); no ANAMNESIS_COMPLETE token needed; QAPair key'leri `QUESTION_KEYS` sabitiyle backend anahtarlarını kullanır (chief_complaint, duration vb. — DB'ye yazılan summary Türkçe etiketli); her soru geldikten sonra input'a auto-focus (`inputRef` + `useEffect`); 7. cevap sonrası `onComplete` **1500ms gecikmeli** çağrılır (kapanış balonu görünsün diye; unmount'ta `clearTimeout`)
- **AnamnesisStructured** — parses 7-topic anamnesis data (chatbot or manual) into key-value display; shared by PatientDetailPage, TakvimPage modal, RandevuIstekleriPage cards; no closing summary shown; `.slice(1)` KALDIRILDI (2026-07-05) — yeni akışta tüm user mesajları gerçek cevap; legacy chat kayıtlarında ilk satırda selamlama görünebilir (MVP'de kabul edilebilir)
- **Layout** — role-conditional sidebar nav (OWNER: Evcil Hayvanlarım / Randevularım / Randevu Al; CLINIC: Hastalar / Randevular / Takvim)

All UI text is in **Turkish**.

---

## RANDEVU AL + ANAMNEZİS INTEGRATION FLOW

`RandevuAlPage` implements a multi-step appointment booking flow:

1. **Klinik Seç** — Leaflet.js map with browser geolocation; Overpass API fetches nearby vet clinics (10 km); user clicks a marker to select a clinic
2. **Hasta Seç** — dropdown of user's registered patients (fetched from GET /patients)
3. **Anamnez** — embedded `AnamnesisChat` component runs the validation-based flow: POST /anamnesis/next-question → 7 fixed questions one by one; each answer sent to POST /anamnesis/validate-answer; on `done: true`, onComplete callback fires and summary is saved via POST /anamnesis/save
4. **Saat Seç** — 5 hardcoded candidate time slots; before display, fetches existing appointments and filters out slots already taken (status PENDING or SCHEDULED) for the same clinicName; shows however many remain (can be < 5); empty state if all taken
5. **Randevu Oluştur** — POST /appointments with status `PENDING`; success screen shown

---

## ANAMNESIS VALIDATION ARCHITECTURE (current)

File: `backend/src/anamnesis/anamnesis.service.ts`

### New endpoint flow (used by frontend)

| Endpoint | Input | Output |
|---|---|---|
| POST /anamnesis/next-question | `{ patientId }` | `{ questionIndex: 0, question, totalQuestions: 7 }` |
| POST /anamnesis/validate-answer | `{ questionIndex, answer }` | valid → `{ valid: true, nextQuestionIndex, nextQuestion, done }` / invalid → `{ valid: false, retryQuestion }` |

### Fixed 7 questions (QUESTIONS array)

| # | key | Soru |
|---|---|---|
| 0 | chief_complaint | Hayvanınızın bugün kliniğe gelme sebebi olan ana şikayeti nedir? |
| 1 | duration | Bu şikayet ne zamandır devam ediyor? |
| 2 | severity | Şikayetin şiddeti nasıl — hafif, orta, yoksa ciddi mi? |
| 3 | appetite | Hayvanınızın iştahında bir değişiklik var mı? |
| 4 | water_intake | Hayvanınızın su tüketiminde bir değişiklik var mı? |
| 5 | behavior | Hayvanınızın davranışlarında son zamanlarda bir değişiklik fark ettiniz mi? |
| 6 | vaccination | Hayvanınızın aşıları güncel mi? |

Each entry also has a `retryQuestion` (hardcoded Turkish rephrase) used when score < 55.

### Groq validation call parameters

| Parameter | Value |
|---|---|
| Model | `llama-3.1-8b-instant` |
| Temperature | `0.1` |
| max_tokens | `20` |
| Timeout | 15 seconds (AbortController) |
| Score threshold | `>= 55` = valid, `< 55` = invalid/retry |
| System prompt | Lenient: short topical answers (1-3 words like "halsiz", "yemiyor") score 80+; only score LOW if completely unrelated, empty, or dismissive |
| Response format | `{"score": N}` — parsed with regex to handle any Groq markdown wrapping |

### Blocklist (checked BEFORE calling Groq)

- `VALIDATE_RUDE_WORDS` (word-level): `siktir`, `sus`, `kes`, `lan`, `salak`, `sanane`, `defol`
- `VALIDATE_RUDE_SUBSTRINGS` (substring): `seni ilgilendirmez`, `bırak beni`, `ne alaka`, `sanane`, `karışma`

If blocklist matches → skip Groq entirely, return `{ valid: false, retryQuestion }` immediately.

### Frontend flow (AnamnesisChat.tsx)

1. Start: call `next-question` → display first question as bot bubble
2. User types answer → call `validate-answer`
3. While waiting: typing indicator shown
4. `valid: true && !done` → show nextQuestion, advance index; input'a auto-focus
5. `valid: true && done` → show "Anamnez tamamlandı, teşekkürler!", `onComplete(history, summary)` **1500ms gecikmeyle** ateşlenir (kapanış balonu okunabilsin; modal bu sürede kapatılırsa `clearTimeout` ile iptal)
6. `valid: false` → show `retryQuestion` bubble, same index (no advance)
7. `onComplete` builds `ChatMessage[]` history + plain-text summary from Q&A pairs for RandevuAlPage; pair key'leri backend ile aynı (`QUESTION_KEYS`: chief_complaint, duration, severity, appetite, water_intake, behavior, vaccination) — summary satırları Türkçe etiketli ("Ana Şikayet: …")

### Legacy endpoints (kept, not used by frontend)
- POST /anamnesis/chat — old free-form Groq chat (LLM-driven, ANAMNESIS_COMPLETE token)
- These remain for reference; will be removed after validation flow is confirmed stable

**Loop/stability issue: ÇÖZÜLDÜ** — old architecture had LLM-driven topic advancement causing loops. New architecture is fully deterministic: backend controls question index, Groq only scores relevance (0-100), no free-form generation in the main flow.

---

## TECH STACK

### Backend
- NestJS (modular monolith)
- Prisma ORM + PostgreSQL (database: `vetclinic`, port 5432)
- JWT auth (HS256, secret in .env)
- REST API only

### Frontend
- React 19 + Vite + TypeScript (strict mode, verbatimModuleSyntax)
- react-router-dom v7
- leaflet + @types/leaflet (map page only)
- No UI library — plain CSS with CSS variables

### AI / External APIs
- **Groq REST API** (OpenAI-compatible): `https://api.groq.com/openai/v1/chat/completions`
  - Model: `llama-3.1-8b-instant`
  - Auth: Bearer token via `GROQ_API_KEY` in backend `.env`
  - Used for: anamnesis chat
- **Resend API**: `https://api.resend.com`
  - Auth: Bearer token via `RESEND_API_KEY` in backend `.env`
  - Used for: e-posta doğrulama kodları, randevu hatırlatmaları
  - `from`: `VetClinic <onboarding@resend.dev>` (test modu — bkz. Bilinen Kısıt)
- **Overpass API** (OSM data): `https://maps.mail.ru/osm/tools/overpass/api/interpreter`
  - Used for: nearby vet clinic search (YakinKliniklerPage)
  - Current query: amenity=veterinary + amenity=animal_hospital + shop=pet, 10 km radius

### Backend dependencies (önemli)
- `@nestjs/schedule` — cron job desteği (`ScheduleModule.forRoot()` AppModule'de)
- `resend` — mail gönderimi
- `jsonwebtoken` — JwtAuthGuard'da token doğrulama (`@nestjs/jwt`'nin bağımlılığı, ayrıca kurulmaz)

---

## IMPORTANT OPERATIONAL NOTES

### PostgreSQL
PostgreSQL is NOT synced via git — each machine needs its own local instance.

**Desktop (old machine):**
- Data dir: `C:\pgdata` (non-default path — Windows username "Barış" has non-ASCII chars)
- Start: `pg_ctl start -D C:\pgdata`

**Laptop (current machine, Windows user "Lenovo"):**
- PostgreSQL 18, data dir: `C:\Program Files\PostgreSQL\18\data`
- No Windows service registered — must start manually each session:
  ```
  pg_ctl start -D "C:\Program Files\PostgreSQL\18\data"
  ```
- First-time setup done 2026-06-17: initdb (with `--locale=C` — Windows Türkçe locale PostgreSQL'i kırıyor) → pg_ctl start → CREATE DATABASE vetclinic → ALTER USER postgres PASSWORD 'postgres' → npx prisma migrate dev

**Both machines:**
- Connection string: `postgresql://postgres:postgres@localhost:5432/vetclinic`

### Multi-machine setup checklist (new machine)
1. Install PostgreSQL
2. Run `initdb` if data dir is empty, then start server
3. `CREATE DATABASE vetclinic;`
4. `ALTER USER postgres WITH PASSWORD 'postgres';`
5. Clone repo from GitHub: `git clone https://github.com/bariss9/vetclinic-mvp.git` (private)
6. `cd backend && npm install && npx prisma generate && npx prisma migrate deploy`
7. `cd ../frontend && npm install`
8. Create `backend/.env` from `backend/.env.example` — fill in real `GROQ_API_KEY` and `RESEND_API_KEY`
9. `cd backend && npm run start:dev` then `cd frontend && npm run dev`

### Backend .env (C:\PROJECT\vetclinic-mvp\backend\.env — laptop)
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vetclinic"
JWT_SECRET="<generated per machine — see .env.example>"
GROQ_API_KEY="<real key — not committed>"
ANTHROPIC_API_KEY="your-anthropic-api-key-here"
RESEND_API_KEY="<Resend dashboard'dan alınır>"
TEST_EMAIL_TO="<test maili için hedef adres — sadece lokal test>"
```
Use `backend/.env.example` as template. `.env` is gitignored and must be recreated on each machine.

### Critical fix already in place
`import 'dotenv/config'` MUST be the first line of `main.ts` — without it Prisma connects as the OS user ("Barış") and fails with P1010/ECONNREFUSED.

### Prisma
- Şema yönetimi **migration tabanlı** — `db push` KULLANILMAZ.
- İlk migration: `20260628131955_init` (prisma/migrations/ git'te takip edilir)
- Yeni şema değişikliği: `npx prisma migrate dev --name <açıklayıcı_isim>`
- Yeni makinede deploy: `npx prisma migrate deploy` (migrations klasörünü uygular, yeni migration oluşturmaz)
- Sonrasında her zaman ayrıca: `npx prisma generate` (TS client'ı yeniler)
- Config file: `prisma/prisma.config.ts` (Prisma 7 style — `url` goes here, not in schema.prisma)

### JWT Auth Guard
- Dosya: `src/auth/jwt-auth.guard.ts`
- `jsonwebtoken.verify()` ile Bearer token doğrular, `req.user = { sub, email, role }` set eder
- Exception fırlatmaz DI bağımlılığı yoktur — doğrudan `@UseGuards(JwtAuthGuard)` ile kullanılır
- İlgili modüllerin `providers` dizisine `JwtAuthGuard` eklenmeli (PatientsModule, MedicalRecordsModule, AppointmentsModule, VaccinationsModule)

### Güvenlik: Ownership Filtering
Daha önce patients/medical-records/appointments endpoint'lerinde JWT guard YOKTU — herkes herkesin verisine erişebiliyordu. Bu 2026-06-30'da kapatıldı:
- **OWNER**: sadece kendi `ownerId`'sine ait kayıtları görür/değiştirir; yabancı kayda erişim → 403
- **CLINIC**: tüm kayıtlara filtresiz erişim (randevu onaylama, takvim sayfası için gerekli)
- Zincir: `MedicalRecord → patient.ownerId`, `Appointment → patient.ownerId`

### E-posta Doğrulama Akışı
- Migration: `add_email_verification` — User'a `isVerified Boolean @default(false)`, `verificationCode String?`, `verificationCodeExpiresAt DateTime?` eklendi
- `POST /auth/register`: kayıt sonrası JWT dönmez; 6 haneli kod üretir, Resend ile gönderir, `"kod gönderildi"` mesajı döner; mail başarısız → 503
- `POST /auth/verify-email { email, code }`: kod + süre kontrolü; başarılıysa `isVerified=true`, kod temizlenir, JWT döner
- `POST /auth/resend-verification { email }`: yeni kod üretir, mail başarısız → 503
- `POST /auth/login`: `isVerified=false` → 403 "Hesap doğrulanmamış"
- Kod süresi: **2 dakika** (`expiresAt = now + 2 * 60 * 1000`)
- Mevcut DB'deki kullanıcılar migration sonrası `isVerified=false` olur — test için: `UPDATE "User" SET "isVerified" = true WHERE email = '...'`

### Randevu Hatırlatma (Cron)
- Migration: `add_appointment_reminder` — Appointment'a `reminderSent Boolean @default(false)` eklendi
- Dosya: `src/appointments/reminders.service.ts`
- `@Cron('0 9 * * *')` → `runReminders()`: tarih=yarın, status=SCHEDULED, reminderSent=false olan randevuları çeker
- Her randevu için `MailService.sendMail()`; `true` dönerse `reminderSent=true`; `false` dönerse WARN loglar, `reminderSent=false` kalır (cron ertesi gün yeniden dener)
- Hata tek randevuyu durdurmuyor — try/catch per item
- DEV ONLY: `POST /appointments/trigger-reminders` (production'da kaldırılmalı veya guard arkasına alınmalı)
- `ScheduleModule.forRoot()` AppModule'de kayıtlı
- `@Cron('0 8 * * *')` → `markStaleAppointments()`: tarihi 2+ gün geçmiş (dünün 00:00'ından eski) ve hâlâ SCHEDULED olan randevuları tek `updateMany` ile UNCERTAIN'e çeker; **reminderSent'ten tamamen bağımsız** ayrı bir otomatik geçiştir

### Randevu Durum Yönetimi (Status Transitions)
- Migration: `add_appointment_status_values` — `AppointmentStatus` enum'a `NO_SHOW` ve `UNCERTAIN` eklendi (2026-07-05)
- `appointments.service.ts` → `guardStatusTransition(current, next, callerRole)`: `update()` içinde status değişikliğinde çağrılır; aynı status'a güncelleme no-op (idempotent, serbest)
- **OWNER**: sadece kendi randevusunu iptal edebilir — hedef `CANCELLED` değilse → 403; `CANCELLED` ama mevcut durum PENDING/SCHEDULED değilse → 400
- **CLINIC** geçiş haritası (`CLINIC_TRANSITIONS`):

| Mevcut | İzinli hedefler |
|---|---|
| PENDING | SCHEDULED, CANCELLED |
| SCHEDULED | COMPLETED, NO_SHOW, CANCELLED |
| UNCERTAIN | COMPLETED, NO_SHOW, CANCELLED (cron'un çektiği belirsiz durumu klinik çözümler) |
| COMPLETED / CANCELLED / NO_SHOW | — (son durum, geri dönüş yok → 400) |

- `UNCERTAIN` manuel set edilemez — sadece 08:00 cron'u atar (DTO kabul eder ama geçiş haritasında hedef olarak yer almadığı için servis reddeder)
- Frontend renk haritası (TakvimPage `STATUS_CLASS` + index.css `takvim-event-*`): SCHEDULED lacivert, COMPLETED yeşil, NO_SHOW kırmızı, UNCERTAIN sarı, CANCELLED gri+çizgili, PENDING soluk

### MailService Sözleşmesi
- `sendMail(to, subject, html): Promise<boolean>` — başarıda `true`, hatada `false` (exception fırlatmaz)
- **Tüm çağıranlar dönüş değerini kontrol etmeli**; aksi halde sessiz mail kaybı riski
- `users.service.ts`: `false` → `ServiceUnavailableException` (503)
- `reminders.service.ts`: `false` → failed sayacı artar, `reminderSent` güncellenmez

### Anamnesis validation flow
- Frontend calls `POST /anamnesis/next-question` once to start, then `POST /anamnesis/validate-answer` per answer
- Backend holds all question state — frontend only tracks `questionIndex` (0-6)
- Groq is called only for validation scoring (temp 0.1, max_tokens 20) — not for question generation
- Blocklist checked before Groq: rude/dismissive answers short-circuit immediately
- `onComplete(history, summary)` callback builds `ChatMessage[]` + plain-text summary from Q&A pairs
- Legacy `POST /anamnesis/chat` (old free-form flow) is still present in backend but unused by frontend
- See ANAMNESIS VALIDATION ARCHITECTURE section above for full parameter table
- **2026-07-05 düzeltmeleri:** (1) `AnamnesisStructured` `.slice(1)` kaldırıldı — soru-cevap eşleşme kayması giderildi (E2E doğrulandı: 7/7 satır doğru); (2) QAPair key'leri `q0/q1…` yerine `QUESTION_KEYS` (backend anahtarları) — DB'deki summary Türkçe etiketli; (3) her soru sonrası input auto-focus; (4) `onComplete` 1500ms gecikmeli (kapanış balonu görünür, unmount'ta `clearTimeout`)

### Aşı Takip Modülü (Vaccinations)

**Backend:** `src/vaccinations/` — `VaccinationsModule`, `VaccinationsController`, `VaccinationsService`, `vaccinations.dto.ts`

**Prisma modeli (`VaccinationRecord`):**
- `id`, `patientId` (FK → Patient, cascade delete), `vaccineName String`, `administeredDate DateTime?`, `nextDueDate DateTime?`, `status VaccinationStatus` (`PLANNED` | `ADMINISTERED`), `notes String?`, `createdByClinicId` (FK → Clinic), `createdAt`, `updatedAt`
- Migration: `add_vaccination_tracking`

**Endpoint yetkilendirme:**

| Method | Endpoint | OWNER | CLINIC |
|---|---|---|---|
| GET | /vaccinations?patientId=N | Kendi hastası → 200, yabancı → 403 | Filtresiz |
| POST | /vaccinations | 403 | ✓ |
| PUT | /vaccinations/:id | 403 | Sadece `createdByClinicId === clinic.id` |
| DELETE | /vaccinations/:id | 403 | Sadece `createdByClinicId === clinic.id` |

**Klinik ID çözümleme:** JWT sadece `{ sub, email, role }` taşır — klinik ID'si `resolveClinic(userId)` helper'ı ile `prisma.clinic.findUnique({ where: { userId } })` çekilerek elde edilir.

**Frontend:** `PatientDetailPage.tsx` — `vaccinations`, `vaccLoading`, `vaccError`, `showVaccForm`, `editingVacc`, `savingVacc`, `deletingVaccId`, `vaccForm` state'leri; `api.getVaccinations` / `createVaccination` / `updateVaccination` / `deleteVaccination` çağrıları; `openVaccAdd()` / `openVaccEdit(v)` / `closeVaccForm()` / `handleVaccSubmit` / `handleVaccDelete` fonksiyonları.

**Tarih gösterimi — kritik not (`dateStr` fonksiyonu):**
- ESKİ (hatalı): `new Date(iso).toLocaleDateString('tr-TR', ...)` — tarayıcı/OS locale'a ve UTC→yerel saat dönüşümüne bağımlıydı; bazı ortamlarda ay kayması riski taşıyordu
- YENİ (güvenli): ISO string doğrudan parse edilir, `new Date()` çağrısı yapılmaz:
  ```typescript
  const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const dateStr = (iso: string | null): string => {
    if (!iso) return '—';
    const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
    return `${day} ${MONTHS_TR[month - 1]} ${year}`;
  };
  ```
  `month` ISO'da 1-indexed (07 = Temmuz) → `MONTHS_TR[month-1]` = `MONTHS_TR[6]` = "Tem". Timezone veya Intl bağımlılığı yok.

**Kayıt tarafı (input → backend):** `<input type="date">.value` her zaman "YYYY-MM-DD" string döner; bu string doğrudan payload'a eklenir, `new Date()` dönüşümü yapılmaz. Backend `new Date("YYYY-MM-DD")` = UTC gece yarısı (ISO date-only spec garantisi). Aralarında ay kayması mümkün değildir.

**Debug log:** `handleVaccSubmit` içinde geçici `console.log('[Aşı Kayıt] payload:', JSON.stringify(payload))` mevcut — production'a alınmadan önce kaldırılmalı.

### Bilinen Kısıt: Resend Test Modu
Resend hesabı şu an doğrulanmamış domain (`onboarding@resend.dev`) ile çalışıyor — bu modda SADECE Resend hesabına kayıtlı adrese (`barissrnl@gmail.com`) mail gönderilebiliyor. Diğer tüm adreslere (Hotmail, başka Gmail vb.) gönderim başarısız oluyor; `MailService` ERROR logluyor ve `sendMail` `false` döndürüyor:
- `users.service.ts` çağrılarında → 503 hatası kullanıcıya yansır
- `reminders.service.ts` çağrılarında → WARN loglanır, `reminderSent=false` kalır (cron ertesi gün yeniden dener)

Production öncesi yapılması gereken: resend.com/domains'de bir domain doğrula, `mail.service.ts`'deki `from` adresini o domaine çevir.

Test sırasında: kayıt/doğrulama testleri sadece `barissrnl@gmail.com` ile yapılmalı.

### Last git push
- Repo: https://github.com/bariss9/vetclinic-mvp (private)
- See `git log --oneline` for current hash

---

## STRICT SCOPE (MUST FOLLOW)

Only implement the following modules:

### Backend Modules
- users (basic authentication + roles)
- patients (animals + owners)
- medical-records (symptoms + notes + AI output)
- appointments (simple scheduling)
- ai (diagnosis only)
- anamnesis (chat-based history intake)
- vaccinations (vaccination tracking per patient)

---

## FORBIDDEN MODULES (DO NOT CREATE)

Do NOT create:
- billing
- inventory
- prescriptions
- drug interaction
- insurance
- pharmacy
- advanced RBAC systems
- microservices architecture

---

## ARCHITECTURE RULES

### Backend
- NestJS (modular monolith only)
- Prisma ORM
- PostgreSQL
- REST API only

NO:
- microservices
- event-driven architecture
- over-engineering

---

### Frontend
- React (Vite)
- Minimal dashboard UI only
- No complex design systems
- No unnecessary pages

---

## AI MODULE RULES

AI is ONLY for diagnosis support.

### Input:
- animalType
- breed
- age
- symptoms
- durationDays
- severity

### Output (STRICT JSON):
{
  "possibleDiseases": [],
  "riskLevel": "low | medium | high",
  "confidenceScore": 0-100,
  "recommendations": [],
  "urgent": false
}

### AI Constraints:
- NEVER provide medical diagnosis
- ONLY provide decision support
- Always include risk level
- Always include uncertainty

---

## DEVELOPMENT RULES

### IMPORTANT
- Always start with planning before coding
- Do NOT generate full system at once
- Work module-by-module only
- Do NOT expand scope without explicit instruction

---

### STEP EXECUTION RULE
1. Design structure only
2. Implement backend first
3. Then database schema
4. Then AI module
5. Then frontend minimal dashboard

---

## SCOPE CONTROL RULES

- NEVER analyze full repository unless asked
- NEVER refactor entire project
- ONLY modify requested module
- Avoid rewriting existing working code

---

## CODE STANDARDS

- TypeScript strict mode required
- Clean modular structure
- No business logic in controllers
- Services must handle logic
- DTO validation required
- Keep functions small and focused

---

## PERFORMANCE RULES

- Avoid unnecessary file generation
- Avoid duplicate modules
- Avoid repeated scaffolding
- Keep dependency count minimal

---

## AI SAFETY RULES

- AI output is advisory only
- Never replace veterinarian decision
- Always mark outputs as "AI-assisted suggestion"
- Flag urgent cases explicitly

---

## SUCCESS CRITERIA

This project is successful if:

- Backend runs without errors
- Basic CRUD works for patients and records
- AI diagnosis endpoint works
- Frontend shows minimal working dashboard
- System is understandable and maintainable

---

## FINAL NOTE

This is a CONTROLLED MVP SYSTEM.

Simplicity is the highest priority.
No over-engineering is allowed.
