import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import type { Appointment, AnamnesisData, MedicalRecord } from '../api';
import Layout from '../components/Layout';
import AnamnesisStructured from '../components/AnamnesisStructured';

export default function RandevuIstekleriPage() {
  const [appointments, setAppointments]   = useState<Appointment[]>([]);
  const [anamnesisMap, setAnamnesisMap]   = useState<Map<number, AnamnesisData | null>>(new Map());
  const [loading, setLoading]             = useState(true);
  const [actionId, setActionId]           = useState<number | null>(null);
  const [toast, setToast]                 = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await api.getAppointments();
      const pending = all
        .filter(a => a.status === 'PENDING')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setAppointments(pending);

      // fetch anamnesis records in parallel
      const entries = await Promise.allSettled(
        pending.map(async (appt) => {
          if (!appt.anamnesisId) return [appt.id, null] as const;
          const recordId = parseInt(appt.anamnesisId, 10);
          if (isNaN(recordId)) return [appt.id, null] as const;
          const record: MedicalRecord = await api.getMedicalRecord(recordId);
          return [appt.id, record.anamnesis as AnamnesisData | null] as const;
        })
      );

      const map = new Map<number, AnamnesisData | null>();
      entries.forEach(result => {
        if (result.status === 'fulfilled') {
          const [id, data] = result.value;
          map.set(id, data);
        }
      });
      setAnamnesisMap(map);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAction(appt: Appointment, action: 'SCHEDULED' | 'CANCELLED') {
    setActionId(appt.id);
    try {
      await api.updateAppointment(appt.id, { status: action });
      setAppointments(prev => prev.filter(a => a.id !== appt.id));
      if (action === 'SCHEDULED') {
        showToast(`${appt.patient.name} için randevu onaylandı.`);
      }
    } finally {
      setActionId(null);
    }
  }

  return (
    <Layout>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Randevu İstekleri</h1>
          <p>Hasta sahiplerinden gelen bekleyen randevu taleplerini yönetin</p>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <p className="muted-text">Randevu istekleri yükleniyor…</p>
        ) : appointments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <p className="empty-state-text">Bekleyen randevu isteği yok.</p>
          </div>
        ) : (
          <>
            <div className="section-title-row">
              <span className="section-title">
                Bekleyen İstekler
                <span className="section-count">{appointments.length}</span>
              </span>
            </div>

            {appointments.map(appt => {
              const busy      = actionId === appt.id;
              const owner     = appt.patient.owner;
              const anamnesis = anamnesisMap.get(appt.id) ?? null;

              return (
                <div key={appt.id} className="card istekler-card">
                  {/* ── Header row ── */}
                  <div className="istekler-header">
                    <div className="istekler-header-left">
                      <span className="istekler-patient">{appt.patient.name}</span>
                      <span className="istekler-meta">
                        {appt.patient.species} · {appt.patient.breed} · {appt.patient.age} yaşında
                      </span>
                    </div>
                    <div className="istekler-header-right">
                      <span className="istekler-date">
                        {new Date(appt.date).toLocaleDateString('tr-TR', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </span>
                      <span className="istekler-time">
                        {new Date(appt.date).toLocaleTimeString('tr-TR', {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* ── Owner ── */}
                  <div className="istekler-owner-row">
                    <span className="istekler-owner-label">Hasta Sahibi:</span>
                    <span className="istekler-owner-value">
                      {owner.name ?? owner.email}
                    </span>
                  </div>

                  {/* ── Anamnesis structured summary ── */}
                  {anamnesis ? (
                    <div className="istekler-anamnesis">
                      <p className="istekler-section-label">Anamnez Özeti</p>
                      <AnamnesisStructured data={anamnesis} />
                    </div>
                  ) : (
                    <p className="muted-text" style={{ fontSize: '.85rem', margin: '.25rem 0 .5rem' }}>
                      Anamnez verisi yok.
                    </p>
                  )}

                  {/* ── Action buttons ── */}
                  <div className="istekler-actions">
                    <button
                      className="btn-primary"
                      disabled={busy}
                      onClick={() => handleAction(appt, 'SCHEDULED')}
                    >
                      {busy ? '…' : '✓ Onayla'}
                    </button>
                    <button
                      className="btn-danger"
                      disabled={busy}
                      onClick={() => handleAction(appt, 'CANCELLED')}
                    >
                      {busy ? '…' : '✕ Reddet'}
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className="istekler-toast">
          <span className="istekler-toast-icon">✓</span>
          {toast}
        </div>
      )}
    </Layout>
  );
}
