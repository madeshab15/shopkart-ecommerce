import os
from dotenv import load_dotenv
load_dotenv()
from contextlib import asynccontextmanager
from contextlib import asynccontextmanager
from decimal import Decimal
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload
from .auth import create_access_token, get_current_user, hash_password, verify_password
from .database import Base, engine, get_db
from .models import Order, OrderItem, Product, User
from .schemas import (
    AdminOrderResponse, LoginRequest, OrderCreate, OrderResponse, OrderStatusUpdate,
    ProductCreate, ProductResponse, ProductUpdate, TokenResponse, UserCreate, UserResponse
)

SEED_PRODUCTS = [
    {"name":"Wireless Headphones","category":"Electronics","description":"Bluetooth over-ear headphones with deep bass and long battery life.","price":Decimal("2499.00"),"stock":25,"image_url":"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900"},
    {"name":"Smart Watch","category":"Electronics","description":"Fitness tracking, notifications and a bright touch display.","price":Decimal("3999.00"),"stock":18,"image_url":"https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900"},
    {"name":"Mechanical Keyboard","category":"Computers","description":"Compact mechanical keyboard for coding and productivity.","price":Decimal("3299.00"),"stock":20,"image_url":"https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=900"},
    {"name":"Laptop Backpack","category":"Accessories","description":"Water-resistant backpack with padded laptop compartment.","price":Decimal("1799.00"),"stock":30,"image_url":"https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=900"},
    {"name":"Wireless Mouse","category":"Computers","description":"Ergonomic wireless mouse with adjustable DPI.","price":Decimal("899.00"),"stock":40,"image_url":"https://images.unsplash.com/photo-1527814050087-3793815479db?w=900"},
    {"name":"USB-C Hub","category":"Accessories","description":"Multi-port USB-C hub with HDMI and USB 3 connectivity.","price":Decimal("1299.00"),"stock":35,"image_url":"https://images.unsplash.com/photo-1625842268584-8f3296236761?w=900"},
]

# Demo admin defaults. These are kept on the backend only; the frontend never
# contains or displays these credentials.
DEFAULT_ADMIN_EMAIL = "admin@gmail.com"
DEFAULT_ADMIN_PASSWORD = "admin123"

def seed_data():
    email = (os.getenv("ADMIN_EMAIL") or DEFAULT_ADMIN_EMAIL).strip().lower()
    password = os.getenv("ADMIN_PASSWORD") or DEFAULT_ADMIN_PASSWORD

    with Session(engine) as db:
        user = db.scalar(select(User).where(User.email == email))
        if not user:
            user = User(email=email, password_hash=hash_password(password), role="admin")
            db.add(user)
        else:
            # Keep the demo admin login usable even when an older database
            # already contains the admin account with a stale password/hash.
            user.password_hash = hash_password(password)
            user.role = "admin"

        if not db.scalar(select(Product.id)):
            db.add_all([Product(**p) for p in SEED_PRODUCTS])
        db.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_data()
    yield

