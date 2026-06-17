# VetClinic AI — Claude Code Project Rules (MVP)

## PROJECT TYPE
This is a MINIMAL MVP Veterinary Clinical AI System.

It is NOT an enterprise system.

The goal is:
- working backend + frontend MVP
- AI-assisted diagnosis support
- simple clinical workflow

---

## CURRENT PROJECT STATUS (updated 2026-06-17)

### Completed — All modules built and working

#### Backend (NestJS, running on http://localhost:3000)
- **users** — register + login, JWT auth
- **patients** — full CRUD, ownerId from JWT
- **medical-records** — CRUD, symptoms[], aiResult JSON, anamnesis JSON
- **appointments** — CRUD, status enum
- **ai** — POST /ai/diagnose (Anthropic key placeholder, currently returns structured mock)
- **anamnesis** — POST /anamnesis/chat (Groq LLM), POST /anamnesis/save

#### Frontend (React + Vite, running on http://localhost:5173)
- **LoginPage** — JWT stored in memory (not localStorage)
- **PatientsPage** — list + add patient form
- **PatientDetailPage** — medical records, AI diagnosis form, Anamnesis tab (chat + saved records)
- **RandevuAlPage** — full appointment booking flow (see below)
- **RandevularimPage** — lists user's appointments with status badges (Onay Bekliyor / Onaylandı / Tamamlandı / İptal Edildi)
- **AnamnesisChat** (component) — embedded chatbot used inside RandevuAlPage

All UI text is in **Turkish**.

---

## RANDEVU AL + ANAMNEZİS INTEGRATION FLOW

`RandevuAlPage` implements a multi-step appointment booking flow:

1. **Klinik Seç** — Leaflet.js map with browser geolocation; Overpass API fetches nearby vet clinics (10 km); user clicks a marker to select a clinic
2. **Hasta Seç** — dropdown of user's registered patients (fetched from GET /patients)
3. **Anamnez** — embedded `AnamnesisChat` component runs the chatbot session for the selected patient; on completion (`[ANAMNESIS_COMPLETE]`), the summary is saved via POST /anamnesis/save
4. **Saat Seç** — mock time slots (hardcoded list); user picks a slot
5. **Randevu Oluştur** — POST /appointments with status `PENDING`; success screen shown

---

## ANAMNESIS CHATBOT FINAL CONFIG

File: `backend/src/anamnesis/anamnesis.service.ts`

| Parameter | Value |
|---|---|
| Model | `llama-3.1-8b-instant` |
| Temperature | `0.3` |
| max_tokens | `150` (normal) / `400` (forceFinish) |
| forceFinish trigger | user message count in history ≥ 7 |
| History sent to Groq | last 4 messages (slice(-4)) |
| Timeout | 45 seconds (AbortController) |
| Completion signal | `[ANAMNESIS_COMPLETE]` token in reply |
| Content-Type | `application/json; charset=utf-8` |

**forceFinish behavior:** when ≥7 user messages have been sent, system prompt appends: "This is the final question or summary — you MUST provide the summary now and end with [ANAMNESIS_COMPLETE]." and max_tokens is raised to 400.

**Irrelevant answer handling:** system prompt instructs model to re-ask the same question politely instead of advancing topics if the answer is irrelevant or rude.

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
- **Overpass API** (OSM data): `https://maps.mail.ru/osm/tools/overpass/api/interpreter`
  - Used for: nearby vet clinic search (YakinKliniklerPage)
  - Current query: amenity=veterinary + amenity=animal_hospital + shop=pet, 10 km radius

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
- First-time setup done 2026-06-17: initdb → pg_ctl start → CREATE DATABASE vetclinic → ALTER USER postgres PASSWORD 'postgres' → npx prisma db push

**Both machines:**
- Connection string: `postgresql://postgres:postgres@localhost:5432/vetclinic`

### Multi-machine setup checklist (new machine)
1. Install PostgreSQL
2. Run `initdb` if data dir is empty, then start server
3. `CREATE DATABASE vetclinic;`
4. `ALTER USER postgres WITH PASSWORD 'postgres';`
5. Clone repo from GitHub: `git clone https://github.com/bariss9/vetclinic-mvp.git` (private)
6. `cd backend && npm install && npx prisma generate && npx prisma db push`
7. `cd ../frontend && npm install`
8. Create `backend/.env` from `backend/.env.example` — fill in real GROQ_API_KEY
9. `cd backend && npm run start:dev` then `cd frontend && npm run dev`

### Backend .env (C:\PROJECT\vetclinic-mvp\backend\.env — laptop)
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vetclinic"
JWT_SECRET="<generated per machine — see .env.example>"
GROQ_API_KEY="<real key — not committed>"
ANTHROPIC_API_KEY="your-anthropic-api-key-here"
```
Use `backend/.env.example` as template. `.env` is gitignored and must be recreated on each machine.

### Critical fix already in place
`import 'dotenv/config'` MUST be the first line of `main.ts` — without it Prisma connects as the OS user ("Barış") and fails with P1010/ECONNREFUSED.

### Prisma
- After schema changes: run `npx prisma generate` separately from `npx prisma db push` — db push does NOT regenerate the TS client.
- Config file: `prisma/prisma.config.ts` (Prisma 7 style — `url` goes here, not in schema.prisma)

### Anamnesis chat
- History role mapping: DTO uses `'user' | 'model'` (Gemini legacy); service maps `'model'` → `'assistant'` for Groq
- `[ANAMNESIS_COMPLETE]` token signals end of session
- History sliced to last 4 messages before sending to Groq
- Timeout: 45 seconds (AbortController)
- forceFinish triggers at ≥7 user messages — appends forced-summary instruction to system prompt and raises max_tokens to 400
- See ANAMNESIS CHATBOT FINAL CONFIG section above for full parameter table

### Last git push
- Hash: `b8b2f1b` — "Fix anamnesis chatbot stability: switch to llama-3.1-8b-instant, lower temperature, add forceFinish safeguard against loops"
- Repo: https://github.com/bariss9/vetclinic-mvp (private)

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
