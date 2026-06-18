import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api';
import type { Patient, ChatMessage, AnamnesisData } from '../api';
import Layout from '../components/Layout';
import AnamnesisChat from '../components/AnamnesisChat';

declare global {
  interface Window {
    __openRandevu?: (key: string) => void;
  }
}

interface OverpassElement {
  type: string;
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

interface Clinic {
  id: number;
  name: string;
  lat: number;
  lon: number;
  phone?: string;
  address?: string;
  distance: number;
}

type ClinicEntry = { key: string } & Clinic;
type MapStatus  = 'loading' | 'error' | 'ready';
type ModalStep  = 'patient' | 'chat' | 'slots' | 'success';

interface Slot { label: string; iso: string; }

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function generateSlots(): Slot[] {
  const schedule: [number, number, number][] = [
    [1, 10,  0],
    [1, 14, 30],
    [2,  9,  0],
    [2, 16,  0],
    [3, 11, 30],
  ];
  const now = new Date();
  return schedule.map(([dayOffset, h, m]) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    const dateLabel = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    const timeLabel = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return { label: `${dateLabel} ${timeLabel}`, iso: d.toISOString() };
  });
}

export default function RandevuAlPage() {
  // ── Map refs ──────────────────────────────────────
  const mapDivRef    = useRef<HTMLDivElement>(null);
  const leafletRef   = useRef<L.Map | null>(null);
  const clinicMapRef = useRef<Record<string, Clinic>>({});
  const markerMapRef = useRef<Record<string, L.Marker>>({});

  // ── Map state ─────────────────────────────────────
  const [status, setStatus]       = useState<MapStatus>('loading');
  const [statusMsg, setStatusMsg] = useState('Konum alınıyor…');
  const [clinics, setClinics]     = useState<ClinicEntry[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // ── Modal state ───────────────────────────────────
  const [modalClinic, setModalClinic]             = useState<Clinic | null>(null);
  const [modalStep, setModalStep]                 = useState<ModalStep>('patient');
  const [patients, setPatients]                   = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [anamnesisHistory, setAnamnesisHistory]   = useState<ChatMessage[]>([]);
  const [anamnesisSummary, setAnamnesisSummary]   = useState('');
  const [slots, setSlots]                         = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot]           = useState<Slot | null>(null);
  const [slotsLoading, setSlotsLoading]           = useState(false);
  const [saving, setSaving]                       = useState(false);
  const [saveError, setSaveError]                 = useState('');

  // ── Global hook for Leaflet popup button ──────────
  useEffect(() => {
    window.__openRandevu = (key: string) => {
      const clinic = clinicMapRef.current[key];
      if (!clinic) return;
      openModal(clinic, key);
    };
    return () => { delete window.__openRandevu; };
  }, []);

  // ── Patients list for modal ───────────────────────
  useEffect(() => {
    api.getPatients().then(setPatients).catch(() => {});
  }, []);

  // ── Leaflet map init ──────────────────────────────
  useEffect(() => {
    if (!mapDivRef.current || leafletRef.current) return;
    let mounted = true;

    const map = L.map(mapDivRef.current, { zoomControl: true });
    leafletRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    if (!navigator.geolocation) {
      setStatusMsg('Tarayıcınız konum özelliğini desteklemiyor.');
      setStatus('error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        if (!mounted) return;

        map.setView([lat, lng], 15);

        L.circleMarker([lat, lng], {
          radius: 9, fillColor: '#3B82F6', color: '#fff', weight: 2.5, fillOpacity: 1,
        }).addTo(map).bindPopup('<b>Konumunuz</b>');

        L.circle([lat, lng], {
          radius: 10000, color: '#3B82F6', fillColor: '#3B82F6',
          fillOpacity: 0.04, weight: 1.5, dashArray: '5 7',
        }).addTo(map);

        try {
          const query = `[out:json][timeout:25];(node["amenity"="veterinary"](around:10000,${lat},${lng});node["amenity"="animal_hospital"](around:10000,${lat},${lng});node["shop"="pet"](around:10000,${lat},${lng}););out body;`;
          const res = await fetch(
            `https://maps.mail.ru/osm/tools/overpass/api/interpreter?data=${encodeURIComponent(query)}`,
          );
          if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
          const data = (await res.json()) as { elements: OverpassElement[] };

          if (!mounted) return;

          const allClinics: ClinicEntry[] = data.elements.map((el, i) => {
            const key = `c${i}`;
            const entry: ClinicEntry = {
              key,
              id:       el.id,
              name:     el.tags.name ?? 'Veteriner Kliniği',
              lat:      el.lat,
              lon:      el.lon,
              phone:    el.tags['phone'] ?? el.tags['contact:phone'],
              address:  [el.tags['addr:street'], el.tags['addr:housenumber']]
                          .filter(Boolean).join(' ') || undefined,
              distance: haversineKm(lat, lng, el.lat, el.lon),
            };
            clinicMapRef.current[key] = entry;
            return entry;
          });

          allClinics.forEach(clinic => {
            const { key } = clinic;
            const icon = L.divIcon({
              className: '',
              html: `<div class="map-vet-pin">🏥</div>`,
              iconSize: [36, 36], iconAnchor: [18, 36], popupAnchor: [0, -40],
            });
            const addrHtml  = clinic.address ? `<p class="mp-detail">📍 ${clinic.address}</p>` : '';
            const phoneHtml = clinic.phone   ? `<p class="mp-detail">📞 ${clinic.phone}</p>`   : '';
            const marker = L.marker([clinic.lat, clinic.lon], { icon })
              .addTo(map)
              .bindPopup(
                `<div class="mp-root">
                  <p class="mp-name">${clinic.name}</p>
                  ${addrHtml}${phoneHtml}
                  <button class="mp-btn" onclick="window.__openRandevu('${key}')">📅 Bu Klinikten Randevu Al</button>
                </div>`,
                { minWidth: 210, maxWidth: 280 },
              );
            markerMapRef.current[key] = marker;
          });

          const sorted = [...allClinics].sort((a, b) => a.distance - b.distance);
          setClinics(sorted);
          setStatus('ready');
        } catch (err) {
          if (!mounted) return;
          console.error('[Overpass]', err);
          setStatusMsg('Klinik verileri yüklenemedi. Lütfen daha sonra tekrar deneyin.');
          setStatus('error');
        }
      },
      err => {
        if (!mounted) return;
        setStatusMsg(`Konum alınamadı: ${err.message}`);
        setStatus('error');
      },
      { timeout: 10000, enableHighAccuracy: true },
    );

    return () => {
      mounted = false;
      map.remove();
      leafletRef.current = null;
    };
  }, []);

  // ── Map interaction ───────────────────────────────
  function handleClinicClick(key: string) {
    const clinic = clinicMapRef.current[key];
    if (!clinic || !leafletRef.current) return;
    setActiveKey(key);
    leafletRef.current.flyTo([clinic.lat, clinic.lon], 16);
    const marker = markerMapRef.current[key];
    if (marker) leafletRef.current.once('moveend', () => marker.openPopup());
  }

  // ── Modal helpers ─────────────────────────────────
  function openModal(clinic: Clinic, key: string) {
    setActiveKey(key);
    setModalClinic(clinic);
    setModalStep('patient');
    setSelectedPatientId(null);
    setAnamnesisHistory([]);
    setAnamnesisSummary('');
    setSlots([]);
    setSelectedSlot(null);
    setSlotsLoading(false);
    setSaving(false);
    setSaveError('');
  }

  function closeModal() {
    setModalClinic(null);
    setModalStep('patient');
    setSelectedPatientId(null);
    setAnamnesisHistory([]);
    setAnamnesisSummary('');
    setSlots([]);
    setSelectedSlot(null);
    setSlotsLoading(false);
    setSaving(false);
    setSaveError('');
  }

  async function handleAnamnesisComplete(history: ChatMessage[], summary: string) {
    setAnamnesisHistory(history);
    setAnamnesisSummary(summary);
    setModalStep('slots');
    setSlotsLoading(true);
    try {
      const existing = await api.getAppointments();
      const takenIsos = new Set(
        existing
          .filter(a =>
            (a.status === 'PENDING' || a.status === 'SCHEDULED') &&
            a.clinicName === modalClinic!.name,
          )
          .map(a => a.date),
      );
      setSlots(generateSlots().filter(s => !takenIsos.has(s.iso)));
    } catch {
      setSlots(generateSlots());
    } finally {
      setSlotsLoading(false);
    }
  }

  async function handleConfirm() {
    if (!modalClinic || !selectedPatientId || !selectedSlot) return;
    setSaving(true);
    setSaveError('');
    try {
      const anamnesisData: AnamnesisData = {
        summary:     anamnesisSummary,
        messages:    anamnesisHistory,
        completedAt: new Date().toISOString(),
      };
      const savedRecord = await api.saveAnamnesis({ patientId: selectedPatientId, anamnesis: anamnesisData });
      await api.createAppointment({
        patientId:     selectedPatientId,
        date:          selectedSlot.iso,
        reason:        'Anamnez sonrası klinik randevusu',
        clinicName:    modalClinic.name,
        clinicAddress: modalClinic.address,
        clinicLat:     modalClinic.lat,
        clinicLon:     modalClinic.lon,
        anamnesisId:   String(savedRecord.id),
      });
      setModalStep('success');
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Randevu oluşturulamadı');
    } finally {
      setSaving(false);
    }
  }

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  return (
    <Layout>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Randevu Al</h1>
          <p>10 km çevrenizde bulunan veteriner klinikleri ve evcil hayvan mağazaları</p>
        </div>
        {status === 'ready' && (
          <span className="muted-text">
            {clinics.length > 0 ? `${clinics.length} klinik bulundu` : 'Yakında klinik bulunamadı'}
          </span>
        )}
      </div>

      <div className="map-page-body">
        {/* ── Clinic list sidebar ── */}
        <div className="clinic-list-sidebar">
          <div className="clinic-list-header">
            {status === 'ready'
              ? `${clinics.length} Klinik`
              : status === 'loading'
              ? 'Yükleniyor…'
              : 'Hata'}
          </div>
          {clinics.map(c => (
            <div
              key={c.key}
              className={`clinic-list-item${activeKey === c.key ? ' clinic-list-item--active' : ''}`}
              onClick={() => handleClinicClick(c.key)}
            >
              <div className="clinic-list-name">{c.name}</div>
              <div className="clinic-list-meta">
                <span className="clinic-list-distance">{c.distance.toFixed(1)} km</span>
                {c.address && (
                  <>
                    <span className="clinic-list-dot">·</span>
                    <span className="clinic-list-address">{c.address}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Map area ── */}
        <div className="map-area">
          {(status === 'loading' || status === 'error') && (
            <div className="map-status-bar">
              {status === 'loading'
                ? <p className="muted-text">⏳ {statusMsg}</p>
                : <p className="error-text">{statusMsg}</p>}
            </div>
          )}
          <div ref={mapDivRef} className="map-container" />
        </div>
      </div>

      {/* ── Appointment modal ── */}
      {modalClinic && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>

            <div className="modal-header">
              <h2>Randevu Al</h2>
              <button className="modal-close-btn" onClick={closeModal}>✕</button>
            </div>

            <div className="modal-body">

              {/* ── Step: patient select ── */}
              {modalStep === 'patient' && (
                <>
                  <div className="modal-clinic-info">
                    <p className="modal-clinic-name">🏥 {modalClinic.name}</p>
                    {modalClinic.address && (
                      <p className="modal-clinic-detail">📍 {modalClinic.address}</p>
                    )}
                    {modalClinic.phone && (
                      <p className="modal-clinic-detail">📞 {modalClinic.phone}</p>
                    )}
                  </div>

                  <div className="field" style={{ marginTop: '1.25rem' }}>
                    <label>Hasta Seçin</label>
                    <select
                      value={selectedPatientId ?? ''}
                      onChange={e => setSelectedPatientId(Number(e.target.value) || null)}
                    >
                      <option value="">— Hasta seçin —</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.species}, {p.age} yaş)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-actions" style={{ marginTop: '1.5rem' }}>
                    <button
                      className="btn-primary"
                      disabled={!selectedPatientId}
                      onClick={() => setModalStep('chat')}
                    >
                      🩺 Anamneze Başla
                    </button>
                    <button className="btn-ghost" onClick={closeModal}>İptal</button>
                  </div>
                </>
              )}

              {/* ── Step: anamnesis chat ── */}
              {modalStep === 'chat' && (
                <>
                  <div className="modal-mini-header">
                    <span>🏥 {modalClinic.name}</span>
                    <span className="modal-mini-sep">·</span>
                    <span>{selectedPatient?.name}</span>
                  </div>
                  <div className="modal-chat-wrapper">
                    <AnamnesisChat
                      patientId={selectedPatientId!}
                      onComplete={handleAnamnesisComplete}
                    />
                  </div>
                </>
              )}

              {/* ── Step: time slot picker ── */}
              {modalStep === 'slots' && (
                <>
                  <div className="modal-clinic-info">
                    <p className="modal-clinic-name">🏥 {modalClinic.name}</p>
                    {modalClinic.address && (
                      <p className="modal-clinic-detail">📍 {modalClinic.address}</p>
                    )}
                  </div>

                  <div className="slot-section">
                    <p className="slot-section-label">Uygun Randevu Saatleri</p>
                    {slotsLoading ? (
                      <p className="muted-text">Müsait saatler kontrol ediliyor…</p>
                    ) : slots.length === 0 ? (
                      <p className="muted-text">Bu klinik için müsait randevu saati bulunmuyor.</p>
                    ) : (
                      <div className="slot-grid">
                        {slots.map(s => (
                          <button
                            key={s.iso}
                            className={`slot-btn${selectedSlot?.iso === s.iso ? ' slot-btn--active' : ''}`}
                            onClick={() => setSelectedSlot(s)}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {saveError && (
                    <p className="error-text" style={{ marginTop: '.75rem' }}>{saveError}</p>
                  )}

                  <div className="form-actions" style={{ marginTop: '1.5rem' }}>
                    <button
                      className="btn-primary"
                      disabled={!selectedSlot || saving || slotsLoading}
                      onClick={handleConfirm}
                    >
                      {saving ? 'Oluşturuluyor…' : 'Randevuyu Onayla'}
                    </button>
                    <button className="btn-ghost" onClick={closeModal} disabled={saving}>
                      İptal
                    </button>
                  </div>
                </>
              )}

              {/* ── Step: success ── */}
              {modalStep === 'success' && (
                <div className="modal-success">
                  <div className="modal-success-icon">✓</div>
                  <h3>Randevu Talebiniz Alındı</h3>
                  <p>
                    <strong>{selectedPatient?.name}</strong> için{' '}
                    <strong>{modalClinic.name}</strong>'e{' '}
                    <strong>{selectedSlot?.label}</strong> tarihli randevu talebiniz iletildi.
                    Klinik en kısa sürede sizinle iletişime geçecektir.
                  </p>
                  <button
                    className="btn-primary"
                    style={{ marginTop: '1.25rem' }}
                    onClick={closeModal}
                  >
                    Tamam
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
