from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.analytics.service import overview, portfolio, risk_distribution, trends
from app.database.session import get_db

router = APIRouter(prefix="/claims/analytics", tags=["analytics"])

DateRange = (date | None, Query(default=None))


@router.get("/overview")
def claims_overview(
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    session: Session = Depends(get_db),
):
    return overview(session, from_date, to_date)


@router.get("/trends")
def claims_trends(
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    session: Session = Depends(get_db),
):
    return trends(session, from_date, to_date)


@router.get("/risk-distribution")
def claims_risk_distribution(
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    session: Session = Depends(get_db),
):
    return risk_distribution(session, from_date, to_date)


@router.get("/portfolio")
def claims_portfolio(
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    session: Session = Depends(get_db),
):
    return portfolio(session, from_date, to_date)
