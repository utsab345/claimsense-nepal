import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { Link } from "react-router-dom"

import { AnomalyIndicator, RiskBadge, StatusBadge } from "@/components/common/badges"
import { EmptyState } from "@/components/common/states"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, formatNPR } from "@/lib/format"
import type { Claim } from "@/lib/types"

export type SortField = "claim_date" | "claim_amount" | "risk_score"
export type SortDirection = "asc" | "desc"

interface ClaimTableProps {
  claims: Claim[]
  sortBy?: SortField
  sortDir?: SortDirection
  onSort?: (field: SortField) => void
  emptyTitle?: string
  emptyDescription?: string
}

const columns: { key: SortField; label: string }[] = [
  { key: "claim_amount", label: "Claim amount" },
  { key: "risk_score", label: "Risk" },
  { key: "claim_date", label: "Date" },
]

export function ClaimTable({ claims, sortBy, sortDir, onSort, emptyTitle, emptyDescription }: ClaimTableProps) {
  if (!claims.length) {
    return <EmptyState title={emptyTitle ?? "No claims found"} description={emptyDescription ?? "Adjust the filters or search terms to see more records."} />
  }

  const sortIcon = (key: SortField) => {
    if (sortBy !== key) return <ArrowUpDown className="h-3 w-3 opacity-50" />
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Claim</TableHead>
          <TableHead>Incident</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Status</TableHead>
          {columns.map((column) => (
            <TableHead key={column.key} className="text-right">
              {onSort ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground"
                  onClick={() => onSort(column.key)}
                >
                  {column.label}
                  {sortIcon(column.key)}
                </button>
              ) : (
                column.label
              )}
            </TableHead>
          ))}
          <TableHead className="text-right">Anomaly</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {claims.map((claim) => (
          <TableRow key={claim.claim_id}>
            <TableCell>
              <Link className="font-medium text-foreground hover:text-primary hover:underline" to={`/claims/${claim.claim_id}`}>
                {claim.claim_id}
              </Link>
              <div className="text-xs text-muted-foreground">{claim.policy_id}</div>
            </TableCell>
            <TableCell>{claim.incident_type}</TableCell>
            <TableCell className="text-muted-foreground">{claim.incident_location ?? "Unknown"}</TableCell>
            <TableCell>
              <StatusBadge status={claim.claim_status} />
            </TableCell>
            <TableCell className="num text-right whitespace-nowrap">{formatNPR(claim.claim_amount)}</TableCell>
            <TableCell className="text-right">
              <RiskBadge priority={claim.review_priority} score={claim.risk_score} />
            </TableCell>
            <TableCell className="num text-right text-muted-foreground">{formatDate(claim.claim_date)}</TableCell>
            <TableCell className="text-right">
              <AnomalyIndicator value={claim.is_anomaly} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
