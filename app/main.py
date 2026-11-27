from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.engine import Engine

from app.api.routes import router
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.database.initialize import initialize_database
from app.database.session import SessionLocal, create_session_factory, engine


def create_app(database_engine: Engine | None = None, seed_data: bool = True) -> FastAPI:
    selected_engine = database_engine if database_engine is not None else engine
    session_factory = SessionLocal if selected_engine is engine else create_session_factory(selected_engine)
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        initialize_database(selected_engine, session_factory, settings.dataset_path if seed_data else "")
        yield

    application = FastAPI(
        title="ClaimSense Nepal API",
        description=(
            "Explainable motor insurance claim triage, investigation workflow and database-grounded "
            "assistant for reproducible synthetic data. Risk scores are decision support only."
        ),
        version=settings.api_version,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    register_error_handlers(application)
    application.include_router(router)
    if session_factory is not SessionLocal:

        def database_dependency():
            session = session_factory()
            try:
                yield session
            finally:
                session.close()

        from app.database.session import get_db

        application.dependency_overrides[get_db] = database_dependency
    return application


app = create_app()
