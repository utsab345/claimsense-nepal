import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AlertTriangle, CircleDollarSign, Clock3, FileSearch, Files, ShieldAlert } from "lucide-react"

import { ChartCard } from "@/components/common/chart-card"
import { ClaimTable } from "@/components/common/claim-table"
import { DateRangeControl } from "@/components/common/filters"
import { PageHeader } from "@/components/common/page-header"
import { Card, Metric } from "@/components/ui/card"
import { CardError } from "@/components/common/states"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/controls"
import { Skeleton } from "@/components/ui/feedback"
import { useSettings } from "@/context/settings-context"
import { api } from "@/lib/api"
import { formatMonth, formatNPR, formatNumber } from "@/lib/format"

type TrendMetric = "count" | "amount"

const riskColors: Record<string, string> = {
  Low: "hsl(var(--primary))",
  Medium: "hsl(var(--warning))",
  High: "hsl(var(--destructive))",
  Unassessed: "hsl(var(--muted-foreground))",
}

function ChartLoading() {
  return (
    <div className="px-4 pb-4">
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function TrendTooltip({ active, payload, label, metric }: { active?: boolean; payload?: Array<{ value?: number }>; label?: string; metric: TrendMetric }) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value ?? 0
  return (
    <div className="rounded border border-border bg-card px-3 py-2 text-xs shadow-subtle">
      <div className="font-medium text-foreground">{label ? formatMonth(label) : ""}</div>
      <div className="text-muted-foreground">{metric === "amount" ? formatNPR(value) : `${formatNumber(value)} claims`}</div>
    </div>
  )
}

function CountTooltip({ active, payload, label, valueFormatter }: { active?: boolean; payload?: Array<{ value?: number; name?: string }>; label?: string; valueFormatter: (value: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border border-border bg-card px-3 py-2 text-xs shadow-subtle">
      <div className="font-medium text-foreground">{label}</div>
      {payload.map((entry, index) => (
        <div key={`${entry.name ?? "value"}-${index}`} className="text-muted-foreground">
          {valueFormatter(entry.value ?? 0)}
        </div>
      ))}
    </div>
  )
}

export function DashboardPage() {
  const { dateRange } = useSettings()
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("count")

  const overviewQuery = useQuery({
    queryKey: ["overview", dateRange.from, dateRange.to],
    queryFn: () => api.overview(dateRange.from, dateRange.to),
  })
  const trendsQuery = useQuery({
    queryKey: ["trends", dateRange.from, dateRange.to],
    queryFn: () => api.trends(dateRange.from, dateRange.to),
  })
  const riskQuery = useQuery({
    queryKey: ["risk-distribution", dateRange.from, dateRange.to],
    queryFn: () => api.riskDistribution(dateRange.from, dateRange.to),
  })
  const highRiskQuery = useQuery({
    queryKey: ["high-risk-claims"],
    queryFn: () => api.highRisk(),
  })

  const riskData = useMemo(() => {
    const distribution = riskQuery.data?.distribution
    if (!distribution) return []
    return (["Low", "Medium", "High", "Unassessed"] as const).map((level) => ({
      level,
      count: distribution[level] ?? 0,
    }))
  }, [riskQuery.data])

  const trendData = trendsQuery.data?.monthly ?? []
  const incidentData = trendsQuery.data?.incident_types ?? []
  const highRiskClaims = (highRiskQuery.data ?? []).slice(0, 8)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Portfolio summary from synthetic claims data for decision support and manual review prioritization."
        actions={<DateRangeControl />}
      />

      {overviewQuery.isError ? (
        <CardError message={overviewQuery.error instanceof Error ? overviewQuery.error.message : "Failed to load overview."} onRetry={() => void overviewQuery.refetch()} />
      ) : (
        <div className="section-grid">
          {overviewQuery.isLoading || !overviewQuery.data ? (
            Array.from({ length: 7 }).map((_, index) => (
              <Card key={index} className="p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-8 w-28" />
                <Skeleton className="mt-2 h-3 w-20" />
              </Card>
            ))
          ) : (
            <>
              <Metric label="Total claims" value={formatNumber(overviewQuery.data.total_claims)} icon={<Files className="h-4 w-4" />} />
              <Metric label="Total claimed amount" value={formatNPR(overviewQuery.data.total_claim_amount)} icon={<CircleDollarSign className="h-4 w-4" />} />
              <Metric label="Average claim" value={formatNPR(overviewQuery.data.average_claim_amount)} icon={<Clock3 className="h-4 w-4" />} />
              <Metric label="Open claims" value={formatNumber(overviewQuery.data.open_claims)} icon={<FileSearch className="h-4 w-4" />} />
              <Metric label="Under review" value={formatNumber(overviewQuery.data.under_review)} icon={<AlertTriangle className="h-4 w-4" />} />
              <Metric label="High-priority claims" value={formatNumber(overviewQuery.data.high_priority_claims)} icon={<ShieldAlert className="h-4 w-4" />} />
              <Metric label="Anomaly count" value={formatNumber(overviewQuery.data.anomaly_count)} icon={<ShieldAlert className="h-4 w-4" />} />
            </>
          )}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Monthly claim trend"
          description="Claim volume and value over time."
          actions={
            <Select value={trendMetric} onValueChange={(value) => setTrendMetric(value as TrendMetric)}>
              <SelectTrigger className="w-32" aria-label="Select trend metric">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="count">Claim count</SelectItem>
                <SelectItem value="amount">Claim amount</SelectItem>
              </SelectContent>
            </Select>
          }
        >
          {trendsQuery.isError ? (
            <div className="px-4 pb-4">
              <CardError message={trendsQuery.error instanceof Error ? trendsQuery.error.message : "Failed to load trend data."} onRetry={() => void trendsQuery.refetch()} />
            </div>
          ) : trendsQuery.isLoading ? (
            <ChartLoading />
          ) : (
            <div className="h-72 px-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={formatMonth} tickLine={false} axisLine={false} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={72}
                    tickFormatter={(value) => (trendMetric === "amount" ? formatNPR(Number(value)) : formatNumber(Number(value)))}
                  />
                  <Tooltip content={<TrendTooltip metric={trendMetric} />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey={trendMetric === "amount" ? "claim_amount" : "claim_count"}
                    name={trendMetric === "amount" ? "Claim amount" : "Claim count"}
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.16}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Incident distribution" description="Claims by incident type in the selected period.">
          {trendsQuery.isError ? (
            <div className="px-4 pb-4">
              <CardError message={trendsQuery.error instanceof Error ? trendsQuery.error.message : "Failed to load incident data."} onRetry={() => void trendsQuery.refetch()} />
            </div>
          ) : trendsQuery.isLoading ? (
            <ChartLoading />
          ) : (
            <div className="h-72 px-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incidentData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="incident_type" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(Number(value))} />
                  <Tooltip content={<CountTooltip valueFormatter={(value) => `${formatNumber(value)} claims`} />} />
                  <Legend />
                  <Bar dataKey="claim_count" name="Claim count" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <ChartCard title="Risk distribution" description="Claims by review priority band.">
          {riskQuery.isError ? (
            <div className="px-4 pb-4">
              <CardError message={riskQuery.error instanceof Error ? riskQuery.error.message : "Failed to load risk distribution."} onRetry={() => void riskQuery.refetch()} />
            </div>
          ) : riskQuery.isLoading ? (
            <ChartLoading />
          ) : (
            <div className="h-72 px-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="level" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(Number(value))} />
                  <Tooltip content={<CountTooltip valueFormatter={(value) => `${formatNumber(value)} claims`} />} />
                  <Bar dataKey="count" name="Claims">
                    {riskData.map((entry) => (
                      <Cell key={entry.level} fill={riskColors[entry.level]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <Card>
          <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">High-priority claims</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Claims currently flagged for manual review.</p>
            </div>
            <Link to="/claims" className="text-xs font-medium text-primary hover:underline">
              View all claims
            </Link>
          </div>
          {highRiskQuery.isError ? (
            <CardError message={highRiskQuery.error instanceof Error ? highRiskQuery.error.message : "Failed to load high-priority claims."} onRetry={() => void highRiskQuery.refetch()} />
          ) : highRiskQuery.isLoading ? (
            <div className="p-4">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <ClaimTable claims={highRiskClaims} emptyTitle="No high-priority claims" emptyDescription="There are no claims currently marked as high priority." />
          )}
        </Card>
      </div>

      <p className="text-2xs leading-relaxed text-muted-foreground">
        Synthetic data for decision support only. Review portfolio patterns in{" "}
        <Link to="/analytics" className="text-primary hover:underline">
          Analytics
        </Link>{" "}
        or data and risk settings in{" "}
        <Link to="/settings" className="text-primary hover:underline">
          Settings
        </Link>
        .
      </p>
    </div>
  )
}
