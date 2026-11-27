import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { Bot, CornerDownLeft, Eraser, MessageSquare } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/feedback"
import { useAssistant } from "@/context/assistant-context"
import { cn } from "@/lib/utils"

const SUGGESTIONS = [
  "Why was claim CLM-00001 flagged?",
  "What are the five highest-priority claims?",
  "What is the financial exposure of high-priority claims?",
  "Which incident categories have the highest average claim amounts?",
  "Summarize the claims portfolio.",
]

export function AssistantPanel() {
  const { open, setOpen, messages, pending, send, clear } = useAssistant()
  const [question, setQuestion] = useState("")
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) bottom.current?.scrollIntoView({ block: "end" })
  }, [messages, open, pending])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!question.trim()) return
    send(question)
    setQuestion("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="left-auto right-0 top-0 flex h-full max-w-md translate-x-0 translate-y-0 flex-col rounded-none border-y-0 border-r-0 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary/10 text-primary">
              <Bot className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle className="text-sm font-semibold">Insurance Copilot</DialogTitle>
              <DialogDescription className="mt-0.5 text-2xs text-muted-foreground">
                Read-only answers from the claims database
              </DialogDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={clear} aria-label="Clear conversation">
            <Eraser className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
          {messages.map((message) => (
            <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[92%] rounded border px-3 py-2 text-xs leading-relaxed",
                  message.role === "user"
                    ? "border-primary/20 bg-primary/10 text-foreground"
                    : "border-border bg-muted/40 text-foreground",
                )}
              >
                <div className="mb-1 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                  {message.role === "assistant" ? <MessageSquare className="h-3 w-3" /> : null}
                  {message.role === "assistant" ? "Copilot" : "You"}
                  {message.answer !== undefined && !message.answer.supported ? (
                    <Badge variant="warning">Not supported</Badge>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap">{message.text}</p>
                {message.error ? <p className="mt-1 text-2xs text-destructive">{message.error}</p> : null}
                {message.answer?.claim_ids?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {message.answer.claim_ids.slice(0, 5).map((id) => (
                      <Link key={id} to={`/claims/${id}`} onClick={() => setOpen(false)}>
                        <Badge variant="info" className="hover:text-primary">{id}</Badge>
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
                  <p className="mt-1 text-2xs text-muted-foreground/80">
                    Source: {message.answer.citations.join(" · ")}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
          {pending ? <p className="text-xs text-muted-foreground">Querying the claims database…</p> : null}
          <div ref={bottom} />
        </div>

        <div className="border-t border-border p-3">
          <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
            {SUGGESTIONS.map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                className="shrink-0 text-2xs"
                onClick={() => send(suggestion)}
                disabled={pending}
              >
                {suggestion.length > 34 ? `${suggestion.slice(0, 32)}…` : suggestion}
              </Button>
            ))}
          </div>
          <form onSubmit={submit} className="flex gap-2">
            <input
              aria-label="Ask a question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about claims, exposure or risk…"
              className="h-9 flex-1 rounded border border-input bg-card px-2.5 text-sm placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button type="submit" size="icon" aria-label="Send question" disabled={pending || question.trim().length < 3 || question.trim().length > 500}>
              <CornerDownLeft className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-2 text-2xs text-muted-foreground">
            Predefined read-only database tools. No arbitrary SQL, no external LLM configured.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
