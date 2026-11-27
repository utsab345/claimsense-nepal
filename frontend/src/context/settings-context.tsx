import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

export type Density = "comfortable" | "compact"
export type DatePreset = "all" | "30d" | "90d" | "12m"

export interface DateRange {
  preset: DatePreset
  from?: string
  to?: string
}

interface SettingsState {
  theme: "light" | "dark"
  density: Density
  sidebarCollapsed: boolean
  autoRefresh: boolean
  refreshSeconds: number
  dateRange: DateRange
  lastRefresh: Date | null
  setLastRefresh: (value: Date | null) => void
  toggleTheme: () => void
  toggleSidebar: () => void
  setDensity: (value: Density) => void
  setAutoRefresh: (value: boolean) => void
  setRefreshSeconds: (value: number) => void
  setDatePreset: (preset: DatePreset) => void
  setCustomRange: (from?: string, to?: string) => void
}

const STORAGE_KEY = "claimsense.settings.v1"

const SettingsContext = createContext<SettingsState | null>(null)

const defaults: Omit<
  SettingsState,
  | "toggleTheme"
  | "toggleSidebar"
  | "setDensity"
  | "setAutoRefresh"
  | "setRefreshSeconds"
  | "setDatePreset"
  | "setCustomRange"
  | "setLastRefresh"
> = {
  theme: "light",
  density: "comfortable",
  sidebarCollapsed: false,
  autoRefresh: false,
  refreshSeconds: 60,
  dateRange: { preset: "all" },
  lastRefresh: null,
}

function readStored(): typeof defaults {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<typeof defaults>
    return { ...defaults, ...parsed, dateRange: parsed.dateRange ?? defaults.dateRange, lastRefresh: null }
  } catch {
    return defaults
  }
}

function rangeForPreset(preset: DatePreset): DateRange {
  if (preset === "all") return { preset }
  const end = new Date()
  const start = new Date()
  if (preset === "30d") start.setDate(start.getDate() - 30)
  if (preset === "90d") start.setDate(start.getDate() - 90)
  if (preset === "12m") start.setMonth(start.getMonth() - 12)
  return { preset, from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(readStored)

  useEffect(() => {
    const persisted = {
      theme: state.theme,
      density: state.density,
      sidebarCollapsed: state.sidebarCollapsed,
      autoRefresh: state.autoRefresh,
      refreshSeconds: state.refreshSeconds,
      dateRange: state.dateRange,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
  }, [state])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.theme === "dark")
    document.documentElement.dataset.density = state.density
  }, [state.theme, state.density])

  const value = useMemo<SettingsState>(
    () => ({
      ...state,
      toggleTheme: () => setState((current) => ({ ...current, theme: current.theme === "dark" ? "light" : "dark" })),
      toggleSidebar: () => setState((current) => ({ ...current, sidebarCollapsed: !current.sidebarCollapsed })),
      setDensity: (density) => setState((current) => ({ ...current, density })),
      setAutoRefresh: (autoRefresh) => setState((current) => ({ ...current, autoRefresh })),
      setRefreshSeconds: (refreshSeconds) => setState((current) => ({ ...current, refreshSeconds })),
      setDatePreset: (preset) => setState((current) => ({ ...current, dateRange: rangeForPreset(preset) })),
      setCustomRange: (from, to) => setState((current) => ({ ...current, dateRange: { preset: "all", from, to } })),
      setLastRefresh: (lastRefresh) => setState((current) => ({ ...current, lastRefresh })),
    }),
    [state],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsState {
  const context = useContext(SettingsContext)
  if (!context) throw new Error("useSettings must be used inside SettingsProvider")
  return context
}
