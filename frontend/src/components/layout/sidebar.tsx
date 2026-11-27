import { NavLink } from "react-router-dom"
import {
  BarChart3,
  Bot,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  History,
  LayoutDashboard,
  SearchCheck,
  Settings2,
  ShieldCheck,
} from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/feedback"
import { useSettings } from "@/context/settings-context"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/claims", label: "Claims", icon: ClipboardList },
  { to: "/investigations", label: "Investigations", icon: SearchCheck },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/copilot", label: "Copilot", icon: Bot },
  { to: "/activity", label: "Activity history", icon: History },
  { to: "/settings", label: "Settings", icon: Settings2 },
]

export function Sidebar({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const { sidebarCollapsed, toggleSidebar } = useSettings()
  const collapsed = sidebarCollapsed && !mobile

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-surface transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex h-14 items-center gap-2 border-b border-border px-4", collapsed && "justify-center px-0")}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-glow">
          <ShieldCheck className="h-4 w-4" />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <div className="truncate text-base font-semibold tracking-tight">ClaimSense</div>
            <div className="text-2xs text-muted-foreground">Nepal · Intelligence</div>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3" aria-label="Main navigation">
        {navItems.map((item) => {
          const link = (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex h-10 items-center gap-2.5 rounded-md px-3 text-[0.95rem] text-muted-foreground transition-all hover:bg-muted hover:text-foreground",
                  collapsed && "justify-center px-0",
                  isActive && "bg-primary/12 font-semibold text-primary shadow-sm ring-1 ring-primary/15 hover:bg-primary/12 hover:text-primary",
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">{item.label}</span> : null}
            </NavLink>
          )
          if (!collapsed) return link
          return (
            <Tooltip key={item.to}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          )
        })}
      </nav>

      {!mobile ? (
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-9 w-full items-center gap-2 rounded px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed ? <span>Collapse</span> : null}
          </button>
        </div>
      ) : null}
    </aside>
  )
}
