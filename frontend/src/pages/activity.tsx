import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Link } from "react-router-dom"

import { PageHeader } from "@/components/common/page-header"
import { CardError, EmptyState, LoadingState } from "@/components/common/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/controls"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useSettings } from "@/context/settings-context"
import { api } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import type { AuditEntry } from "@/lib/types"

const ACTIONS = [
  "claim_created",
  "risk_assessed",
  "investigation_opened",
  "status_changed",
  "note_added",
  "analyst_assigned",
]
const PAGE_SIZE = 10
const FETCH_SIZE = 100
const MAX_PAGES = 50

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

function actionVariant(action: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (action === "risk_assessed") return "warning"
  if (action === "status_changed" || action === "investigation_opened") return "success"
  if (action === "analyst_assigned") return "info"
  return "neutral"
}

export function ActivityPage() {
  const { autoRefresh, refreshSeconds, dateRange } = useSettings()
  const [claimId, setClaimId] = useState("")
  const [action, setAction] = useState("")
  const [offset, setOffset] = useState(0)
  const refetchInterval = autoRefresh ? Math.max(10, refreshSeconds) * 1000 : undefined

  const auditQuery = useQuery({
    queryKey: ["audit", claimId.trim() || null],
    queryFn: async () => {
      const entries: AuditEntry[] = []
      let nextOffset = 0
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const batch = await api.audit(claimId.trim() || undefined, FETCH_SIZE, nextOffset)
        entries.push(...batch.items)
        nextOffset += batch.limit || FETCH_SIZE
        if (batch.items.length === 0 || entries.length >= batch.total) break
      }
      return entries
    },
    refetchInterval,
  })

  const entries = useMemo(() => {
    const from = dateRange.from
    const to = dateRange.to
    return (auditQuery.data ?? []).filter((entry) => {
      if (action && entry.action !== action) return false
      if (from && entry.created_at.slice(0, 10) < from) return false
      if (to && entry.created_at.slice(0, 10) > to) return false
      return true
    })
  }, [auditQuery.data, action, dateRange.from, dateRange.to])

  const visible = entries.slice(offset, offset + PAGE_SIZE)
  const total = entries.length

  return (
    <div className="space-y-5">
      <PageHeader
        title="Activity history"
        description="An audit trail of claim, risk, investigation and analyst actions. Each entry records what happened, who did it and when."
      />
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
          <div className="w-full space-y-1 sm:w-56">
            <Label htmlFor="audit-claim">Claim ID</Label>
            <Input
              id="audit-claim"
              value={claimId}
              onChange={(event) => {
                setClaimId(event.target.value)
                setOffset(0)
              }}
              placeholder="Any claim"
            />
          </div>
          <div className="w-full space-y-1 sm:w-60">
            <Label>Action</Label>
            <Select
              value={action || "all"}
              onValueChange={(next) => {
                setAction(next === "all" ? "" : next)
                setOffset(0)
              }}
            >
              <SelectTrigger aria-label="Filter by action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {ACTIONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="pb-2 text-2xs text-muted-foreground">
            Date range:{" "}
            <span className="font-medium text-foreground">
              {dateRange.from || dateRange.to ? `${dateRange.from ?? "…"} to ${dateRange.to ?? "…"}` : "all dates"}
            </span>
          </div>
        </div>
        {auditQuery.isPending ? (
          <LoadingState rows={6} />
        ) : auditQuery.isError ? (
          <CardError
            message={auditQuery.error instanceof Error ? auditQuery.error.message : "Unable to load activity history."}
            onRetry={() => void auditQuery.refetch()}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No activity found"
            description="Adjust the claim ID, action or date range to see other audit records."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Claim</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Actor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="num whitespace-nowrap text-muted-foreground">{formatDateTime(entry.created_at)}</TableCell>
                  <TableCell>
                    <Badge variant={actionVariant(entry.action)}>{entry.action}</Badge>
                  </TableCell>
                  <TableCell>
                    {entry.claim_id ? (
                      <Link
                        className="font-medium text-foreground hover:text-primary hover:underline"
                        to={`/claims/${entry.claim_id}`}
                      >
                        {entry.claim_id}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-md text-xs text-muted-foreground">{entry.summary}</TableCell>
                  <TableCell>{entry.actor}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {auditQuery.isSuccess ? (
          <PaginationControls
            offset={offset}
            total={total}
            onPrevious={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
            onNext={() => setOffset((current) => current + PAGE_SIZE)}
          />
        ) : null}
      </Card>
      <p className="text-2xs leading-relaxed text-muted-foreground">
        Records are generated by real application actions in this local database — assessments, workflow changes, notes
        and assignments are written here as they happen.
      </p>
    </div>
  )
}
