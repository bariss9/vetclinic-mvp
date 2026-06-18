import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { PatientDetail, MedicalRecord, AiResult, AnamnesisData } from '../api';
import Layout from '../components/Layout';
import AnamnesisStructured from '../components/AnamnesisStructured';
import { useAuth } from '../AuthContext';

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

export default function PatientDetailPage() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const { role }   = useAuth();
  const [patient, setPatient]     = useState<PatientDetail | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [diagnosing, setDiagnosing] = useState<number | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [symptoms, setSymptoms]   = useState('');
  const [durationDays, setDurationDays] = useState('1');
  const [severity, setSeverity]   = useState<'mild' | 'moderate' | 'severe'>('mild');
  const [diagError, setDiagError] = useState('');
  const [results, setResults]     = useState<Record<number, AiResult>>({});
  const [expandedAnamnesis, setExpandedAnamnesis] = useState<Set<number>>(new Set());

  function toggleAnamnesis(id: number) {
    setExpandedAnamnesis(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

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

  async function confirmDelete() {
    if (!patient) return;
    setShowDeleteModal(false);
    setDeleting(true);
    try {
      await api.deletePatient(patient.id);
      navigate('/patients');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Silme işlemi başarısız');
      setDeleting(false);
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

  const medicalRecords   = patient.medicalRecords.filter(r => !r.anamnesis);
  const anamnesisRecords = role === 'CLINIC'
    ? patient.medicalRecords.filter(r => r.anamnesis !== null)
    : [];

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
        {role === 'CLINIC' && (
          <button className="btn-danger" onClick={() => setShowDeleteModal(true)} disabled={deleting}>
            {deleting ? 'Siliniyor…' : 'Hastayı Sil'}
          </button>
        )}
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

        {/* ── Anamnez Kayıtları (CLINIC only) ── */}
        {anamnesisRecords.map(record => {
          const open = expandedAnamnesis.has(record.id);
          return (
            <div key={record.id} className="card record-card">
              <button
                className="anamnesis-accordion-header"
                onClick={() => toggleAnamnesis(record.id)}
                aria-expanded={open}
              >
                <span className="record-id">
                  <span className="badge badge-ai" style={{ fontSize: '.7rem', marginRight: '.4rem' }}>Anamnez Kaydı</span>
                  #{record.id}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                  <span className="record-date">
                    {new Date(record.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <svg
                    className={`accordion-chevron${open ? ' accordion-chevron-open' : ''}`}
                    width="14" height="14" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </button>
              {open && (
                <div className="anamnesis-accordion-body">
                  <AnamnesisStructured data={record.anamnesis as AnamnesisData} />
                  {record.notes && record.notes !== 'Collected via anamnesis chat' && (
                    <div className="hekim-notu-block">
                      <p className="hekim-notu-label">Hekim Notu</p>
                      <p className="hekim-notu-text">{record.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* ── Tıbbi Kayıtlar ── */}
        {medicalRecords.length === 0 && anamnesisRecords.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p className="empty-state-text">Bu hasta için henüz tıbbi kayıt yok.</p>
          </div>
        )}

        {medicalRecords.map(record => {
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
      </div>

      {showDeleteModal && (
        <div className="takvim-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="takvim-modal" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="takvim-modal-header">
              <h3 className="takvim-modal-title">Hastayı Sil</h3>
              <button className="takvim-modal-close" onClick={() => setShowDeleteModal(false)}>✕</button>
            </div>
            <p style={{ margin: '0 0 1.5rem', lineHeight: 1.5 }}>
              <strong>{patient?.name}</strong> adlı hastayı silmek istediğinize emin misiniz?
              Bu işlem geri alınamaz.
            </p>
            <div className="takvim-modal-footer">
              <button className="btn-ghost" onClick={() => setShowDeleteModal(false)}>Vazgeç</button>
              <button className="btn-danger" onClick={confirmDelete}>Evet, Sil</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
