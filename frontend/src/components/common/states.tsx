import type { ReactNode } from "react"
import { AlertCircle, Inbox } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/feedback"

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded border border-border bg-muted text-muted-foreground">
        <Inbox className="h-4 w-4" />
      </div>
      <p className="text-base font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded border border-destructive/30 bg-destructive/10 text-destructive">
        <AlertCircle className="h-4 w-4" />
      </div>
      <p className="text-base font-medium text-foreground">Unable to load this view</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}

export function LoadingState({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  )
}

export function CardError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card>
      <ErrorState message={message} onRetry={onRetry} />
    </Card>
  )
}
