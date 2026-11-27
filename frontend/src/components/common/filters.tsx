import { CalendarDays, Download, RotateCcw, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/controls"
import { useSettings, type DatePreset } from "@/context/settings-context"
import { claimsExportUrl } from "@/lib/api"
import type { ClaimFilters, ClaimStatus, ReviewPriority } from "@/lib/types"

export interface FilterValues {
  search: string
  status: ClaimStatus | ""
  risk: ReviewPriority | ""
  incident: string
  anomaly: "true" | "false" | ""
}

export const emptyFilters: FilterValues = { search: "", status: "", risk: "", incident: "", anomaly: "" }

export function FilterBar({
  value,
  onChange,
  onReset,
  incidents,
  showAnomaly = true,
}: {
  value: FilterValues
  onChange: (next: FilterValues) => void
  onReset: () => void
  incidents: string[]
  showAnomaly?: boolean
}) {
  const set = (key: keyof FilterValues, next: string) => onChange({ ...value, [key]: next })

  return (
    <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-5">
      <div className="relative sm:col-span-2 lg:col-span-2">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          aria-label="Search claims"
          placeholder="Search claim, policy or customer ID"
          className="pl-8"
          value={value.search}
          onChange={(event) => set("search", event.target.value)}
        />
      </div>
      <Select value={value.status || "all"} onValueChange={(next) => set("status", next === "all" ? "" : next)}>
        <SelectTrigger aria-label="Filter by status">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {["Open", "Under Review", "Approved", "Rejected", "Paid"].map((status) => (
            <SelectItem key={status} value={status}>
              {status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={value.risk || "all"} onValueChange={(next) => set("risk", next === "all" ? "" : next)}>
        <SelectTrigger aria-label="Filter by risk level">
          <SelectValue placeholder="All risk levels" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All risk levels</SelectItem>
          <SelectItem value="High">High</SelectItem>
          <SelectItem value="Medium">Medium</SelectItem>
          <SelectItem value="Low">Low</SelectItem>
        </SelectContent>
      </Select>
      <Select value={value.incident || "all"} onValueChange={(next) => set("incident", next === "all" ? "" : next)}>
        <SelectTrigger aria-label="Filter by incident type">
          <SelectValue placeholder="All incidents" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All incidents</SelectItem>
          {incidents.map((incident) => (
            <SelectItem key={incident} value={incident}>
              {incident}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showAnomaly ? (
        <Select value={value.anomaly || "all"} onValueChange={(next) => set("anomaly", next === "all" ? "" : next)}>
          <SelectTrigger aria-label="Filter by anomaly status">
            <SelectValue placeholder="Anomaly: any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anomaly: any</SelectItem>
            <SelectItem value="true">Anomaly flagged</SelectItem>
            <SelectItem value="false">No anomaly</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
      <div className="flex items-end lg:justify-end">
        <Button variant="ghost" size="sm" onClick={onReset} type="button">
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </Button>
      </div>
    </div>
  )
}

export function DateRangeControl() {
  const { dateRange, setDatePreset, setCustomRange } = useSettings()
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="date-preset">Date range</Label>
        <Select value={dateRange.preset} onValueChange={(next) => setDatePreset(next as DatePreset)}>
          <SelectTrigger id="date-preset" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All dates</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="12m">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="date-from">From</Label>
        <Input
          id="date-from"
          type="date"
          className="w-36"
          value={dateRange.from ?? ""}
          onChange={(event) => setCustomRange(event.target.value || undefined, dateRange.to)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="date-to">To</Label>
        <Input
          id="date-to"
          type="date"
          className="w-36"
          value={dateRange.to ?? ""}
          onChange={(event) => setCustomRange(dateRange.from, event.target.value || undefined)}
        />
      </div>
      <div className="hidden items-center gap-1 pb-2 text-2xs text-muted-foreground lg:flex">
        <CalendarDays className="h-3.5 w-3.5" /> Backend-filtered
      </div>
    </div>
  )
}

export function ExportClaimsButton({ filters }: { filters: ClaimFilters }) {
  return (
    <Button asChild variant="outline" size="sm">
      <a href={claimsExportUrl(filters)} download>
        <Download className="h-3.5 w-3.5" /> Export CSV
      </a>
    </Button>
  )
}
