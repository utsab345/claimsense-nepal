import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Bot, CornerDownLeft, Eraser, MessageSquare, PanelRightOpen } from "lucide-react"

import { PageHeader } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/controls"
import { useAssistant, type ChatMessage } from "@/context/assistant-context"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

const BASE_SUGGESTIONS = [
  "What are the five highest-priority claims?",
  "What is the financial exposure of high-priority claims?",
  "Which incident categories have the highest average claim amounts?",
  "Were there claims within 14 days of policy start?",
  "Summarize the claims portfolio.",
]

const TOOLS = [
  { name: "claim_explanation", detail: "Stored indicators and score for one claim ID" },
  { name: "high_priority_claims", detail: "Claims with High review priority, ranked by score" },
  { name: "financial_exposure", detail: "Sum of claim amounts in high-priority claims" },
  { name: "incident_amounts", detail: "Amounts grouped by incident category" },
  { name: "early_claim_patterns", detail: "Claims shortly after policy start" },
  { name: "portfolio_summary", detail: "Counts and totals across the dataset" },
]

const GUARDRAILS = [
  "No arbitrary SQL is executed; only the fixed read-only tools above can query.",
  "No external LLM is configured; answers follow deterministic rules.",
  "Unsupported questions receive a deterministic fallback response.",
  "No records are fabricated; answers cite database aggregates or claim IDs.",
  "Risk scores are not fraud probabilities and never trigger rejection.",
]

function MessageItem({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"
  const unsupported = message.answer !== undefined && !message.answer.supported

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[92%] rounded border px-3 py-2 text-xs leading-relaxed",
          isUser ? "border-primary/20 bg-primary/10 text-foreground" : "border-border bg-muted/40 text-foreground",
        )}
      >
        <div className="mb-1 flex flex-wrap items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          {!isUser ? <MessageSquare className="h-3 w-3" /> : null}
          {isUser ? "You" : "Copilot"}
          {unsupported ? <Badge variant="warning">Not supported</Badge> : null}
        </div>
        <p className="whitespace-pre-wrap">{message.text}</p>
        {unsupported ? (
          <p className="mt-2 rounded border border-warning/30 bg-warning/10 px-2 py-1 text-2xs text-warning">
            This question is outside the supported tool set. No records were inferred.
          </p>
        ) : null}
        {message.error ? <p className="mt-1 text-2xs text-destructive">{message.error}</p> : null}
        {message.answer?.claim_ids?.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.answer.claim_ids.map((id) => (
              <Link key={id} to={`/claims/${id}`}>
                <Badge variant="info" className="hover:text-primary">
                  {id}
                </Badge>
              </Link>
            ))}
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

export function CopilotPage() {
  const { messages, pending, send, clear, setOpen } = useAssistant()
  const [question, setQuestion] = useState("")
  const logRef = useRef<HTMLDivElement>(null)
  const priorityQuery = useQuery({ queryKey: ["high-risk-claims"], queryFn: api.highRisk })
  const suggestions = useMemo(() => {
    const claimId = priorityQuery.data?.[0]?.claim_id
    return claimId
      ? [`Explain why claim ${claimId} was flagged`, ...BASE_SUGGESTIONS]
      : BASE_SUGGESTIONS
  }, [priorityQuery.data])

  useEffect(() => {
    const node = logRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, pending])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!question.trim()) return
    send(question)
    setQuestion("")
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Copilot"
        description="Database-grounded assistant for the generated claims dataset. It uses read-only tools, cites the records behind each answer and never writes to the database."
        actions={
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <PanelRightOpen className="h-3.5 w-3.5" /> Open side panel
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="flex min-h-[70vh] flex-col">
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded bg-primary/10 text-primary">
                <Bot className="h-4 w-4" />
              </span>
              <div>
                <CardTitle>Conversation</CardTitle>
                <CardDescription>Ask about claims, exposure, incident amounts or the portfolio.</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={clear} aria-label="Clear conversation">
              <Eraser className="h-3.5 w-3.5" /> Clear
            </Button>
          </CardHeader>

          <div ref={logRef} className="max-h-[60vh] flex-1 space-y-4 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
            {messages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))}
            {pending ? <p className="text-xs text-muted-foreground">Querying the claims database…</p> : null}
          </div>

          <div className="border-t border-border p-3">
            <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-2xs"
                  onClick={() => send(suggestion)}
                  disabled={pending}
                >
                  {suggestion.length > 40 ? `${suggestion.slice(0, 38)}…` : suggestion}
                </Button>
              ))}
            </div>
            <form onSubmit={submit} className="flex gap-2">
              <Input
                aria-label="Ask a question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask about claims, exposure or risk…"
              />
              <Button type="submit" size="icon" aria-label="Send question" disabled={pending || question.trim().length < 3 || question.trim().length > 500}>
                <CornerDownLeft className="h-4 w-4" />
              </Button>
            </form>
            <p className="mt-2 text-2xs text-muted-foreground">
              Answers describe generated records only, not the Nepal insurance market.
            </p>
          </div>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <div>
              <CardTitle>How answers are grounded</CardTitle>
              <CardDescription>Fixed read-only tools answer the supported question types.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Read-only tools</p>
              <ul className="mt-2 divide-y divide-border border-y border-border">
                {TOOLS.map((tool) => (
                  <li key={tool.name} className="py-2">
                    <p className="font-mono text-2xs font-medium text-foreground">{tool.name}</p>
                    <p className="mt-0.5 text-2xs text-muted-foreground">{tool.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Boundaries</p>
              <ul className="mt-2 space-y-2 text-2xs leading-relaxed text-muted-foreground">
                {GUARDRAILS.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
