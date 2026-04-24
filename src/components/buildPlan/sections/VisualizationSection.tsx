import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Image as ImageIcon, Sparkles } from "lucide-react";
import type { BuildPlan } from "@/services/buildPlan/types";

interface Props {
  plan: BuildPlan;
  planId: string;
  hasImages: boolean;
  onOpen: () => void;
}

export default function VisualizationSection({ plan, hasImages, onOpen }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          What will it look like?
        </CardTitle>
        <Button size="sm" onClick={onOpen}>
          {hasImages ? "Open renders" : "Generate with AI"}
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        <button
          onClick={onOpen}
          className="w-full group relative aspect-[21/9] rounded-lg border bg-gradient-to-br from-primary/10 via-primary/5 to-primary/20 overflow-hidden hover:border-primary/40 transition-colors"
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
            <div className="rounded-full bg-background/70 backdrop-blur px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Powered by Nano Banana Pro
            </div>
            <Sparkles className="h-6 w-6 mb-2 text-primary" />
            <p className="text-base font-semibold">
              {hasImages ? "Your AI renders" : `Visualize your ${plan.preferences.aesthetic} ${plan.infra}`}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              {hasImages
                ? "Open the gallery to review variants, regenerate, or download."
                : `Generate 4 photoreal variants of how a ${plan.envelope.approxFloors}-floor ${plan.infra} could look on this plot.`}
            </p>
            <Badge variant="secondary" className="mt-3">
              {hasImages ? "Continue" : "Start generation"}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Badge>
          </div>
        </button>
      </CardContent>
    </Card>
  );
}
