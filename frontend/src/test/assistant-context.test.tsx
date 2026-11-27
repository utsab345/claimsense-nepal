import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AssistantProvider, useAssistant } from "@/context/assistant-context"
import { api } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  api: {
    ask: vi.fn(),
  },
}))

const ask = vi.mocked(api.ask)

function Harness() {
  const { send } = useAssistant()
  return (
    <div>
      <button onClick={() => send("?")}>Send short</button>
      <button onClick={() => send("What is the average claim amount?")}>Send valid</button>
    </div>
  )
}

describe("assistant context", () => {
  beforeEach(() => {
    ask.mockReset()
    ask.mockResolvedValue({
      answer: "The average claim amount is NPR 200,000.00 across 3 claims.",
      citations: ["Claims database"],
      supported: true,
      claim_ids: [],
      calculation: "AVG(claim_amount)",
    })
  })

  it("only sends questions that satisfy the backend validation rule", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AssistantProvider>
          <Harness />
        </AssistantProvider>
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Send short" }))
    expect(ask).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Send valid" }))
    await waitFor(() => expect(ask).toHaveBeenCalledWith("What is the average claim amount?"))
    expect(ask).toHaveBeenCalledTimes(1)
  })
})
