import type {
  ApiErrorBody,
  AppSettings,
  AssistantAnswer,
  AuditPage,
  Claim,
  ClaimFilters,
  ClaimPage,
  Investigation,
  InvestigationPage,
  InvestigationStatus,
  NotificationItem,
  Overview,
  Portfolio,
  RiskAssessment,
  RiskDistribution,
  Trends,
} from "@/lib/types"

const BASE_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/$/, "")

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = "ApiError"
  }
}

function toQuery(params: object): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean" && value !== null && value !== undefined) return
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value))
  })
  const query = search.toString()
  return query ? `?${query}` : ""
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    })
  } catch {
    throw new ApiError("Cannot reach the API. Check the backend connection.", 0)
  }
  if (!response.ok) {
    let body: ApiErrorBody = {}
    try {
      body = (await response.json()) as ApiErrorBody
    } catch {
      body = { detail: response.statusText }
    }
    const detail =
      body.error?.message ??
      (typeof body.detail === "string"
        ? body.detail
        : Array.isArray(body.detail)
          ? body.detail.map((entry) => entry.msg ?? "Invalid value").join("; ")
          : "Request failed")
    throw new ApiError(detail, response.status)
  }
  return (await response.json()) as T
}

export const api = {
  health: () => request<{ status: string; database?: string; claims?: number }>("/health/detailed"),
  settings: () => request<AppSettings>("/settings"),
  claims: (filters: ClaimFilters = {}) => request<ClaimPage>(`/claims${toQuery(filters)}`),
  claim: (claimId: string) => request<Claim>(`/claims/${encodeURIComponent(claimId)}`),
  risk: (claimId: string) => request<RiskAssessment>(`/claims/${encodeURIComponent(claimId)}/risk`),
  assess: (claimId: string) =>
    request<RiskAssessment>(`/claims/${encodeURIComponent(claimId)}/assess`, { method: "POST" }),
  highRisk: () => request<Claim[]>("/claims/high-risk?limit=100"),
  overview: (fromDate?: string, toDate?: string) =>
    request<Overview>(`/claims/analytics/overview${toQuery({ from_date: fromDate, to_date: toDate })}`),
  trends: (fromDate?: string, toDate?: string) =>
    request<Trends>(`/claims/analytics/trends${toQuery({ from_date: fromDate, to_date: toDate })}`),
  riskDistribution: (fromDate?: string, toDate?: string) =>
    request<RiskDistribution>(
      `/claims/analytics/risk-distribution${toQuery({ from_date: fromDate, to_date: toDate })}`,
    ),
  portfolio: (fromDate?: string, toDate?: string) =>
    request<Portfolio>(`/claims/analytics/portfolio${toQuery({ from_date: fromDate, to_date: toDate })}`),
  ask: (question: string) =>
    request<AssistantAnswer>("/assistant/ask", { method: "POST", body: JSON.stringify({ question }) }),
  investigations: (status?: InvestigationStatus, search?: string, limit = 50, offset = 0) =>
    request<InvestigationPage>(`/investigations${toQuery({ status, search, limit, offset })}`),
  investigation: (claimId: string) => request<Investigation>(`/claims/${encodeURIComponent(claimId)}/investigation`),
  addNote: (claimId: string, body: string, author = "Analyst") =>
    request<Investigation>(`/claims/${encodeURIComponent(claimId)}/investigation/note`, {
      method: "POST",
      body: JSON.stringify({ body, author }),
    }),
  updateStatus: (claimId: string, status: InvestigationStatus, author = "Analyst", note?: string) =>
    request<Investigation>(`/claims/${encodeURIComponent(claimId)}/investigation/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, author, note: note || undefined }),
    }),
  assign: (claimId: string, assigned_analyst: string | null) =>
    request<Investigation>(`/claims/${encodeURIComponent(claimId)}/investigation/assignment`, {
      method: "PATCH",
      body: JSON.stringify({ assigned_analyst }),
    }),
  audit: (claimId?: string, limit = 50, offset = 0) =>
    request<AuditPage>(`/audit${toQuery({ claim_id: claimId, limit, offset })}`),
  notifications: () => request<NotificationItem[]>("/notifications"),
  markNotificationRead: (id: string) => request<NotificationItem>(`/notifications/${id}/read`, { method: "POST" }),
}

export function claimsExportUrl(filters: ClaimFilters = {}): string {
  return `${BASE_URL}/claims/export${toQuery(filters)}`
}
