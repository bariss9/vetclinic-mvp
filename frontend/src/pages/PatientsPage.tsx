import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Patient, ChatMessage } from '../api';
import { useAuth } from '../AuthContext';
import Layout from '../components/Layout';

const SPECIES_EMOJI: Record<string, string> = {
  dog: '🐕', cat: '🐈', bird: '🦜', rabbit: '🐇',
  hamster: '🐹', fish: '🐠', turtle: '🐢',
};

function speciesIcon(species: string) {
  return SPECIES_EMOJI[species.toLowerCase()] ?? '🐾';
}

// Must mirror TOPICS order in anamnesis.service.ts
const ANAMNESIS_TOPICS = [
  { key: 'chief_complaint', label: 'Ana Şikayet',  question: 'Hayvanın ana sağlık şikayeti nedir?' },
  { key: 'duration',        label: 'Süre',          question: 'Bu şikayet ne kadar süredir devam ediyor?' },
  { key: 'severity',        label: 'Şiddet',         question: 'Semptomların şiddeti nasıl? (Hafif / Orta / Şiddetli)' },
  { key: 'appetite',        label: 'İştah',          question: 'Hayvanın iştahı nasıl? Normal şekilde yiyor mu?' },
  { key: 'water_intake',    label: 'Su Tüketimi',    question: 'Hayvanın su tüketimi nasıl?' },
  { key: 'behavior',        label: 'Davranış',        question: 'Davranışında veya aktivite seviyesinde değişiklik var mı?' },
  { key: 'vaccination',     label: 'Aşı Durumu',     question: 'Aşı durumu ve geçmişi nasıl?' },
] as const;

const EMPTY_ANAMNESIS = Object.fromEntries(ANAMNESIS_TOPICS.map(t => [t.key, '']));

