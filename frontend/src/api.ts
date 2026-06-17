const BASE = 'http://localhost:3000';

let token: string | null = null;

export function setToken(t: string) { token = t; }
export function getToken() { return token; }
export function clearToken() { token = null; }

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? res.statusText);
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    req<{ access_token: string }>('POST', '/auth/login', { email, password }),

  getPatients: () =>
    req<Patient[]>('GET', '/patients'),

  getPatient: (id: number) =>
    req<PatientDetail>('GET', `/patients/${id}`),

  createPatient: (data: CreatePatientInput) =>
    req<Patient>('POST', '/patients', data),

  getMedicalRecords: () =>
    req<MedicalRecord[]>('GET', '/medical-records'),

  diagnose: (data: DiagnoseInput) =>
    req<DiagnoseResult>('POST', '/ai/diagnose', data),

  chatAnamnesis: (data: { message: string; history: ChatMessage[]; patientId: number }) =>
    req<ChatResponse>('POST', '/anamnesis/chat', data),

  saveAnamnesis: (data: { patientId: number; anamnesis: object }) =>
    req<MedicalRecord>('POST', '/anamnesis/save', data),

  getAppointments: () =>
    req<Appointment[]>('GET', '/appointments'),

  createAppointment: (data: CreateAppointmentInput) =>
    req<Appointment>('POST', '/appointments', data),
};

export interface Patient {
  id: number;
  name: string;
  species: string;
  breed: string;
  age: number;
  ownerId: number;
  createdAt: string;
}

export interface MedicalRecord {
  id: number;
  patientId: number;
  symptoms: string[];
  notes: string | null;
  aiResult: AiResult | null;
  anamnesis: AnamnesisData | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ChatResponse {
  reply: string;
  done: boolean;
}

export interface AnamnesisData {
  summary: string;
  messages: ChatMessage[];
  completedAt: string;
}

export interface PatientDetail extends Patient {
  medicalRecords: MedicalRecord[];
}

export interface AiResult {
  possibleDiseases: string[];
  riskLevel: 'low' | 'medium' | 'high';
  confidenceScore: number;
  recommendations: string[];
  urgent: boolean;
}

export interface DiagnoseResult {
  aiResult: AiResult;
  medicalRecord: MedicalRecord;
  advisory: string;
}

export interface CreatePatientInput {
  name: string;
  species: string;
  breed: string;
  age: number;
  ownerId: number;
}

export interface CreateAppointmentInput {
  patientId: number;
  date: string;
  reason: string;
  clinicName?: string;
  clinicAddress?: string;
  clinicLat?: number;
  clinicLon?: number;
  anamnesisId?: string;
}

export interface Appointment {
  id: number;
  patientId: number;
  date: string;
  reason: string;
  status: 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  clinicName: string | null;
  clinicAddress: string | null;
  clinicLat: number | null;
  clinicLon: number | null;
  anamnesisId: string | null;
  createdAt: string;
  updatedAt: string;
  patient: { id: number; name: string; ownerId: number };
}

export interface DiagnoseInput {
  animalType: string;
  breed: string;
  age: number;
  symptoms: string[];
  durationDays: number;
  severity: 'mild' | 'moderate' | 'severe';
  medicalRecordId: number;
}
