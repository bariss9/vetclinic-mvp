# VetClinic AI — Claude Code Project Rules (MVP)

## PROJECT TYPE
This is a MINIMAL MVP Veterinary Clinical AI System.

It is NOT an enterprise system.

The goal is:
- working backend + frontend MVP
- AI-assisted diagnosis support
- simple clinical workflow

---

## CURRENT PROJECT STATUS (updated 2026-06-16)

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
- **YakinKliniklerPage** — Leaflet.js map, browser geolocation, Overpass API for nearby vet clinics

All UI text is in **Turkish**.

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
  - Model: `llama-3.3-70b-versatile`
  - Auth: Bearer token via `GROQ_API_KEY` in backend `.env`
  - Used for: anamnesis chat
- **Overpass API** (OSM data): `https://maps.mail.ru/osm/tools/overpass/api/interpreter`
  - Used for: nearby vet clinic search (YakinKliniklerPage)
  - Current query: amenity=veterinary + amenity=animal_hospital + shop=pet, 10 km radius

---

## IMPORTANT OPERATIONAL NOTES

### PostgreSQL
- Installed at `C:\pgdata` (non-default path due to Windows username "Barış" containing non-ASCII chars)
- Must be started manually if it stops:
  ```
  pg_ctl start -D C:\pgdata
  ```
- Connection string: `postgresql://postgres:postgres@localhost:5432/vetclinic`

### Backend .env (D:\VetClinic-MVP\backend\.env)
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vetclinic"
JWT_SECRET="vetclinic_jwt_secret_change_in_production"
ANTHROPIC_API_KEY="your-anthropic-api-key-here"
GROQ_API_KEY="your-groq-api-key-here"
```

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
