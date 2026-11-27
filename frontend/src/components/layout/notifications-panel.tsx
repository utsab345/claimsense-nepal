import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Bell, Check } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/feedback"
import { api } from "@/lib/api"

export function NotificationsPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useQuery({ queryKey: ["notifications"], queryFn: api.notifications, enabled: open })
  const markRead = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-auto right-0 top-0 flex h-full max-w-sm translate-x-0 translate-y-0 flex-col rounded-none border-y-0 border-r-0 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <div>
            <DialogTitle className="text-sm font-semibold">Notifications</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
              Generated from the current claims database.
            </DialogDescription>
          </div>
          <Bell className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 divide-y divide-border overflow-y-auto">
          {isLoading ? <p className="px-4 py-6 text-xs text-muted-foreground">Loading notifications…</p> : null}
          {isError ? <p className="px-4 py-6 text-xs text-destructive">Notifications could not be loaded.</p> : null}
          {data?.map((item) => (
            <div key={item.id} className={`px-4 py-4 ${item.read ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{item.title}</p>
                <Badge variant={item.severity === "critical" ? "danger" : item.severity === "warning" ? "warning" : "neutral"}>
                  {item.severity}
                </Badge>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
              <div className="mt-2 flex items-center gap-2">
                {item.claim_ids[0] ? (
                  <Link className="text-xs text-primary hover:underline" to={`/claims/${item.claim_ids[0]}`}>
                    Open {item.claim_ids[0]}
                  </Link>
                ) : null}
                {!item.read ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 px-2 text-xs"
                    onClick={() => markRead.mutate(item.id)}
                    disabled={markRead.isPending}
                  >
                    <Check className="h-3.5 w-3.5" /> Mark read
                  </Button>
                ) : (
                  <span className="ml-auto text-2xs text-muted-foreground">Read</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
