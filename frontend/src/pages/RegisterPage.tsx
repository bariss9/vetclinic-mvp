import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';

export default function RegisterPage() {
  const [name, setName]           = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [role, setRole]           = useState<'OWNER' | 'CLINIC'>('OWNER');
  const [clinicName, setClinicName] = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.register({
        name,
        email,
        password,
        role,
        ...(role === 'CLINIC' && clinicName ? { clinicName } : {}),
      });
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kayıt başarısız');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      {/* ── Marka paneli ── */}
      <div className="login-brand-panel">
        <div>
          <div className="login-logo">
            <div className="login-logo-icon">V</div>
            <span className="login-logo-name">VetClinic AI</span>
          </div>

          <div className="login-hero-text">
            <h2>Kliniğiniz için daha akıllı klinik kararlar</h2>
            <p>
              Veteriner profesyoneller için tasarlanmış yapay zeka destekli tanı desteği.
              Hızlı, yapılandırılmış ve her zaman danışmanlık niteliğinde.
            </p>
          </div>

          <div className="login-features">
            <div className="login-feature">
              <div className="login-feature-dot" />
              <span>Hasta kayıtları ve tıbbi geçmiş tek bir yerde</span>
            </div>
            <div className="login-feature">
              <div className="login-feature-dot" />
              <span>Yapay zeka destekli ayırıcı tanı desteği</span>
            </div>
            <div className="login-feature">
              <div className="login-feature-dot" />
              <span>Uygulanabilir önerilerle risk düzeyi triyajı</span>
            </div>
          </div>
        </div>

        <div className="login-brand-footer">
          © 2026 VetClinic AI — Profesyonel veteriner kararının yerine geçmez
        </div>
      </div>

      {/* ── Form paneli ── */}
      <div className="login-form-panel">
        <div className="login-form-box">
          <h1>Hesap Oluştur</h1>
          <p className="login-sub">Platforma ücretsiz katılın</p>

          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="name">Ad Soyad</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Adınız Soyadınız"
                autoFocus
              />
            </div>

            <div className="form-field">
              <label htmlFor="email">E-posta adresi</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="siz@ornek.com"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="password">Şifre</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="En az 6 karakter"
                required
              />
            </div>

            {/* ── Rol seçimi ── */}
            <div className="form-field">
              <label>Hesap türü</label>
              <div className="role-toggle">
                <button
                  type="button"
                  className={`role-toggle-btn${role === 'OWNER' ? ' role-toggle-active' : ''}`}
                  onClick={() => setRole('OWNER')}
                >
                  🐾 Hasta Sahibi
                </button>
                <button
                  type="button"
                  className={`role-toggle-btn${role === 'CLINIC' ? ' role-toggle-active' : ''}`}
                  onClick={() => setRole('CLINIC')}
                >
                  🏥 Klinik
                </button>
              </div>
            </div>

            {role === 'CLINIC' && (
              <div className="form-field">
                <label htmlFor="clinicName">Klinik Adı</label>
                <input
                  id="clinicName"
                  type="text"
                  value={clinicName}
                  onChange={e => setClinicName(e.target.value)}
                  placeholder="Klinik adını girin"
                />
              </div>
            )}

            {error && <p className="error-text">{error}</p>}

            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? 'Kayıt yapılıyor…' : 'Kayıt Ol'}
            </button>
          </form>

          <p className="login-switch-link">
            Zaten hesabın var mı?{' '}
            <Link to="/">Giriş yap</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
