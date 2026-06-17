# VetClinic AI

A minimal MVP veterinary clinical AI system with AI-assisted diagnosis support and a simple clinical workflow.

## Features

- JWT-authenticated user accounts
- Patient management (CRUD)
- Medical records with AI diagnosis support (Groq LLM)
- Anamnesis chat — structured symptom intake via a conversational AI
- Appointment booking with nearby clinic discovery (Leaflet + OpenStreetMap)
- Turkish-language UI

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | NestJS (modular monolith), Prisma ORM, PostgreSQL, REST API, JWT |
| Frontend | React 19 + Vite + TypeScript (strict), react-router-dom v7 |
| AI | Groq REST API — `llama-3.3-70b-versatile` model |
| Map | Leaflet.js + Overpass API (OpenStreetMap data) |

---

## Prerequisites

- **Node.js** 18 or later
- **PostgreSQL** 16 or later
- **Groq API key** — free tier available at [console.groq.com](https://console.groq.com)

---

## Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd VetClinic-MVP
```

### 2. PostgreSQL

Create a database named `vetclinic`:

```sql
CREATE DATABASE vetclinic;
```

> **Windows note:** If your Windows username contains non-ASCII characters, PostgreSQL may fail to initialise at the default data directory. Use a custom path:
> ```
> initdb -D C:\pgdata -U postgres
> pg_ctl start -D C:\pgdata
> ```

### 3. Backend

```bash
cd backend
npm install
cp .env.example .env   # then fill in your values (see below)
npx prisma db push
npx prisma generate
npm run start:dev
```

The API will be available at `http://localhost:3000`.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in the values:

```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/vetclinic"
JWT_SECRET="change_me_to_a_long_random_secret"
GROQ_API_KEY="your-groq-api-key-here"
ANTHROPIC_API_KEY="your-anthropic-api-key-here"
```

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret used to sign JWT tokens |
| `GROQ_API_KEY` | Yes | Groq API key for the anamnesis chat LLM |
| `ANTHROPIC_API_KEY` | No | Placeholder — AI diagnosis endpoint currently returns a mock |

The frontend has no environment variables in development.

---

## Running Both Servers

Open two terminals:

```bash
# Terminal 1 — backend (port 3000)
cd backend && npm run start:dev

# Terminal 2 — frontend (port 5173)
cd frontend && npm run dev
```

---

## Project Structure

```
VetClinic-MVP/
├── backend/          # NestJS API
│   ├── src/
│   │   ├── users/          # Auth — register + login
│   │   ├── patients/       # Patient CRUD
│   │   ├── medical-records/
│   │   ├── appointments/
│   │   ├── ai/             # Diagnosis endpoint
│   │   └── anamnesis/      # Chat-based history intake (Groq)
│   └── prisma/
│       └── schema.prisma
└── frontend/         # React + Vite
    └── src/
        ├── pages/
        │   ├── LoginPage.tsx
        │   ├── PatientsPage.tsx
        │   ├── PatientDetailPage.tsx
        │   ├── RandevuAlPage.tsx   # Nearby clinics + appointment booking
        │   └── RandevularimPage.tsx # My appointments
        └── components/
            ├── Layout.tsx
            └── AnamnesisChat.tsx
```

---

## Notes

- AI diagnosis output is advisory only and must not replace a licensed veterinarian.
- The `ANTHROPIC_API_KEY` variable is reserved for a future upgrade to the diagnosis endpoint; it is not used in this MVP.
- Nearby clinic data is sourced from OpenStreetMap via the Overpass API — accuracy depends on OSM contributors in your area.
