import os
from typing import Any

import httpx
import pandas as pd
import plotly.express as px
import streamlit as st


API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000").rstrip("/")
INCIDENT_TYPES = ("Collision", "Theft", "Flood", "Fire", "Glass Damage", "Vandalism")
CLAIM_STATUSES = ("Open", "Under Review", "Approved", "Rejected", "Paid")
RISK_LEVELS = ("Low", "Medium", "High")


def api_get(path: str, params: dict[str, Any] | None = None):
    try:
        response = httpx.get(f"{API_BASE_URL}{path}", params=params, timeout=15)
    except httpx.HTTPError as error:
        st.error(f"Cannot reach the claims API at {API_BASE_URL}: {error}")
        st.stop()
    if response.is_error:
        st.error(f"Claims API returned {response.status_code}: {response.text}")
        st.stop()
    return response.json()


def api_post(path: str):
    try:
        response = httpx.post(f"{API_BASE_URL}{path}", timeout=60)
    except httpx.HTTPError as error:
        st.error(f"Cannot reach the claims API at {API_BASE_URL}: {error}")
        st.stop()
    if response.is_error:
        st.error(f"Claims API returned {response.status_code}: {response.text}")
        st.stop()
    return response.json()


def render_overview():
    st.title("Claims overview")
    overview = api_get("/claims/analytics/overview")
    first, second, third, fourth = st.columns(4)
    first.metric("Total claims", f"{overview['total_claims']:,}")
    second.metric("Claimed amount", f"Rs {overview['total_claim_amount']:,.0f}")
    third.metric("Average claim", f"Rs {overview['average_claim_amount']:,.0f}")
    fourth.metric("Under review", f"{overview['under_review']:,}")

    distribution = overview["risk_distribution"]
    chart, note = st.columns((3, 2))
    with chart:
        st.subheader("Review priority")
        risk_frame = pd.DataFrame(
            [{"Priority": priority, "Claims": count} for priority, count in distribution.items()]
        )
        st.plotly_chart(
            px.pie(risk_frame, names="Priority", values="Claims", hole=0.56, color="Priority"),
            use_container_width=True,
        )
    with note:
        st.subheader("Review queue")
        st.metric("High priority", distribution["High"])
        st.metric("Medium priority", distribution["Medium"])
        st.metric("Not yet assessed", distribution["Unassessed"])
        st.caption("Risk scores support analyst review. They do not prove fraud or determine claim outcomes.")


def render_claims_explorer():
    st.title("Claims explorer")
    first, second, third = st.columns(3)
    search = first.text_input("Claim, policy, or customer ID")
    status_filter = second.selectbox("Claim status", ("All", *CLAIM_STATUSES))
    incident_filter = third.selectbox("Incident type", ("All", *INCIDENT_TYPES))
    fourth, fifth = st.columns(2)
    risk_filter = fourth.selectbox("Review priority", ("All", *RISK_LEVELS))
    offset = fifth.number_input("Starting row", min_value=0, step=50, value=0)
    params = {"limit": 50, "offset": int(offset)}
    if search:
        params["search"] = search
    if status_filter != "All":
        params["status"] = status_filter
    if incident_filter != "All":
        params["incident_type"] = incident_filter
    if risk_filter != "All":
        params["risk_level"] = risk_filter
    page = api_get("/claims", params)
    st.caption(f"Showing {len(page['items'])} of {page['total']:,} matching claims")
    if not page["items"]:
        st.info("No claims match these filters.")
        return
    frame = pd.DataFrame(page["items"])
    visible_columns = [
        "claim_id",
        "claim_date",
        "incident_type",
        "claim_amount",
        "claim_status",
        "risk_score",
        "review_priority",
    ]
    st.dataframe(frame[visible_columns], use_container_width=True, hide_index=True)
    selected_id = st.selectbox("Claim details", frame["claim_id"].tolist())
    claim = api_get(f"/claims/{selected_id}")
    st.json(claim, expanded=False)
    if st.button("Assess claim risk", key=f"assess-{selected_id}"):
        assessment = api_post(f"/claims/{selected_id}/assess")
        st.session_state["latest_assessment"] = assessment
        st.rerun()
    if assessment := st.session_state.get("latest_assessment"):
        if assessment["claim_id"] == selected_id:
            st.subheader("Latest risk assessment")
            st.write(f"Priority: **{assessment['review_priority']}** | Score: **{assessment['risk_score']:.0f}/100**")
            for indicator in assessment["risk_indicators"]:
                st.write(f"**{indicator['label']}** (+{indicator['points']}): {indicator['explanation']}")
            st.caption(assessment["disclaimer"])


