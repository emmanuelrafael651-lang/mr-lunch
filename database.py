import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


# =========================================================
# RUTA DE LA BASE DE DATOS
# =========================================================
#
# En Railway:
#   usaremos el Volume montado en /data
#
# En local:
#   seguirá usando ./data/mr_lunch.db
#

if os.getenv("RAILWAY_VOLUME_MOUNT_PATH"):
    DATABASE_PATH = os.path.join(
        os.getenv("RAILWAY_VOLUME_MOUNT_PATH"),
        "mr_lunch.db"
    )
else:
    os.makedirs("data", exist_ok=True)
    DATABASE_PATH = os.path.join(
        "data",
        "mr_lunch.db"
    )


DATABASE_URL = f"sqlite:///{DATABASE_PATH}"


# =========================================================
# ENGINE
# =========================================================

engine = create_engine(
    DATABASE_URL,
    connect_args={
        "check_same_thread": False
    }
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
# DEPENDENCIA DE BASE DE DATOS
# =========================================================

def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()