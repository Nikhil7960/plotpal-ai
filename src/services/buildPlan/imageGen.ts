// Nano Banana Pro (Gemini 3 Pro Image) — architectural visualisation for
// a plot + infra combination. Takes a "before" reference image (Street View
// or satellite) and produces a single photoreal daytime render, preserving
// the surroundings.

import { GoogleGenAI, Modality } from "@google/genai";
import type {
  Aesthetic, BuildPlan, InfraType,
} from "./types";
import type { BeforeImage, BeforeImageSource } from "./streetView";

export const NANO_BANANA_PRO_MODEL = "gemini-3-pro-image-preview";
export const NANO_BANANA_FALLBACK_MODEL = "gemini-2.5-flash-image";

export interface GenerateRenderInput {
  plan: BuildPlan;
  aesthetic?: Aesthetic;           // optional override of plan.preferences.aesthetic
  reference?: BeforeImage | null;  // "before" image to condition on
}

export interface GeneratedImageResult {
  base64: string;
  mime: string;
  prompt: string;
  model: string;
  referenceSource?: BeforeImageSource;
}

const INFRA_HINTS: Record<InfraType, string> = {
  residential: "a mid-rise residential tower with balconies and landscaped podium",
  office: "a corporate office building with glass curtain walls and a drop-off plaza",
  retail: "a ground-level retail block with wide shopfronts and clear signage",
  mall: "a multi-level shopping mall with wide entrances, large glazing, and landscaped parking",
  cafe: "a boutique cafe with outdoor seating, planters, and warm ambient lighting",
  restaurant: "a restaurant with a welcoming entry canopy and street-side seating",
  hotel: "a boutique hotel with a porte-cochere, signage, and softly lit facade",
  hospital: "a hospital with a clear emergency entry, ambulance bay, and calm institutional facade",
  school: "a school with playgrounds, covered walkways, and a clearly identified entrance",
  gym: "a modern fitness centre with large glazing revealing training floors",
  park: "a public park with walking paths, planted beds, seating, and shade trees",
};

const AESTHETIC_HINTS: Record<Aesthetic, string> = {
  modern: "modern architecture: clean horizontal lines, generous glazing, exposed concrete and aluminium fins",
  artDeco: "Mumbai art deco: curved balconies, horizontal banding, pastel plaster, geometric grilles",
  biophilic: "biophilic design: vertical green walls, generous planters, wood screens and natural materials",
  industrial: "industrial aesthetic: exposed concrete, metal cladding, steel structure visible",
  vernacular: "Mumbai vernacular: jaali screens, shaded verandahs, local stone plinths",
  luxury: "luxury: stone cladding, warm timber, bronze accents, curated landscape, restrained signage",
};

export function buildPrompt(input: GenerateRenderInput): string {
  const { plan } = input;
  const aesthetic = input.aesthetic ?? plan.preferences.aesthetic;
  const { infra, plot, envelope, preferences } = plan;

  const floors = envelope.approxFloors;
  const heightM = envelope.heightEstimateM;
  const buaM2 = envelope.buildableAreaSqM;
  const ambition = preferences.ambition;

  const scene = INFRA_HINTS[infra];
  const style = AESTHETIC_HINTS[aesthetic];
  const roadText = `fronting a ${plot.roadWidthM} metre wide road`;
  const cityBand = plot.isIslandCity ? "Mumbai Island City" : "Mumbai suburbs";

  const refInstruction = input.reference
    ? input.reference.source === "streetview"
      ? `
IMPORTANT — use the attached street-view photograph as the ground truth for
the surrounding context: the neighbouring buildings, trees, overhead wires,
road, sky, and any people/vehicles must remain recognisably the same. ONLY
replace the empty/vacant plot in the centre of the frame with the new
building described below. Match the camera angle, perspective, and natural
daylight of the reference.`
      : `
The attached image is an aerial view of the plot. Use it to understand the
plot's position and size relative to neighbouring buildings and streets, but
render the output from a pedestrian eye-level street view of the same
location.`
    : "";

  return `
Architectural visualisation, bright natural daytime, eye-level street view
of a newly constructed ${scene} in ${cityBand}, ${roadText}, Mumbai, India.
${refInstruction}

Scale: ${floors} storey${floors === 1 ? "" : "s"} (≈ ${heightM}m tall),
about ${Math.round(buaM2).toLocaleString()} m² built-up area on a plot of
${Math.round(plot.areaSqM).toLocaleString()} m². Grade: ${ambition}.

Style: ${style}.

Context to respect:
- Dense Mumbai fabric — neighbouring buildings, street trees, scooters,
  autorickshaws, pedestrians remain visible.
- Bright afternoon daylight, clear blue sky with a few soft clouds.
- Follow DCPR 2034 setbacks: leave a small front setback with landscaping,
  do NOT build to the street edge.
${plot.inAirportFunnel ? "- Airport funnel: keep building height modest." : ""}
${plot.inHeritagePrecinct ? "- Heritage precinct: match heritage facade proportions." : ""}
${plot.inCRZ ? "- CRZ zone: compact footprint, low massing." : ""}

Photography:
- Photoreal, full-colour, cinematic but believable.
- No placeholder text, no fake logos, no watermarks.
- No architectural drawings, no line-art — this is a realistic photograph.

Composition:
- The new building occupies the central 60% of the frame.
- Keep the street, sidewalk, and surrounding urban fabric clearly visible
  so the user can compare with the "before" reference.
`.trim().replace(/\n{3,}/g, "\n\n");
}

function getApiKey(): string {
  const k = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (!k) throw new Error("VITE_GEMINI_API_KEY missing — add it to your .env");
  return k;
}

/**
 * Generate a single daytime render. If a reference image is provided, it is
 * passed to the model as an inline image part so the surroundings are
 * preserved.
 */
export async function generateRender(input: GenerateRenderInput): Promise<GeneratedImageResult> {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });

  const prompt = buildPrompt(input);
  const parts: any[] = [];
  if (input.reference) {
    parts.push({
      inlineData: {
        data: input.reference.base64,
        mimeType: input.reference.mime,
      },
    });
  }
  parts.push({ text: prompt });

  const modelsToTry = [NANO_BANANA_PRO_MODEL, NANO_BANANA_FALLBACK_MODEL];
  let lastError: unknown = null;
  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });
      const candidate = response.candidates?.[0];
      const imgPart = candidate?.content?.parts?.find((p: any) => p.inlineData?.data);
      if (!imgPart?.inlineData?.data) {
        throw new Error("Model returned no image data");
      }
      return {
        base64: imgPart.inlineData.data as string,
        mime: imgPart.inlineData.mimeType ?? "image/png",
        prompt,
        model,
        referenceSource: input.reference?.source,
      };
    } catch (err) {
      lastError = err;
      console.warn(`Image gen failed on ${model}:`, err);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Image generation failed on all models");
}
