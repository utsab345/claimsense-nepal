import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"

import { ActivityTimeline, type TimelineEntry } from "@/components/common/activity-timeline"
import { LiveIndicator, RiskBadge, StatusBadge } from "@/components/common/badges"
import { PageHeader } from "@/components/common/page-header"
import { CardError, EmptyState, LoadingState } from "@/components/common/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/components/ui/controls"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Separator,
} from "@/components/ui/feedback"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useSettings } from "@/context/settings-context"
import { api } from "@/lib/api"
import { formatDateTime, formatNPR, formatNumber } from "@/lib/format"
import type { InvestigationStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const STATUSES: InvestigationStatus[] = ["Open", "Under Review", "Additional Information Required", "Resolved"]
const PAGE_SIZE = 10

interface Feedback {
  kind: "success" | "error"
  message: string
}

function PaginationControls({
  offset,
  total,
  onPrevious,
  onNext,
}: {
  offset: number
  total: number
  onPrevious: () => void
  onNext: () => void
}) {
  const start = total === 0 ? 0 : offset + 1
  const end = Math.min(offset + PAGE_SIZE, total)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-2xs text-muted-foreground">
      <span className="num">
        Showing {start}-{end} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={offset === 0} onClick={onPrevious}>
          <ChevronLeft className="h-3.5 w-3.5" /> Previous
        </Button>
        <span className="num">
          Page {Math.floor(offset / PAGE_SIZE) + 1} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
        </span>
        <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= total} onClick={onNext}>
          Next <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

type RiskThresholds = { high: number; medium: number; anomaly_points: number }

function ScoreBadge({ score, thresholds }: { score: number | null; thresholds?: RiskThresholds }) {
  if (score === null) return <Badge variant="neutral">—</Badge>
  const variant = score >= (thresholds?.high ?? 70) ? "danger" : score >= (thresholds?.medium ?? 40) ? "warning" : "success"
  return (
    <Badge variant={variant}>
      <span className="num">{formatNumber(Math.round(score))}</span>
    </Badge>
  )
}

function InvestigationDetail({ claimId, refetchInterval }: { claimId: string; refetchInterval: number | undefined }) {
  const queryClient = useQueryClient()
  const investigationQuery = useQuery({
    queryKey: ["investigation", claimId],
    queryFn: () => api.investigation(claimId),
    refetchInterval,
  })
  const claimQuery = useQuery({
    queryKey: ["claim", claimId],
    queryFn: () => api.claim(claimId),
    refetchInterval,
  })

  const [author, setAuthor] = useState("Analyst")
  const [assignment, setAssignment] = useState("")
  const [noteBody, setNoteBody] = useState("")
  const [pendingStatus, setPendingStatus] = useState<InvestigationStatus | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(null), 5000)
    return () => window.clearTimeout(timer)
  }, [feedback])

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["investigations"] })
    void queryClient.invalidateQueries({ queryKey: ["investigation", claimId] })
    void queryClient.invalidateQueries({ queryKey: ["audit"] })
    void queryClient.invalidateQueries({ queryKey: ["notifications"] })
  }

  const statusMutation = useMutation({
    mutationFn: (next: InvestigationStatus) => api.updateStatus(claimId, next, author.trim() || "Analyst"),
    onSuccess: (_result, next) => {
      invalidateAll()
      setFeedback({ kind: "success", message: `Status updated to ${next}.` })
    },
    onError: (error) => setFeedback({ kind: "error", message: error.message }),
  })

  const assignMutation = useMutation({
    mutationFn: (analyst: string | null) => api.assign(claimId, analyst),
    onSuccess: (_result, analyst) => {
      invalidateAll()
      setFeedback({ kind: "success", message: analyst ? `Assigned to ${analyst}.` : "Assignment cleared." })
    },
    onError: (error) => setFeedback({ kind: "error", message: error.message }),
  })

  const noteMutation = useMutation({
    mutationFn: (body: string) => api.addNote(claimId, body, author.trim() || "Analyst"),
    onSuccess: () => {
      invalidateAll()
      setNoteBody("")
      setFeedback({ kind: "success", message: "Note added." })
    },
    onError: (error) => setFeedback({ kind: "error", message: error.message }),
  })

  useEffect(() => {
    if (investigationQuery.data) setAssignment(investigationQuery.data.assigned_analyst ?? "")
  }, [investigationQuery.data?.assigned_analyst])

  if (investigationQuery.isPending || claimQuery.isPending) {
    return (
      <Card>
        <LoadingState rows={6} />
      </Card>
    )
  }

  if (investigationQuery.isError || claimQuery.isError) {
    const error = investigationQuery.error ?? claimQuery.error
    return (
      <CardError
        message={error instanceof Error ? error.message : "Unable to load this investigation."}
        onRetry={() => {
          void investigationQuery.refetch()
          void claimQuery.refetch()
        }}
      />
    )
  }

  const investigation = investigationQuery.data
  const claim = claimQuery.data
  if (!investigation || !claim) {
    return (
      <Card>
        <LoadingState rows={6} />
      </Card>
    )
  }

  const timeline: TimelineEntry[] = [...investigation.events]
    .reverse()
    .map((event) => ({
      id: event.id,
      title: `${event.from_status ? `${event.from_status} → ` : ""}${event.to_status}`,
      detail: [event.author, event.detail].filter(Boolean).join(" · ") || undefined,
      timestamp: event.created_at,
    }))

  const requestStatus = (next: InvestigationStatus) => {
    setFeedback(null)
    if (next === "Resolved") {
      setPendingStatus(next)
      return
    }
    statusMutation.mutate(next)
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle>Investigation</CardTitle>
          <CardDescription>
            Opened {formatDateTime(investigation.opened_at)} · Updated {formatDateTime(investigation.updated_at)}
          </CardDescription>
        </div>
        <StatusBadge status={investigation.status} />
      </CardHeader>
      <CardContent className="space-y-5">
        {feedback ? (
          <div
            role="status"
            className={cn(
              "flex items-center justify-between gap-2 rounded border px-3 py-2 text-xs",
              feedback.kind === "success"
                ? "border-primary/25 bg-primary/10 text-primary"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            <span>{feedback.message}</span>
            <Button variant="ghost" size="icon-sm" aria-label="Dismiss message" onClick={() => setFeedback(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null}

        <section className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="investigation-author">Author</Label>
              <Input
                id="investigation-author"
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
                placeholder="Analyst"
              />
            </div>
            <div className="space-y-1">
              <Label>Workflow status</Label>
              <Select
                value={investigation.status}
                disabled={statusMutation.isPending}
                onValueChange={(next) => requestStatus(next as InvestigationStatus)}
              >
                <SelectTrigger aria-label="Investigation status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-2xs leading-relaxed text-muted-foreground">
            The author is recorded on status changes and notes. Moving a claim to Resolved needs confirmation.
          </p>
        </section>

        <Separator />

        <section className="space-y-2">
          <Label htmlFor="investigation-assignee">Assigned analyst</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="investigation-assignee"
              className="min-w-[160px] flex-1"
              value={assignment}
              onChange={(event) => setAssignment(event.target.value)}
              placeholder="Unassigned"
            />
            <Button
              size="sm"
              disabled={assignMutation.isPending || assignment.trim() === (investigation.assigned_analyst ?? "")}
              onClick={() => assignMutation.mutate(assignment.trim() || null)}
            >
              Save
            </Button>
            {investigation.assigned_analyst ? (
              <Button
                variant="outline"
                size="sm"
                disabled={assignMutation.isPending}
                onClick={() => {
                  setAssignment("")
                  assignMutation.mutate(null)
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </section>

        <Separator />

        <section className="space-y-2">
          <Label htmlFor="investigation-note">Notes</Label>
          <Textarea
            id="investigation-note"
            value={noteBody}
            onChange={(event) => setNoteBody(event.target.value)}
            placeholder="Record a review finding or request for information"
          />
          <div className="flex justify-end">
            <Button size="sm" disabled={noteMutation.isPending || !noteBody.trim()} onClick={() => noteMutation.mutate(noteBody.trim())}>
              Add note
            </Button>
          </div>
          <div className="space-y-2">
            {investigation.notes.length === 0 ? (
              <p className="text-xs text-muted-foreground">No notes recorded for this investigation.</p>
            ) : (
              investigation.notes.map((item) => (
                <div key={item.id} className="rounded border border-border p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">{item.author}</span>
                    <span className="num text-2xs text-muted-foreground">{formatDateTime(item.created_at)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <Separator />

        <section className="space-y-3">
          <div>
            <h4 className="text-xs font-semibold text-foreground">Status-change history</h4>
            <p className="mt-0.5 text-2xs text-muted-foreground">Every workflow transition is recorded.</p>
          </div>
          <ActivityTimeline entries={timeline} emptyTitle="No status changes yet" />
        </section>

        <Separator />

        <section className="space-y-2">
          <h4 className="text-xs font-semibold text-foreground">Claim reference</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded border border-border bg-muted/30 p-3 text-xs">
            <div>
              <div className="text-2xs text-muted-foreground">Claim</div>
              <Link className="font-medium text-foreground hover:text-primary hover:underline" to={`/claims/${claim.claim_id}`}>
                {claim.claim_id}
              </Link>
            </div>
            <div>
              <div className="text-2xs text-muted-foreground">Risk</div>
              <div className="mt-0.5">
                <RiskBadge priority={claim.review_priority} score={claim.risk_score} />
              </div>
            </div>
            <div>
              <div className="text-2xs text-muted-foreground">Claim amount</div>
              <div className="num mt-0.5 font-medium">{formatNPR(claim.claim_amount)}</div>
            </div>
            <div>
              <div className="text-2xs text-muted-foreground">Triggered indicators</div>
              <div className="num mt-0.5 font-medium">{claim.risk_indicators?.length ?? 0}</div>
            </div>
          </div>
        </section>
      </CardContent>

      <AlertDialog open={pendingStatus !== null} onOpenChange={(open) => { if (!open) setPendingStatus(null) }}>
        <AlertDialogContent>
          <AlertDialogTitle>Resolve this investigation?</AlertDialogTitle>
          <AlertDialogDescription>
            Claim {claimId} will be moved to Resolved and the change will be recorded in the audit trail. Reopen it later
            if new information arrives.
          </AlertDialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <AlertDialogCancel asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                size="sm"
                disabled={statusMutation.isPending}
                onClick={() => {
                  const next = pendingStatus
                  setPendingStatus(null)
                  if (next) statusMutation.mutate(next)
                }}
              >
                Confirm resolution
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

export function InvestigationsPage() {
  const { autoRefresh, refreshSeconds } = useSettings()
  const [searchParams, setSearchParams] = useSearchParams()
  const claimId = searchParams.get("claim") ?? ""
  const [status, setStatus] = useState<InvestigationStatus | "">("")
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)
  const refetchInterval = autoRefresh ? Math.max(10, refreshSeconds) * 1000 : undefined

  const investigationsQuery = useQuery({
    queryKey: ["investigations", status, search, offset, PAGE_SIZE],
    queryFn: () => api.investigations(status || undefined, search || undefined, PAGE_SIZE, offset),
    refetchInterval,
  })
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: api.settings })
  const thresholds = settingsQuery.data?.risk_thresholds

  const items = investigationsQuery.data?.items ?? []
  const total = investigationsQuery.data?.total ?? 0

  return (
    <div className="space-y-5">
      <PageHeader
        title="Investigations"
        description="A manual investigation workspace for reviewing flagged claims. Risk scores only prioritise work — they never automatically approve or reject a claim."
        actions={<LiveIndicator active={autoRefresh} />}
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-end gap-2 border-b border-border p-3">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search investigations"
                placeholder="Search claim or analyst"
                className="pl-8"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setOffset(0)
                }}
              />
            </div>
            <Select
              value={status || "all"}
              onValueChange={(next) => {
                setStatus(next === "all" ? "" : (next as InvestigationStatus))
                setOffset(0)
              }}
            >
              <SelectTrigger aria-label="Filter by investigation status" className="w-full sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {investigationsQuery.isPending ? (
            <LoadingState rows={6} />
          ) : investigationsQuery.isError ? (
            <CardError
              message={investigationsQuery.error instanceof Error ? investigationsQuery.error.message : "Unable to load investigations."}
              onRetry={() => void investigationsQuery.refetch()}
            />
          ) : items.length === 0 ? (
            <EmptyState
              title="No investigations found"
              description="Adjust the status filter or search term to see more claims."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Claim</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Risk score</TableHead>
                  <TableHead>Analyst</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.claim_id}
                    className={cn("cursor-pointer", claimId === item.claim_id && "bg-muted")}
                    onClick={() => setSearchParams({ claim: item.claim_id })}
                  >
                    <TableCell>
                      <button
                        type="button"
                        className="font-medium text-foreground hover:text-primary hover:underline"
                        onClick={() => setSearchParams({ claim: item.claim_id })}
                      >
                        {item.claim_id}
                      </button>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ScoreBadge score={item.risk_score} thresholds={thresholds} />
                    </TableCell>
                    <TableCell>{item.assigned_analyst ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                    <TableCell className="num text-right whitespace-nowrap">{formatNPR(item.claim_amount)}</TableCell>
                    <TableCell className="num text-right whitespace-nowrap text-muted-foreground">
                      {formatDateTime(item.updated_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {investigationsQuery.isSuccess ? (
            <PaginationControls
              offset={offset}
              total={total}
              onPrevious={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
              onNext={() => setOffset((current) => current + PAGE_SIZE)}
            />
          ) : null}
        </Card>

        {claimId ? (
          <InvestigationDetail key={claimId} claimId={claimId} refetchInterval={refetchInterval} />
        ) : (
          <Card>
            <EmptyState
              title="No investigation selected"
              description="Choose a claim from the list to review its status, assignment, notes and history."
            />
          </Card>
        )}
      </div>
    </div>
  )
}