export default function PatientsPage() {
  const [patients, setPatients]     = useState<Patient[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showForm, setShowForm]     = useState(false);
  const { userId, role } = useAuth();
  const navigate = useNavigate();
  const isOwner  = role === 'OWNER';

  // Patient fields
  const [name, setName]       = useState('');
  const [species, setSpecies] = useState('');
  const [breed, setBreed]     = useState('');
  const [age, setAge]         = useState('');
  const [formError, setFormError]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Anamnesis fields (CLINIC only)
  const [answers, setAnswers]     = useState<Record<string, string>>(EMPTY_ANAMNESIS);
  const [hekimNotu, setHekimNotu] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      setPatients(await api.getPatients());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Hastalar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName(''); setSpecies(''); setBreed(''); setAge('');
    setAnswers(EMPTY_ANAMNESIS);
    setHekimNotu('');
    setFormError('');
  }

  async function handleAddPatient(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const patient = await api.createPatient({
        name, species, breed,
        age: parseInt(age, 10),
        ownerId: userId!,
      });

      // If at least one anamnesis field or hekim notu is filled, save anamnesis record
      const hasAnamnesis = ANAMNESIS_TOPICS.some(t => answers[t.key].trim())
                        || hekimNotu.trim().length > 0;

      if (hasAnamnesis) {
        const messages: ChatMessage[] = [
          { role: 'user',  text: 'Merhaba, anamnezi başlatalım.' },
          ...ANAMNESIS_TOPICS.flatMap(t => [
            { role: 'model' as const, text: t.question },
            { role: 'user'  as const, text: answers[t.key] },
          ]),
        ];
        await api.saveAnamnesis({
          patientId: patient.id,
          anamnesis: { messages, summary: '', completedAt: new Date().toISOString() },
          notes: hekimNotu.trim() || undefined,
        });
      }

      resetForm();
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Hasta eklenemedi');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{isOwner ? 'Evcil Hayvanlarım' : 'Hastalar'}</h1>
          <p>{isOwner ? 'Evcil hayvanlarınızı takip edin ve yönetin' : 'Kliniğinize kayıtlı hayvan hastalarını yönetin'}</p>
        </div>
        <button
          className={showForm ? 'btn-ghost' : 'btn-primary'}
          onClick={() => { resetForm(); setShowForm(v => !v); }}
        >
          {showForm ? 'İptal' : '+ Hasta Ekle'}
        </button>
      </div>

      <div className="page-body">
        {/* ── Hasta ekleme formu ── */}
        {showForm && (
          <div className="card form-card">
            <h3>Yeni Hasta</h3>
            <form className="form-body" onSubmit={handleAddPatient}>

              {/* ── Temel bilgiler (her iki rol) ── */}
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="p-name">Ad</label>
                  <input id="p-name" value={name} onChange={e => setName(e.target.value)} required placeholder="örn. Buddy" />
                </div>
                <div className="field">
                  <label htmlFor="p-species">Tür</label>
                  <input id="p-species" value={species} onChange={e => setSpecies(e.target.value)} required placeholder="Köpek, Kedi, Kuş…" />
                </div>
                <div className="field">
                  <label htmlFor="p-breed">Irk</label>
                  <input id="p-breed" value={breed} onChange={e => setBreed(e.target.value)} required placeholder="örn. Labrador" />
                </div>
                <div className="field">
                  <label htmlFor="p-age">Yaş (yıl)</label>
                  <input id="p-age" type="number" min="0" value={age} onChange={e => setAge(e.target.value)} required placeholder="3" />
                </div>
              </div>

              {/* ── Klinik anamnez (yalnızca CLINIC) ── */}
              {role === 'CLINIC' && (
                <>
                  <div className="form-section-divider">
                    <span>Klinik Anamnez</span>
                    <span className="form-section-hint">İsteğe bağlı — boş bırakılabilir</span>
                  </div>

                  <div className="form-grid">
                    {ANAMNESIS_TOPICS.map(t => (
                      <div key={t.key} className="field" style={{ gridColumn: '1 / -1' }}>
                        <label htmlFor={`a-${t.key}`}>{t.label}</label>
                        <input
                          id={`a-${t.key}`}
                          value={answers[t.key]}
                          onChange={e => setAnswers(prev => ({ ...prev, [t.key]: e.target.value }))}
                          placeholder={t.question}
                        />
                      </div>
                    ))}

                    <div className="field" style={{ gridColumn: '1 / -1' }}>
                      <label htmlFor="p-hekim-notu">Hekim Notu</label>
                      <textarea
                        id="p-hekim-notu"
                        rows={3}
                        value={hekimNotu}
                        onChange={e => setHekimNotu(e.target.value)}
                        placeholder="Hekime ait serbest notlar…"
                        className="form-textarea"
                      />
                    </div>
                  </div>
                </>
              )}

              {formError && <p className="error-text">{formError}</p>}
              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Kaydediliyor…' : 'Hastayı Kaydet'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => { resetForm(); setShowForm(false); }}>
                  İptal
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Durumlar ── */}
        {loading && <p className="muted-text">Hastalar yükleniyor…</p>}
        {error   && <p className="error-text">{error}</p>}

        {/* ── Hasta listesi ── */}
        {!loading && !error && (
          <>
            <div className="section-title-row">
              <span className="section-title">
                {isOwner ? 'Evcil Hayvanlarım' : 'Tüm Hastalar'}
                <span className="section-count">{patients.length}</span>
              </span>
            </div>

            {patients.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🐾</div>
                <p className="empty-state-text">Henüz hasta yok. Yukarıdan ilk hastanızı ekleyin.</p>
              </div>
            ) : (
              <div className="patient-grid">
                {patients.map(p => (
                  <div
                    key={p.id}
                    className="card patient-card"
                    onClick={() => navigate(`/patients/${p.id}`)}
                  >
                    <div className="patient-avatar">{speciesIcon(p.species)}</div>
                    <div className="patient-info">
                      <div className="patient-name">{p.name}</div>
                      <div className="patient-sub">
                        <span className="patient-species-tag">{p.species}</span>
                        <span className="patient-dot">·</span>
                        <span>{p.breed}</span>
                        <span className="patient-dot">·</span>
                        <span>{p.age}y</span>
                      </div>
                    </div>
                    <svg className="patient-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
