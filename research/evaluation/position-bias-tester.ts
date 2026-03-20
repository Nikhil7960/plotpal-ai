import { GoogleGenAI } from '@google/genai';
import { getApiKey, MODELS } from '../config.js';
import { CellResult, PointwiseScore, PositionBiasResult } from '../types.js';
import { getFullRubricText } from './rubrics.js';
import { RUBRIC_DIMENSIONS } from './rubrics.js';
import { withRetry } from '../pipeline/retry.js';

let ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!ai) ai = new GoogleGenAI({ apiKey: getApiKey() });
  return ai;
}

/**
 * Run the judge with reversed vacantSpaces order and compare scores.
 */
export async function testPositionBias(
  result: CellResult,
  originalScore: PointwiseScore
): Promise<PositionBiasResult> {
  const reversedResult = {
    ...result.filteredResult,
    vacantSpaces: [...result.filteredResult.vacantSpaces].reverse(),
  };

  const rubricText = getFullRubricText();

  return withRetry(
    async () => {
      const prompt = `You are an expert urban planning evaluator assessing an AI system that analyzes satellite imagery to identify vacant development sites in Mumbai, India.

## Cell Info
- Cell ID: ${result.cellId}
- Center: ${result.center.lat.toFixed(6)}, ${result.center.lng.toFixed(6)} (500m × 500m cell)

## AI Output Being Evaluated
${JSON.stringify(reversedResult, null, 2)}

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

      const response = await getAI().models.generateContent({
        model: MODELS.judge,
        config: { temperature: 0.1 },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const content = response.text ?? '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error(`No JSON in bias test response for ${result.cellId}`);

      const parsed = JSON.parse(jsonMatch[0]);

      const originalScores: Record<string, number> = {};
      const reversedScores: Record<string, number> = {};

      for (const dim of RUBRIC_DIMENSIONS) {
        originalScores[dim] = originalScore[dim].score;
        reversedScores[dim] = parsed[dim].score;
      }

      const diffs = RUBRIC_DIMENSIONS.map(
        (dim) => Math.abs(originalScores[dim] - reversedScores[dim])
      );
      const maxDiff = Math.max(...diffs);

      return {
        cellId: result.cellId,
        originalScores,
        reversedScores,
        maxDiff,
        biased: maxDiff > 1,
      };
    },
    `bias(${result.cellId})`,
    { maxRetries: 3, baseDelayMs: 3000 }
  );
}
