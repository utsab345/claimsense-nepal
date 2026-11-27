import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { RiskExplanation } from "@/components/common/risk-explanation"
import type { RiskAssessment } from "@/lib/types"

const assessed: RiskAssessment = {
  claim_id: "CLM-TEST-1",
  assessed: true,
  risk_score: 65,
  review_priority: "Medium",
  is_anomaly: true,
  risk_indicators: [
    {
      code: "documents_missing",
      label: "Supporting documents missing",
      explanation: "No supporting documents are recorded for this claim.",
      points: 10,
    },
    {
      code: "statistical_anomaly",
      label: "Statistical outlier",
      explanation: "Isolation Forest identified an unusual combination of claim features.",
      points: 20,
    },
  ],
  disclaimer: "Decision support only.",
}

describe("RiskExplanation", () => {
  it("does not render an unassessed claim as zero risk", () => {
    render(<RiskExplanation assessment={{ ...assessed, assessed: false }} />)

    expect(screen.getByText("Not assessed yet")).toBeInTheDocument()
    expect(screen.queryByText("/ 100")).not.toBeInTheDocument()
    expect(screen.queryByText("Supporting documents missing")).not.toBeInTheDocument()
  })

  it("renders each stored indicator with its points and anomaly result", () => {
    render(<RiskExplanation assessment={assessed} />)

    expect(screen.getByText("Supporting documents missing")).toBeInTheDocument()
    expect(screen.getByText("Statistical outlier")).toBeInTheDocument()
    expect(screen.getAllByText("+10").length).toBeGreaterThan(0)
    expect(screen.getByText("Statistical model: anomaly flagged")).toBeInTheDocument()
  })
})
