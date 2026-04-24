import { GoogleGenAI } from '@google/genai';
import type { VacantSpace } from './qwenVL';
import { generateContentWithFallback } from './geminiRetry';
import { latLngToPixel, type ImageBounds, type ImageSize } from './imageCoords';

export interface AuditResult {
  i: number;
  actualLandUse: 'vacant_land' | 'building' | 'road_or_rail' | 'water' | 'forest_or_park' | 'partially_vacant' | 'out_of_frame' | 'ambiguous';
  looksVacant: boolean;
  auditNote: string;
}

/**
 * Second-pass visual verification: re-examines the satellite image and
 * checks whether each candidate's pixel actually lands on vacant land.
 * Returns only the spaces that the audit confirms look vacant.
 */
export async function auditVacantSpaces(
  spaces: VacantSpace[],
  imageBase64: string,
  imageBounds: ImageBounds,
  imageSize: ImageSize
): Promise<{ kept: VacantSpace[]; audits: AuditResult[] }> {
  if (spaces.length === 0) return { kept: [], audits: [] };

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return { kept: spaces, audits: [] };

  const ai = new GoogleGenAI({ apiKey });

  const markers = spaces.map((s, i) => {
    const p =
      s.pixelCoordinates ??
      latLngToPixel(s.coordinates.lat, s.coordinates.lng, imageBounds, imageSize);
    return {
      i,
      px: Math.round('px' in p ? p.px : p.x),
      py: Math.round('py' in p ? p.py : p.y),
      label: s.location,
      suitability: s.suitability,
    };
  });

  const prompt = `You are an IMPARTIAL AUDITOR reviewing proposed development sites against a satellite image.

The image is ${imageSize.width}×${imageSize.height} pixels. Each proposed site's approximate pixel location is given below.

SITES TO AUDIT:
${markers.map(m => `[${m.i}] pixel (${m.px}, ${m.py}) — "${m.label}" — claimed suitability ${m.suitability}/100`).join('\n')}

For EACH site, look at what is actually visible at that pixel location in the image and report:
- actualLandUse: one of "vacant_land", "building", "road_or_rail", "water", "forest_or_park", "partially_vacant", "out_of_frame", "ambiguous"
- looksVacant: true/false
- auditNote: 1 short sentence describing what you see at that specific spot

Be strict. A rooftop of a residential building is NOT vacant. A road is NOT vacant. A dense grid of small informal structures (slum / chawl) is NOT vacant. A public park or playing field is NOT vacant.
Vacant means: bare earth, cleared ground, empty lots with no structures, or clearly derelict/unused land.
Pixel coordinates can be imprecise — look within ~30 pixels of the given pixel.

Return ONLY this JSON:
{
  "audits": [ { "i": 0, "actualLandUse": "...", "looksVacant": true, "auditNote": "..." } ]
}`;

  try {
    const resp = await generateContentWithFallback(ai, {
      config: { temperature: 0.1 },
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/png', data: imageBase64 } },
          ],
        },
      ],
    });
    const text = resp.text ?? '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { kept: spaces, audits: [] };
    const parsed = JSON.parse(m[0]) as { audits?: AuditResult[] };
    const audits = parsed.audits ?? [];

    const keptIdx = new Set(audits.filter(a => a.looksVacant).map(a => a.i));
    // If audit didn't return entries for some indices, keep them (benefit of the doubt)
    const auditedIdx = new Set(audits.map(a => a.i));
    const kept = spaces.filter((_, i) => keptIdx.has(i) || !auditedIdx.has(i));
    return { kept, audits };
  } catch (error) {
    console.warn('Visual audit failed, skipping:', error);
    return { kept: spaces, audits: [] };
  }
}
