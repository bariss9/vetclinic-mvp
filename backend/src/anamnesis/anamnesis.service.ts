import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChatDto, SaveAnamnesisDto, ChatMessageDto, NextQuestionDto, ValidateAnswerDto } from './anamnesis.dto';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const COMPLETION_TOKEN = '[ANAMNESIS_COMPLETE]';

const QUESTIONS = [
  { key: 'chief_complaint', question: 'Hayvanınızın bugün kliniğe gelme sebebi olan ana şikayeti nedir?',           retryQuestion: 'Hayvanınızı bugün kliniğe getirmenizin ana sebebini öğrenebilir miyim?' },
  { key: 'duration',        question: 'Bu şikayet ne zamandır devam ediyor?',                                        retryQuestion: 'Bu sorun ne zaman başladı, yaklaşık olarak belirtebilir misiniz?' },
  { key: 'severity',        question: 'Şikayetin şiddeti nasıl — hafif, orta, yoksa ciddi mi?',                     retryQuestion: 'Bu şikayetin hafif mi, orta mı, yoksa ciddi mi olduğunu söyleyebilir misiniz?' },
  { key: 'appetite',        question: 'Hayvanınızın iştahında bir değişiklik var mı?',                               retryQuestion: 'Hayvanınız eskisi gibi yiyor mu, iştahında bir fark fark ettiniz mi?' },
  { key: 'water_intake',    question: 'Hayvanınızın su tüketiminde bir değişiklik var mı?',                         retryQuestion: 'Hayvanınızın su içme miktarı normale göre değişti mi?' },
  { key: 'behavior',        question: 'Hayvanınızın davranışlarında son zamanlarda bir değişiklik fark ettiniz mi?', retryQuestion: 'Hayvanınız son zamanlarda aktivite veya davranış bakımından farklı mı?' },
  { key: 'vaccination',     question: 'Hayvanınızın aşıları güncel mi?',                                            retryQuestion: 'Hayvanınızın aşı takvimi hakkında bilgi verebilir misiniz?' },
] as const;

// Standalone rude/dismissive words (word-level match to avoid false positives like "susuz", "kesin")
const RUDE_WORDS = new Set(['sus', 'kes', 'lan', 'salak', 'siktir', 'defol', 'sanane']);

// Multi-word or unambiguous phrases (substring match is safe here)
const RUDE_SUBSTRINGS = ['bırak beni', 'sus lan', 'siktir', 'whatever', 'shut up', 'yok bişey'];

// Blocklist for validate-answer — checked before calling Groq
const VALIDATE_RUDE_WORDS = new Set(['siktir', 'sus', 'kes', 'lan', 'salak', 'sanane', 'defol']);
const VALIDATE_RUDE_SUBSTRINGS = ['seni ilgilendirmez', 'bırak beni', 'ne alaka', 'sanane', 'karışma'];

