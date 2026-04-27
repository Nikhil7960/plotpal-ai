import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, Ruler } from "lucide-react";
import type { Approval, BuildPlan } from "@/services/buildPlan/types";
import EnvelopeDiagram from "../visuals/EnvelopeDiagram";

export default function FeasibilitySection({ plan }: { plan: BuildPlan }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ruler className="h-5 w-5" />
          Can I build here?
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Envelope */}
        <div className="space-y-3">
          <div className="rounded-lg border p-3">
            <EnvelopeDiagram plot={plan.plot} envelope={plan.envelope} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Stat label="Basic FSI" value={plan.envelope.basicFSI.toFixed(2)} />
            <Stat label="Premium FSI avail." value={plan.envelope.premiumFSIAvailable.toFixed(2)} />
            <Stat label="TDR avail." value={plan.envelope.tdrAvailable.toFixed(2)} />
            <Stat label="Max permissible" value={plan.envelope.maxPermissibleFSI.toFixed(2)} />
            <Stat label="Setbacks (F/S/R)" value={
              `${plan.envelope.setbacks.front}/${plan.envelope.setbacks.side}/${plan.envelope.setbacks.rear}m`
            } />
            <Stat label="Est. floors" value={`${plan.envelope.approxFloors}`} />
          </div>
          {plan.envelope.notes.length > 0 && (
            <ul className="text-xs text-muted-foreground space-y-1">
              {plan.envelope.notes.map((n, i) => (
                <li key={i}>• {n}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Approvals */}
        <div>
          <p className="text-sm font-medium mb-2">Approvals & permits</p>
          <div className="space-y-2">
            {plan.approvals.map(a => <ApprovalCard key={a.key} approval={a} />)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium tabular-nums">{value}</div>
    </div>
  );
}

function ApprovalCard({ approval }: { approval: Approval }) {
  const interactive = !!approval.applicationUrl;
  const Wrapper: React.ElementType = interactive ? "a" : "div";
  const wrapperProps = interactive
    ? {
        href: approval.applicationUrl,
        target: "_blank",
        rel: "noopener noreferrer",
        "aria-label": `Open ${approval.name} application portal`,
      }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={[
        "block rounded-md border p-2.5 bg-card text-sm",
        interactive
          ? "cursor-pointer transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{approval.name}</span>
            {approval.required ? (
              <Badge variant="secondary" className="text-[10px]">Required</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">Conditional</Badge>
            )}
            {interactive && (
              <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
          </div>
          <div className="text-xs text-muted-foreground">{approval.authority}</div>
        </div>
        <div className="flex items-center gap-1 text-xs whitespace-nowrap text-muted-foreground">
          <Clock className="h-3 w-3" />
          {approval.typicalTatMonths.low}–{approval.typicalTatMonths.high} mo
        </div>
      </div>
      {approval.triggerReason && (
        <div className="mt-1 text-xs flex items-start gap-1 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{approval.triggerReason}</span>
        </div>
      )}
      {approval.gotcha && (
        <div className="mt-1 text-xs text-muted-foreground">
          <span className="text-foreground">Gotcha:</span> {approval.gotcha}
        </div>
      )}
      {interactive && (
        <div className="mt-1 text-[11px] text-primary/80">
          Tap to open application portal →
        </div>
      )}
    </Wrapper>
  );
}
