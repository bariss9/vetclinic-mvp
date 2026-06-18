import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChatDto, SaveAnamnesisDto, ChatMessageDto } from './anamnesis.dto';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const COMPLETION_TOKEN = '[ANAMNESIS_COMPLETE]';

// Standalone rude/dismissive words (word-level match to avoid false positives like "susuz", "kesin")
const RUDE_WORDS = new Set(['sus', 'kes', 'lan', 'salak', 'siktir', 'defol', 'sanane']);

// Multi-word or unambiguous phrases (substring match is safe here)
const RUDE_SUBSTRINGS = ['bırak beni', 'sus lan', 'siktir', 'whatever', 'shut up', 'yok bişey'];

function isIrrelevantAnswer(text: string): boolean {
  const t = text.trim().toLowerCase();
  // Numbers with optional Turkish units are always valid answers (e.g. "2", "3 gün", "5 kilo")
  if (/^\d+(\s*(gün|saat|kilo|kg|ay|yıl|hafta|dakika|dk))?$/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.some(w => RUDE_WORDS.has(w))) return true;
  return RUDE_SUBSTRINGS.some(s => t.includes(s));
}

const TOPICS = [
  {
    key:   'chief_complaint',
    hint:  'the main health concern or chief complaint',
    reask: 'Hayvanınızın ana sağlık şikayeti nedir, söyleyebilir misiniz?',
  },
  {
    key:   'duration',
    hint:  'how long the problem has been going on',
    reask: 'Bu şikayet ne zamandan beri devam ediyor?',
  },
  {
    key:   'severity',
    hint:  'how severe the symptoms are (mild, moderate, or severe)',
    reask: 'Semptomların şiddetini nasıl tanımlarsınız — hafif mi, orta mı, yoksa ağır mı?',
  },
  {
    key:   'appetite',
    hint:  "the animal's appetite and eating habits",
    reask: 'Hayvanınızın iştahı nasıl, normal yiyor mu?',
  },
  {
    key:   'water_intake',
    hint:  "the animal's water intake",
    reask: 'Hayvanınız yeterince su içiyor mu?',
  },
  {
    key:   'behavior',
    hint:  'any changes in behavior or activity level',
    reask: 'Davranışında veya aktivite seviyesinde bir değişiklik fark ettiniz mi?',
  },
  {
    key:   'vaccination',
    hint:  'vaccination status and history',
    reask: 'Hayvanınızın aşı durumu hakkında bilgi verebilir misiniz?',
  },
] as const;

function buildSystemPrompt(
  species: string,
  name: string,
  breed: string,
  age: number,
  topicIndex: number,
): string {
  const base = `You are a veterinary assistant collecting patient history for ${name}, a ${age}-year-old ${species} (${breed}). Always respond in Turkish, regardless of what language the owner uses. The owner's answers may be short Turkish words or phrases (e.g. 'halsiz', 'iyi', 'az'). Treat these as valid answers to your question.`;

  if (topicIndex >= TOPICS.length) {
    return `${base} The owner has answered all questions. Based solely on the conversation history, write a brief clinical summary of all answers and append ${COMPLETION_TOKEN} at the very end. Do not ask any further questions.`;
  }

  const { hint } = TOPICS[topicIndex];
  return `${base} Ask the owner about: ${hint}. Ask only this one question. Keep it short and friendly. Do not ask about anything else and do not reference topics already discussed.`;
}

function formatHistory(history: ChatMessageDto[]) {
  return history.map(m => ({
    role: m.role === 'model' ? 'assistant' : 'user',
    content: m.text,
  }));
}

@Injectable()
export class AnamnesisService {
  constructor(private readonly prisma: PrismaService) {}

  async chat(dto: ChatDto) {
    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException(`Patient #${dto.patientId} not found`);

    const apiKey = process.env.GROQ_API_KEY;
    console.log('[Groq] key prefix:', apiKey ? apiKey.slice(0, 10) + '...' : 'NOT SET');
    if (!apiKey) throw new InternalServerErrorException('GROQ_API_KEY is not configured');

    const userMessageCount = dto.history.filter(m => m.role === 'user').length;
    const irrelevantInHistory = dto.history.filter(m => m.role === 'user' && isIrrelevantAnswer(m.text)).length;
    const effectiveCount = userMessageCount - irrelevantInHistory;
    const isCurrentIrrelevant = isIrrelevantAnswer(dto.message);
    const topicIndex = isCurrentIrrelevant ? Math.max(0, effectiveCount - 1) : effectiveCount;
    const isSummary = topicIndex >= TOPICS.length;

    // Hard guard: bypass Groq entirely for rude/irrelevant input outside the summary phase.
    // The LLM never sees the message, so it cannot skip topics or produce meta-commentary.
    if (isCurrentIrrelevant && !isSummary) {
      const reply = `Anlayışınız için teşekkürler, ama bu bilgiye gerçekten ihtiyacım var. ${TOPICS[topicIndex].reask}`;
      return { reply, done: false };
    }

    const body = {
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt(patient.species, patient.name, patient.breed, patient.age, topicIndex) },
        ...(isSummary ? formatHistory(dto.history) : []),
        { role: 'user', content: dto.message },
      ],
      temperature: 0.3,
      max_tokens: isSummary ? 400 : 150,
    };

    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 45_000);
    const startMs = Date.now();

    let res: Response;
    try {
      res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: abort.signal,
      });
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      console.error(`[Groq] fetch failed after ${Date.now() - startMs}ms:`, isTimeout ? 'TIMEOUT after 45s' : err);
      throw new InternalServerErrorException(
        isTimeout ? 'Groq API timed out after 45 seconds' : 'Groq API request failed',
      );
    } finally {
      clearTimeout(timeout);
    }

    const rawBody = await res.text();
    console.log(`[Groq] status=${res.status} duration=${Date.now() - startMs}ms body=${rawBody.slice(0, 500)}`);

    if (!res.ok) {
      throw new InternalServerErrorException(`Groq API error: ${rawBody}`);
    }

    const data = JSON.parse(rawBody) as {
      choices: Array<{ message: { content: string } }>;
    };

    const rawReply: string = data.choices?.[0]?.message?.content ?? '';
    const done = /ANAMNESIS_COMPLETE/i.test(rawReply);
    const reply = rawReply.replace(/[\[(]?ANAMNESIS_COMPLETE[\])]?/gi, '').trim();

    return { reply, done };
  }

  async save(dto: SaveAnamnesisDto) {
    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException(`Patient #${dto.patientId} not found`);

    return this.prisma.medicalRecord.create({
      data: {
        patientId: dto.patientId,
        symptoms: [],
        notes: dto.notes ?? 'Collected via anamnesis chat',
        anamnesis: dto.anamnesis as Prisma.InputJsonValue,
      },
    });
  }
}
