import { useState, useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import type { ChatMessage, AnamnesisData } from '../api';

interface Props {
  patientId: number;
  onSaved?: () => void;
  onComplete?: (history: ChatMessage[], summary: string) => void;
}

const COMPLETION_TOKEN = '[ANAMNESIS_COMPLETE]';

interface Bubble {
  role: 'user' | 'bot';
  text: string;
}

function stripToken(text: string) {
  return text.replace(/[\[(]?ANAMNESIS_COMPLETE[\])]?/gi, '').trim();
}

export default function AnamnesisChat({ patientId, onSaved, onComplete }: Props) {
  const [bubbles, setBubbles]   = useState<Bubble[]>([]);
  const [history, setHistory]   = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');
  const [started, setStarted]   = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [bubbles, loading]);

  useEffect(() => {
    if (!done || !onComplete) return;
    const summaryBubble = [...bubbles].reverse().find(b => b.role === 'bot');
    onComplete(history, summaryBubble?.text ?? '');
  // onComplete is stable (passed from parent render); bubbles/history are current when done flips
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  async function startChat() {
    setStarted(true);
    setLoading(true);
    setError('');
    try {
      const { reply, done: isDone } = await api.chatAnamnesis({
        message: 'Merhaba, anamnezi başlatalım.',
        history: [],
        patientId,
      });
      const cleanReply = stripToken(reply);
      setBubbles([{ role: 'bot', text: cleanReply }]);
      setHistory([
        { role: 'user', text: 'Merhaba, anamnezi başlatalım.' },
        { role: 'model', text: cleanReply },
      ]);
      if (isDone) setDone(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sohbet başlatılamadı';
      console.error('[AnamnesisChat] startChat failed:', err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading || done) return;

    setInput('');
    setError('');
    setBubbles(prev => [...prev, { role: 'user', text }]);
    setLoading(true);

    const newHistory: ChatMessage[] = [...history, { role: 'user', text }];

    try {
      const { reply, done: isDone } = await api.chatAnamnesis({
        message: text,
        history: history,
        patientId,
      });
      const cleanReply = stripToken(reply);
      setBubbles(prev => [...prev, { role: 'bot', text: cleanReply }]);
      setHistory([...newHistory, { role: 'model', text: cleanReply }]);
      if (isDone) setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Mesaj gönderilemedi');
      setBubbles(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const summaryBubble = [...bubbles].reverse().find(b => b.role === 'bot');
      const anamnesisData: AnamnesisData = {
        summary: summaryBubble?.text ?? '',
        messages: history,
        completedAt: new Date().toISOString(),
      };
      await api.saveAnamnesis({ patientId, anamnesis: anamnesisData });
      setSaved(true);
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  if (!started) {
    return (
      <div className="anamnesis-start">
        <div className="anamnesis-start-icon">🩺</div>
        <h3>Anamnez Sohbeti</h3>
        <p>
          YZ asistanı sizi semptomlar, süre, iştah, davranış ve daha fazlası hakkında
          sorular sorarak yapılandırılmış bir tıbbi geçmiş alımı sürecinde yönlendirecek.
        </p>
        <button className="btn-primary" onClick={startChat}>
          Anamnezi Başlat
        </button>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="anamnesis-saved">
        <div className="anamnesis-saved-icon">✓</div>
        <h3>Anamnez Kaydedildi</h3>
        <p>Anamnez bu hasta için yeni bir tıbbi kayıt olarak kaydedildi.</p>
      </div>
    );
  }

  return (
    <div className="chat-shell">
      <div className="chat-messages">
        {bubbles.map((b, i) => (
          <div key={i} className={`chat-bubble-row ${b.role === 'user' ? 'user-row' : 'bot-row'}`}>
            {b.role === 'bot' && <div className="chat-avatar">AI</div>}
            <div className={`chat-bubble ${b.role === 'user' ? 'bubble-user' : 'bubble-bot'}`}>
              {b.text.split('\n').map((line, j) => (
                <span key={j}>{line}{j < b.text.split('\n').length - 1 && <br />}</span>
              ))}
            </div>
            {b.role === 'user' && <div className="chat-avatar user-avatar">Siz</div>}
          </div>
        ))}

        {loading && (
          <div className="chat-bubble-row bot-row">
            <div className="chat-avatar">AI</div>
            <div className="chat-bubble bubble-bot bubble-typing">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && <p className="error-text" style={{ padding: '0 1rem' }}>{error}</p>}

      {done ? (
        onComplete ? (
          <div className="chat-done-bar">
            <p className="chat-done-text">Anamnez tamamlandı. Randevu adımına geçiliyor…</p>
          </div>
        ) : (
          <div className="chat-done-bar">
            <p className="chat-done-text">Anamnez tamamlandı. Yukarıdaki özeti inceleyin ve kaydedin.</p>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Kaydediliyor…' : '💾 Anamnez Kaydet'}
            </button>
          </div>
        )
      ) : (
        <form className="chat-input-bar" onSubmit={sendMessage}>
          <input
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Yanıtınızı yazın…"
            disabled={loading || done}
            autoFocus
          />
          <button type="submit" className="chat-send-btn" disabled={loading || !input.trim() || done}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      )}
    </div>
  );
}
