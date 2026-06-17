import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChatDto, SaveAnamnesisDto, ChatMessageDto } from './anamnesis.dto';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const COMPLETION_TOKEN = '[ANAMNESIS_COMPLETE]';

function buildSystemPrompt(species: string, name: string, breed: string, age: number, forceFinish: boolean): string {
  const base = `You are a veterinary assistant collecting patient history for ${name}, a ${age}-year-old ${species} (${breed}). Ask one short question at a time about these 7 topics in order: 1) chief complaint, 2) duration, 3) severity, 4) appetite, 5) water intake, 6) behavior, 7) vaccination status. Never ask about the same topic twice. Track what has been asked and move to the next topic. After covering all 7 topics, immediately output a brief summary and add ${COMPLETION_TOKEN} at the very end. If the owner's answer is irrelevant, rude, or doesn't address the question (e.g. 'whatever', 'shut up', 'none of your business'), politely ask the same question again in a different way instead of moving to the next topic. Only move to the next topic once you get a relevant answer.`;
  if (forceFinish) {
    return `${base} This is the final question or summary — you MUST provide the summary now and end with ${COMPLETION_TOKEN}.`;
  }
  return base;
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
    const forceFinish = userMessageCount >= 7;

    const body = {
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt(patient.species, patient.name, patient.breed, patient.age, forceFinish) },
        ...formatHistory(dto.history.slice(-4)),
        { role: 'user', content: dto.message },
      ],
      temperature: 0.3,
      max_tokens: forceFinish ? 400 : 150,
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

    const reply: string = data.choices?.[0]?.message?.content ?? '';
    const done = reply.includes(COMPLETION_TOKEN);

    return { reply, done };
  }

  async save(dto: SaveAnamnesisDto) {
    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException(`Patient #${dto.patientId} not found`);

    return this.prisma.medicalRecord.create({
      data: {
        patientId: dto.patientId,
        symptoms: [],
        notes: 'Collected via anamnesis chat',
        anamnesis: dto.anamnesis as Prisma.InputJsonValue,
      },
    });
  }
}
