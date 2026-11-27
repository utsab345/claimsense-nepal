import type { HTMLAttributes } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva("inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      neutral: "border-border bg-muted text-muted-foreground",
      success: "border-primary/25 bg-primary/10 text-primary",
      warning: "border-warning/30 bg-warning/10 text-warning",
      danger: "border-destructive/30 bg-destructive/10 text-destructive",
      info: "border-foreground/15 bg-foreground/5 text-foreground",
    },
  },
  defaultVariants: { variant: "neutral" },
})

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
