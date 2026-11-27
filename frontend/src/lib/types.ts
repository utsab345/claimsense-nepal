export type ClaimStatus = "Open" | "Under Review" | "Approved" | "Rejected" | "Paid"
export type ReviewPriority = "Low" | "Medium" | "High"
export type InvestigationStatus = "Open" | "Under Review" | "Additional Information Required" | "Resolved"

export interface RiskIndicator {
  code: string
  label: string
  explanation: string
  points: number
}

export interface Claim {
  claim_id: string
  policy_id: string
  customer_id: string
  vehicle_age: number
  vehicle_type: string
  vehicle_value: number
  policy_age_days: number
  incident_type: string
  incident_location: string | null
  claim_amount: number
  premium_amount: number
  previous_claim_count: number
  days_since_policy_start: number
  incident_hour: number
  repair_cost: number
  supporting_documents_count: number | null
  claim_status: ClaimStatus
  claim_date: string
  risk_score: number | null
  review_priority: ReviewPriority | null
  is_anomaly: boolean | null
  risk_indicators: RiskIndicator[] | null
  created_at: string
}

export interface ClaimPage {
  items: Claim[]
  total: number
  limit: number
  offset: number
}

export interface ClaimFilters {
  search?: string
  status?: ClaimStatus
  risk_level?: ReviewPriority
  incident_type?: string
  is_anomaly?: boolean
  from_date?: string
  to_date?: string
  sort_by?: "claim_date" | "claim_amount" | "risk_score"
  sort_dir?: "asc" | "desc"
  limit?: number
  offset?: number
}

export interface Overview {
  total_claims: number
  total_claim_amount: number
  average_claim_amount: number
  open_claims: number
  under_review: number
  high_priority_claims: number
  anomaly_count: number
  risk_distribution: Record<"Low" | "Medium" | "High" | "Unassessed", number>
}

export interface Trends {
  monthly: { month: string; claim_count: number; claim_amount: number }[]
  incident_types: { incident_type: string; claim_count: number; average_claim_amount: number }[]
  statuses: { claim_status: string; claim_count: number }[]
}

export interface RiskDistribution {
  distribution: Record<"Low" | "Medium" | "High" | "Unassessed", number>
  score_histogram: Record<string, number>
  assessed_count: number
  anomaly_count: number
}

export interface Portfolio {
  locations: { location: string; claim_count: number; total_amount: number }[]
  claim_premium_ratio: { average_ratio: number; claims_above_ten_x: number; claims_count: number }
  high_priority_exposure: { total_amount: number; claim_count: number }
  anomaly_distribution: Record<"Low" | "Medium" | "High" | "Unassessed", number>
}

export interface RiskAssessment {
  claim_id: string
  assessed?: boolean
  risk_score: number
  review_priority: ReviewPriority
  is_anomaly: boolean
  risk_indicators: RiskIndicator[]
  disclaimer: string
}

export interface InvestigationNote {
  id: number
  author: string
  body: string
  created_at: string
}

export interface InvestigationEvent {
  id: number
  from_status: string | null
  to_status: string
  author: string
  detail: string | null
  created_at: string
}

export interface Investigation {
  claim_id: string
  status: InvestigationStatus
  assigned_analyst: string | null
  opened_at: string
  updated_at: string
  notes: InvestigationNote[]
  events: InvestigationEvent[]
}

export interface InvestigationSummary {
  claim_id: string
  status: InvestigationStatus
  assigned_analyst: string | null
  opened_at: string
  updated_at: string
  risk_score: number | null
  claim_amount: number
  indicator_count: number
}

export interface InvestigationPage {
  items: InvestigationSummary[]
  total: number
  limit: number
  offset: number
}

export interface AuditEntry {
  id: number
  claim_id: string | null
  action: string
  summary: string
  actor: string
  created_at: string
}

export interface AuditPage {
  items: AuditEntry[]
  total: number
  limit: number
  offset: number
}

export interface NotificationItem {
  id: string
  title: string
  body: string
  severity: "info" | "warning" | "critical"
  read: boolean
  claim_ids: string[]
}

export interface AppSettings {
  application: string
  version: string
  database: string
  dataset: string
  dataset_records: number
  currency: string
  risk_thresholds: { high: number; medium: number; anomaly_points: number }
  features: { investigations: boolean; assistant: boolean; anomaly_detection: boolean; external_llm: boolean }
  disclaimer: string
}

export interface AssistantAnswer {
  answer: string
  citations: string[]
  supported: boolean
  claim_ids: string[]
  calculation: string | null
}

export interface ApiErrorBody {
  detail?: string | { msg?: string }[]
  error?: { code: string; message: string }
}
