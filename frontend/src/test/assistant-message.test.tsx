import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { AssistantMessage } from "@/components/common/assistant-message"
import type { ChatMessage } from "@/context/assistant-context"

const message: ChatMessage = {
  id: "a-1",
  role: "assistant",
  text: "There are 18 claims with high review priority.",
  answer: {
    answer: "There are 18 claims with high review priority.",
    citations: ["Claims database"],
    supported: true,
    claim_ids: ["CLM-00001"],
    calculation: "COUNT(claims) WHERE review_priority = 'High'",
    tool: "high_priority_claims",
    follow_ups: ["Why was claim CLM-00001 flagged?"],
  },
}

describe("AssistantMessage", () => {
  it("shows the grounded tool and sends follow-up questions", () => {
    const onAsk = vi.fn()
    render(
      <MemoryRouter>
        <AssistantMessage message={message} onAsk={onAsk} />
      </MemoryRouter>,
    )

    expect(screen.getByText("High Priority Claims")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Why was claim CLM-00001 flagged/ }))
    expect(onAsk).toHaveBeenCalledWith("Why was claim CLM-00001 flagged?")
  })
})
