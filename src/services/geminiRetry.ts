import { GoogleGenAI } from '@google/genai';

type GenerateRequest = Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'>;
type GenerateResponse = Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>;

export const MODEL_FALLBACK_ORDER = [
  'gemini-3.1-pro-preview',
  'gemini-2.5-pro',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
] as const;

const MAX_ATTEMPTS_PER_MODEL = 3;
const BASE_DELAY_MS = 1200;

function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const status = (error as { status?: number })?.status;
  const cause = (error as { cause?: { code?: string } })?.cause;
  const causeCode = cause?.code;
  if (status && [408, 425, 429, 500, 502, 503, 504].includes(status)) return true;
  if (causeCode && ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'UND_ERR_SOCKET'].includes(causeCode)) return true;
  return /\b(408|425|429|500|502|503|504)\b|UNAVAILABLE|overloaded|rate.?limit|temporarily|timeout|fetch failed|terminated|socket hang up|network|ECONNRESET|ETIMEDOUT/i.test(message);
}

function isModelNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const status = (error as { status?: number })?.status;
  if (status === 404) return true;
  return /not.?found|does not exist|unsupported|invalid.?model/i.test(message);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function generateContentWithFallback(
  ai: GoogleGenAI,
  request: GenerateRequest,
  models: readonly string[] = MODEL_FALLBACK_ORDER
): Promise<GenerateResponse> {
  let lastError: unknown;

  for (const model of models) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
      try {
        return await ai.models.generateContent({ ...request, model });
      } catch (error) {
        lastError = error;
        const retryable = isRetryableError(error);
        const notFound = isModelNotFoundError(error);
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`Gemini ${model} attempt ${attempt} failed: ${msg}`);

        if (notFound) break; // skip to next model immediately
        if (!retryable) throw error; // non-retryable: give up entirely
        if (attempt < MAX_ATTEMPTS_PER_MODEL) {
          await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1));
        }
      }
    }
    console.warn(`Gemini ${model} exhausted, trying next model`);
    await sleep(BASE_DELAY_MS);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('All Gemini models failed');
}
