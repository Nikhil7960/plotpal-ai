import { GoogleGenAI } from '@google/genai';
import { getApiKey, MODELS } from '../config.js';
import { CellResult, PointwiseScore } from '../types.js';
import { getFullRubricText } from './rubrics.js';
import { withRetry } from '../pipeline/retry.js';

let ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!ai) ai = new GoogleGenAI({ apiKey: getApiKey() });
  return ai;
}

export async function scoreResult(result: CellResult): Promise<PointwiseScore> {
  const rubricText = getFullRubricText();

  const prompt = `You are an expert urban planning evaluator assessing an AI system that analyzes satellite imagery to identify vacant development sites in Mumbai, India.

## Cell Info
- Cell ID: ${result.cellId}
- Center: ${result.center.lat.toFixed(6)}, ${result.center.lng.toFixed(6)} (500m × 500m cell)

## AI Output Being Evaluated
${JSON.stringify(result.filteredResult, null, 2)}

## Scoring Rubric
${rubricText}

Score each dimension 1-5 with a brief justification. Return ONLY valid JSON:
{
  "relevance": { "score": <1-5>, "justification": "..." },
  "feasibility": { "score": <1-5>, "justification": "..." },
  "reasoning_quality": { "score": <1-5>, "justification": "..." },
  "geographic_accuracy": { "score": <1-5>, "justification": "..." },
  "completeness": { "score": <1-5>, "justification": "..." },
  "overall_score": <1-5>,
  "notes": "..."
}`;

  return withRetry(
    async () => {
      const response = await getAI().models.generateContent({
        model: MODELS.judge,
        config: { temperature: 0.1 },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const content = response.text ?? '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error(`No JSON in judge response for ${result.cellId}`);

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        cellId: result.cellId,
        relevance: parsed.relevance,
        feasibility: parsed.feasibility,
        reasoning_quality: parsed.reasoning_quality,
        geographic_accuracy: parsed.geographic_accuracy,
        completeness: parsed.completeness,
        overall_score: parsed.overall_score,
        notes: parsed.notes || '',
      };
    },
    `judge(${result.cellId})`,
    { maxRetries: 3, baseDelayMs: 3000 }
  );
}
