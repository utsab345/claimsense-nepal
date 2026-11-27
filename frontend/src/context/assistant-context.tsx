import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import { useMutation } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { AssistantAnswer } from "@/lib/types"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  text: string
  answer?: AssistantAnswer
  error?: string
}

interface AssistantState {
  open: boolean
  setOpen: (open: boolean) => void
  messages: ChatMessage[]
  pending: boolean
  send: (question: string) => void
  clear: () => void
}

const AssistantContext = createContext<AssistantState | null>(null)

const welcome: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text: "Ask about a claim, high-priority exposure, incident amounts or the portfolio. Answers come from the claims database.",
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([welcome])

  const mutation = useMutation({
    mutationFn: (question: string) => api.ask(question),
    onSuccess: (answer, _question) => {
      setMessages((current) => [
        ...current,
        { id: `a-${Date.now()}`, role: "assistant", text: answer.answer, answer },
      ])
    },
    onError: (error, question) => {
      setMessages((current) => [
        ...current.filter((message) => !(message.role === "user" && message.text === question)),
        { id: `e-${Date.now()}`, role: "assistant", text: "The assistant could not answer that question.", error: error instanceof Error ? error.message : "Unknown error" },
      ])
    },
  })

  const value = useMemo<AssistantState>(
    () => ({
      open,
      setOpen,
      messages,
      pending: mutation.isPending,
      send: (question) => {
        const trimmed = question.trim()
        if (trimmed.length < 3 || trimmed.length > 500 || mutation.isPending) return
        setMessages((current) => [...current, { id: `u-${Date.now()}`, role: "user", text: trimmed }])
        mutation.mutate(trimmed)
      },
      clear: () => setMessages([welcome]),
    }),
    [open, messages, mutation],
  )

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>
}

export function useAssistant(): AssistantState {
  const context = useContext(AssistantContext)
  if (!context) throw new Error("useAssistant must be used inside AssistantProvider")
  return context
}