app = FastAPI(title="E-Commerce Full Stack API", version="3.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])

@app.get("/")
def root():
    return {"message":"E-Commerce API is running","docs":"/docs","version":"3.0.0"}

def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(403, "Admin access required")
    return current_user

@app.post("/auth/register", response_model=UserResponse, status_code=201)
def register(data: UserCreate, db: Session = Depends(get_db)):
    email = data.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(400, "Email already registered")
    user = User(email=email, password_hash=hash_password(data.password), role="customer")
    db.add(user); db.commit(); db.refresh(user)
    return user

@app.post("/auth/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    return {"access_token":create_access_token(user.id), "user":user}

@app.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user

@app.get("/categories", response_model=list[str])
def categories(db: Session = Depends(get_db)):
    return list(db.scalars(select(Product.category).where(Product.is_active == True).distinct().order_by(Product.category)).all())

@app.get("/products", response_model=list[ProductResponse])
def list_products(
    search: str | None = Query(None),
    category: str | None = Query(None),
    min_price: Decimal | None = Query(None, ge=0),
    max_price: Decimal | None = Query(None, ge=0),
    include_inactive: bool = False,
    db: Session = Depends(get_db)
):
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(400, "min_price cannot be greater than max_price")
    stmt = select(Product)
    if not include_inactive: stmt = stmt.where(Product.is_active == True)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(or_(Product.name.ilike(pattern), Product.description.ilike(pattern), Product.category.ilike(pattern)))
    if category: stmt = stmt.where(Product.category == category)
    if min_price is not None: stmt = stmt.where(Product.price >= min_price)
    if max_price is not None: stmt = stmt.where(Product.price <= max_price)
    return list(db.scalars(stmt.order_by(Product.id.desc())).all())

@app.get("/products/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product or not product.is_active: raise HTTPException(404, "Product not found")
    return product

@app.post("/products", response_model=ProductResponse, status_code=201)
def create_product(data: ProductCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    product = Product(**data.model_dump())
    db.add(product); db.commit(); db.refresh(product); return product

@app.put("/products/{product_id}", response_model=ProductResponse)
def update_product(product_id: int, data: ProductUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    product = db.get(Product, product_id)
    if not product: raise HTTPException(404, "Product not found")
    for key, value in data.model_dump(exclude_unset=True).items(): setattr(product, key, value)
    db.commit(); db.refresh(product); return product

@app.delete("/products/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    product = db.get(Product, product_id)
    if not product: raise HTTPException(404, "Product not found")
    product.is_active = False
    db.commit()

def order_query_for(order_id=None):
    stmt = select(Order).options(selectinload(Order.items), selectinload(Order.user))
    return stmt.where(Order.id == order_id) if order_id else stmt

@app.post("/orders", response_model=OrderResponse, status_code=201)
def create_order(data: OrderCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Combine duplicate product IDs so stock can never be decremented twice accidentally.
    quantities = {}
    for item in data.items:
        quantities[item.product_id] = quantities.get(item.product_id, 0) + item.quantity
    if any(q > 100 for q in quantities.values()):
        raise HTTPException(400, "Maximum quantity per product is 100")
    order = Order(user_id=current_user.id, status="PLACED", total=Decimal("0.00"))
    db.add(order)
    total = Decimal("0.00")
    try:
        for product_id, quantity in quantities.items():
            product = db.scalar(select(Product).where(Product.id == product_id, Product.is_active == True).with_for_update())
            if not product: raise HTTPException(404, f"Product {product_id} not found")
            if product.stock < quantity: raise HTTPException(400, f"Not enough stock for {product.name}. Available: {product.stock}")
            product.stock -= quantity
            total += product.price * quantity
            order.items.append(OrderItem(product_id=product.id, product_name=product.name, quantity=quantity, unit_price=product.price))
        order.total = total
        db.commit()
    except HTTPException:
        db.rollback(); raise
    except Exception:
        db.rollback(); raise HTTPException(500, "Could not create order")
    return db.scalar(order_query_for(order.id))

@app.get("/orders", response_model=list[OrderResponse])
def my_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return list(db.scalars(select(Order).options(selectinload(Order.items)).where(Order.user_id == current_user.id).order_by(Order.id.desc())).unique().all())

@app.get("/orders/{order_id}", response_model=OrderResponse)
def get_my_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    order = db.scalar(select(Order).options(selectinload(Order.items)).where(Order.id == order_id, Order.user_id == current_user.id))
    if not order: raise HTTPException(404, "Order not found")
    return order

@app.post("/orders/{order_id}/cancel", response_model=OrderResponse)
def cancel_my_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    order = db.scalar(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order_id, Order.user_id == current_user.id)
        .with_for_update()
    )
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status == "CANCELLED":
        raise HTTPException(400, "Order is already cancelled")
    if order.status in ("SHIPPED", "DELIVERED"):
        raise HTTPException(400, "This order can no longer be cancelled")

    # Restore inventory exactly once before changing the status.
    for item in order.items:
        product = db.scalar(select(Product).where(Product.id == item.product_id).with_for_update())
        if product:
            product.stock += item.quantity
    order.status = "CANCELLED"
    db.commit()
    return db.scalar(
        select(Order).options(selectinload(Order.items)).where(Order.id == order.id)
    )

@app.post("/orders/{order_id}/reorder", response_model=OrderResponse, status_code=201)
def reorder(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    order = db.scalar(
        select(Order).options(selectinload(Order.items)).where(
            Order.id == order_id, Order.user_id == current_user.id
        )
    )
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status == "CANCELLED":
        # Reordering a cancelled order is still allowed if products are available.
        pass
    quantities = {item.product_id: item.quantity for item in order.items}
    if not quantities:
        raise HTTPException(400, "Order has no items")
    new_order = Order(user_id=current_user.id, status="PLACED", total=Decimal("0.00"))
    db.add(new_order)
    total = Decimal("0.00")
    try:
        for product_id, quantity in quantities.items():
            product = db.scalar(
                select(Product).where(Product.id == product_id, Product.is_active == True).with_for_update()
            )
            if not product:
                raise HTTPException(404, f"Product {product_id} is no longer available")
            if product.stock < quantity:
                raise HTTPException(400, f"Not enough stock for {product.name}. Available: {product.stock}")
            product.stock -= quantity
            total += product.price * quantity
            new_order.items.append(OrderItem(
                product_id=product.id, product_name=product.name,
                quantity=quantity, unit_price=product.price
            ))
        new_order.total = total
        db.commit()
    except HTTPException:
        db.rollback(); raise
    except Exception:
        db.rollback(); raise HTTPException(500, "Could not reorder")
    return db.scalar(select(Order).options(selectinload(Order.items)).where(Order.id == new_order.id))

@app.get("/admin/users", response_model=list[UserResponse])
def admin_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return list(db.scalars(select(User).order_by(User.id.desc())).all())

@app.post("/admin/users", response_model=UserResponse, status_code=201)
def admin_create_user(data: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    email = data.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(400, "Email already registered")
    user = User(email=email, password_hash=hash_password(data.password), role="customer")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@app.get("/admin/orders", response_model=list[AdminOrderResponse])
def admin_orders(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    orders = list(db.scalars(select(Order).options(selectinload(Order.items), selectinload(Order.user)).order_by(Order.id.desc())).unique().all())
    return [{"id":o.id,"status":o.status,"total":o.total,"created_at":o.created_at,"items":o.items,"user_id":o.user_id,"user_email":o.user.email} for o in orders]

@app.patch("/orders/{order_id}/status", response_model=OrderResponse)
def update_order_status(order_id: int, data: OrderStatusUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    order = db.scalar(select(Order).options(selectinload(Order.items)).where(Order.id == order_id))
    if not order: raise HTTPException(404, "Order not found")
    old = order.status
    new = data.status
    if old == "CANCELLED" and new != "CANCELLED": raise HTTPException(400, "Cancelled orders cannot be reopened")
    if old == "DELIVERED" and new not in ("DELIVERED",): raise HTTPException(400, "Delivered orders cannot be changed")
    if new == "CANCELLED" and old != "CANCELLED":
        for item in order.items:
            product = db.get(Product, item.product_id)
            if product: product.stock += item.quantity
    order.status = new
    db.commit()
    return db.scalar(select(Order).options(selectinload(Order.items)).where(Order.id == order.id))

@app.get("/admin/dashboard")
def admin_dashboard(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    sales = db.scalar(select(func.coalesce(func.sum(Order.total), 0)).where(Order.status != "CANCELLED")) or 0
    return {
        "total_users": db.scalar(select(func.count(User.id))) or 0,
        "total_products": db.scalar(select(func.count(Product.id)).where(Product.is_active == True)) or 0,
        "total_orders": db.scalar(select(func.count(Order.id))) or 0,
        "total_sales": float(sales),
        "pending_orders": db.scalar(select(func.count(Order.id)).where(Order.status.in_(["PLACED","PROCESSING","SHIPPED"]))) or 0,
    }
