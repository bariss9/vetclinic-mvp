import { Injectable, NotFoundException } from '@nestjs/common';
// import Anthropic from '@anthropic-ai/sdk';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DiagnoseDto } from './ai.dto';

export interface DiagnosisResult {
  possibleDiseases: string[];
  riskLevel: 'low' | 'medium' | 'high';
  confidenceScore: number;
  recommendations: string[];
  urgent: boolean;
}

@Injectable()
export class AiService {
  // private readonly anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  constructor(private readonly prisma: PrismaService) {}

  async diagnose(dto: DiagnoseDto) {
    const record = await this.prisma.medicalRecord.findUnique({ where: { id: dto.medicalRecordId } });
    if (!record) throw new NotFoundException(`MedicalRecord #${dto.medicalRecordId} not found`);

    // const prompt = `You are a veterinary AI assistant providing decision support only. Analyze the following case and respond with ONLY a valid JSON object — no markdown, no explanation, just raw JSON.
    //
    // Animal: ${dto.animalType}, ${dto.breed}, ${dto.age} year(s) old
    // Symptoms: ${dto.symptoms.join(', ')}
    // Duration: ${dto.durationDays} day(s)
    // Severity: ${dto.severity}
    //
    // Respond with this exact JSON structure:
    // {
    //   "possibleDiseases": ["disease1", "disease2"],
    //   "riskLevel": "low" | "medium" | "high",
    //   "confidenceScore": 0-100,
    //   "recommendations": ["recommendation1", "recommendation2"],
    //   "urgent": true | false
    // }
    //
    // IMPORTANT: This is AI-assisted decision support only. Always recommend consulting a licensed veterinarian.`;

    // const response = await this.anthropic.messages.create({
    //   model: 'claude-sonnet-4-6',
    //   max_tokens: 1024,
    //   messages: [{ role: 'user', content: prompt }],
    // });
    // const block = response.content[0];
    // if (block.type !== 'text') throw new Error('Unexpected response type from AI');
    // const aiResult: DiagnosisResult = JSON.parse(block.text.trim()) as DiagnosisResult;

    const aiResult: DiagnosisResult = {
      possibleDiseases: ['Kennel Cough', 'Bronchitis'],
      riskLevel: 'medium',
      confidenceScore: 72,
      recommendations: ['Rest', 'Hydration', 'Vet visit within 48h'],
      urgent: false,
    };

    const updated = await this.prisma.medicalRecord.update({
      where: { id: dto.medicalRecordId },
      data: { aiResult: aiResult as unknown as Prisma.InputJsonValue },
      include: { patient: { select: { id: true, name: true } } },
    });

    return {
      medicalRecord: updated,
      aiResult,
      advisory: 'AI-assisted suggestion only — not a medical diagnosis. Consult a licensed veterinarian.',
    };
  }
}
