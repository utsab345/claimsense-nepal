import { ArrowUpRight, CornerDownRight, MessageSquare, Sparkles } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import type { ChatMessage } from "@/context/assistant-context"
import { cn } from "@/lib/utils"

function toolLabel(tool: string) {
  return tool
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function AssistantMessage({
  message,
  onAsk,
  onOpenClaim,
  compact = false,
}: {
  message: ChatMessage
  onAsk: (question: string) => void
  onOpenClaim?: () => void
  compact?: boolean
}) {
  const isUser = message.role === "user"
  const unsupported = message.answer !== undefined && !message.answer.supported

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[92%] rounded-md border px-3.5 py-3 text-sm leading-relaxed shadow-sm",
          isUser
            ? "border-primary/25 bg-gradient-to-br from-primary/15 to-primary/5 text-foreground"
            : "border-border bg-card/80 text-foreground",
        )}
      >
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          {!isUser ? <MessageSquare className="h-3.5 w-3.5 text-primary" /> : null}
          {isUser ? "You" : "Copilot"}
          {!isUser && message.answer?.tool && message.answer.tool !== "unsupported" ? (
            <Badge variant="info" className="normal-case tracking-normal">
              <Sparkles className="h-3 w-3" /> {toolLabel(message.answer.tool)}
            </Badge>
          ) : null}
          {unsupported ? <Badge variant="warning">Not supported</Badge> : null}
        </div>

        <p className="whitespace-pre-wrap">{message.text}</p>

        {unsupported ? (
          <p className="mt-2 rounded border border-warning/30 bg-warning/10 px-2 py-1.5 text-2xs text-warning">
            This question is outside the supported tool set. No records were inferred.
          </p>
        ) : null}
        {message.error ? <p className="mt-1 text-xs text-destructive">{message.error}</p> : null}

        {message.answer?.claim_ids?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(compact ? message.answer.claim_ids.slice(0, 5) : message.answer.claim_ids).map((id) => (
              <Link key={id} to={`/claims/${id}`} onClick={onOpenClaim}>
                <Badge variant="info" className="hover:text-primary">
                  {id} <ArrowUpRight className="h-3 w-3" />
                </Badge>
              </Link>
            ))}
          </div>
        ) : null}

        {message.answer?.follow_ups?.length && !unsupported ? (
          <div className="mt-3 border-t border-border pt-2.5">
            <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Ask next</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {message.answer.follow_ups.slice(0, compact ? 1 : 2).map((followUp) => (
                <button
                  key={followUp}
                  type="button"
                  onClick={() => onAsk(followUp)}
                  className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-2xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                >
                  <CornerDownRight className="h-3 w-3" /> {followUp}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {message.answer?.calculation ? (
          <p className="mt-2 border-t border-border pt-2 font-mono text-2xs text-muted-foreground">
            {message.answer.calculation}
          </p>
        ) : null}
        {message.answer?.citations?.length ? (
          <p className="mt-1 text-2xs text-muted-foreground/80">Source: {message.answer.citations.join(" · ")}</p>
        ) : null}
      </div>
    </div>
  )
}
