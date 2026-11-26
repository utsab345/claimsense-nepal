from pathlib import Path

import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.database.base import Base
from app.models import Claim


def initialize_database(engine: Engine, session_factory: sessionmaker[Session], dataset_path: str) -> int:
    Base.metadata.create_all(engine)
    with session_factory() as session:
        claim_count = session.scalar(select(func.count()).select_from(Claim)) or 0
        if claim_count:
            return 0
        source = Path(dataset_path)
        if not source.is_file():
            return 0
        dataframe = pd.read_csv(source)
        records = dataframe.where(pd.notna(dataframe), None).to_dict(orient="records")
        for record in records:
            record["claim_date"] = pd.Timestamp(record["claim_date"]).date()
        session.add_all(Claim(**record) for record in records)
        session.commit()
        return len(records)
