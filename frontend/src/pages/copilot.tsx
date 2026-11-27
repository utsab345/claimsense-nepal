import { useEffect, useRef, useState, type FormEvent } from "react"
import { Bot, CornerDownLeft, Eraser, PanelRightOpen, Sparkles } from "lucide-react"

import { AssistantMessage } from "@/components/common/assistant-message"
import { ThinkingIndicator } from "@/components/common/thinking-indicator"
import { PageHeader } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/controls"
import { useAssistant } from "@/context/assistant-context"
import { useCopilotSuggestions } from "@/hooks/use-copilot-suggestions"

const PLACEHOLDERS = [
  "Ask why a claim was flagged…",
  "Ask about high-priority exposure…",
  "Ask for a portfolio summary…",
]

const TOOLS = [
  { name: "average_claim_amount", detail: "Average claimed amount across the dataset" },
  { name: "claim_explanation", detail: "Stored indicators and score for one claim ID" },
  { name: "early_claim_patterns", detail: "Claims shortly after policy start" },
  { name: "financial_exposure", detail: "Sum of claim amounts in high-priority claims" },
  { name: "high_priority_claims", detail: "Claims with High review priority, ranked by score" },
  { name: "incident_amounts", detail: "Amounts grouped by incident category" },
  { name: "portfolio_summary", detail: "Counts and totals across the dataset" },
  { name: "unusual_missing_documents", detail: "Stored outliers with missing documents" },
]

const GUARDRAILS = [
  "No arbitrary SQL is executed; only the fixed read-only tools above can query.",
  "No external LLM is configured; answers follow deterministic rules.",
  "Unsupported questions receive a deterministic fallback response.",
  "No records are fabricated; answers cite database aggregates or claim IDs.",
  "Risk scores are not fraud probabilities and never trigger rejection.",
]

export function CopilotPage() {
  const { messages, pending, send, clear, setOpen } = useAssistant()
  const [question, setQuestion] = useState("")
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const logRef = useRef<HTMLDivElement>(null)
  const suggestions = useCopilotSuggestions()

  useEffect(() => {
    const timer = window.setInterval(
      () => setPlaceholderIndex((current) => (current + 1) % PLACEHOLDERS.length),
      3500,
    )
    return () => window.clearInterval(timer)
  }, [])

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
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary shadow-sm">
                <Bot className="h-5 w-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>Conversation</CardTitle>
                  <Badge variant="success">Live SQLite</Badge>
                </div>
                <CardDescription>Ask about claims, exposure, incident amounts or the portfolio.</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={clear} aria-label="Clear conversation">
              <Eraser className="h-3.5 w-3.5" /> Clear
            </Button>
          </CardHeader>

          <div ref={logRef} className="max-h-[60vh] flex-1 space-y-4 overflow-y-auto px-5 py-5" role="log" aria-live="polite">
            {messages.map((message) => (
              <AssistantMessage key={message.id} message={message} onAsk={send} />
            ))}
            {pending ? <ThinkingIndicator /> : null}
          </div>

          <div className="border-t border-border p-4">
            <div className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Suggested from live data
            </div>
            <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => send(suggestion)}
                  disabled={pending}
                >
                  {suggestion.length > 44 ? `${suggestion.slice(0, 42)}…` : suggestion}
                </Button>
              ))}
            </div>
            <form onSubmit={submit} className="flex gap-2">
              <Input
                aria-label="Ask a question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={PLACEHOLDERS[placeholderIndex]}
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
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Read-only tools</p>
              <ul className="mt-2 divide-y divide-border border-y border-border">
                {TOOLS.map((tool) => (
                  <li key={tool.name} className="py-2">
                    <p className="font-mono text-xs font-medium text-foreground">{tool.name}</p>
                    <p className="mt-0.5 text-2xs text-muted-foreground">{tool.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Boundaries</p>
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
