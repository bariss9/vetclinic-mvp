import { useState, useEffect } from 'react';
import { api } from '../api';
import type { Appointment, MedicalRecord, AnamnesisData } from '../api';
import Layout from '../components/Layout';
import AnamnesisStructured from '../components/AnamnesisStructured';

const MONTH_NAMES = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const DAY_LABELS  = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}

function buildCells(year: number, month: number): (Date | null)[] {
  const dow = new Date(year, month, 1).getDay();       // 0=Sun
  const startOffset = (dow + 6) % 7;                   // Mon=0 … Sun=6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array<null>(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function TakvimPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading]           = useState(true);
  const [viewDate, setViewDate]         = useState(() => new Date());
  const [selected, setSelected]         = useState<Appointment | null>(null);
  const [anamnesis, setAnamnesis]       = useState<MedicalRecord | null>(null);
  const [anamnesisLoading, setAnamnesisLoading] = useState(false);
  const [cancelling, setCancelling]     = useState(false);

  useEffect(() => { loadAppointments(); }, []);

  async function loadAppointments() {
    setLoading(true);
    try {
      const all = await api.getAppointments();
      setAppointments(all.filter(a => a.status === 'SCHEDULED'));
    } finally {
      setLoading(false);
    }
  }

  async function openModal(appt: Appointment) {
    setSelected(appt);
    setAnamnesis(null);
    if (appt.anamnesisId) {
      const recordId = parseInt(appt.anamnesisId, 10);
      if (!isNaN(recordId)) {
        setAnamnesisLoading(true);
        try {
          setAnamnesis(await api.getMedicalRecord(recordId));
        } catch {
          // anamnesis not found — show nothing
        } finally {
          setAnamnesisLoading(false);
        }
      }
    }
  }

  async function handleCancel() {
    if (!selected) return;
    setCancelling(true);
    try {
      await api.updateAppointment(selected.id, { status: 'CANCELLED' });
      setAppointments(prev => prev.filter(a => a.id !== selected.id));
      setSelected(null);
    } finally {
      setCancelling(false);
    }
  }

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const cells = buildCells(year, month);
  const today = new Date();

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)); }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)); }

  return (
    <Layout>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Takvim</h1>
          <p>Onaylanan randevuları yönetin</p>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <p className="muted-text">Randevular yükleniyor…</p>
        ) : (
          <div className="card" style={{ padding: '1.25rem' }}>
            {/* ── Month nav ── */}
            <div className="takvim-nav">
              <button className="takvim-nav-btn" onClick={prevMonth}>&#8249;</button>
              <span className="takvim-nav-title">{MONTH_NAMES[month]} {year}</span>
              <button className="takvim-nav-btn" onClick={nextMonth}>&#8250;</button>
            </div>

            {/* ── Day-of-week header ── */}
            <div className="takvim-grid">
              {DAY_LABELS.map(d => (
                <div key={d} className="takvim-dow">{d}</div>
              ))}

              {/* ── Day cells ── */}
              {cells.map((date, i) => {
                if (!date) return <div key={`empty-${i}`} className="takvim-cell takvim-cell-empty" />;
                const isToday = isSameDay(date, today);
                const dayAppts = appointments.filter(a => isSameDay(new Date(a.date), date));
                return (
                  <div key={date.toISOString()} className={`takvim-cell${isToday ? ' takvim-cell-today' : ''}`}>
                    <span className={`takvim-day-num${isToday ? ' takvim-day-num-today' : ''}`}>
                      {date.getDate()}
                    </span>
                    {dayAppts.map(appt => (
                      <button
                        key={appt.id}
                        className="takvim-event"
                        onClick={() => openModal(appt)}
                      >
                        <span className="takvim-event-time">
                          {new Date(appt.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="takvim-event-name">{appt.patient.name}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>

            {appointments.length === 0 && (
              <div className="empty-state" style={{ marginTop: '2rem' }}>
                <div className="empty-state-icon">📅</div>
                <p className="empty-state-text">Bu ay için onaylı randevu yok.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {selected && (
        <div className="takvim-overlay" onClick={() => setSelected(null)}>
          <div className="takvim-modal" onClick={e => e.stopPropagation()}>
            <button className="takvim-modal-close" onClick={() => setSelected(null)}>✕</button>

            <div className="takvim-modal-header">
              <span className="badge badge-ai" style={{ fontSize: '.75rem' }}>SCHEDULED</span>
              <h2 className="takvim-modal-title">{selected.patient.name}</h2>
              <p className="takvim-modal-date">
                {new Date(selected.date).toLocaleDateString('tr-TR', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                })}
                {' · '}
                {new Date(selected.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <div className="takvim-modal-section">
              <p className="takvim-modal-label">Hasta</p>
              <p className="takvim-modal-value">
                {selected.patient.name} · {selected.patient.species} · {selected.patient.breed} · {selected.patient.age} yaşında
              </p>
            </div>

            <div className="takvim-modal-section">
              <p className="takvim-modal-label">Hasta Sahibi</p>
              <p className="takvim-modal-value">
                {selected.patient.owner.name ?? selected.patient.owner.email}
              </p>
            </div>

            {selected.clinicName && (
              <div className="takvim-modal-section">
                <p className="takvim-modal-label">Klinik</p>
                <p className="takvim-modal-value">{selected.clinicName}</p>
              </div>
            )}

            <div className="takvim-modal-section">
              <p className="takvim-modal-label">Anamnez Özeti</p>
              {anamnesisLoading ? (
                <p className="muted-text" style={{ fontSize: '.875rem' }}>Yükleniyor…</p>
              ) : anamnesis?.anamnesis ? (
                <AnamnesisStructured data={anamnesis.anamnesis as AnamnesisData} />
              ) : (
                <p className="muted-text" style={{ fontSize: '.875rem' }}>Anamnez kaydı bulunamadı.</p>
              )}
            </div>

            <div className="takvim-modal-footer">
              <button
                className="btn-danger"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? 'İptal ediliyor…' : 'Randevuyu İptal Et'}
              </button>
              <button className="btn-ghost" onClick={() => setSelected(null)}>Kapat</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
