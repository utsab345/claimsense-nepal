import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react"

import { StatusBadge } from "@/components/common/badges"
import { ActivityTimeline, type TimelineEntry } from "@/components/common/activity-timeline"
import { PageHeader } from "@/components/common/page-header"
import { RiskExplanation } from "@/components/common/risk-explanation"
import { CardError, LoadingState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { api } from "@/lib/api"
import { formatDate, formatNPR, formatNumber } from "@/lib/format"
import type { Claim, RiskAssessment } from "@/lib/types"

function DetailList({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-2xs uppercase tracking-wide text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 text-sm text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </Card>
  )
}

function getReviewActions(claim: Claim, assessment: RiskAssessment): string[] {
  const codes = new Set((assessment.risk_indicators ?? []).map((indicator) => indicator.code))
  const actions: string[] = []

  if (codes.has("documents_missing") || codes.has("documents_limited")) {
    actions.push("Request supporting documents; the recorded document count contributed to the score.")
  }
  if (codes.has("early_claim_high") || codes.has("early_claim_elevated")) {
    actions.push("Confirm policy inception and incident timing for a claim soon after policy start.")
  }
  if (codes.has("claim_premium_ratio_high") || codes.has("claim_premium_ratio_elevated")) {
    actions.push("Review the claim amount relative to the recorded premium and policy history.")
  }
  if (codes.has("repeat_claims_high") || codes.has("repeat_claims_elevated")) {
    actions.push("Review prior claim history for related patterns.")
  }
  if (codes.has("overnight_incident")) {
    actions.push("Verify the police report and incident timeline for the overnight incident.")
  }
  if (codes.has("statistical_anomaly")) {
    actions.push("Validate the unusual field combination flagged by the statistical model.")
  }
  if (claim.claim_status === "Open" || claim.claim_status === "Under Review") {
    actions.push("Confirm investigation status and next reviewer action before closing the file.")
  }
  if (actions.length === 0) {
    actions.push(
      assessment.assessed === false
        ? "Re-run assessment to load the stored review signals before manual review."
        : "Confirm claim documentation and recorded fields are complete before final review.",
    )
  }
  return actions
}

export function ClaimDetailPage() {
  const { claimId } = useParams<{ claimId: string }>()
  const queryClient = useQueryClient()
  const [assessmentMessage, setAssessmentMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const claimQuery = useQuery({
    queryKey: ["claim", claimId],
    queryFn: () => api.claim(claimId ?? ""),
    enabled: Boolean(claimId),
  })
  const riskQuery = useQuery({
    queryKey: ["risk", claimId],
    queryFn: () => api.risk(claimId ?? ""),
    enabled: Boolean(claimId),
  })
  const investigationQuery = useQuery({
    queryKey: ["investigation", claimId],
    queryFn: () => api.investigation(claimId ?? ""),
    enabled: Boolean(claimId),
  })
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.settings(),
  })

  const assessMutation = useMutation({
    mutationFn: () => api.assess(claimId ?? ""),
    onSuccess: async () => {
      setAssessmentMessage({ type: "success", text: "Risk assessment refreshed." })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["claim", claimId] }),
        queryClient.invalidateQueries({ queryKey: ["risk", claimId] }),
        queryClient.invalidateQueries({ queryKey: ["high-risk-claims"] }),
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
        queryClient.invalidateQueries({ queryKey: ["trends"] }),
        queryClient.invalidateQueries({ queryKey: ["risk-distribution"] }),
        queryClient.invalidateQueries({ queryKey: ["analytics"] }),
        queryClient.invalidateQueries({ queryKey: ["investigations"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ])
    },
    onError: (error) => {
      setAssessmentMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to refresh risk assessment.",
      })
    },
  })

  const claim = claimQuery.data
  const assessment = riskQuery.data
  const investigation = investigationQuery.data

  const timelineEntries = useMemo<TimelineEntry[]>(() => {
    if (!investigation) return []
    const eventEntries: TimelineEntry[] = investigation.events.map((event) => ({
      id: `event-${event.id}`,
      title: event.from_status ? `Status changed to ${event.to_status}` : `Investigation opened as ${event.to_status}`,
      detail: [event.author, event.detail].filter(Boolean).join(" — ") || undefined,
      timestamp: event.created_at,
    }))
    const noteEntries: TimelineEntry[] = investigation.notes.map((note) => ({
      id: `note-${note.id}`,
      title: `Note by ${note.author}`,
      detail: note.body,
      timestamp: note.created_at,
    }))
    return [...eventEntries, ...noteEntries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [investigation])

  if (!claimId) {
    return <CardError message="Claim ID is missing." />
  }

  if (claimQuery.isError || riskQuery.isError) {
    const error = claimQuery.error ?? riskQuery.error
    return (
      <CardError
        message={error instanceof Error ? error.message : "Failed to load claim."}
        onRetry={() => {
          void claimQuery.refetch()
          void riskQuery.refetch()
        }}
      />
    )
  }

  if (claimQuery.isLoading || riskQuery.isLoading || !claim || !assessment) {
    return <LoadingState rows={10} />
  }

  const reviewActions = getReviewActions(claim, assessment)

  return (
    <div className="space-y-6">
      <PageHeader
        title={claim.claim_id}
        description={`Policy ${claim.policy_id} • Customer ${claim.customer_id}`}
        actions={
          <>
            <StatusBadge status={claim.claim_status} />
            <Button asChild variant="outline" size="sm">
              <Link to="/claims">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Claims
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/investigations?claim=${encodeURIComponent(claim.claim_id)}`}>
                <ExternalLink className="h-3.5 w-3.5" /> Investigation workspace
              </Link>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setAssessmentMessage(null)
                assessMutation.mutate()
              }}
              disabled={assessMutation.isPending}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${assessMutation.isPending ? "animate-spin" : ""}`} />
              {assessment.assessed === false ? "Assess claim" : "Re-run assessment"}
            </Button>
          </>
        }
      />

      {assessmentMessage ? (
        <div
          className={`rounded border px-3 py-2 text-xs ${
            assessmentMessage.type === "success"
              ? "border-primary/25 bg-primary/10 text-primary"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {assessmentMessage.text}
        </div>
      ) : null}

      {settingsQuery.isError ? (
        <div className="rounded border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Configured risk thresholds could not be loaded; showing default bands.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-4">
          <SectionCard title="Claim information" description="Recorded claim details.">
            <DetailList
              items={[
                { label: "Claim ID", value: claim.claim_id },
                { label: "Claim date", value: formatDate(claim.claim_date) },
                { label: "Claim status", value: claim.claim_status },
                { label: "Incident type", value: claim.incident_type },
                { label: "Incident location", value: claim.incident_location ?? "Unknown" },
                { label: "Incident hour", value: `${formatNumber(claim.incident_hour)}:00` },
                { label: "Supporting documents", value: formatNumber(claim.supporting_documents_count) },
                { label: "Previous claims", value: formatNumber(claim.previous_claim_count) },
              ]}
            />
          </SectionCard>

          <SectionCard title="Vehicle information" description="Vehicle attributes captured for the claim.">
            <DetailList
              items={[
                { label: "Vehicle type", value: claim.vehicle_type },
                { label: "Vehicle age", value: `${formatNumber(claim.vehicle_age)} years` },
                { label: "Vehicle value", value: formatNPR(claim.vehicle_value) },
              ]}
            />
          </SectionCard>

          <SectionCard title="Financial information" description="Amounts associated with the claim and policy.">
            <DetailList
              items={[
                { label: "Claim amount", value: formatNPR(claim.claim_amount) },
                { label: "Repair cost", value: formatNPR(claim.repair_cost) },
                { label: "Premium amount", value: formatNPR(claim.premium_amount) },
                {
                  label: "Claim to premium ratio",
                  value: claim.premium_amount > 0 ? `${(claim.claim_amount / claim.premium_amount).toFixed(2)}x` : "—",
                },
              ]}
            />
          </SectionCard>

          <SectionCard title="Policy information" description="Policy context for review.">
            <DetailList
              items={[
                { label: "Policy ID", value: claim.policy_id },
                { label: "Customer ID", value: claim.customer_id },
                { label: "Policy age", value: `${formatNumber(claim.policy_age_days)} days` },
                { label: "Days since policy start", value: formatNumber(claim.days_since_policy_start) },
              ]}
            />
          </SectionCard>
        </div>

        <div className="space-y-4">
          <RiskExplanation assessment={assessment} thresholds={settingsQuery.data?.risk_thresholds} />

          <SectionCard title="Investigation history" description="Recorded investigation status, assignments, and notes.">
            <div className="space-y-4 p-4">
              {investigationQuery.isError ? (
                <CardError
                  message={investigationQuery.error instanceof Error ? investigationQuery.error.message : "Failed to load investigation history."}
                  onRetry={() => void investigationQuery.refetch()}
                />
              ) : investigationQuery.isLoading ? (
                <LoadingState rows={4} />
              ) : investigation ? (
                <>
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-2xs uppercase tracking-wide text-muted-foreground">Investigation status</dt>
                      <dd className="mt-1 text-sm text-foreground">{investigation.status}</dd>
                    </div>
                    <div>
                      <dt className="text-2xs uppercase tracking-wide text-muted-foreground">Assigned analyst</dt>
                      <dd className="mt-1 text-sm text-foreground">{investigation.assigned_analyst ?? "Unassigned"}</dd>
                    </div>
                    <div>
                      <dt className="text-2xs uppercase tracking-wide text-muted-foreground">Opened</dt>
                      <dd className="mt-1 text-sm text-foreground">{formatDate(investigation.opened_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-2xs uppercase tracking-wide text-muted-foreground">Last updated</dt>
                      <dd className="mt-1 text-sm text-foreground">{formatDate(investigation.updated_at)}</dd>
                    </div>
                  </dl>
                  <ActivityTimeline entries={timelineEntries} emptyTitle="No investigation activity" />
                </>
              ) : (
                <ActivityTimeline entries={[]} emptyTitle="No investigation activity" />
              )}
            </div>
          </SectionCard>

          <SectionCard title="Recommended manual review actions" description="Review prompts derived from stored risk indicators.">
            <div className="space-y-3 p-4">
              <ul className="space-y-2 text-sm text-foreground">
                {reviewActions.map((action) => (
                  <li key={action} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
              <p className="text-2xs leading-relaxed text-muted-foreground">
                These are review prompts, not conclusions. Final decisions require manual review of the claim record and supporting evidence.
              </p>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
