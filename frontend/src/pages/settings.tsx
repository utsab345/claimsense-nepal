import type { ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { Activity, Database, Server } from "lucide-react"

import { DateRangeControl } from "@/components/common/filters"
import { PageHeader } from "@/components/common/page-header"
import { ErrorState, LoadingState } from "@/components/common/states"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Metric } from "@/components/ui/card"
import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from "@/components/ui/controls"
import { useSettings, type Density } from "@/context/settings-context"
import { api } from "@/lib/api"
import { formatDateTime, formatNumber } from "@/lib/format"

declare global {
  interface ImportMeta {
    env: { VITE_API_URL?: string }
  }
}

const featureLabels: Record<string, string> = {
  investigations: "Investigations",
  assistant: "Copilot assistant",
  anomaly_detection: "Anomaly detection",
  external_llm: "External LLM",
}

function SettingRow({
  htmlFor,
  label,
  description,
  control,
}: {
  htmlFor?: string
  label: string
  description: string
  control: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-md">
        <Label htmlFor={htmlFor}>{label}</Label>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

export function SettingsPage() {
  const {
    theme,
    density,
    sidebarCollapsed,
    autoRefresh,
    refreshSeconds,
    lastRefresh,
    toggleTheme,
    toggleSidebar,
    setDensity,
    setAutoRefresh,
    setRefreshSeconds,
  } = useSettings()

  const health = useQuery({ queryKey: ["health"], queryFn: api.health, retry: false })
  const appSettings = useQuery({ queryKey: ["settings"], queryFn: api.settings, retry: false })
  const features = appSettings.data?.features
  const featureRows = features ? Object.entries(features) : []
  const baseUrl = import.meta.env.VITE_API_URL ?? "/api"

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Interface preferences persist in this browser only. They do not change backend data, analytics or API behaviour."
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Controls how the application is displayed on this device.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <SettingRow
            htmlFor="theme-switch"
            label="Dark theme"
            description="Switch between the warm off-white and charcoal dark colour schemes."
            control={<Switch id="theme-switch" checked={theme === "dark"} onCheckedChange={() => toggleTheme()} />}
          />
          <SettingRow
            htmlFor="density-select"
            label="Table density"
            description="Compact reduces vertical padding across claim and investigation tables."
            control={
              <Select value={density} onValueChange={(value) => setDensity(value as Density)}>
                <SelectTrigger id="density-select" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comfortable">Comfortable</SelectItem>
                  <SelectItem value="compact">Compact</SelectItem>
                </SelectContent>
              </Select>
            }
          />
          <SettingRow
            htmlFor="sidebar-switch"
            label="Collapsible sidebar"
            description="Reduce the navigation sidebar to icons; you can also toggle it from the top bar."
            control={
              <Switch id="sidebar-switch" checked={sidebarCollapsed} onCheckedChange={() => toggleSidebar()} />
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Data &amp; refresh</CardTitle>
            <CardDescription>Controls the date filter and automatic query refresh.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <SettingRow
            htmlFor="auto-refresh-switch"
            label="Auto-refresh"
            description="Periodically re-fetch analytics and dashboard data while the application is open."
            control={
              <Switch
                id="auto-refresh-switch"
                checked={autoRefresh}
                onCheckedChange={(value) => setAutoRefresh(value)}
              />
            }
          />
          <SettingRow
            htmlFor="refresh-select"
            label="Refresh interval"
            description="Seconds between automatic refreshes when auto-refresh is enabled."
            control={
              <Select value={String(refreshSeconds)} onValueChange={(value) => setRefreshSeconds(Number(value))}>
                <SelectTrigger id="refresh-select" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">60 seconds</SelectItem>
                  <SelectItem value="120">120 seconds</SelectItem>
                </SelectContent>
              </Select>
            }
          />
          <SettingRow
            label="Last refresh"
            description="Time of the most recent manual or automatic data refresh in this browser session."
            control={
              <span className="num text-xs text-foreground">
                {lastRefresh ? formatDateTime(lastRefresh.toISOString()) : "Not refreshed"}
              </span>
            }
          />
          <div className="pt-3">
            <p className="text-xs font-medium text-foreground">Reporting period</p>
            <p className="mt-1 text-xs text-muted-foreground">Applied to analytics and overview queries on the server.</p>
            <div className="mt-3">
              <DateRangeControl />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Currency</CardTitle>
            <CardDescription>Display setting for monetary values.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm font-medium text-foreground">NPR (Nepalese Rupee)</p>
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
            All amounts are shown in Nepalese Rupees. No exchange-rate conversion is performed and no alternate display
            currency is available.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>API connection</CardTitle>
            <CardDescription>Live status of the configured backend.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 rounded border border-border bg-muted/40 px-3 py-2 font-mono text-2xs text-foreground">
            <Server className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {baseUrl}
          </div>
          {health.isPending ? (
            <LoadingState rows={2} />
          ) : health.isError ? (
            <ErrorState message={health.error.message} onRetry={() => void health.refetch()} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Status" value={health.data?.status ?? "—"} icon={<Activity className="h-4 w-4 text-primary" />} />
              <Metric label="Database" value={health.data?.database ?? "—"} icon={<Database className="h-4 w-4 text-muted-foreground" />} />
              <Metric label="Claims" value={formatNumber(health.data?.claims)} hint="Records available to queries" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Application information</CardTitle>
            <CardDescription>Version and dataset details reported by the backend.</CardDescription>
          </div>
          {appSettings.isSuccess ? <Badge variant="neutral">v{appSettings.data.version}</Badge> : null}
        </CardHeader>
        <CardContent>
          {appSettings.isPending ? (
            <LoadingState rows={4} />
          ) : appSettings.isError ? (
            <ErrorState message={appSettings.error.message} onRetry={() => void appSettings.refetch()} />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Application</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{appSettings.data?.application ?? "—"}</p>
                </div>
                <div>
                  <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Version</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{appSettings.data?.version ?? "—"}</p>
                </div>
                <div>
                  <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Database</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{appSettings.data?.database ?? "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Dataset records</p>
                <p className="num mt-1 text-sm font-medium text-foreground">
                  {formatNumber(appSettings.data?.dataset_records)}
                </p>
              </div>
              <div>
                <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Dataset source</p>
                <p className="mt-1 break-all font-mono text-2xs text-muted-foreground">
                  {appSettings.data?.dataset ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Features</p>
                <div className="mt-2 divide-y divide-border border-y border-border">
                  {featureRows.map(([key, enabled]) => (
                    <div key={key} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-xs text-muted-foreground">{featureLabels[key] ?? key}</span>
                      <Badge variant={enabled ? "success" : "neutral"}>{enabled ? "Enabled" : "Disabled"}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              <p className="border-t border-border pt-3 text-2xs leading-relaxed text-muted-foreground">
                {appSettings.data?.disclaimer}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
