import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { SettingsProvider, useSettings } from "@/context/settings-context"

function Harness() {
  const { theme, toggleTheme, density, setDensity, setLastRefresh, lastRefresh } = useSettings()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="density">{density}</span>
      <span data-testid="refresh">{lastRefresh ? "refreshed" : "not refreshed"}</span>
      <button onClick={toggleTheme}>Toggle theme</button>
      <button onClick={() => setDensity("compact")}>Compact</button>
      <button onClick={() => setLastRefresh(new Date())}>Refresh</button>
    </div>
  )
}

describe("SettingsProvider", () => {
  it("applies and persists global theme and density settings", () => {
    render(
      <SettingsProvider>
        <Harness />
      </SettingsProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }))
    expect(document.documentElement).toHaveClass("dark")
    expect(screen.getByTestId("theme")).toHaveTextContent("dark")
    expect(JSON.parse(localStorage.getItem("claimsense.settings.v1") ?? "{}").theme).toBe("dark")

    fireEvent.click(screen.getByRole("button", { name: "Compact" }))
    expect(document.documentElement.dataset.density).toBe("compact")

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    expect(screen.getByTestId("refresh")).toHaveTextContent("refreshed")
    expect(localStorage.getItem("claimsense.settings.v1")).not.toContain("lastRefresh")
  })
})
