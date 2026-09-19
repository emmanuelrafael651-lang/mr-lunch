from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from zoneinfo import ZoneInfo

from database import engine, Base, get_db
import models


# Zona horaria oficial de Mr. Lunch
MEXICO_TZ = ZoneInfo("America/Mexico_City")


def mexico_now():
    return datetime.now(MEXICO_TZ).replace(tzinfo=None)


# =========================================================
# CREAR TABLAS
# =========================================================

Base.metadata.create_all(bind=engine)


# =========================================================
# MIGRACIÓN SIMPLE
# =========================================================
# Agrega columnas nuevas a bases existentes sin borrar
# los datos actuales.

def migrate_database():

    inspector = inspect(engine)

    # -----------------------------------------
    # CATEGORY.active
    # -----------------------------------------

    if inspector.has_table("categories"):

        columns = [
            column["name"]
            for column in inspector.get_columns("categories")
        ]

        if "active" not in columns:

            with engine.begin() as connection:
                connection.execute(
                    text(
                        "ALTER TABLE categories "
                        "ADD COLUMN active BOOLEAN DEFAULT 1"
                    )
                )

    # -----------------------------------------
    # PRODUCT.active
    # -----------------------------------------

    if inspector.has_table("products"):

        columns = [
            column["name"]
            for column in inspector.get_columns("products")
        ]

        if "active" not in columns:

            with engine.begin() as connection:
                connection.execute(
                    text(
                        "ALTER TABLE products "
                        "ADD COLUMN active BOOLEAN DEFAULT 1"
                    )
                )


migrate_database()


# =========================================================
# APP
# =========================================================

