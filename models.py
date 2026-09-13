from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime

from database import Base


# =========================================================
# CATEGORÍAS
# =========================================================

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(
        String,
        unique=True,
        nullable=False
    )

    # Permite retirar una categoría del catálogo
    # sin destruir información histórica.
    active = Column(
        Boolean,
        default=True,
        nullable=False
    )

    products = relationship(
        "Product",
        back_populates="category"
    )


# =========================================================
# PRODUCTOS
# =========================================================

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(
        String,
        nullable=False
    )

    price = Column(
        Float,
        nullable=False
    )

    image = Column(
        String,
        nullable=True
    )

    # Producto disponible en el catálogo
    active = Column(
        Boolean,
        default=True,
        nullable=False
    )

    category_id = Column(
        Integer,
        ForeignKey("categories.id"),
        nullable=False
    )

    category = relationship(
        "Category",
        back_populates="products"
    )

    sale_details = relationship(
        "SaleDetail",
        back_populates="product"
    )


# =========================================================
# CAJAS
# =========================================================

class CashRegister(Base):
    __tablename__ = "cash_register"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    is_open = Column(
        Boolean,
        default=False
    )

    initial_fund = Column(
        Float,
        default=0
    )

    cash_sales = Column(
        Float,
        default=0
    )

    cash_in = Column(
        Float,
        default=0
    )

    cash_out = Column(
        Float,
        default=0
    )

    opened_at = Column(
        DateTime,
        nullable=True
    )

    closed_at = Column(
        DateTime,
        nullable=True
    )

    sales = relationship(
        "Sale",
        back_populates="cash_register"
    )

    movements = relationship(
        "CashMovement",
        back_populates="cash_register"
    )


# =========================================================
# VENTAS
# =========================================================

class Sale(Base):
    __tablename__ = "sales"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    ticket = Column(
        String,
        unique=True,
        nullable=False
    )

    date = Column(
        DateTime,
        default=datetime.now
    )

    order_type = Column(
        String,
        nullable=False
    )

    table = Column(
        String,
        nullable=True
    )

    payment_method = Column(
        String,
        nullable=False
    )

    total = Column(
        Float,
        nullable=False
    )

    cash_register_id = Column(
        Integer,
        ForeignKey("cash_register.id"),
        nullable=True
    )

    cash_register = relationship(
        "CashRegister",
        back_populates="sales"
    )

    details = relationship(
        "SaleDetail",
        back_populates="sale",
        cascade="all, delete-orphan"
    )


# =========================================================
# DETALLE DE VENTA
# =========================================================

class SaleDetail(Base):
    __tablename__ = "sale_details"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    sale_id = Column(
        Integer,
        ForeignKey("sales.id"),
        nullable=False
    )

    # IMPORTANTE:
    # Se mantiene obligatorio para conservar
    # correctamente el historial de ventas.
    product_id = Column(
        Integer,
        ForeignKey("products.id"),
        nullable=False
    )

    product_name = Column(
        String,
        nullable=False
    )

    quantity = Column(
        Integer,
        nullable=False
    )

    price = Column(
        Float,
        nullable=False
    )

    subtotal = Column(
        Float,
        nullable=False
    )

    sale = relationship(
        "Sale",
        back_populates="details"
    )

    product = relationship(
        "Product",
        back_populates="sale_details"
    )


# =========================================================
# MOVIMIENTOS DE CAJA
# =========================================================

class CashMovement(Base):
    __tablename__ = "cash_movements"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    type = Column(
        String,
        nullable=False
    )

    amount = Column(
        Float,
        nullable=False
    )

    concept = Column(
        String,
        nullable=False
    )

    date = Column(
        DateTime,
        default=datetime.now
    )

    cash_register_id = Column(
        Integer,
        ForeignKey("cash_register.id"),
        nullable=True
    )

    cash_register = relationship(
        "CashRegister",
        back_populates="movements"
    )