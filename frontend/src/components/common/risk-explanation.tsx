import { Info, ShieldCheck, ShieldAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { RiskBadge } from "@/components/common/badges"
import type { RiskAssessment } from "@/lib/types"

interface RiskExplanationProps {
  assessment: RiskAssessment
  thresholds?: { high: number; medium: number; anomaly_points: number }
}

export function RiskExplanation({ assessment, thresholds }: RiskExplanationProps) {
  if (assessment.assessed === false) {
    return (
      <div className="space-y-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Rule-based risk score</p>
          <p className="mt-2 text-lg font-semibold text-foreground">Not assessed yet</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Re-run assessment to compute and store the score, triggered indicators and statistical anomaly result.
          </p>
        </Card>
        <p className="flex items-start gap-2 text-2xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {assessment.disclaimer}
        </p>
      </div>
    )
  }

  const total = assessment.risk_indicators.reduce((sum, indicator) => sum + indicator.points, 0)
  const threshold = thresholds?.high ?? 70
  const band = thresholds ? `${thresholds.medium}–${thresholds.high}` : "configured"
  const reached = assessment.risk_score >= threshold

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Rule-based risk score</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="num text-3xl font-semibold tracking-tight">{Math.round(assessment.risk_score)}</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          </div>
          <RiskBadge priority={assessment.review_priority} />
        </div>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded bg-muted">
          <div className="h-full rounded bg-primary" style={{ width: `${Math.min(100, assessment.risk_score)}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={reached ? "danger" : "neutral"}>
            {reached ? `Reached high threshold (${threshold})` : `Below high threshold (${threshold})`}
          </Badge>
          <span>
            {total} indicator points contributed; medium band begins at {thresholds?.medium ?? 40}.
          </span>
        </div>
        <p className="mt-3 text-2xs leading-relaxed text-muted-foreground">
          The score is the capped sum of triggered indicators used to prioritise manual review. It is not a fraud
          probability and never automatically approves or rejects a claim. Review band: {band}.
        </p>
      </Card>

      <Card>
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Triggered indicators</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Each indicator shows its rule, points and evidence.</p>
        </div>
        {assessment.risk_indicators.length ? (
          <div className="divide-y divide-border">
            {assessment.risk_indicators.map((indicator) => (
              <div key={indicator.code} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-sm font-medium text-foreground">{indicator.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{indicator.explanation}</p>
                  <p className="mt-1 font-mono text-2xs text-muted-foreground/80">{indicator.code}</p>
                </div>
                <div className="num text-sm font-semibold text-foreground">+{indicator.points}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-6 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            No rule indicators were triggered for this claim.
          </div>
        )}
      </Card>

      <Card className="flex items-start gap-3 p-4">
        {assessment.is_anomaly ? (
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        ) : (
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        )}
        <div>
          <p className="text-sm font-medium">Statistical model: {assessment.is_anomaly ? "anomaly flagged" : "no anomaly"}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            The Isolation Forest result is stored separately from the rule score. An outlier is an unusual combination
            of recorded fields, not evidence of fraud. {thresholds ? `It adds ${thresholds.anomaly_points} points to the rule score when flagged.` : ""}
          </p>
        </div>
      </Card>

      <p className="flex items-start gap-2 text-2xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {assessment.disclaimer}
      </p>
    </div>
  )
}
