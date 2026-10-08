import os
os.environ["DATABASE_URL"] = "sqlite:///./test_ecommerce.db"
os.environ["JWT_SECRET"] = "test-secret"
os.environ["ADMIN_EMAIL"] = "admin@test.com"
os.environ["ADMIN_PASSWORD"] = "Admin@12345"

from fastapi.testclient import TestClient
from app.main import app

def test_full_flow():
    with TestClient(app) as client:
        email = "customer@example.com"
        r = client.post("/auth/register", json={"email":email,"password":"secret123"})
        assert r.status_code in (201, 400)

        r = client.post("/auth/login", json={"email":email,"password":"secret123"})
        assert r.status_code == 200
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        products = client.get("/products").json()
        assert len(products) >= 1
        p = next(p for p in products if p["stock"] > 0)

        r = client.post("/orders", headers=headers, json={"items":[{"product_id":p["id"],"quantity":1}]})
        assert r.status_code == 201
        order_id = r.json()["id"]
        assert r.json()["total"] == str(p["price"])

        orders = client.get("/orders", headers=headers)
        assert orders.status_code == 200
        assert any(o["id"] == order_id for o in orders.json())

        r = client.post("/auth/login", json={"email":"admin@test.com","password":"Admin@12345"})
        assert r.status_code == 200
        admin_headers = {"Authorization":f"Bearer {r.json()['access_token']}"}
        assert client.get("/admin/dashboard", headers=admin_headers).status_code == 200
        assert client.get("/admin/orders", headers=admin_headers).status_code == 200
