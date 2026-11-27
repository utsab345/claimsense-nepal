import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

const STAGES = [
  "Matching a read-only tool",
  "Querying the claims database",
  "Grounding the answer",
]

export function ThinkingIndicator({ compact = false }: { compact?: boolean }) {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setStage((current) => (current + 1) % STAGES.length), 700)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <span className="flex items-center gap-1">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className={cn("h-1.5 w-1.5 rounded-full bg-primary animate-pulse", dot !== stage && "opacity-35")}
          />
        ))}
      </span>
      <span>{STAGES[stage]}…</span>
      {compact ? null : <span className="text-2xs text-muted-foreground/70">No external model</span>}
    </div>
  )
}
