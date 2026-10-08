from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    role: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ProductBase(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    category: str = Field(min_length=2, max_length=100)
    description: str = Field(default="", max_length=5000)
    price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    stock: int = Field(ge=0)
    image_url: str = Field(default="", max_length=1000)

class ProductCreate(ProductBase): pass

class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    category: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=5000)
    price: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    stock: int | None = Field(default=None, ge=0)
    image_url: str | None = Field(default=None, max_length=1000)
    is_active: bool | None = None

class ProductResponse(ProductBase):
    id: int
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

class OrderItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=100)

class OrderCreate(BaseModel):
    items: list[OrderItemCreate] = Field(min_length=1, max_length=50)

class OrderItemResponse(BaseModel):
    product_id: int
    product_name: str
    quantity: int
    unit_price: Decimal
    model_config = ConfigDict(from_attributes=True)

class OrderResponse(BaseModel):
    id: int
    status: str
    total: Decimal
    created_at: datetime
    items: list[OrderItemResponse]
    model_config = ConfigDict(from_attributes=True)

class OrderStatusUpdate(BaseModel):
    status: str = Field(pattern="^(PLACED|PROCESSING|SHIPPED|DELIVERED|CANCELLED)$")

class AdminOrderResponse(OrderResponse):
    user_id: int
    user_email: EmailStr
