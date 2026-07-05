import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Appointment } from '../api';
import { useAuth } from '../AuthContext';
import Layout from '../components/Layout';

const STATUS_LABEL: Record<Appointment['status'], string> = {
  PENDING:   'Onay Bekliyor',
  SCHEDULED: 'Onaylandı',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal Edildi',
  NO_SHOW:   'Gerçekleşmedi',
  UNCERTAIN: 'Belirsiz',
};

const STATUS_CLASS: Record<Appointment['status'], string> = {
  PENDING:   'badge badge-appt-pending',
  SCHEDULED: 'badge badge-appt-scheduled',
  COMPLETED: 'badge badge-appt-completed',
  CANCELLED: 'badge badge-appt-cancelled',
  NO_SHOW:   'badge badge-appt-cancelled',
  UNCERTAIN: 'badge badge-appt-pending',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function RandevularimPage() {
  const { userId }                    = useAuth();
  const navigate                      = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  useEffect(() => {
    api.getAppointments()
      .then(all => {
        const mine = all
          .filter(a => a.patient.ownerId === userId)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAppointments(mine);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Randevular yüklenemedi'))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <Layout>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Randevularım</h1>
          <p>Klinik randevu talepleriniz ve durumları</p>
        </div>
        {!loading && appointments.length > 0 && (
          <span className="muted-text">{appointments.length} randevu</span>
        )}
      </div>

      <div className="page-body">
        {loading && <p className="muted-text">Randevular yükleniyor…</p>}

        {error && <p className="error-text">{error}</p>}

        {!loading && !error && appointments.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📅</div>
            <p className="empty-state-text">Henüz randevunuz yok.</p>
            <button
              className="btn-primary"
              style={{ marginTop: '1rem' }}
              onClick={() => navigate('/randevu-al')}
            >
              Randevu Al
            </button>
          </div>
        )}

        {appointments.map(appt => (
          <div key={appt.id} className="card appt-card">
            <div className="appt-card-header">
              <span className={STATUS_CLASS[appt.status]}>
                {STATUS_LABEL[appt.status]}
              </span>
              <span className="appt-date">{formatDate(appt.date)}</span>
            </div>

            <div className="appt-card-body">
              <p className="appt-clinic">
                🏥 {appt.clinicName ?? '—'}
              </p>
              {appt.clinicAddress && (
                <p className="appt-clinic-address">📍 {appt.clinicAddress}</p>
              )}
              <p className="appt-patient">
                🐾 {appt.patient.name}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
