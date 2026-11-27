import { Navigate, Route, Routes } from "react-router-dom"

import { AppShell } from "@/components/layout/app-shell"
import { AnalyticsPage } from "@/pages/analytics"
import { ActivityPage } from "@/pages/activity"
import { ClaimDetailPage } from "@/pages/claim-detail"
import { ClaimsPage } from "@/pages/claims"
import { CopilotPage } from "@/pages/copilot"
import { DashboardPage } from "@/pages/dashboard"
import { InvestigationsPage } from "@/pages/investigations"
import { SettingsPage } from "@/pages/settings"

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/claims" element={<ClaimsPage />} />
        <Route path="/claims/:claimId" element={<ClaimDetailPage />} />
        <Route path="/investigations" element={<InvestigationsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/copilot" element={<CopilotPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