app = FastAPI(
    title="Mr. Lunch API",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# SCHEMAS
# =========================================================

class CategoryCreate(BaseModel):
    name: str


class ProductCreate(BaseModel):
    name: str
    price: float
    image: Optional[str] = None
    category_id: int


class SaleDetailCreate(BaseModel):
    product_id: int
    product_name: str
    quantity: int
    price: float
    subtotal: float


class SaleCreate(BaseModel):
    order_type: str
    table: Optional[str] = None
    payment_method: str
    total: float
    details: List[SaleDetailCreate]


class CashOpenCreate(BaseModel):
    initial_fund: float


class CashMovementCreate(BaseModel):
    type: str
    amount: float
    concept: str


# =========================================================
# INICIO
# =========================================================

@app.get("/api/test")
def test():

    return {
        "status": "ok",
        "message": "La API está funcionando"
    }


# =========================================================
# CATEGORÍAS
# =========================================================

@app.get("/api/categories")
def get_categories(
    db: Session = Depends(get_db)
):

    categories = (
        db.query(models.Category)
        .filter(models.Category.active == True)
        .order_by(models.Category.id.asc())
        .all()
    )

    return [
        {
            "id": category.id,
            "name": category.name,
            "active": category.active
        }
        for category in categories
    ]


@app.post("/api/categories")
def create_category(
    category: CategoryCreate,
    db: Session = Depends(get_db)
):

    name = category.name.strip()

    if not name:

        raise HTTPException(
            status_code=400,
            detail="El nombre de la categoría es obligatorio."
        )

    existing = (
        db.query(models.Category)
        .filter(
            models.Category.name == name
        )
        .first()
    )

    if existing:

        # Si existía pero estaba eliminada,
        # simplemente la volvemos a activar.
        if not existing.active:

            existing.active = True

            db.commit()
            db.refresh(existing)

            return {
                "message": "Categoría reactivada correctamente",
                "category": {
                    "id": existing.id,
                    "name": existing.name,
                    "active": existing.active
                }
            }

        raise HTTPException(
            status_code=400,
            detail="La categoría ya existe."
        )

    new_category = models.Category(
        name=name,
        active=True
    )

    db.add(new_category)
    db.commit()
    db.refresh(new_category)

    return {
        "message": "Categoría creada correctamente",
        "category": {
            "id": new_category.id,
            "name": new_category.name,
            "active": new_category.active
        }
    }


@app.delete("/api/categories/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db)
):

    category = (
        db.query(models.Category)
        .filter(
            models.Category.id == category_id
        )
        .first()
    )

    if not category:

        raise HTTPException(
            status_code=404,
            detail="Categoría no encontrada."
        )

    # -----------------------------------------
    # Productos pertenecientes a la categoría
    # -----------------------------------------

    products = (
        db.query(models.Product)
        .filter(
            models.Product.category_id == category.id
        )
        .all()
    )

    # -----------------------------------------
    # No borramos físicamente la categoría.
    #
    # La desactivamos para no romper referencias
    # de productos ni historial.
    # -----------------------------------------

    category.active = False

    # Todos los productos de esta categoría
    # también desaparecen del catálogo.
    for product in products:

        product.active = False

    db.commit()

    return {
        "message": "Categoría eliminada del catálogo correctamente."
    }


# =========================================================
# PRODUCTOS
# =========================================================

@app.get("/api/products")
def get_products(
    db: Session = Depends(get_db)
):

    products = (
        db.query(models.Product)
        .filter(models.Product.active == True)
        .order_by(models.Product.id.asc())
        .all()
    )

    return [
        {
            "id": product.id,
            "name": product.name,
            "price": float(product.price),
            "image": product.image,
            "active": product.active,
            "category_id": product.category_id,
            "category": (
                product.category.name
                if product.category
                else "Sin categoría"
            )
        }
        for product in products
    ]


@app.post("/api/products")
def create_product(
    product: ProductCreate,
    db: Session = Depends(get_db)
):

    category = (
        db.query(models.Category)
        .filter(
            models.Category.id == product.category_id,
            models.Category.active == True
        )
        .first()
    )

    if not category:

        raise HTTPException(
            status_code=404,
            detail="La categoría no existe o está eliminada."
        )

    if not product.name.strip():

        raise HTTPException(
            status_code=400,
            detail="El nombre del producto es obligatorio."
        )

    if product.price < 0:

        raise HTTPException(
            status_code=400,
            detail="El precio no puede ser negativo."
        )

    new_product = models.Product(
        name=product.name.strip(),
        price=float(product.price),
        image=product.image,
        category_id=product.category_id,
        active=True
    )

    db.add(new_product)
    db.commit()
    db.refresh(new_product)

    return {
        "message": "Producto creado correctamente",
        "product": {
            "id": new_product.id,
            "name": new_product.name,
            "price": float(new_product.price),
            "image": new_product.image,
            "active": new_product.active,
            "category_id": new_product.category_id
        }
    }


@app.delete("/api/products/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db)
):

    product = (
        db.query(models.Product)
        .filter(
            models.Product.id == product_id
        )
        .first()
    )

    if not product:

        raise HTTPException(
            status_code=404,
            detail="Producto no encontrado."
        )

    # -----------------------------------------
    # Comprobar si el producto tiene ventas
    # -----------------------------------------

    has_sales = (
        db.query(models.SaleDetail)
        .filter(
            models.SaleDetail.product_id == product.id
        )
        .first()
        is not None
    )

    # -----------------------------------------
    # PRODUCTO YA VENDIDO
    # -----------------------------------------

    if has_sales:

        # No se borra de la BD.
        # Se elimina del catálogo.
        product.active = False

        db.commit()

        return {
            "message": (
                "Producto retirado del catálogo. "
                "Las ventas anteriores se conservaron."
            ),
            "deleted_permanently": False
        }

    # -----------------------------------------
    # PRODUCTO NUNCA VENDIDO
    # -----------------------------------------

    db.delete(product)
    db.commit()

    return {
        "message": "Producto eliminado correctamente.",
        "deleted_permanently": True
    }


# =========================================================
# VENTAS
# =========================================================

@app.get("/api/sales")
def get_sales(
    db: Session = Depends(get_db)
):

    open_cash = (
        db.query(models.CashRegister)
        .filter(
            models.CashRegister.is_open == True
        )
        .order_by(
            models.CashRegister.id.desc()
        )
        .first()
    )

    if not open_cash:
        return []

    sales = (
        db.query(models.Sale)
        .filter(
            models.Sale.cash_register_id == open_cash.id
        )
        .order_by(
            models.Sale.id.asc()
        )
        .all()
    )

    return [
        {
            "id": sale.id,
            "ticket": sale.ticket,
            "date": sale.date,
            "order_type": sale.order_type,
            "table": sale.table,
            "payment_method": sale.payment_method,
            "total": float(sale.total),
            "details": [
                {
                    "product_id": detail.product_id,
                    "product_name": detail.product_name,
                    "quantity": detail.quantity,
                    "price": float(detail.price),
                    "subtotal": float(detail.subtotal)
                }
                for detail in sale.details
            ]
        }
        for sale in sales
    ]


@app.post("/api/sales")
def create_sale(
    sale_data: SaleCreate,
    db: Session = Depends(get_db)
):

    cash_register = (
        db.query(models.CashRegister)
        .filter(
            models.CashRegister.is_open == True
        )
        .order_by(
            models.CashRegister.id.desc()
        )
        .first()
    )

    if not cash_register:

        raise HTTPException(
            status_code=400,
            detail="No hay una caja abierta."
        )

    last_sale = (
        db.query(models.Sale)
        .order_by(
            models.Sale.id.desc()
        )
        .first()
    )

    next_number = (
        1001
        if not last_sale
        else last_sale.id + 1001
    )

    ticket = f"TK-{next_number}"

    new_sale = models.Sale(
        ticket=ticket,
        date=mexico_now(),
        order_type=sale_data.order_type,
        table=sale_data.table,
        payment_method=sale_data.payment_method,
        total=float(sale_data.total),
        cash_register_id=cash_register.id
    )

    db.add(new_sale)
    db.flush()

    for detail in sale_data.details:

        product = (
            db.query(models.Product)
            .filter(
                models.Product.id == detail.product_id
            )
            .first()
        )

        if not product:

            db.rollback()

            raise HTTPException(
                status_code=404,
                detail=(
                    f"El producto con ID "
                    f"{detail.product_id} no existe."
                )
            )

        new_detail = models.SaleDetail(
            sale_id=new_sale.id,
            product_id=detail.product_id,
            product_name=detail.product_name,
            quantity=detail.quantity,
            price=float(detail.price),
            subtotal=float(detail.subtotal)
        )

        db.add(new_detail)

    if sale_data.payment_method == "Efectivo":

        cash_register.cash_sales = (
            float(cash_register.cash_sales or 0)
            + float(sale_data.total)
        )

    db.commit()
    db.refresh(new_sale)

    return {
        "message": "Venta registrada correctamente",
        "sale": {
            "id": new_sale.id,
            "ticket": new_sale.ticket,
            "date": new_sale.date,
            "order_type": new_sale.order_type,
            "table": new_sale.table,
            "payment_method": new_sale.payment_method,
            "total": float(new_sale.total)
        }
    }


# =========================================================
# CAJA
# =========================================================

def cash_to_dict(cash):

    if not cash:

        return {
            "id": None,
            "is_open": False,
            "initial_fund": 0,
            "cash_sales": 0,
            "cash_in": 0,
            "cash_out": 0,
            "opened_at": None,
            "closed_at": None
        }

    return {
        "id": cash.id,
        "is_open": bool(cash.is_open),
        "initial_fund": float(cash.initial_fund or 0),
        "cash_sales": float(cash.cash_sales or 0),
        "cash_in": float(cash.cash_in or 0),
        "cash_out": float(cash.cash_out or 0),
        "opened_at": cash.opened_at,
        "closed_at": cash.closed_at
    }


def get_open_cash(db: Session):

    return (
        db.query(models.CashRegister)
        .filter(
            models.CashRegister.is_open == True
        )
        .order_by(
            models.CashRegister.id.desc()
        )
        .first()
    )


# =========================================================
# OBTENER CAJA
# =========================================================

@app.get("/api/cash")
def get_cash(
    db: Session = Depends(get_db)
):

    cash = get_open_cash(db)

    if not cash:

        cash = (
            db.query(models.CashRegister)
            .order_by(
                models.CashRegister.id.desc()
            )
            .first()
        )

    return cash_to_dict(cash)


# =========================================================
# ABRIR CAJA
# =========================================================

@app.post("/api/cash/open")
def open_cash(
    data: CashOpenCreate,
    db: Session = Depends(get_db)
):

    if data.initial_fund < 0:

        raise HTTPException(
            status_code=400,
            detail="El fondo inicial no puede ser negativo."
        )

    current_cash = get_open_cash(db)

    if current_cash:

        return {
            "message": "La caja ya estaba abierta.",
            "cash": cash_to_dict(current_cash)
        }

    cash = models.CashRegister(
        is_open=True,
        initial_fund=float(data.initial_fund),
        cash_sales=0,
        cash_in=0,
        cash_out=0,
        opened_at=datetime.now(),
        closed_at=None
    )

    db.add(cash)
    db.commit()
    db.refresh(cash)

    return {
        "message": "Caja abierta correctamente.",
        "cash": cash_to_dict(cash)
    }


# =========================================================
# MOVIMIENTO DE CAJA
# =========================================================

@app.post("/api/cash/movement")
def create_cash_movement(
    movement: CashMovementCreate,
    db: Session = Depends(get_db)
):

    movement_type = movement.type.upper().strip()

    if movement_type not in ["IN", "OUT"]:

        raise HTTPException(
            status_code=400,
            detail="Tipo de movimiento inválido. Usa IN o OUT."
        )

    if movement.amount <= 0:

        raise HTTPException(
            status_code=400,
            detail="El monto debe ser mayor a cero."
        )

    concept = movement.concept.strip()

    if not concept:

        raise HTTPException(
            status_code=400,
            detail="El concepto es obligatorio."
        )

    cash = get_open_cash(db)

    if not cash:

        raise HTTPException(
            status_code=400,
            detail="La caja está cerrada."
        )

    amount = float(movement.amount)

    new_movement = models.CashMovement(
        type=movement_type,
        amount=amount,
        concept=concept,
        date=mexico_now(),
        cash_register_id=cash.id
    )

    if movement_type == "IN":

        cash.cash_in = (
            float(cash.cash_in or 0)
            + amount
        )

    else:

        cash.cash_out = (
            float(cash.cash_out or 0)
            + amount
        )

    db.add(new_movement)
    db.commit()
    db.refresh(new_movement)

    return {
        "message": (
            "Entrada registrada correctamente."
            if movement_type == "IN"
            else "Salida registrada correctamente."
        ),
        "movement": {
            "id": new_movement.id,
            "type": new_movement.type,
            "amount": float(new_movement.amount or 0),
            "concept": new_movement.concept,
            "date": new_movement.date
        },
        "cash": cash_to_dict(cash)
    }


# =========================================================
# MOVIMIENTOS DE CAJA
# =========================================================

@app.get("/api/cash/movements")
def get_cash_movements(
    db: Session = Depends(get_db)
):

    cash = get_open_cash(db)

    if not cash:
        return []

    movements = (
        db.query(models.CashMovement)
        .filter(
            models.CashMovement.cash_register_id == cash.id
        )
        .order_by(
            models.CashMovement.id.asc()
        )
        .all()
    )

    return [
        {
            "id": movement.id,
            "type": movement.type,
            "amount": float(movement.amount or 0),
            "concept": movement.concept,
            "date": movement.date
        }
        for movement in movements
    ]


# =========================================================
# CERRAR CAJA
# =========================================================

@app.post("/api/cash/close")
def close_cash(
    db: Session = Depends(get_db)
):

    cash = get_open_cash(db)

    if not cash:

        raise HTTPException(
            status_code=400,
            detail="No hay una caja abierta."
        )

    cash.is_open = False
    cash.closed_at = mexico_now()

    db.commit()
    db.refresh(cash)

    return {
        "message": "Caja cerrada correctamente.",
        "cash": cash_to_dict(cash)
    }


# =========================================================
# FRONTEND
# =========================================================

app.mount(
    "/",
    StaticFiles(
        directory=".",
        html=True
    ),
    name="static"
)