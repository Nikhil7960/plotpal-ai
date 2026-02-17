import React from "react";

interface ArcGISPropertyLookupIframeProps {
  src: string;
  isLoading?: boolean;
  onLoad?: () => void;
}

export default function ArcGISPropertyLookupIframe({
  src,
  isLoading = false,
  onLoad,
}: ArcGISPropertyLookupIframeProps) {
  return (
    <div className="h-[600px] w-[800px] max-w-full rounded-lg overflow-hidden border relative bg-muted/30">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10 pointer-events-none">
          <span className="text-sm text-muted-foreground">Updating…</span>
        </div>
      )}
      <iframe
        title="ArcGIS Property Lookup"
        src={src}
        className="w-full h-full border-0"
        onLoad={onLoad}
      />
    </div>
  );
}
