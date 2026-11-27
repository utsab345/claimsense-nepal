import { useEffect, useRef, useState, type FormEvent } from "react"
import { Bot, CornerDownLeft, Eraser, Sparkles } from "lucide-react"

import { AssistantMessage } from "@/components/common/assistant-message"
import { ThinkingIndicator } from "@/components/common/thinking-indicator"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/feedback"
import { useAssistant } from "@/context/assistant-context"
import { useCopilotSuggestions } from "@/hooks/use-copilot-suggestions"

const PLACEHOLDERS = [
  "Ask why a claim was flagged…",
  "Ask about high-priority exposure…",
  "Ask for a portfolio summary…",
]

export function AssistantPanel() {
  const { open, setOpen, messages, pending, send, clear } = useAssistant()
  const [question, setQuestion] = useState("")
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const bottom = useRef<HTMLDivElement>(null)
  const suggestions = useCopilotSuggestions()

  useEffect(() => {
    const timer = window.setInterval(
      () => setPlaceholderIndex((current) => (current + 1) % PLACEHOLDERS.length),
      3500,
    )
    return () => window.clearInterval(timer)
  }, [])

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
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary shadow-sm">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-semibold">Insurance Copilot</DialogTitle>
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
            <AssistantMessage
              key={message.id}
              message={message}
              onAsk={send}
              onOpenClaim={() => setOpen(false)}
              compact
            />
          ))}
          {pending ? <ThinkingIndicator compact /> : null}
          <div ref={bottom} />
        </div>

        <div className="border-t border-border p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Try
          </div>
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
            {suggestions.map((suggestion) => (
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
              placeholder={PLACEHOLDERS[placeholderIndex]}
              className="h-10 flex-1 rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
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
