import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { PatientDetail, MedicalRecord, AiResult } from '../api';
import Layout from '../components/Layout';
import AnamnesisChat from '../components/AnamnesisChat';

const RISK_BADGE: Record<string, string> = {
  low:    'badge badge-risk-low',
  medium: 'badge badge-risk-med',
  high:   'badge badge-risk-high',
};

const RISK_LABEL: Record<string, string> = {
  low: '● Düşük Risk', medium: '● Orta Risk', high: '● Yüksek Risk',
};

const SPECIES_EMOJI: Record<string, string> = {
  dog: '🐕', cat: '🐈', bird: '🦜', rabbit: '🐇',
  hamster: '🐹', fish: '🐠', turtle: '🐢',
};

function speciesIcon(s: string) {
  return SPECIES_EMOJI[s.toLowerCase()] ?? '🐾';
}

type Tab = 'records' | 'anamnesis';

export default function PatientDetailPage() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const [patient, setPatient]     = useState<PatientDetail | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [tab, setTab]             = useState<Tab>('records');
  const [diagnosing, setDiagnosing] = useState<number | null>(null);
  const [symptoms, setSymptoms]   = useState('');
  const [durationDays, setDurationDays] = useState('1');
  const [severity, setSeverity]   = useState<'mild' | 'moderate' | 'severe'>('mild');
  const [diagError, setDiagError] = useState('');
  const [results, setResults]     = useState<Record<number, AiResult>>({});

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getPatient(Number(id));
      setPatient(data);
      const existing: Record<number, AiResult> = {};
      data.medicalRecords.forEach(r => { if (r.aiResult) existing[r.id] = r.aiResult; });
      setResults(existing);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Hasta yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  async function handleDiagnose(e: FormEvent, record: MedicalRecord) {
    e.preventDefault();
    setDiagError('');
    setDiagnosing(record.id);
    try {
      const symptomList = symptoms
        ? symptoms.split(',').map(s => s.trim()).filter(Boolean)
        : record.symptoms;
      const { aiResult } = await api.diagnose({
        animalType: patient!.species,
        breed: patient!.breed,
        age: patient!.age,
        symptoms: symptomList,
        durationDays: parseInt(durationDays, 10),
        severity,
        medicalRecordId: record.id,
      });
      setResults(prev => ({ ...prev, [record.id]: aiResult }));
    } catch (err: unknown) {
      setDiagError(err instanceof Error ? err.message : 'Tanı başarısız');
    } finally {
      setDiagnosing(null);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: '3rem 2rem' }}>
          <p className="muted-text">Hasta yükleniyor…</p>
        </div>
      </Layout>
    );
  }

  if (error || !patient) {
    return (
      <Layout>
        <div style={{ padding: '3rem 2rem' }}>
          <p className="error-text">{error || 'Hasta bulunamadı'}</p>
          <button className="btn-ghost" style={{ marginTop: '1rem' }} onClick={() => navigate('/patients')}>
            ← Hastalara Dön
          </button>
        </div>
      </Layout>
    );
  }

  const anamnesisRecords = patient.medicalRecords.filter(r => r.anamnesis !== null);

  return (
    <Layout>
      <div className="page-header">
        <div className="page-header-left">
          <button className="back-btn" onClick={() => navigate('/patients')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Hastalara Dön
          </button>
          <h1>Hasta Detayı</h1>
        </div>
      </div>

      <div className="page-body">
        {/* ── Hasta hero kartı ── */}
        <div className="card patient-hero">
          <div className="patient-hero-avatar">{speciesIcon(patient.species)}</div>
          <div>
            <div className="patient-hero-name">{patient.name}</div>
            <div className="patient-hero-tags">
              <span className="hero-tag hero-tag-species">{patient.species} · {patient.breed}</span>
              <span className="hero-tag hero-tag-age">{patient.age} yaşında</span>
            </div>
          </div>
        </div>

        {/* ── Sekmeler ── */}
        <div className="tab-bar">
          <button
            className={`tab-btn${tab === 'records' ? ' tab-active' : ''}`}
            onClick={() => setTab('records')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Tıbbi Kayıtlar
            <span className="tab-count">{patient.medicalRecords.filter(r => !r.anamnesis).length}</span>
          </button>
          <button
            className={`tab-btn${tab === 'anamnesis' ? ' tab-active' : ''}`}
            onClick={() => setTab('anamnesis')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Anamnez
            {anamnesisRecords.length > 0 && (
              <span className="tab-count">{anamnesisRecords.length}</span>
            )}
          </button>
        </div>

        {/* ── Kayıtlar sekmesi ── */}
        {tab === 'records' && (
          <>
            {patient.medicalRecords.filter(r => !r.anamnesis).length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <p className="empty-state-text">Bu hasta için henüz tıbbi kayıt yok.</p>
              </div>
            )}

            {patient.medicalRecords.filter(r => !r.anamnesis).map(record => {
              const result = results[record.id];
              const busy   = diagnosing === record.id;

              return (
                <div key={record.id} className="card record-card">
                  <div className="record-header">
                    <span className="record-id">Kayıt #{record.id}</span>
                    <span className="record-date">{new Date(record.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>

                  <div className="record-symptoms-row">
                    {record.symptoms.map(s => (
                      <span key={s} className="symptom-chip">{s}</span>
                    ))}
                  </div>

                  {record.notes && (
                    <p className="record-notes-text">{record.notes}</p>
                  )}

                  {result ? (
                    <div className="ai-result-block">
                      <div className="ai-result-top">
                        <span className="badge badge-ai">YZ Destekli</span>
                        {result.urgent && <span className="badge badge-urgent">ACİL</span>}
                        <span className={RISK_BADGE[result.riskLevel]}>
                          {RISK_LABEL[result.riskLevel]}
                        </span>
                        <div className="confidence-pill">
                          <div className="confidence-bar">
                            <div className="confidence-fill" style={{ width: `${result.confidenceScore}%` }} />
                          </div>
                          Güven Skoru: {result.confidenceScore}%
                        </div>
                      </div>

                      <div className="ai-result-cols">
                        <div>
                          <p className="ai-col-title">Olası Hastalıklar</p>
                          <ul className="ai-list">
                            {result.possibleDiseases.map(d => <li key={d}>{d}</li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="ai-col-title">Öneriler</p>
                          <ul className="ai-list">
                            {result.recommendations.map(r => <li key={r}>{r}</li>)}
                          </ul>
                        </div>
                      </div>

                      <p className="advisory-strip">
                        Yalnızca YZ destekli öneri — tıbbi tanı değildir. Klinik kararlar vermeden önce her zaman lisanslı bir veterinerle görüşün.
                      </p>
                    </div>
                  ) : (
                    <div className="diagnose-form-block">
                      <p className="diagnose-form-title">AI Tanı Çalıştır</p>
                      <form className="form-body" onSubmit={e => handleDiagnose(e, record)}>
                        <div className="form-grid">
                          <div className="field" style={{ gridColumn: '1 / -1' }}>
                            <label>Semptomları geçersiz kıl (virgülle ayırın, kayıttakileri kullanmak için boş bırakın)</label>
                            <input
                              value={symptoms}
                              onChange={e => setSymptoms(e.target.value)}
                              placeholder={record.symptoms.join(', ')}
                            />
                          </div>
                          <div className="field">
                            <label>Süre (gün)</label>
                            <input
                              type="number"
                              min="1"
                              value={durationDays}
                              onChange={e => setDurationDays(e.target.value)}
                              required
                            />
                          </div>
                          <div className="field">
                            <label>Şiddet</label>
                            <select
                              value={severity}
                              onChange={e => setSeverity(e.target.value as 'mild' | 'moderate' | 'severe')}
                            >
                              <option value="mild">Hafif</option>
                              <option value="moderate">Orta</option>
                              <option value="severe">Ağır</option>
                            </select>
                          </div>
                        </div>
                        {diagError && <p className="error-text">{diagError}</p>}
                        <div className="form-actions">
                          <button type="submit" className="btn-secondary" disabled={busy}>
                            {busy ? 'Analiz ediliyor…' : '✦ AI Tanı Çalıştır'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* ── Anamnez sekmesi ── */}
        {tab === 'anamnesis' && (
          <>
            {/* Kaydedilen anamnez kayıtları */}
            {anamnesisRecords.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <p className="records-section-title" style={{ marginBottom: '.75rem' }}>Kaydedilen Anamnezler</p>
                {anamnesisRecords.map(r => (
                  <div key={r.id} className="card anamnesis-saved-card">
                    <div className="record-header">
                      <span className="record-id">Anamnez #{r.id}</span>
                      <span className="record-date">{new Date(r.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <div className="anamnesis-summary-text">
                      {(r.anamnesis as { summary: string }).summary
                        .split('\n')
                        .map((line, i) => <p key={i}>{line}</p>)}
                    </div>
                  </div>
                ))}
                <div className="anamnesis-divider">
                  <span>Aşağıdan yeni bir anamnez başlatın</span>
                </div>
              </div>
            )}

            {/* Canlı sohbet */}
            <div className="card chat-card">
              <AnamnesisChat
                patientId={patient.id}
                onSaved={load}
              />
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
