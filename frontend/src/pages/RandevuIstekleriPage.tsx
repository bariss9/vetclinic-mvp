import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api';
import type { Appointment, AnamnesisData, MedicalRecord } from '../api';
import Layout from '../components/Layout';
import AnamnesisStructured from '../components/AnamnesisStructured';

type Tab = 'istekler' | 'planlanmis';

export default function RandevuIstekleriPage() {
  const [pending, setPending]             = useState<Appointment[]>([]);
  const [scheduled, setScheduled]         = useState<Appointment[]>([]);
  const [anamnesisMap, setAnamnesisMap]   = useState<Map<number, AnamnesisData | null>>(new Map());
  const [loading, setLoading]             = useState(true);
  const [actionId, setActionId]           = useState<number | null>(null);
  const [toast, setToast]                 = useState<string | null>(null);
  const [tab, setTab]                     = useState<Tab>('istekler');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await api.getAppointments();
      const byDate = (a: Appointment, b: Appointment) =>
        new Date(a.date).getTime() - new Date(b.date).getTime();
      const pendingList   = all.filter(a => a.status === 'PENDING').sort(byDate);
      const scheduledList = all.filter(a => a.status === 'SCHEDULED').sort(byDate);
      setPending(pendingList);
      setScheduled(scheduledList);

      // fetch anamnesis records in parallel
      const visible = [...pendingList, ...scheduledList];
      const entries = await Promise.allSettled(
        visible.map(async (appt) => {
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

  async function handlePendingAction(appt: Appointment, action: 'SCHEDULED' | 'CANCELLED') {
    setActionId(appt.id);
    try {
      const updated = await api.updateAppointment(appt.id, { status: action });
      setPending(prev => prev.filter(a => a.id !== appt.id));
      if (action === 'SCHEDULED') {
        setScheduled(prev =>
          [...prev, updated].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        );
        showToast(`${appt.patient.name} için randevu onaylandı.`);
      }
    } finally {
      setActionId(null);
    }
  }

  async function handleScheduledAction(appt: Appointment, action: 'COMPLETED' | 'NO_SHOW') {
    setActionId(appt.id);
    try {
      await api.updateAppointment(appt.id, { status: action });
      setScheduled(prev => prev.filter(a => a.id !== appt.id));
      showToast(
        action === 'COMPLETED'
          ? `${appt.patient.name} randevusu tamamlandı olarak işaretlendi.`
          : `${appt.patient.name} randevusu gerçekleşmedi olarak işaretlendi.`
      );
    } finally {
      setActionId(null);
    }
  }

  function renderCard(appt: Appointment, actions: ReactNode) {
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
        <div className="istekler-actions">{actions}</div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Randevular</h1>
          <p>Bekleyen istekleri ve planlanmış randevuları yönetin</p>
        </div>
      </div>

      <div className="page-body">
        <div className="tab-bar">
          <button
            className={`tab-btn${tab === 'istekler' ? ' tab-active' : ''}`}
            onClick={() => setTab('istekler')}
          >
            Randevu İstekleri
            <span className="tab-count">{pending.length}</span>
          </button>
          <button
            className={`tab-btn${tab === 'planlanmis' ? ' tab-active' : ''}`}
            onClick={() => setTab('planlanmis')}
          >
            Planlanmış Randevular
            <span className="tab-count">{scheduled.length}</span>
          </button>
        </div>

        {loading ? (
          <p className="muted-text">Randevular yükleniyor…</p>
        ) : tab === 'istekler' ? (
          pending.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <p className="empty-state-text">Bekleyen randevu isteği yok.</p>
            </div>
          ) : (
            pending.map(appt => {
              const busy = actionId === appt.id;
              return renderCard(appt, (
                <>
                  <button
                    className="btn-primary"
                    disabled={busy}
                    onClick={() => handlePendingAction(appt, 'SCHEDULED')}
                  >
                    {busy ? '…' : '✓ Onayla'}
                  </button>
                  <button
                    className="btn-danger"
                    disabled={busy}
                    onClick={() => handlePendingAction(appt, 'CANCELLED')}
                  >
                    {busy ? '…' : '✕ Reddet'}
                  </button>
                </>
              ));
            })
          )
        ) : (
          scheduled.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <p className="empty-state-text">Planlanmış randevu yok.</p>
            </div>
          ) : (
            scheduled.map(appt => {
              const busy = actionId === appt.id;
              return renderCard(appt, (
                <>
                  <button
                    className="btn-primary"
                    disabled={busy}
                    onClick={() => handleScheduledAction(appt, 'COMPLETED')}
                  >
                    {busy ? '…' : '✓ Yapıldı'}
                  </button>
                  <button
                    className="btn-danger"
                    disabled={busy}
                    onClick={() => handleScheduledAction(appt, 'NO_SHOW')}
                  >
                    {busy ? '…' : '✕ Gerçekleşmedi'}
                  </button>
                </>
              ));
            })
          )
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
