import { Activity, ShieldAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/feedback"
import type { ClaimStatus, InvestigationStatus, ReviewPriority } from "@/lib/types"

export function StatusBadge({ status }: { status: ClaimStatus | InvestigationStatus | string }) {
  const variant =
    status === "Paid" || status === "Resolved" || status === "Approved"
      ? "success"
      : status === "Rejected"
        ? "danger"
        : status === "Under Review" || status === "Additional Information Required"
          ? "warning"
          : "info"
  return <Badge variant={variant}>{status}</Badge>
}

export function RiskBadge({ priority, score }: { priority: ReviewPriority | null; score?: number | null }) {
  if (!priority) return <Badge variant="neutral">Unassessed</Badge>
  const variant = priority === "High" ? "danger" : priority === "Medium" ? "warning" : "success"
  return (
    <Badge variant={variant}>
      {priority}
      {score !== undefined && score !== null ? <span className="num opacity-75">{Math.round(score)}</span> : null}
    </Badge>
  )
}

export function AnomalyIndicator({ value }: { value: boolean | null | undefined }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
          <ShieldAlert className="h-3.5 w-3.5" /> Flagged
        </span>
      </TooltipTrigger>
      <TooltipContent>Statistical outlier only — not evidence of fraud</TooltipContent>
    </Tooltip>
  )
}

export function LiveIndicator({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
      <Activity className={`h-3.5 w-3.5 ${active ? "text-primary" : ""}`} />
      {active ? "Auto-refresh on" : "Auto-refresh off"}
    </span>
  )
}