def render_risk_analysis():
    st.title("Risk analysis")
    distribution = api_get("/claims/analytics/risk-distribution")
    first, second = st.columns(2)
    first.metric("Statistical anomalies", distribution["anomaly_count"])
    second.metric("Assessed claims", distribution["assessed_count"])
    left, right = st.columns(2)
    with left:
        st.subheader("Review priority distribution")
        frame = pd.DataFrame(
            [{"Priority": name, "Claims": count} for name, count in distribution["distribution"].items()]
        )
        st.plotly_chart(px.bar(frame, x="Priority", y="Claims", color="Priority"), use_container_width=True)
    with right:
        st.subheader("Risk score distribution")
        histogram = pd.DataFrame(
            [{"Score range": label, "Claims": count} for label, count in distribution["score_histogram"].items()]
        )
        st.plotly_chart(px.bar(histogram, x="Score range", y="Claims"), use_container_width=True)
    st.caption("Isolation Forest finds statistical outliers in claim history. An anomaly is a review signal, not proof of fraud.")
    st.subheader("High-priority review queue")
    queue = api_get("/claims/high-risk", {"limit": 100})
    if queue:
        st.dataframe(
            pd.DataFrame(queue)[
                ["claim_id", "claim_date", "incident_type", "claim_amount", "risk_score", "claim_status"]
            ],
            use_container_width=True,
            hide_index=True,
        )
    else:
        st.info("No claims currently have high review priority.")
    with st.expander("Scoring explanation"):
        st.write(
            "Rule indicators add configured points for claim-to-vehicle and claim-to-premium ratios, repeated claims, early claims, missing documents, and overnight incident times. "
            "Isolation Forest is trained on at least 50 existing claims using standardized numerical features. "
            "The score is capped at 100 and priority thresholds are configurable. Each triggered indicator is returned with its reason."
        )


def render_trends():
    st.title("Claims trends")
    data = api_get("/claims/analytics/trends")
    monthly = pd.DataFrame(data["monthly"])
    incidents = pd.DataFrame(data["incident_types"])
    statuses = pd.DataFrame(data["statuses"])
    left, right = st.columns(2)
    with left:
        st.subheader("Claims by month")
        if not monthly.empty:
            st.plotly_chart(
                px.line(monthly, x="month", y="claim_count", markers=True, labels={"claim_count": "Claims"}),
                use_container_width=True,
            )
    with right:
        st.subheader("Claim amount by month")
        if not monthly.empty:
            st.plotly_chart(
                px.bar(monthly, x="month", y="claim_amount", labels={"claim_amount": "Claim amount (Rs)"}),
                use_container_width=True,
            )
    bottom_left, bottom_right = st.columns(2)
    with bottom_left:
        st.subheader("Incident types")
        if not incidents.empty:
            st.plotly_chart(
                px.bar(incidents, x="incident_type", y="claim_count", color="incident_type"),
                use_container_width=True,
            )
    with bottom_right:
        st.subheader("Claim statuses")
        if not statuses.empty:
            st.plotly_chart(px.pie(statuses, names="claim_status", values="claim_count", hole=0.45), use_container_width=True)


def main():
    st.set_page_config(page_title="ClaimSense Nepal", page_icon="🛡️", layout="wide")
    st.sidebar.title("ClaimSense Nepal")
    st.sidebar.caption("Motor claim triage and analytics")
    st.sidebar.info("All records are synthetic and do not represent actual insurance customers.")
    page = st.sidebar.radio("Workspace", ("Overview", "Claims Explorer", "Risk Analysis", "Trends"))
    if page == "Overview":
        render_overview()
    elif page == "Claims Explorer":
        render_claims_explorer()
    elif page == "Risk Analysis":
        render_risk_analysis()
    else:
        render_trends()


if __name__ == "__main__":
    main()
