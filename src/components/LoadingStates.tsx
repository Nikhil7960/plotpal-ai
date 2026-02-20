import { Card, CardContent } from './ui/card';
import { Skeleton } from './ui/skeleton';

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

export function AnalysisProgress({ stage }: { stage: 'capturing' | 'analyzing' | 'processing' }) {
  const stages = {
    capturing: { text: 'Capturing map screenshot...', progress: 33 },
    analyzing: { text: 'AI is analyzing the image...', progress: 66 },
    processing: { text: 'Processing results and finding POIs...', progress: 90 },
  };

  const current = stages[stage];

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
              <p className="text-sm text-muted-foreground">This may take a few moments...</p>
            </div>
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
