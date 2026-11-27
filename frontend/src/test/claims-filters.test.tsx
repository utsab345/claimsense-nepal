import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SettingsProvider } from "@/context/settings-context"
import { api } from "@/lib/api"
import { ClaimsPage } from "@/pages/claims"

vi.mock("@/lib/api", () => ({
  api: {
    claims: vi.fn(),
    trends: vi.fn(),
  },
  claimsExportUrl: vi.fn(() => "/api/claims/export"),
}))

const claims = vi.mocked(api.claims)
const trends = vi.mocked(api.trends)

describe("ClaimsPage filters", () => {
  beforeEach(() => {
    claims.mockReset()
    trends.mockReset()
    claims.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 })
    trends.mockResolvedValue({ monthly: [], incident_types: [], statuses: [] })
  })

  it("passes the active search filter to the claims API", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SettingsProvider>
          <MemoryRouter>
            <ClaimsPage />
          </MemoryRouter>
        </SettingsProvider>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(claims).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText("Search claims"), { target: { value: "CLM-00001" } })

    await waitFor(() =>
      expect(claims).toHaveBeenLastCalledWith(expect.objectContaining({ search: "CLM-00001", limit: 20 })),
    )
  })
})
