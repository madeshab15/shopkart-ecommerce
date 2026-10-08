# ShopKart — Complete E-Commerce Full Stack Project

A fresher-friendly, working e-commerce application with a real relational database.

## Technology
- Frontend: HTML, CSS, JavaScript
- Backend: FastAPI + Python
- Database: MySQL 8.4
- ORM: SQLAlchemy 2
- Authentication: JWT + Argon2 password hashing
- API documentation: Swagger/OpenAPI
- Containerization: Docker Compose
- Tests: Pytest

## Main features
### Customer
1. Login first (default administrator credentials are configured on the backend and are not displayed or pre-filled in the frontend)
2. Browse products
3. Search products
4. Filter by category
5. Add/remove/update cart
6. Place an order
7. Database stock automatically decreases after successful checkout
8. View personal order history and order items

### Admin
1. Dashboard: users, products, orders, sales and pending orders
2. Create customer users and view registered users
3. Add products
4. Edit price/stock/name
5. Hide products without breaking historical orders
6. View all customer orders
7. Change order status: PLACED → PROCESSING → SHIPPED → DELIVERED
8. Cancel an order and restore its stock

## Database design
- `users`: customer/admin accounts
- `products`: catalog, price, stock, category and active/hidden state
- `orders`: customer order header, status and total
- `order_items`: products purchased, quantity, price-at-purchase and product name snapshot

Order creation uses a database transaction. If a product does not exist or stock is insufficient, the transaction is rolled back, so partial orders are not saved.

Money is stored using MySQL `DECIMAL`/SQLAlchemy `Numeric`, not floating-point database columns.

## Option A — Recommended: Docker Desktop
Install Docker Desktop, then open CMD in this project folder:

```cmd
docker compose up --build
```

Wait until MySQL becomes healthy and the API starts.

Open:
- Store: http://127.0.0.1:8080
- API: http://127.0.0.1:8000
- Swagger: http://127.0.0.1:8000/docs

### Default admin
Email: `admin@gmail.com`
Password: `admin123`

Change the admin credentials and JWT secret before using the project outside a demo.

## Option B — Run backend manually
1. Start MySQL and create database `ecommerce`.
2. Copy `backend/.env.example` to `backend/.env` and set the correct values.
3. In CMD:

```cmd
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Then open `frontend/index.html` using VS Code Live Server.

## How to demonstrate
1. Open the Store.
2. Register a customer.
3. Login.
4. Add two products to cart.
5. Open Cart and place order.
6. Open Orders and show the saved order and database-driven total.
7. Login as admin.
8. Open Admin.
9. Show dashboard counts.
10. Show the product in Manage Products and change stock.
11. Show the customer order and change its status.
12. Cancel an order and explain that stock is restored.
13. Refresh the store and show the product stock changed.

## Useful API endpoints
- `POST /auth/register`
- `POST /auth/login`
- `GET /me`
- `GET /categories`
- `GET /products`
- `GET /products/{id}`
- `POST /products` (admin)
- `PUT /products/{id}` (admin)
- `DELETE /products/{id}` (admin; hides product)
- `POST /orders`
- `GET /orders`
- `GET /orders/{id}`
- `GET /admin/orders` (admin)
- `PATCH /orders/{id}/status` (admin)
- `GET /admin/dashboard` (admin)

## Testing
From `backend`:

```cmd
python -m pytest -q
```

The test covers registration/login, product retrieval, order creation, order history and admin endpoints.

## Stopping the project
```cmd
docker compose down
```

To remove the MySQL database volume and start completely fresh:

```cmd
docker compose down -v
docker compose up --build
```

Do not run `down -v` if you need to keep existing orders/products.

## Cart and Product Details
- Product cards now use normal links and buttons instead of unsafe inline product JSON, so product names containing quotes/apostrophes cannot break Add to Cart.
- Every product has a Product Details page at `product.html?id=<product_id>`.
- Product Details supports quantity selection, live subtotal, stock limits and Add to Cart.
- Cart stores product ID, name, current price, image and quantity in browser storage.
- Cart refreshes product data from the API before rendering, preventing stale prices/stock from being used.
- Quantity controls enforce available stock.
- Checkout sends only product IDs and quantities to the backend; the backend re-checks stock and calculates the authoritative total from MySQL.
- Successful checkout clears the cart and creates the order in MySQL.

## Customer order lifecycle
- Add/remove products from cart
- Change cart quantities with live stock validation
- Place orders from the cart
- View complete order details and item totals
- Cancel orders while status is PLACED or PROCESSING
- Cancellation automatically restores inventory
- Reorder any previous order using current product price and stock
- SHIPPED and DELIVERED orders cannot be cancelled by customers
- Admin can move orders through PLACED -> PROCESSING -> SHIPPED -> DELIVERED or CANCELLED


## Interview talking points
- **Frontend:** responsive HTML/CSS/JavaScript UI with login gateway, product search/filter, product details, cart, checkout and order history.
- **Backend:** FastAPI REST API with JWT authentication, role-based admin authorization and Swagger documentation.
- **Database:** MySQL relational schema for users, products, orders and order items using SQLAlchemy ORM.
- **Business logic:** checkout validates stock, calculates totals on the server and decreases inventory transactionally; cancellation restores inventory.
- **Admin:** dashboard KPIs, customer creation/listing, product CRUD/hide, inventory management and order status workflow.
- **DevOps:** Docker Compose runs frontend (Nginx), FastAPI backend and MySQL together.
- **Testing:** Pytest covers authentication, products, orders and admin endpoints.

## Recommended demo flow
1. Open `http://127.0.0.1:8080` — the app sends a new visitor to the login page first.
2. Show the displayed demo credentials and type them manually: `admin@gmail.com` / `admin123`.
3. Demonstrate Admin Dashboard: users, products, sales and orders.
4. Create a customer user from Admin → Create Customer User.
5. Logout and login as the customer.
6. Search/filter a product → open details → add quantity → cart → place order.
7. Open Orders and demonstrate Cancel / Order Again where applicable.
8. Login as admin again and update the order status through Processing → Shipped → Delivered.
9. Explain that stock is stored in MySQL and checkout/cancellation updates it transactionally.

## Docker troubleshooting
If you changed Docker files and want a clean rebuild:
```cmd
docker compose down
docker compose build --no-cache
docker compose up
```
If you want to reset the demo database completely:
```cmd
docker compose down -v
docker compose up --build
```
