import type { ReactNode } from "react"

import { EmptyState } from "@/components/common/states"
import { formatDateTime } from "@/lib/format"

export interface TimelineEntry {
  id: string | number
  title: string
  detail?: string
  timestamp: string
  icon?: ReactNode
}

export function ActivityTimeline({ entries, emptyTitle = "No activity recorded" }: { entries: TimelineEntry[]; emptyTitle?: string }) {
  if (!entries.length) return <EmptyState title={emptyTitle} description="New activity will appear here as it is recorded." />
  return (
    <ol className="relative space-y-4 border-l border-border pl-4">
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -left-[21px] top-0.5 flex h-3 w-3 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
            {entry.icon}
          </span>
          <div className="text-sm font-medium text-foreground">{entry.title}</div>
          {entry.detail ? <div className="mt-0.5 text-xs text-muted-foreground">{entry.detail}</div> : null}
          <div className="num mt-1 text-2xs text-muted-foreground/80">{formatDateTime(entry.timestamp)}</div>
        </li>
      ))}
    </ol>
  )
}
