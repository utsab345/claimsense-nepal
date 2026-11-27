import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"

import { ClaimTable, type SortDirection, type SortField } from "@/components/common/claim-table"
import { DateRangeControl, ExportClaimsButton, FilterBar, emptyFilters, type FilterValues } from "@/components/common/filters"
import { PageHeader } from "@/components/common/page-header"
import { CardError, LoadingState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useSettings } from "@/context/settings-context"
import { api } from "@/lib/api"
import type { ClaimFilters } from "@/lib/types"
import { formatNumber } from "@/lib/format"

const PAGE_SIZE = 20

function toClaimFilters(filters: FilterValues, dateRange: { from?: string; to?: string }, sortBy: SortField, sortDir: SortDirection, page: number): ClaimFilters {
  return {
    search: filters.search || undefined,
    status: filters.status || undefined,
    risk_level: filters.risk || undefined,
    incident_type: filters.incident || undefined,
    is_anomaly: filters.anomaly === "" ? undefined : filters.anomaly === "true",
    from_date: dateRange.from,
    to_date: dateRange.to,
    sort_by: sortBy,
    sort_dir: sortDir,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }
}

export function ClaimsPage() {
  const { dateRange } = useSettings()
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState<FilterValues>(emptyFilters)
  const [sortBy, setSortBy] = useState<SortField>("claim_date")
  const [sortDir, setSortDir] = useState<SortDirection>("desc")
  const [page, setPage] = useState(0)

  useEffect(() => {
    const search = searchParams.get("search") ?? ""
    setFilters((current) => (current.search === search ? current : { ...current, search }))
    setPage(0)
  }, [searchParams])

  const trendsQuery = useQuery({
    queryKey: ["trends", dateRange.from, dateRange.to],
    queryFn: () => api.trends(dateRange.from, dateRange.to),
  })

  const claimFilters = useMemo(
    () => toClaimFilters(filters, dateRange, sortBy, sortDir, page),
    [filters, dateRange, sortBy, sortDir, page],
  )

  const claimsQuery = useQuery({
    queryKey: ["claims", claimFilters],
    queryFn: () => api.claims(claimFilters),
  })

  const incidents = useMemo(() => (trendsQuery.data?.incident_types ?? []).map((item) => item.incident_type), [trendsQuery.data])

  const handleFilterChange = (next: FilterValues) => {
    setFilters(next)
    setPage(0)
  }

  const handleReset = () => {
    setFilters(emptyFilters)
    setSortBy("claim_date")
    setSortDir("desc")
    setPage(0)
  }

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(field)
      setSortDir("desc")
    }
    setPage(0)
  }

  const total = claimsQuery.data?.total ?? 0
  const items = claimsQuery.data?.items ?? []
  const start = total === 0 ? 0 : page * PAGE_SIZE + 1
  const end = total === 0 ? 0 : page * PAGE_SIZE + items.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Claims"
        description="Review, filter, and prioritize claims for manual investigation."
        actions={
          <>
            <DateRangeControl />
            <ExportClaimsButton filters={claimFilters} />
          </>
        }
      />

      <Card>
        <FilterBar value={filters} onChange={handleFilterChange} onReset={handleReset} incidents={incidents} />
        {claimsQuery.isError ? (
          <CardError message={claimsQuery.error instanceof Error ? claimsQuery.error.message : "Failed to load claims."} onRetry={() => void claimsQuery.refetch()} />
        ) : claimsQuery.isLoading ? (
          <LoadingState rows={8} />
        ) : (
          <>
            <ClaimTable claims={items} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
            <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div>
                Showing {formatNumber(start)}–{formatNumber(end)} of {formatNumber(total)}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0}>
                  Previous
                </Button>
                <span className="num px-1">
                  Page {formatNumber(page + 1)} of {formatNumber(totalPages)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                  disabled={page >= totalPages - 1}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
