import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Download, Loader2, RefreshCcw, Sparkles, Wand2,
  AlertTriangle, Eye, ImageOff, Info, ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import {
  addImageToPlan, getPlan, replaceImagesOnPlan, setBeforeImage,
  type BeforeImageStored, type GeneratedImage, type StoredPlan,
} from "@/services/buildPlan/planStore";
import {
  NANO_BANANA_PRO_MODEL, generateRender,
} from "@/services/buildPlan/imageGen";
import { fetchBeforeImage } from "@/services/buildPlan/streetView";
import { generateBuildPlan } from "@/services/buildPlan/planGenerator";
import type { BuildPlan, PlotContext } from "@/services/buildPlan/types";

function inferPlotContext(sp: StoredPlan): PlotContext {
  const { lat, lng } = sp.space.coordinates;
  const isIslandCity = lat < 19.04;
  const typicalAreaM2 = {
    cafe: 350, restaurant: 500, retail: 600, residential: 1800,
    office: 2200, mall: 6000, hotel: 3500, hospital: 4500,
    school: 5500, gym: 900, park: 5000,
  } as Record<string, number>;
  return {
    lat, lng, address: sp.space.location,
    areaSqM: typicalAreaM2[sp.infra] ?? 1500,
    isIslandCity,
    roadWidthM: isIslandCity ? 12 : 15,
  };
}

type BeforeStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; image: BeforeImageStored }
  | { kind: "unavailable" };

type AfterStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

