import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  ArrowLeft, ArrowRight, Gauge, Layers3, Wallet, Calendar, Palette, Check,
} from "lucide-react";
import type {
  Ambition, Aesthetic, Preferences, Timeline, UseMix,
} from "@/services/buildPlan/types";
import { DEFAULT_PREFERENCES } from "@/services/buildPlan/planGenerator";
import { cn } from "@/lib/utils";

interface PreferencesFlowProps {
  onComplete: (prefs: Preferences) => void;
  onSkip?: () => void;
  initial?: Partial<Preferences>;
}

const AMBITIONS: Array<{ key: Ambition; title: string; sub: string }> = [
  { key: "modest", title: "Modest", sub: "Value-engineered · minimal frills" },
  { key: "standard", title: "Standard", sub: "Mumbai mid-market baseline" },
  { key: "premium", title: "Premium", sub: "Imported finishes · amenities" },
  { key: "landmark", title: "Landmark", sub: "Architectural signature · bespoke" },
];

const TIMELINES: Array<{ key: Timeline; title: string; sub: string }> = [
  { key: "fast", title: "Move fast", sub: "Buy premium FSI, overlap approvals" },
  { key: "balanced", title: "Balanced", sub: "Typical sequencing for Mumbai" },
  { key: "valueMax", title: "Value-max", sub: "Wait for TDR; minimise premium cost" },
];

const AESTHETICS: Array<{ key: Aesthetic; title: string; sub: string }> = [
  { key: "modern", title: "Modern", sub: "Glass · clean lines" },
  { key: "artDeco", title: "Art Deco", sub: "South Mumbai heritage" },
  { key: "biophilic", title: "Biophilic", sub: "Green, planted facades" },
  { key: "industrial", title: "Industrial", sub: "Concrete · steel · raw" },
  { key: "vernacular", title: "Vernacular", sub: "Local materials · context" },
  { key: "luxury", title: "Luxury", sub: "Stone · warm wood · curated" },
];

export default function PreferencesFlow({ onComplete, onSkip, initial }: PreferencesFlowProps) {
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<Preferences>({
    ...DEFAULT_PREFERENCES, ...initial,
  });
  const totalSteps = 5;

  const next = () => setStep(s => Math.min(totalSteps, s + 1));
  const prev = () => setStep(s => Math.max(0, s - 1));

  const update = (patch: Partial<Preferences>) => setPrefs(p => ({ ...p, ...patch }));
  const updateMix = (patch: Partial<UseMix>) => {
    setPrefs(p => ({ ...p, useMix: { ...p.useMix, ...patch } }));
  };

  // Normalize mix to sum to 1 on commit.
  const commit = () => {
    const m = prefs.useMix;
    const sum = m.residential + m.retail + m.office + m.amenity;
    const normalized = sum > 0
      ? {
          residential: m.residential / sum,
          retail: m.retail / sum,
          office: m.office / sum,
          amenity: m.amenity / sum,
        }
      : { residential: 1, retail: 0, office: 0, amenity: 0 };
    onComplete({ ...prefs, useMix: normalized });
  };

  return (
    <Card className="max-w-2xl mx-auto border-2">
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className={cn(
                "h-1.5 w-10 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-muted"
              )} />
            ))}
          </div>
          {onSkip && (
            <Button variant="ghost" size="sm" onClick={onSkip}>Skip</Button>
          )}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <header>
              <div className="flex items-center gap-2 mb-1">
                <Gauge className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Ambition</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Drives finish grade, FSI utilisation, and the approvals you'll pay for.
              </p>
            </header>
            <div className="grid grid-cols-2 gap-2">
              {AMBITIONS.map(a => (
                <button
                  key={a.key}
                  onClick={() => update({ ambition: a.key })}
                  className={cn(
                    "text-left rounded-lg border-2 p-3 transition-colors",
                    prefs.ambition === a.key
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{a.title}</span>
                    {prefs.ambition === a.key && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{a.sub}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <header>
              <div className="flex items-center gap-2 mb-1">
                <Layers3 className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Use mix</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                How should the built-up area be allocated? Ignore if you want a single-use build.
              </p>
            </header>
            <MixSlider label="Residential" value={prefs.useMix.residential}
              onChange={v => updateMix({ residential: v })} />
            <MixSlider label="Retail" value={prefs.useMix.retail}
              onChange={v => updateMix({ retail: v })} />
            <MixSlider label="Office" value={prefs.useMix.office}
              onChange={v => updateMix({ office: v })} />
            <MixSlider label="Amenity / common" value={prefs.useMix.amenity}
              onChange={v => updateMix({ amenity: v })} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <header>
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Budget anchor</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Optional. Leave blank to see the cost we estimate.
              </p>
            </header>
            <div className="space-y-2">
              <Label htmlFor="budget">Target budget (₹ in Cr)</Label>
              <Input
                id="budget"
                type="number"
                inputMode="decimal"
                placeholder="e.g., 25"
                value={prefs.budgetCapINR ? (prefs.budgetCapINR / 100).toString() : ""}
                onChange={e => {
                  const cr = parseFloat(e.target.value);
                  update({
                    budgetCapINR: isNaN(cr) ? undefined : cr * 100, // store in lakh
                  });
                }}
              />
              <p className="text-xs text-muted-foreground">
                If your estimate comes in over this, we'll flag it.
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <header>
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Timeline</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Affects whether we assume premium FSI purchase or waiting for TDR.
              </p>
            </header>
            <div className="grid grid-cols-1 gap-2">
              {TIMELINES.map(t => (
                <button
                  key={t.key}
                  onClick={() => update({ timeline: t.key })}
                  className={cn(
                    "text-left rounded-lg border-2 p-3 transition-colors",
                    prefs.timeline === t.key
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{t.title}</span>
                    {prefs.timeline === t.key && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{t.sub}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <header>
              <div className="flex items-center gap-2 mb-1">
                <Palette className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Aesthetic direction</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Seeds the AI-rendered after-image. You can try all variants later.
              </p>
            </header>
            <div className="grid grid-cols-2 gap-2">
              {AESTHETICS.map(a => (
                <button
                  key={a.key}
                  onClick={() => update({ aesthetic: a.key })}
                  className={cn(
                    "text-left rounded-lg border-2 p-3 transition-colors",
                    prefs.aesthetic === a.key
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{a.title}</span>
                    {prefs.aesthetic === a.key && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{a.sub}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={prev} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < totalSteps - 1 ? (
            <Button onClick={next}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={commit}>
              Generate plan <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MixSlider({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-sm">
        <Label>{label}</Label>
        <span className="text-muted-foreground">{Math.round(value * 100)}%</span>
      </div>
      <Slider
        value={[value * 100]}
        onValueChange={v => onChange(v[0] / 100)}
        min={0} max={100} step={5}
      />
    </div>
  );
}
