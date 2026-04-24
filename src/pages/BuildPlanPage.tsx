import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, Download, RefreshCcw, Settings2, Sparkles,
} from "lucide-react";

import type {
  BuildPlan, InfraType, PlotContext, Preferences, Scenario,
} from "@/services/buildPlan/types";
import {
  DEFAULT_PREFERENCES, generateBuildPlan,
} from "@/services/buildPlan/planGenerator";
import {
  createPlan, getPlan, updatePlan, type StoredPlan,
} from "@/services/buildPlan/planStore";
import { reverseGeocode } from "@/services/locationContext";
import { fetchNearbyPOIs, type POICategory } from "@/utils/osmPOI";

import PreferencesFlow from "@/components/buildPlan/PreferencesFlow";
import PlanHeader from "@/components/buildPlan/sections/PlanHeader";
import FeasibilitySection from "@/components/buildPlan/sections/FeasibilitySection";
import CostSection from "@/components/buildPlan/sections/CostSection";
import TimelineSection from "@/components/buildPlan/sections/TimelineSection";
import MaterialsSection from "@/components/buildPlan/sections/MaterialsSection";
import MarketSection from "@/components/buildPlan/sections/MarketSection";
import VisualizationSection from "@/components/buildPlan/sections/VisualizationSection";
import RisksSection from "@/components/buildPlan/sections/RisksSection";

// --- Plot inference ---------------------------------------------------------
function inferPlotContext(args: {
  lat: number; lng: number; address: string; infra: InfraType;
}): PlotContext {
  const { lat, lng, address, infra } = args;
  const isIslandCity = lat < 19.04;
  const typicalAreaM2: Record<InfraType, number> = {
    cafe: 350, restaurant: 500, retail: 600, residential: 1800,
    office: 2200, mall: 6000, hotel: 3500, hospital: 4500,
    school: 5500, gym: 900, park: 5000,
  };
  const areaSqM = typicalAreaM2[infra] ?? 1500;
  const roadWidthM = isIslandCity ? 12 : 15;
  return {
    lat, lng, address,
    areaSqM, isIslandCity, roadWidthM,
  };
}

interface LegacyNavState {
  space?: StoredPlan["space"];
  infra?: InfraType;
  searchLocation?: string;
}

export default function BuildPlanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id?: string }>();

  // Legacy: if someone landed on /plan (no id) via navigate() state, promote
  // it into a real saved plan and redirect to /plan/:id so refresh works.
  useEffect(() => {
    if (id) return;
    const nav = (location.state ?? {}) as LegacyNavState;
    if (nav.space && nav.infra) {
      const plan = createPlan({
        space: nav.space,
        infra: nav.infra,
        searchLocation: nav.searchLocation,
      });
      navigate(`/plan/${plan.id}`, { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [id, location.state, navigate]);

  const [stored, setStored] = useState<StoredPlan | null>(() =>
    id ? getPlan(id) : null
  );
  const [pois, setPois] = useState<POICategory[] | undefined>(undefined);
  const [resolvedAddress, setResolvedAddress] = useState<string | undefined>(undefined);

  // If plan id changes or doesn't exist, handle gracefully.
  useEffect(() => {
    if (!id) return;
    const p = getPlan(id);
    setStored(p);
    if (!p) navigate("/", { replace: true });
  }, [id, navigate]);

  // Kick off POI + reverse geocode.
  useEffect(() => {
    if (!stored) return;
    const { lat, lng } = stored.space.coordinates;
    fetchNearbyPOIs(lat, lng, 500).then(setPois).catch(() => setPois([]));
    reverseGeocode(lat, lng).then(addr => addr && setResolvedAddress(addr)).catch(() => {});
  }, [stored?.id]);

  const plot: PlotContext | null = useMemo(() => {
    if (!stored) return null;
    return inferPlotContext({
      lat: stored.space.coordinates.lat,
      lng: stored.space.coordinates.lng,
      address: resolvedAddress || stored.space.location || stored.searchLocation || "Selected plot",
      infra: stored.infra,
    });
  }, [stored, resolvedAddress]);

  const prefs = stored?.preferences;
  const scenario: Scenario = stored?.scenario ?? "base";

  const savePrefs = (p: Preferences) => {
    if (!stored) return;
    setStored(updatePlan(stored.id, { preferences: p }));
  };
  const setScenario = (s: Scenario) => {
    if (!stored) return;
    setStored(updatePlan(stored.id, { scenario: s }));
  };
  const clearPrefs = () => {
    if (!stored) return;
    setStored(updatePlan(stored.id, { preferences: undefined }));
  };

  const plan: BuildPlan | null = useMemo(() => {
    if (!plot || !stored || !prefs) return null;
    return generateBuildPlan({ plot, infra: stored.infra, preferences: prefs, scenario });
  }, [plot, stored?.infra, prefs, scenario]);

  if (!stored) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-30">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to analysis
          </Button>
          {plan && (
            <div className="flex items-center gap-2">
              <ScenarioToggle value={scenario} onChange={setScenario} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/plan/${stored.id}/visualize`)}
              >
                <Sparkles className="h-4 w-4 mr-1" /> Visualize
              </Button>
              <Button variant="outline" size="sm" onClick={clearPrefs}>
                <Settings2 className="h-4 w-4 mr-1" /> Edit preferences
              </Button>
              <Button variant="outline" size="sm" disabled>
                <Download className="h-4 w-4 mr-1" /> Export PDF
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-5xl">
        {!plan ? (
          <div className="py-8">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-semibold">Tell us a bit about your plan</h2>
              <p className="text-muted-foreground mt-1">
                5 quick questions drive the feasibility math and the render.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Plan ID <code className="font-mono bg-muted px-1.5 py-0.5 rounded">{stored.id}</code> · auto-saved
              </p>
            </div>
            <PreferencesFlow
              onComplete={savePrefs}
              onSkip={() => savePrefs(DEFAULT_PREFERENCES)}
              initial={stored.preferences}
            />
          </div>
        ) : (
          <div className="space-y-6">
            <PlanHeader plan={plan} />
            <FeasibilitySection plan={plan} />
            <CostSection plan={plan} />
            <TimelineSection plan={plan} />
            <MaterialsSection plan={plan} />
            <MarketSection plan={plan} pois={pois} />
            <VisualizationSection
              plan={plan}
              planId={stored.id}
              hasImages={(stored.images?.length ?? 0) > 0}
              onOpen={() => navigate(`/plan/${stored.id}/visualize`)}
            />
            <RisksSection plan={plan} />

            <Card>
              <CardContent className="py-4 text-xs text-muted-foreground flex items-start gap-2">
                <RefreshCcw className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  <span className="font-medium text-foreground">Napkin math — not due diligence.</span>{" "}
                  Numbers are indicative bands derived from published Mumbai
                  2026 construction baselines and a simplified DCPR 2034 rule
                  engine. Verify with a licensed architect and RERA-registered
                  legal counsel before any commitment. Plan ID{" "}
                  <code className="font-mono bg-muted px-1 py-0.5 rounded">{stored.id}</code>.
                </span>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

function ScenarioToggle({
  value, onChange,
}: { value: Scenario; onChange: (s: Scenario) => void }) {
  const options: Scenario[] = ["conservative", "base", "optimistic"];
  return (
    <div className="inline-flex rounded-md border bg-card p-0.5">
      {options.map(o => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`text-[11px] px-2.5 py-1 rounded-sm capitalize transition-colors
            ${value === o ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
