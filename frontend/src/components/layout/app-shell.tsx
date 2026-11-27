import { useCallback, useEffect, useState } from "react"
import { Outlet } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"

import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { NotificationsPanel } from "@/components/layout/notifications-panel"
import { AssistantPanel } from "@/components/layout/assistant-panel"
import { Dialog, DialogContent, DialogTitle, TooltipProvider } from "@/components/ui/feedback"
import { useSettings } from "@/context/settings-context"

export function AppShell() {
  const queryClient = useQueryClient()
  const { autoRefresh, refreshSeconds, lastRefresh, setLastRefresh } = useSettings()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries()
    setLastRefresh(new Date())
  }, [queryClient])

  useEffect(() => {
    if (!autoRefresh) return
    const timer = window.setInterval(refresh, Math.max(10, refreshSeconds) * 1000)
    return () => window.clearInterval(timer)
  }, [autoRefresh, refreshSeconds, refresh])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen overflow-hidden bg-background">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogContent className="left-0 top-0 flex h-full w-60 max-w-[80vw] translate-x-0 translate-y-0 flex-col rounded-none border-y-0 border-l-0 p-0">
            <DialogTitle className="sr-only">Navigation</DialogTitle>
            <Sidebar mobile onNavigate={() => setMobileOpen(false)} />
          </DialogContent>
        </Dialog>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            onOpenMobile={() => setMobileOpen(true)}
            onRefresh={refresh}
            lastRefresh={lastRefresh}
            onOpenNotifications={() => setNotificationsOpen(true)}
          />
          <main className="app-canvas flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <NotificationsPanel open={notificationsOpen} onOpenChange={setNotificationsOpen} />
      <AssistantPanel />
    </TooltipProvider>
  )
}
