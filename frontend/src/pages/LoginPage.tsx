import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

function parseJwtSub(token: string): number {
  const payload = JSON.parse(atob(token.split('.')[1]));
  return payload.sub as number;
}

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { access_token } = await api.login(email, password);
      login(access_token, parseJwtSub(access_token));
      navigate('/patients');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
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
          <h1>Hoş Geldiniz</h1>
          <p className="login-sub">Klinik panelinize giriş yapın</p>

          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="email">E-posta adresi</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="siz@klinik.com"
                required
                autoFocus
              />
            </div>

            <div className="form-field">
              <label htmlFor="password">Şifre</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && <p className="error-text">{error}</p>}

            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