function isBlocklisted(text: string): boolean {
  const t = text.trim().toLowerCase();
  const words = t.split(/\s+/);
  if (words.some(w => VALIDATE_RUDE_WORDS.has(w))) return true;
  return VALIDATE_RUDE_SUBSTRINGS.some(s => t.includes(s));
}

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
  private readonly logger = new Logger(AnamnesisService.name);

  constructor(private readonly prisma: PrismaService) {}

  async chat(dto: ChatDto) {
    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException(`Patient #${dto.patientId} not found`);

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new InternalServerErrorException('Servis geçici olarak kullanılamıyor');

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
      this.logger.error(`Groq fetch failed after ${Date.now() - startMs}ms: ${isTimeout ? 'TIMEOUT after 45s' : String(err)}`);
      throw new InternalServerErrorException('Servis geçici olarak kullanılamıyor');
    } finally {
      clearTimeout(timeout);
    }

    const rawBody = await res.text();
    console.log(`[Groq] status=${res.status} duration=${Date.now() - startMs}ms body=${rawBody.slice(0, 500)}`);

    if (!res.ok) {
      // Upstream hata detayı istemciye sızdırılmaz — sadece loglanır
      this.logger.error(`Groq API error (chat): status=${res.status} body=${rawBody.slice(0, 500)}`);
      throw new InternalServerErrorException('Servis geçici olarak kullanılamıyor');
    }

    const data = JSON.parse(rawBody) as {
      choices: Array<{ message: { content: string } }>;
    };

    const rawReply: string = data.choices?.[0]?.message?.content ?? '';
    const done = /ANAMNESIS_COMPLETE/i.test(rawReply);
    const reply = rawReply.replace(/[\[(]?ANAMNESIS_COMPLETE[\])]?/gi, '').trim();

    return { reply, done };
  }

  async nextQuestion(dto: NextQuestionDto) {
    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException(`Patient #${dto.patientId} not found`);
    return { questionIndex: 0, question: QUESTIONS[0].question, totalQuestions: QUESTIONS.length };
  }

  async validateAnswer(dto: ValidateAnswerDto) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new InternalServerErrorException('Servis geçici olarak kullanılamıyor');

    const current = QUESTIONS[dto.questionIndex];
    if (!current) throw new BadRequestException(`Invalid questionIndex: ${dto.questionIndex}`);

    if (isBlocklisted(dto.answer)) {
      console.log(`[validate] blocklisted answer at q=${dto.questionIndex}: "${dto.answer}"`);
      return { valid: false, retryQuestion: current.retryQuestion };
    }

    const body = {
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are scoring how relevant a pet owner\'s answer is to a veterinary question. Be LENIENT — pet owners often give short, casual answers (1-3 words) and these should score HIGH if they are topically relevant, even without full sentences. For example, for a question about lethargy or main complaint, answers like \'halsiz\', \'yemiyor\', \'kusuyor\' should score 80+. Short NEGATIVE answers that report no change or absence are FULLY VALID answers, especially for yes/no questions: \'hayır\', \'yok\', \'normal\', \'değişiklik yok\', \'her zamanki gibi\', \'iyi\', \'gayet iyi\' should score 90+. Uncertainty answers are also VALID because the owner\'s lack of knowledge is clinically meaningful information: \'bilmiyorum\', \'emin değilim\', \'fark etmedim\' should score 75+. Calibration examples: \'hayır\' -> 90, \'yok\' -> 90, \'normal\' -> 90, \'bilmiyorum\' -> 75. Only score LOW (under 40) if the answer is completely unrelated, empty, or rude/dismissive (e.g. \'sus\', random characters). Output ONLY {"score": N}.',
        },
        {
          role: 'user',
          content: `Question: ${current.question}\nAnswer: ${dto.answer}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 20,
    };

    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 15_000);

    let res: Response;
    try {
      res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: abort.signal,
      });
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      this.logger.error(`Groq fetch failed (validate): ${isTimeout ? 'TIMEOUT after 15s' : String(err)}`);
      throw new InternalServerErrorException('Servis geçici olarak kullanılamıyor');
    } finally {
      clearTimeout(timeout);
    }

    const rawBody = await res.text();
    console.log(`[Groq/validate] q=${dto.questionIndex} status=${res.status} body=${rawBody.slice(0, 200)}`);
    if (!res.ok) {
      // Upstream hata detayı istemciye sızdırılmaz — sadece loglanır
      this.logger.error(`Groq API error (validate): status=${res.status} body=${rawBody.slice(0, 500)}`);
      throw new InternalServerErrorException('Servis geçici olarak kullanılamıyor');
    }

    let score = 0;
    try {
      const data = JSON.parse(rawBody) as { choices: Array<{ message: { content: string } }> };
      const content = data.choices?.[0]?.message?.content ?? '{"score":0}';
      const match = content.match(/\{[^}]*"score"\s*:\s*(\d+)[^}]*\}/);
      score = match ? parseInt(match[1], 10) : 0;
    } catch {
      score = 0;
    }

    console.log(`[Groq/validate] q=${dto.questionIndex} score=${score}`);

    if (score >= 55) {
      const nextIndex = dto.questionIndex + 1;
      return {
        valid: true,
        nextQuestionIndex: nextIndex,
        nextQuestion: QUESTIONS[nextIndex]?.question ?? null,
        done: nextIndex >= QUESTIONS.length,
      };
    }

    return { valid: false, retryQuestion: current.retryQuestion };
  }

  async save(dto: SaveAnamnesisDto, callerId: number, callerRole: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException(`Patient #${dto.patientId} not found`);
    if (callerRole === 'OWNER' && patient.ownerId !== callerId) {
      throw new ForbiddenException('Bu hastaya erişim yetkiniz yok');
    }

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