export default function PlanVisualizePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [stored, setStored] = useState<StoredPlan | null>(() =>
    id ? getPlan(id) : null
  );
  useEffect(() => {
    if (!id) { navigate("/", { replace: true }); return; }
    const p = getPlan(id);
    if (!p) { navigate("/", { replace: true }); return; }
    setStored(p);
  }, [id, navigate]);

  const plan: BuildPlan | null = useMemo(() => {
    if (!stored?.preferences) return null;
    const plot = inferPlotContext(stored);
    return generateBuildPlan({
      plot,
      infra: stored.infra,
      preferences: stored.preferences,
      scenario: stored.scenario ?? "base",
    });
  }, [stored]);

  const afterImage: GeneratedImage | undefined =
    stored?.images && stored.images.length > 0
      ? stored.images[stored.images.length - 1]
      : undefined;

  const [beforeStatus, setBeforeStatus] = useState<BeforeStatus>(() => {
    if (stored?.beforeImage) return { kind: "ready", image: stored.beforeImage };
    return { kind: "idle" };
  });
  const [afterStatus, setAfterStatus] = useState<AfterStatus>(() =>
    afterImage ? { kind: "ready" } : { kind: "idle" }
  );

  // Auto-fetch the "before" image once per plan (only if we don't have it yet).
  // NOTE: do not depend on `beforeStatus` here — setting loading state would
  // otherwise re-trigger the effect and its cleanup would cancel the in-flight fetch.
  useEffect(() => {
    if (!stored) return;
    if (stored.beforeImage) {
      setBeforeStatus({ kind: "ready", image: stored.beforeImage });
      return;
    }
    let cancelled = false;
    setBeforeStatus({ kind: "loading" });
    (async () => {
      const { lat, lng } = stored.space.coordinates;
      const res = await fetchBeforeImage(lat, lng);
      if (cancelled) return;
      if (!res) {
        setBeforeStatus({ kind: "unavailable" });
        return;
      }
      const b: BeforeImageStored = {
        base64: res.base64, mime: res.mime, source: res.source,
        note: res.note, fallbackReason: res.fallbackReason,
        createdAt: Date.now(),
      };
      const updated = setBeforeImage(stored.id, b);
      if (updated) setStored(updated);
      setBeforeStatus({ kind: "ready", image: b });
    })();
    return () => { cancelled = true; };
  }, [stored?.id]);

  if (!stored) return null;
  if (!plan) {
    return (
      <div className="min-h-screen grid place-items-center p-8 text-center">
        <div>
          <p className="text-sm text-muted-foreground">
            Finish the preferences step first.
          </p>
          <Button className="mt-3" onClick={() => navigate(`/plan/${stored.id}`)}>
            Back to build plan
          </Button>
        </div>
      </div>
    );
  }

  const hasApiKey = !!(import.meta as any).env?.VITE_GEMINI_API_KEY;

  const runRender = async () => {
    if (!plan) return;
    setAfterStatus({ kind: "loading" });
    try {
      const reference = beforeStatus.kind === "ready"
        ? {
            base64: beforeStatus.image.base64,
            mime: beforeStatus.image.mime,
            source: beforeStatus.image.source,
          }
        : null;
      const res = await generateRender({ plan, reference });
      const image: GeneratedImage = {
        id: `render-${Date.now().toString(36)}`,
        aesthetic: plan.preferences.aesthetic,
        prompt: res.prompt,
        base64: res.base64,
        mime: res.mime,
        createdAt: Date.now(),
        referenceSource: res.referenceSource,
      };
      // Replace (not append) — we only want one current render.
      const updated = replaceImagesOnPlan(stored.id, [image]);
      if (updated) setStored(updated);
      setAfterStatus({ kind: "ready" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      setAfterStatus({ kind: "error", message });
      toast({
        title: "Visualisation failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const retryBefore = async () => {
    setBeforeStatus({ kind: "loading" });
    const { lat, lng } = stored.space.coordinates;
    const res = await fetchBeforeImage(lat, lng);
    if (!res) {
      setBeforeStatus({ kind: "unavailable" });
      return;
    }
    const b: BeforeImageStored = {
      base64: res.base64, mime: res.mime, source: res.source,
      note: res.note, fallbackReason: res.fallbackReason,
      createdAt: Date.now(),
    };
    const updated = setBeforeImage(stored.id, b);
    if (updated) setStored(updated);
    setBeforeStatus({ kind: "ready", image: b });
  };

  const clearRender = () => {
    const updated = replaceImagesOnPlan(stored.id, []);
    if (updated) setStored(updated);
    setAfterStatus({ kind: "idle" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-30">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/plan/${stored.id}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to build plan
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              Plan <code className="font-mono">{stored.id}</code>
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Before &amp; after
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Left: the plot as it looks today. Right: a photoreal daytime concept
              of your {plan.preferences.aesthetic} {plan.infra}, generated by
              Nano Banana Pro ({NANO_BANANA_PRO_MODEL}).
            </p>
          </div>
          <div className="flex items-center gap-2">
            {afterStatus.kind === "ready" && (
              <Button variant="outline" size="sm" onClick={clearRender}>
                Clear render
              </Button>
            )}
            <Button
              onClick={runRender}
              disabled={afterStatus.kind === "loading" || !hasApiKey}
            >
              {afterStatus.kind === "loading" ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generating…</>
              ) : afterStatus.kind === "ready" ? (
                <><RefreshCcw className="h-4 w-4 mr-1" /> Regenerate</>
              ) : (
                <><Wand2 className="h-4 w-4 mr-1" /> Generate visualisation</>
              )}
            </Button>
          </div>
        </div>

        {!hasApiKey && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-4 flex items-start gap-3 text-sm">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-300">
                  Gemini API key not configured
                </p>
                <p className="text-amber-700/80 dark:text-amber-300/80">
                  Add <code className="font-mono bg-muted px-1 py-0.5 rounded">VITE_GEMINI_API_KEY</code>{" "}
                  to your <code className="font-mono bg-muted px-1 py-0.5 rounded">.env</code>{" "}
                  and restart the dev server.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {beforeStatus.kind === "ready" && beforeStatus.image.source === "satellite" && (
          beforeStatus.image.fallbackReason === "no-google-key" ? (
            <Card className="border-blue-500/40 bg-blue-500/5">
              <CardContent className="p-4 flex items-start gap-3 text-sm">
                <Info className="h-5 w-5 text-blue-600 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium text-blue-700 dark:text-blue-300">
                    This is an aerial view, not Street View.
                  </p>
                  <p className="text-blue-800/80 dark:text-blue-300/80">
                    Ground-level Street View needs a Google Maps API key. Add{" "}
                    <code className="font-mono bg-muted px-1 py-0.5 rounded">VITE_GOOGLE_MAPS_API_KEY</code>{" "}
                    to your <code className="font-mono bg-muted px-1 py-0.5 rounded">.env</code>{" "}
                    (Street View Static API enabled in the Google Cloud project) and reload.
                  </p>
                  <a
                    href="https://developers.google.com/maps/documentation/streetview/overview"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-300 underline underline-offset-2"
                  >
                    Street View Static API docs <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          ) : beforeStatus.image.fallbackReason === "no-coverage" ? (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="p-4 flex items-start gap-3 text-sm">
                <Info className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <p className="font-medium text-amber-700 dark:text-amber-300">
                    No Street View coverage at this exact location.
                  </p>
                  <p className="text-amber-800/80 dark:text-amber-300/80">
                    Google doesn't have ground-level imagery within 80m of this point
                    — common for interior plots off the main road. We're showing the
                    aerial view instead; the render still uses it as context.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null
        )}

        {/* Before / After pair */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BeforeCard
            status={beforeStatus}
            onRetry={retryBefore}
            address={stored.space.location}
          />
          <AfterCard
            status={afterStatus}
            image={afterImage}
            beforeStatus={beforeStatus}
            onGenerate={runRender}
            disabled={!hasApiKey || beforeStatus.kind === "loading"}
          />
        </div>

        {/* Prompt drawer */}
        {afterImage && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Prompt used</span>
                <Button
                  size="sm" variant="ghost"
                  onClick={() => navigator.clipboard?.writeText(afterImage.prompt)}
                >
                  Copy
                </Button>
              </div>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/40 rounded-md p-3 max-h-60 overflow-auto">
                {afterImage.prompt}
              </pre>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="py-4 text-xs text-muted-foreground">
            AI-generated concept — not an architectural drawing. Massing and
            details will vary between runs and may violate local code; always
            validate with a licensed architect. Renders stored locally under
            plan <code className="font-mono bg-muted px-1 py-0.5 rounded">{stored.id}</code>.
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// --- Cards ------------------------------------------------------------------

function BeforeCard({
  status, onRetry, address,
}: { status: BeforeStatus; onRetry: () => void; address: string }) {
  return (
    <Card className="overflow-hidden">
      <div className="px-3 py-2 border-b flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" />
          <span className="font-medium">Before · today</span>
        </div>
        {status.kind === "ready" && (
          <Badge variant="outline" className="text-[10px]">
            {status.image.source === "streetview" ? "Street View" : "Satellite"}
          </Badge>
        )}
      </div>
      <div className="aspect-[16/10] bg-muted/40 relative">
        {status.kind === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Fetching ground imagery…
          </div>
        )}
        {status.kind === "ready" && (
          <img
            src={`data:${status.image.mime};base64,${status.image.base64}`}
            alt="Plot today"
            className="w-full h-full object-cover"
          />
        )}
        {status.kind === "unavailable" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 gap-1.5 text-xs text-muted-foreground">
            <ImageOff className="h-5 w-5" />
            <div>Ground imagery unavailable for this plot.</div>
            <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>
          </div>
        )}
      </div>
      <div className="p-3 text-xs text-muted-foreground space-y-0.5">
        <div className="truncate" title={address}>{address}</div>
        {status.kind === "ready" && status.image.note && (
          <div className="text-amber-600 dark:text-amber-400">{status.image.note}</div>
        )}
      </div>
    </Card>
  );
}

function AfterCard({
  status, image, beforeStatus, onGenerate, disabled,
}: {
  status: AfterStatus;
  image?: GeneratedImage;
  beforeStatus: BeforeStatus;
  onGenerate: () => void;
  disabled: boolean;
}) {
  const idleCopy =
    beforeStatus.kind === "loading"
      ? "Waiting for the ground imagery to load, then we can drop in your building."
      : beforeStatus.kind === "ready"
        ? beforeStatus.image.source === "streetview"
          ? "We'll keep the Street View surroundings and drop in your building."
          : "We'll use the aerial view as context and render a street-level concept."
        : "Ground imagery isn't available, but we can still generate a concept.";
  return (
    <Card className="overflow-hidden">
      <div className="px-3 py-2 border-b flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="font-medium">After · AI render</span>
        </div>
        {image?.referenceSource && (
          <Badge variant="outline" className="text-[10px] capitalize">
            from {image.referenceSource}
          </Badge>
        )}
      </div>
      <div className="aspect-[16/10] relative bg-gradient-to-br from-primary/10 via-background to-primary/20">
        {status.kind === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Rendering with Nano Banana Pro…
            <p className="text-[10px] opacity-80">This usually takes 10–30 seconds.</p>
          </div>
        )}
        {status.kind === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-red-600 dark:text-red-400 text-center px-6">
            <AlertTriangle className="h-5 w-5" />
            <div>{status.message}</div>
            <Button size="sm" variant="outline" onClick={onGenerate} disabled={disabled}>
              Retry
            </Button>
          </div>
        )}
        {status.kind === "ready" && image && (
          <img
            src={`data:${image.mime};base64,${image.base64}`}
            alt="AI render"
            className="w-full h-full object-cover"
          />
        )}
        {status.kind === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
            <Sparkles className="h-6 w-6 text-primary" />
            <p className="text-sm font-medium">Ready to visualise</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              {idleCopy}
            </p>
            <Button size="sm" className="mt-1" onClick={onGenerate} disabled={disabled}>
              <Wand2 className="h-4 w-4 mr-1" /> Generate
            </Button>
          </div>
        )}
      </div>
      <div className="p-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {image
            ? `Generated ${new Date(image.createdAt).toLocaleString()}`
            : "No render yet"}
        </span>
        {image && (
          <Button size="sm" variant="outline" onClick={() => downloadImage(image)}>
            <Download className="h-4 w-4 mr-1" /> Download
          </Button>
        )}
      </div>
    </Card>
  );
}

function downloadImage(img: GeneratedImage) {
  const link = document.createElement("a");
  link.href = `data:${img.mime};base64,${img.base64}`;
  link.download = `plotpal-render-${img.id}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
