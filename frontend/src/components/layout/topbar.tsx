import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Bell, Bot, Menu, Moon, RefreshCw, Rows3, Search, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/controls"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/feedback"
import { useAssistant } from "@/context/assistant-context"
import { useSettings } from "@/context/settings-context"
import { api } from "@/lib/api"
import { formatDateTime } from "@/lib/format"

export function Topbar({
  onOpenMobile,
  onRefresh,
  lastRefresh,
  onOpenNotifications,
}: {
  onOpenMobile: () => void
  onRefresh: () => void
  lastRefresh: Date | null
  onOpenNotifications: () => void
}) {
  const navigate = useNavigate()
  const { theme, toggleTheme, density, setDensity, autoRefresh, setAutoRefresh } = useSettings()
  const { setOpen } = useAssistant()
  const [search, setSearch] = useState("")
  const { data: notifications } = useQuery({ queryKey: ["notifications"], queryFn: api.notifications })
  const unread = notifications?.filter((item) => !item.read).length ?? 0

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    if (search.trim()) {
      navigate(`/claims?search=${encodeURIComponent(search.trim())}`)
      setSearch("")
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 sm:px-4">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobile} aria-label="Open menu">
        <Menu className="h-4 w-4" />
      </Button>

      <form onSubmit={submitSearch} className="relative hidden max-w-xs flex-1 md:block">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          aria-label="Find a claim"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Find a claim ID or policy ID"
          className="h-9 w-full rounded border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </form>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="hidden items-center gap-2 border-r border-border pr-3 xl:flex">
          <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} aria-label="Auto refresh" />
          <label htmlFor="auto-refresh" className="cursor-pointer text-2xs text-muted-foreground">
            Auto
          </label>
          <span className="num text-2xs text-muted-foreground/80">
            {lastRefresh ? `Updated ${formatDateTime(lastRefresh.toISOString())}` : "Not refreshed"}
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onRefresh} aria-label="Refresh data">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh data</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle table density"
              onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}
            >
              <Rows3 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Table density: {density}</TooltipContent>
        </Tooltip>
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="relative" onClick={onOpenNotifications} aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread ? (
            <span className="num absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-semibold text-primary-foreground">
              {unread}
            </span>
          ) : null}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Bot className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Copilot</span>
        </Button>
      </div>
    </header>
  )
}
