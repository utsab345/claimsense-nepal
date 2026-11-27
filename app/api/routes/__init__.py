from fastapi import APIRouter

from app.api.routes import analytics, assistant, audit, claims, investigations, risk, system

router = APIRouter()
router.include_router(system.router)
router.include_router(analytics.router)
router.include_router(assistant.router)
router.include_router(audit.router)
router.include_router(investigations.router)
router.include_router(risk.router)
router.include_router(claims.router)
