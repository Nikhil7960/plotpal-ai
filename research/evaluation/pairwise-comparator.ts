import { GoogleGenAI } from '@google/genai';
import { getApiKey, MODELS } from '../config.js';
import { CellResult, PairwiseComparison } from '../types.js';
import { withRetry } from '../pipeline/retry.js';

let ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!ai) ai = new GoogleGenAI({ apiKey: getApiKey() });
  return ai;
}

/**
 * Compare two adjacent cells for spatial coherence.
 */
export async function comparePair(
  resultA: CellResult,
  resultB: CellResult
): Promise<PairwiseComparison> {
  return withRetry(
    async () => {
      const prompt = `You are evaluating spatial coherence between two adjacent 500m×500m cells analyzed by an AI urban planning system in Mumbai.

## Cell A (${resultA.cellId})
Center: ${resultA.center.lat.toFixed(6)}, ${resultA.center.lng.toFixed(6)}
${JSON.stringify(resultA.filteredResult, null, 2)}

## Cell B (${resultB.cellId})
Center: ${resultB.center.lat.toFixed(6)}, ${resultB.center.lng.toFixed(6)}
${JSON.stringify(resultB.filteredResult, null, 2)}

Evaluate spatial coherence:
- Do adjacent cells show consistent understanding of the area?
- If one cell finds a vacant area near the shared boundary, does the neighbor acknowledge it?
- Are recommended infrastructure types complementary (not redundant)?

Return ONLY valid JSON:
{
  "spatialCoherence": <0.0-1.0>,
  "justification": "Brief explanation"
}`;

      const response = await getAI().models.generateContent({
        model: MODELS.judge,
        config: { temperature: 0.1 },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const content = response.text ?? '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in pairwise response');

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        cellA: resultA.cellId,
        cellB: resultB.cellId,
        spatialCoherence: parsed.spatialCoherence,
        justification: parsed.justification,
      };
    },
    `pairwise(${resultA.cellId},${resultB.cellId})`,
    { maxRetries: 3, baseDelayMs: 3000 }
  );
}

/**
 * Find adjacent cell pairs from results.
 */
export function findAdjacentPairs(
  results: CellResult[],
  maxPairs: number
): [CellResult, CellResult][] {
  const resultMap = new Map(results.map((r) => [r.cellId, r]));
  const pairs: [CellResult, CellResult][] = [];

  for (const result of results) {
    if (pairs.length >= maxPairs) break;

    const match = result.cellId.match(/cell_(\d+)_(\d+)/);
    if (!match) continue;
    const row = parseInt(match[1]);
    const col = parseInt(match[2]);

    const rightId = `cell_${row}_${col + 1}`;
    const rightResult = resultMap.get(rightId);
    if (rightResult && pairs.length < maxPairs) {
      pairs.push([result, rightResult]);
    }

    const bottomId = `cell_${row + 1}_${col}`;
    const bottomResult = resultMap.get(bottomId);
    if (bottomResult && pairs.length < maxPairs) {
      pairs.push([result, bottomResult]);
    }
  }

  return pairs;
}
