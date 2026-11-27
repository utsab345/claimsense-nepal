import { useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AlertTriangle } from "lucide-react"

import { ChartCard } from "@/components/common/chart-card"
import { ClaimTable } from "@/components/common/claim-table"
import { DateRangeControl } from "@/components/common/filters"
import { PageHeader } from "@/components/common/page-header"
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Metric } from "@/components/ui/card"
import { useSettings } from "@/context/settings-context"
import { api } from "@/lib/api"
import { formatMonth, formatNPR, formatNumber } from "@/lib/format"

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 4,
  color: "hsl(var(--foreground))",
  fontSize: 11,
}

const bandColors: Record<string, string> = {
  Low: "hsl(var(--primary))",
  Medium: "hsl(var(--warning))",
  High: "hsl(var(--destructive))",
  Unassessed: "hsl(var(--muted-foreground))",
}

function compactCurrency(value: number): string {
  if (value >= 1_000_000) return `NPR ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `NPR ${(value / 1_000).toFixed(0)}k`
  return `NPR ${Math.round(value)}`
}

function AsyncContent({
  loading,
  error,
  onRetry,
  empty,
  emptyTitle = "No data in this range",
  children,
}: {
  loading: boolean
  error: Error | null
  onRetry: () => void
  empty?: boolean
  emptyTitle?: string
  children: ReactNode
}) {
  if (loading) return <LoadingState rows={4} />
  if (error) return <ErrorState message={error.message} onRetry={onRetry} />
  if (empty)
    return <EmptyState title={emptyTitle} description="Adjust the selected date range or load the dataset to see records here." />
  return <>{children}</>
}

export function AnalyticsPage() {
  const { dateRange, autoRefresh, refreshSeconds } = useSettings()
  const [measure, setMeasure] = useState<"count" | "amount">("count")
  const from = dateRange.from
  const to = dateRange.to
  const refetchInterval = autoRefresh ? refreshSeconds * 1000 : false

  const overview = useQuery({
    queryKey: ["analytics", "overview", from, to],
    queryFn: () => api.overview(from, to),
    refetchInterval,
  })
  const trends = useQuery({
    queryKey: ["analytics", "trends", from, to],
    queryFn: () => api.trends(from, to),
    refetchInterval,
  })
  const portfolio = useQuery({
    queryKey: ["analytics", "portfolio", from, to],
    queryFn: () => api.portfolio(from, to),
    refetchInterval,
  })
  const risk = useQuery({
    queryKey: ["analytics", "risk", from, to],
    queryFn: () => api.riskDistribution(from, to),
    refetchInterval,
  })
  const highRisk = useQuery({
    queryKey: ["analytics", "high-risk"],
    queryFn: () => api.highRisk(),
    refetchInterval,
  })

  const monthly = (trends.data?.monthly ?? []).map((item) => ({
    month: formatMonth(item.month),
    count: item.claim_count,
    amount: item.claim_amount,
  }))
  const monthlyAverage = (trends.data?.monthly ?? []).map((item) => ({
    month: formatMonth(item.month),
    average: item.claim_count > 0 ? item.claim_amount / item.claim_count : 0,
  }))
  const incidents = trends.data?.incident_types ?? []
  const locations = [...(portfolio.data?.locations ?? [])].sort((a, b) => b.claim_count - a.claim_count)
  const ratio = portfolio.data?.claim_premium_ratio
  const riskDistribution = risk.data?.distribution ? Object.entries(risk.data.distribution) : []
  const riskData = riskDistribution.map(([label, count]) => ({ label, count }))
  const anomalyDistribution = portfolio.data?.anomaly_distribution ? Object.entries(portfolio.data.anomaly_distribution) : []
  const anomalyTotal = anomalyDistribution.reduce((sum, [, count]) => sum + count, 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics"
        description="Portfolio analytics computed from the generated claims dataset. Figures are filtered by the selected date range and are not real Nepal market statistics."
        actions={
          <>
            <Badge variant="warning" className="gap-1 px-2 py-1 text-2xs">
              <AlertTriangle className="h-3 w-3" /> Synthetic data
            </Badge>
            <DateRangeControl />
          </>
        }
      />

      <AsyncContent
        loading={overview.isPending}
        error={overview.error}
        onRetry={() => void overview.refetch()}
      >
        <div className="section-grid">
          <Metric label="Total claims" value={formatNumber(overview.data?.total_claims)} hint="In selected range" />
          <Metric label="Total claimed" value={formatNPR(overview.data?.total_claim_amount)} hint="Sum of recorded claim amounts" />
          <Metric label="Average claim" value={formatNPR(overview.data?.average_claim_amount)} hint="Per claim in selected range" />
          <Metric
            label="Anomalies flagged"
            value={formatNumber(overview.data?.anomaly_count)}
            hint="Statistical outliers, not fraud findings"
          />
        </div>
      </AsyncContent>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Monthly claims trend"
          description="Claim volume and total claimed amount by month."
          actions={
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant={measure === "count" ? "subtle" : "outline"}
                onClick={() => setMeasure("count")}
              >
                Count
              </Button>
              <Button
                type="button"
                size="sm"
                variant={measure === "amount" ? "subtle" : "outline"}
                onClick={() => setMeasure("amount")}
              >
                Amount
              </Button>
            </div>
          }
        >
          <AsyncContent
            loading={trends.isPending}
            error={trends.error}
            onRetry={() => void trends.refetch()}
            empty={monthly.length === 0}
          >
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis
                    width={58}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={measure === "count" ? (value) => formatNumber(value) : compactCurrency}
                  />
                  <ChartTooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) =>
                      measure === "count" ? formatNumber(Number(value)) : formatNPR(Number(value))
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey={measure}
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.14}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </AsyncContent>
        </ChartCard>

        <ChartCard title="Average claim amount over time" description="Total claim amount divided by claim count for each month.">
          <AsyncContent
            loading={trends.isPending}
            error={trends.error}
            onRetry={() => void trends.refetch()}
            empty={monthlyAverage.length === 0}
          >
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyAverage} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis width={58} tickLine={false} axisLine={false} tickFormatter={compactCurrency} />
                  <ChartTooltip contentStyle={tooltipStyle} formatter={(value) => formatNPR(Number(value))} />
                  <Line
                    type="monotone"
                    dataKey="average"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </AsyncContent>
        </ChartCard>

        <ChartCard
          title="Incident category analysis"
          description="Average claim amount by incident type; labels show the claim count."
          className="lg:col-span-2"
        >
          <AsyncContent
            loading={trends.isPending}
            error={trends.error}
            onRetry={() => void trends.refetch()}
            empty={incidents.length === 0}
          >
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incidents} layout="vertical" margin={{ top: 4, right: 88, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={compactCurrency} />
                  <YAxis type="category" dataKey="incident_type" width={112} tickLine={false} axisLine={false} />
                  <ChartTooltip contentStyle={tooltipStyle} formatter={(value) => formatNPR(Number(value))} />
                  <Bar dataKey="average_claim_amount" fill="hsl(var(--primary))" isAnimationActive={false}>
                    <LabelList
                      dataKey="claim_count"
                      position="right"
                      formatter={(value: unknown) => `${formatNumber(Number(value))} claims`}
                      fill="hsl(var(--muted-foreground))"
                      fontSize={10}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </AsyncContent>
        </ChartCard>

        <ChartCard title="Claims by location" description="Claim volume per recorded incident location; labels show total claimed amount.">
          <AsyncContent
            loading={portfolio.isPending}
            error={portfolio.error}
            onRetry={() => void portfolio.refetch()}
            empty={locations.length === 0}
          >
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={locations} layout="vertical" margin={{ top: 4, right: 88, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="location" width={112} tickLine={false} axisLine={false} />
                  <ChartTooltip contentStyle={tooltipStyle} formatter={(value) => formatNumber(Number(value))} />
                  <Bar dataKey="claim_count" fill="hsl(var(--primary))" isAnimationActive={false}>
                    <LabelList
                      dataKey="total_amount"
                      position="right"
                      formatter={(value: unknown) => compactCurrency(Number(value))}
                      fill="hsl(var(--muted-foreground))"
                      fontSize={10}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </AsyncContent>
        </ChartCard>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Claim-to-premium ratio</CardTitle>
              <CardDescription>Recorded claim amount relative to premium; above 10× is the watch threshold.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <AsyncContent loading={portfolio.isPending} error={portfolio.error} onRetry={() => void portfolio.refetch()}>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Average ratio" value={`${(ratio?.average_ratio ?? 0).toFixed(2)}×`} hint="Mean of per-claim ratios" />
                <Metric label="Above 10×" value={formatNumber(ratio?.claims_above_ten_x)} hint="Claims over the watch threshold" />
                <Metric label="Claims counted" value={formatNumber(ratio?.claims_count)} hint="Records with premium data" />
              </div>
            </AsyncContent>
          </CardContent>
        </Card>

        <ChartCard title="Risk distribution" description="Stored review-priority bands across the selected range.">
          <AsyncContent
            loading={risk.isPending}
            error={risk.error}
            onRetry={() => void risk.refetch()}
            empty={riskData.length === 0}
          >
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis width={48} tickLine={false} axisLine={false} allowDecimals={false} />
                  <ChartTooltip contentStyle={tooltipStyle} formatter={(value) => formatNumber(Number(value))} />
                  <Bar dataKey="count" isAnimationActive={false}>
                    {riskData.map((entry) => (
                      <Cell key={entry.label} fill={bandColors[entry.label] ?? "hsl(var(--primary))"} />
                    ))}
                    <LabelList dataKey="count" position="top" fill="hsl(var(--muted-foreground))" fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </AsyncContent>
        </ChartCard>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Anomaly distribution</CardTitle>
              <CardDescription>Statistical outlier flags grouped by review-priority band.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <AsyncContent
              loading={portfolio.isPending}
              error={portfolio.error}
              onRetry={() => void portfolio.refetch()}
              empty={anomalyDistribution.length === 0}
            >
              <div className="space-y-3">
                {anomalyDistribution.map(([label, count]) => (
                  <div key={label}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="num font-medium text-foreground">{formatNumber(count)}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded bg-muted">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${anomalyTotal > 0 ? (count / anomalyTotal) * 100 : 0}%`,
                          backgroundColor: bandColors[label] ?? "hsl(var(--primary))",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </AsyncContent>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>High-priority financial exposure</CardTitle>
              <CardDescription>Claimed amount held in claims marked High review priority.</CardDescription>
            </div>
            <Badge variant="warning">Manual review</Badge>
          </CardHeader>
          <CardContent>
            <AsyncContent
              loading={portfolio.isPending || overview.isPending}
              error={portfolio.error ?? overview.error}
              onRetry={() => {
                void portfolio.refetch()
                void overview.refetch()
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric
                  label="High-priority exposure"
                  value={formatNPR(portfolio.data?.high_priority_exposure.total_amount)}
                  hint={`${formatNumber(portfolio.data?.high_priority_exposure.claim_count)} high-priority claims in range`}
                  icon={<AlertTriangle className="h-4 w-4 text-warning" />}
                />
                <Metric
                  label="Total claimed amount"
                  value={formatNPR(overview.data?.total_claim_amount)}
                  hint={`${formatNumber(overview.data?.high_priority_claims)} high-priority claims recorded in range`}
                />
              </div>
            </AsyncContent>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Highest-priority claims</CardTitle>
              <CardDescription>Claims currently marked High review priority; scores are not fraud probabilities.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/claims">View all claims</Link>
            </Button>
          </CardHeader>
          <AsyncContent
            loading={highRisk.isPending}
            error={highRisk.error}
            onRetry={() => void highRisk.refetch()}
          >
            <ClaimTable
              claims={(highRisk.data ?? []).slice(0, 8)}
              emptyTitle="No high-priority claims"
              emptyDescription="No claims are currently marked with High review priority."
            />
          </AsyncContent>
        </Card>
      </div>

      <p className="border-t border-border pt-4 text-2xs leading-relaxed text-muted-foreground">
        Synthetic generated data; distributions are modelling assumptions, not measured Nepal insurance rates.
      </p>
    </div>
  )
}
