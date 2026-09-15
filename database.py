import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


# =========================================================
# BASE DE DATOS
# =========================================================

DATABASE_URL = os.getenv("DATABASE_URL")

# En local seguimos usando SQLite.
if not DATABASE_URL:
    os.makedirs("data", exist_ok=True)
    DATABASE_URL = "sqlite:///./data/mr_lunch.db"


# =========================================================
# ENGINE
# =========================================================

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgres://",
        "postgresql://",
        1
    )

if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgresql://",
        "postgresql+psycopg2://",
        1
    )


engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True
)


# =========================================================
# SESIONES
# =========================================================

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


# =========================================================
# BASE
# =========================================================

Base = declarative_base()


# =========================================================
# DEPENDENCIA
# =========================================================

def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()