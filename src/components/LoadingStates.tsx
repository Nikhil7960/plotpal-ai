import { Card, CardContent } from './ui/card';
import { Skeleton } from './ui/skeleton';

export type AnalysisStage =
  | 'capturing'
  | 'context'
  | 'analyzing'
  | 'filtering'
  | 'validating'
  | 'processing';

export function MapSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="h-[600px] bg-muted animate-pulse flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-full bg-muted-foreground/20 animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    </Card>
  );
}

export function ResultsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Skeleton className="h-12 w-16" />
            </div>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const STAGE_CONFIG: Record<AnalysisStage, { text: string; detail: string; progress: number }> = {
  capturing: {
    text: 'Capturing map screenshot...',
    detail: 'Taking a high-resolution snapshot of the current view',
    progress: 10,
  },
  context: {
    text: 'Gathering location context...',
    detail: 'Fetching land use data, water bodies, forests, and protected areas from OpenStreetMap',
    progress: 25,
  },
  analyzing: {
    text: 'AI is analyzing the image...',
    detail: 'Gemini is identifying potential vacant spaces using satellite imagery and ground truth data',
    progress: 45,
  },
  filtering: {
    text: 'Verifying with Google Search...',
    detail: 'Cross-referencing locations against web data for ownership, zoning, and restrictions',
    progress: 65,
  },
  validating: {
    text: 'Running hard validation checks...',
    detail: 'Programmatically verifying each coordinate against OpenStreetMap zone data',
    progress: 82,
  },
  processing: {
    text: 'Finalizing results...',
    detail: 'Processing validated results and fetching nearby amenities',
    progress: 95,
  },
};

const STAGE_ORDER: AnalysisStage[] = ['capturing', 'context', 'analyzing', 'filtering', 'validating', 'processing'];

export function AnalysisProgress({ stage }: { stage: AnalysisStage }) {
  const current = STAGE_CONFIG[stage];
  const currentIndex = STAGE_ORDER.indexOf(stage);

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{current.text}</p>
              <p className="text-sm text-muted-foreground">{current.detail}</p>
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-1">
            {STAGE_ORDER.map((s, idx) => {
              const isCompleted = idx < currentIndex;
              const isActive = idx === currentIndex;
              return (
                <div key={s} className="flex-1 flex items-center gap-1">
                  <div
                    className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                      isCompleted
                        ? 'bg-primary'
                        : isActive
                        ? 'bg-primary/60 animate-pulse'
                        : 'bg-muted'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-500 ease-out"
              style={{ width: `${current.progress}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
