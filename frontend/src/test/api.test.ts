import { afterEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"

describe("api client", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("surfaces FastAPI validation messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ detail: [{ msg: "question must contain at least 3 characters" }] }),
      }),
    )

    await expect(api.ask("?")).rejects.toMatchObject({
      message: "question must contain at least 3 characters",
      status: 422,
    })
  })

  it("reports an unreachable backend", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))

    await expect(api.health()).rejects.toMatchObject({
      message: "Cannot reach the API. Check the backend connection.",
      status: 0,
    })
  })
})
