import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

function parseJwt(token: string): { sub: number; role: 'OWNER' | 'CLINIC' } {
  return JSON.parse(atob(token.split('.')[1]));
}

export default function VerifyEmailPage() {
  const location = useLocation();
  const navigate  = useNavigate();
  const { login } = useAuth();

  const [email, setEmail]     = useState<string>((location.state as { email?: string })?.email ?? '');
  const [code, setCode]       = useState('');
  const [error, setError]     = useState('');
  const [info, setInfo]       = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const { access_token } = await api.verifyEmail(email, code.trim());
      const payload = parseJwt(access_token);
      login(access_token, payload.sub, payload.role);
      navigate('/patients');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Doğrulama başarısız');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    setInfo('');
    setResending(true);
    try {
      await api.resendVerification(email);
      setInfo('Yeni kod e-posta adresinize gönderildi.');
    } catch {
      setError('Kod gönderilemedi, lütfen tekrar deneyin.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-brand-panel">
        <div>
          <div className="login-logo">
            <div className="login-logo-icon">V</div>
            <span className="login-logo-name">VetClinic AI</span>
          </div>
          <div className="login-hero-text">
            <h2>E-postanızı doğrulayın</h2>
            <p>
              Kayıt olduğunuz e-posta adresine 6 haneli bir doğrulama kodu gönderdik.
              Kodu aşağıya girin.
            </p>
          </div>
        </div>
        <div className="login-brand-footer">
          © 2026 VetClinic AI — Profesyonel veteriner kararının yerine geçmez
        </div>
      </div>

      <div className="login-form-panel">
        <div className="login-form-box">
          <h1>Doğrulama Kodu</h1>
          <p className="login-sub">Kodun süresi 15 dakikadır</p>

          <form onSubmit={handleSubmit}>
            {!((location.state as { email?: string })?.email) && (
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
            )}

            <div className="form-field">
              <label htmlFor="code">Doğrulama kodu</label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                required
                autoFocus
                style={{ letterSpacing: '0.25em', fontSize: '1.25rem' }}
              />
            </div>

            {error && <p className="error-text">{error}</p>}
            {info  && <p style={{ color: 'var(--success, #22c55e)', marginBottom: '0.75rem' }}>{info}</p>}

            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? 'Doğrulanıyor…' : 'Doğrula ve Giriş Yap'}
            </button>
          </form>

          <p className="login-switch-link" style={{ marginTop: '1rem' }}>
            Kodu almadınız mı?{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, font: 'inherit' }}
            >
              {resending ? 'Gönderiliyor…' : 'Tekrar gönder'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
