import type { ReactNode } from "react"

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function ChartCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actions}
      </CardHeader>
      <div className="px-2 py-3">{children}</div>
    </Card>
  )
}
