import type { AnamnesisData } from '../api';

const TOPIC_LABELS = [
  'Ana Şikayet',
  'Süre',
  'Şiddet',
  'İştah',
  'Su Tüketimi',
  'Davranış',
  'Aşı Durumu',
] as const;

export function parseAnamnesis(data: AnamnesisData): { label: string; answer: string }[] {
  const userAnswers = data.messages
    .filter(m => m.role === 'user')
    .slice(1)
    .map(m => m.text);

  return TOPIC_LABELS.map((label, i) => ({
    label,
    answer: userAnswers[i] ?? '—',
  }));
}

interface Props {
  data: AnamnesisData;
}

export default function AnamnesisStructured({ data }: Props) {
  const rows = parseAnamnesis(data);

  return (
    <div className="takvim-anamnesis-box anamnesis-structured">
      {rows.map(({ label, answer }) => (
        <div key={label} className="anamnesis-kv-row">
          <span className="anamnesis-kv-label">{label}</span>
          <span className="anamnesis-kv-value">{answer}</span>
        </div>
      ))}
    </div>
  );
}
