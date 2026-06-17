import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Patient } from '../api';
import { useAuth } from '../AuthContext';
import Layout from '../components/Layout';

const SPECIES_EMOJI: Record<string, string> = {
  dog: '🐕', cat: '🐈', bird: '🦜', rabbit: '🐇',
  hamster: '🐹', fish: '🐠', turtle: '🐢',
};

function speciesIcon(species: string) {
  return SPECIES_EMOJI[species.toLowerCase()] ?? '🐾';
}

export default function PatientsPage() {
  const [patients, setPatients]   = useState<Patient[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [showForm, setShowForm]   = useState(false);
  const { userId } = useAuth();
  const navigate   = useNavigate();

  const [name, setName]           = useState('');
  const [species, setSpecies]     = useState('');
  const [breed, setBreed]         = useState('');
  const [age, setAge]             = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  async function handleAddPatient(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await api.createPatient({ name, species, breed, age: parseInt(age, 10), ownerId: userId! });
      setName(''); setSpecies(''); setBreed(''); setAge('');
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
          <h1>Hastalar</h1>
          <p>Kliniğinize kayıtlı hayvan hastalarını yönetin</p>
        </div>
        <button
          className={showForm ? 'btn-ghost' : 'btn-primary'}
          onClick={() => setShowForm(v => !v)}
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
              {formError && <p className="error-text">{formError}</p>}
              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Kaydediliyor…' : 'Hastayı Kaydet'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>
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
                Tüm Hastalar
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
