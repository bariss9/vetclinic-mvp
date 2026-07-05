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
  register: (data: { email: string; password: string; name?: string; role?: 'OWNER' | 'CLINIC'; clinicName?: string }) =>
    req<{ id: number; email: string; role: string }>('POST', '/auth/register', data),

  login: (email: string, password: string) =>
    req<{ access_token: string }>('POST', '/auth/login', { email, password }),

  verifyEmail: (email: string, code: string) =>
    req<{ access_token: string }>('POST', '/auth/verify-email', { email, code }),

  resendVerification: (email: string) =>
    req<{ message: string }>('POST', '/auth/resend-verification', { email }),

  getPatients: () =>
    req<Patient[]>('GET', '/patients'),

  getPatient: (id: number) =>
    req<PatientDetail>('GET', `/patients/${id}`),

  createPatient: (data: CreatePatientInput) =>
    req<Patient>('POST', '/patients', data),

  deletePatient: (id: number) =>
    req<void>('DELETE', `/patients/${id}`),

  getMedicalRecords: () =>
    req<MedicalRecord[]>('GET', '/medical-records'),

  diagnose: (data: DiagnoseInput) =>
    req<DiagnoseResult>('POST', '/ai/diagnose', data),

  chatAnamnesis: (data: { message: string; history: ChatMessage[]; patientId: number }) =>
    req<ChatResponse>('POST', '/anamnesis/chat', data),

  nextQuestion: (patientId: number) =>
    req<NextQuestionResponse>('POST', '/anamnesis/next-question', { patientId }),

  validateAnswer: (data: { questionIndex: number; answer: string }) =>
    req<ValidateAnswerResponse>('POST', '/anamnesis/validate-answer', data),

  saveAnamnesis: (data: { patientId: number; anamnesis: object; notes?: string }) =>
    req<MedicalRecord>('POST', '/anamnesis/save', data),

  getAppointments: () =>
    req<Appointment[]>('GET', '/appointments'),

  createAppointment: (data: CreateAppointmentInput) =>
    req<Appointment>('POST', '/appointments', data),

  updateAppointment: (id: number, data: { status: string }) =>
    req<Appointment>('PUT', `/appointments/${id}`, data),

  getMedicalRecord: (id: number) =>
    req<MedicalRecord>('GET', `/medical-records/${id}`),

  getVaccinations: (patientId: number) =>
    req<VaccinationRecord[]>('GET', `/vaccinations?patientId=${patientId}`),

  createVaccination: (data: CreateVaccinationInput) =>
    req<VaccinationRecord>('POST', '/vaccinations', data),

  updateVaccination: (id: number, data: Partial<CreateVaccinationInput>) =>
    req<VaccinationRecord>('PUT', `/vaccinations/${id}`, data),

  deleteVaccination: (id: number) =>
    req<void>('DELETE', `/vaccinations/${id}`),
};

export interface VaccinationRecord {
  id: number;
  patientId: number;
  vaccineName: string;
  administeredDate: string | null;
  nextDueDate: string | null;
  status: 'PLANNED' | 'ADMINISTERED';
  notes: string | null;
  createdByClinicId: number;
  createdByClinic: { id: number; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreateVaccinationInput {
  patientId: number;
  vaccineName: string;
  administeredDate?: string;
  nextDueDate?: string;
  status?: 'PLANNED' | 'ADMINISTERED';
  notes?: string;
}

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

export interface NextQuestionResponse {
  questionIndex: number;
  question: string;
  totalQuestions: number;
}

export interface ValidateAnswerResponse {
  valid: boolean;
  nextQuestionIndex?: number;
  nextQuestion?: string | null;
  done?: boolean;
  retryQuestion?: string;
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

export type AppointmentStatus =
  | 'PENDING'
  | 'SCHEDULED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'UNCERTAIN';

export interface Appointment {
  id: number;
  patientId: number;
  date: string;
  reason: string;
  status: AppointmentStatus;
  clinicName: string | null;
  clinicAddress: string | null;
  clinicLat: number | null;
  clinicLon: number | null;
  anamnesisId: string | null;
  createdAt: string;
  updatedAt: string;
  patient: {
    id: number;
    name: string;
    species: string;
    breed: string;
    age: number;
    ownerId: number;
    owner: { id: number; name: string | null; email: string };
  };
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
