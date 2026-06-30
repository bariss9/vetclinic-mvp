import { Resend } from 'resend';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter(line => line.includes('=') && !line.startsWith('#'))
    .map(line => {
      const [key, ...rest] = line.split('=');
      return [key.trim(), rest.join('=').trim().replace(/^"|"$/g, '')];
    }),
);

const apiKey = env.RESEND_API_KEY;
const to = env.TEST_EMAIL_TO;

if (!apiKey) {
  console.error('RESEND_API_KEY .env dosyasında bulunamadı.');
  process.exit(1);
}
if (!to) {
  console.error('TEST_EMAIL_TO .env dosyasında bulunamadı.');
  process.exit(1);
}

const resend = new Resend(apiKey);

console.log(`Mail gönderiliyor → ${to}`);

const { data, error } = await resend.emails.send({
  from: 'VetClinic <onboarding@resend.dev>',
  to,
  subject: 'Test',
  html: '<p>VetClinic MVP — Resend API test maili.</p>',
});

if (error) {
  console.error('Hata:', error.message);
} else {
  console.log('Başarılı:', data.id);
}
