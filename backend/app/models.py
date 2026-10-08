from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(500), nullable=False)
    role: Mapped[str] = mapped_column(String(30), default="customer", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    orders: Mapped[list["Order"]] = relationship(back_populates="user")

class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    stock: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    image_url: Mapped[str] = mapped_column(String(1000), default="", nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    __table_args__ = (CheckConstraint("price > 0", name="ck_product_price_positive"),
                      CheckConstraint("stock >= 0", name="ck_product_stock_nonnegative"))

class Order(Base):
    __tablename__ = "orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), default="PLACED", nullable=False, index=True)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    user: Mapped["User"] = relationship(back_populates="orders")
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), nullable=False, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    product_name: Mapped[str] = mapped_column(String(200), nullable=False)
    order: Mapped["Order"] = relationship(back_populates="items")
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_order_item_quantity_positive"),
        CheckConstraint("unit_price > 0", name="ck_order_item_unit_price_positive"),
    )
