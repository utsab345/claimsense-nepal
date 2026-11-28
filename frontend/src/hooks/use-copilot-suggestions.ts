import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"

const BASE_SUGGESTIONS = [
  "What are the five highest-priority claims?",
  "What is the financial exposure of high-priority claims?",
  "How many claims are under review?",
  "Which incident categories have the highest average claim amounts?",
  "Were there claims within 14 days of policy start?",
  "Summarize the claims portfolio.",
]

export function useCopilotSuggestions() {
  const priorityQuery = useQuery({ queryKey: ["high-risk-claims"], queryFn: api.highRisk })
  const trendsQuery = useQuery({ queryKey: ["trends", undefined, undefined], queryFn: () => api.trends() })

  return useMemo(() => {
    const suggestions = [...BASE_SUGGESTIONS]
    const claimId = priorityQuery.data?.[0]?.claim_id
    if (claimId) suggestions.unshift(`Why was claim ${claimId} flagged?`)
    if (priorityQuery.data?.length) suggestions.push("How many claims have high review priority?")
    if (trendsQuery.data?.incident_types?.length) {
      suggestions.push("Which incident types have the highest claim amounts?")
    }
    return suggestions
  }, [priorityQuery.data, trendsQuery.data])
}
