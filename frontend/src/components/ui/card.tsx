import type { HTMLAttributes, ReactNode } from "react"

import { cn } from "@/lib/utils"

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "card-accent relative overflow-hidden rounded-lg border border-border bg-card shadow-subtle transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card",
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-start justify-between gap-4 border-b border-border px-5 py-3.5", className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold tracking-tight text-foreground", className)} {...props} />
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-sm text-muted-foreground", className)} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-5", className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between border-t border-border px-5 py-3 text-sm", className)} {...props} />
}

export function Metric({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {icon ? <span className="text-primary/80">{icon}</span> : null}
      </div>
      <div className="num mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</div>
      {hint ? <div className="mt-1.5 text-sm text-muted-foreground">{hint}</div> : null}
    </Card>
  )
}
