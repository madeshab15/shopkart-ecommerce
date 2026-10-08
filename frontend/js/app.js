const API = `${window.location.protocol}//${window.location.hostname || "127.0.0.1"}:8000`;
const $ = id => document.getElementById(id);
const token = () => localStorage.getItem("access_token");
const cartKey = "cart";
const placeholder = "https://via.placeholder.com/600x400?text=Product";

const esc = value => String(value ?? "").replace(/[&<>"']/g, m => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
}[m]));

async function getJson(response) {
  try { return await response.json(); } catch { return {}; }
}

function authHeaders() {
  return token() ? { Authorization: `Bearer ${token()}` } : {};
}

function money(value) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

function getCart() {
  try {
    const cart = JSON.parse(localStorage.getItem(cartKey) || "[]");
    return Array.isArray(cart) ? cart : [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(cartKey, JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const count = getCart().reduce((total, item) => total + Number(item.quantity || 0), 0);
  document.querySelectorAll("#cartCount").forEach(el => el.textContent = count);
}

function updateAuthLink() {
  const link = $("authLink");
  if (!link) return;
  if (token()) {
    link.textContent = "Logout";
    link.href = "#";
    link.onclick = event => {
      event.preventDefault();
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      location.href = "index.html";
    };
  } else {
    link.textContent = "Login";
    link.href = "login.html";
    link.onclick = null;
  }
}

async function requireLogin(requiredRole = null) {
  if (!token()) {
    const next = encodeURIComponent(location.pathname.split('/').pop() + location.search);
    location.href = `login.html?next=${next}`;
    return false;
  }
  try {
    const response = await fetch(`${API}/me`, { headers: authHeaders() });
    const user = await getJson(response);
    if (!response.ok) throw new Error(user.detail || "Session expired");
    localStorage.setItem("user", JSON.stringify(user));
    if (requiredRole && user.role !== requiredRole) {
      alert("Admin access required.");
      location.href = "index.html";
      return false;
    }
    return true;
  } catch {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    location.href = `login.html?next=${encodeURIComponent(location.pathname.split('/').pop() || 'index.html')}`;
    return false;
  }
}

async function initHome() {
  if (!(await requireLogin())) return;
  updateCartCount();
  updateAuthLink();
  loadCategories();
  loadProducts();
}

async function loadCategories() {
  const select = $("categoryFilter");
  if (!select) return;
  try {
    const response = await fetch(`${API}/categories`);
    const data = await getJson(response);
    if (!response.ok) throw new Error(data.detail || "Unable to load categories");
    select.innerHTML = `<option value="">All categories</option>` +
      data.map(category => `<option value="${esc(category)}">${esc(category)}</option>`).join("");
  } catch {
    select.innerHTML = `<option value="">All categories</option>`;
  }
}

async function loadProducts() {
  const box = $("products");
  if (!box) return;
  const params = new URLSearchParams();
  const search = $("search")?.value.trim();
  const category = $("categoryFilter")?.value;
  if (search) params.set("search", search);
  if (category) params.set("category", category);

  box.innerHTML = `<p>Loading products...</p>`;
  try {
    const response = await fetch(`${API}/products?${params.toString()}`);
    const data = await getJson(response);
    if (!response.ok) throw new Error(data.detail || "Unable to load products");
    box.innerHTML = data.length ? data.map(productCard).join("") : `<p>No products found.</p>`;
  } catch (error) {
    box.innerHTML = `<div class="card"><p>Unable to load products.</p><p class="hint">${esc(error.message || "Start the backend and try again.")}</p></div>`;
  }
}

function productCard(product) {
  const out = Number(product.stock) <= 0;
  const image = esc(product.image_url || placeholder);
  return `<article class="card product-card">
    <a class="product-image-link" href="product.html?id=${encodeURIComponent(product.id)}">
      <img src="${image}" alt="${esc(product.name)}" onerror="this.onerror=null;this.src='${placeholder}'">
    </a>
    <div class="product-info">
      <span class="badge">${esc(product.category)}</span>
      <h3>${esc(product.name)}</h3>
      <p class="description">${esc(product.description)}</p>
      <p class="price">${money(product.price)}</p>
      <p class="stock ${out ? "out" : ""}">${out ? "Out of stock" : `In stock: ${product.stock}`}</p>
      <div class="product-actions">
        <a class="secondary button-link" href="product.html?id=${encodeURIComponent(product.id)}">View Details</a>
        <button type="button" ${out ? "disabled" : ""} onclick="addToCartFromProduct(${product.id})">${out ? "Out of Stock" : "Add to Cart"}</button>
      </div>
    </div>
  </article>`;
}

async function addToCartFromProduct(productId) {
  try {
    const response = await fetch(`${API}/products/${productId}`);
    const product = await getJson(response);
    if (!response.ok) throw new Error(product.detail || "Product not found");
    addProductToCart(product);
  } catch (error) {
    alert(error.message || "Unable to add product to cart.");
  }
}

function addProductToCart(product, quantity = 1) {
  const stock = Number(product.stock);
  if (stock <= 0) {
    alert("This product is out of stock.");
    return false;
  }

  const cart = getCart();
  const existing = cart.find(item => Number(item.product_id) === Number(product.id));
  const currentQuantity = existing ? Number(existing.quantity) : 0;
  const requestedQuantity = currentQuantity + Number(quantity);

  if (requestedQuantity > stock) {
    alert(`Only ${stock} unit(s) of ${product.name} are available.`);
    return false;
  }

  if (existing) {
    existing.quantity = requestedQuantity;
    existing.name = product.name;
    existing.price = Number(product.price);
    existing.image_url = product.image_url || "";
    existing.stock = stock;
  } else {
    cart.push({
      product_id: Number(product.id),
      name: product.name,
      price: Number(product.price),
      quantity: Number(quantity),
      image_url: product.image_url || "",
      stock
    });
  }

  saveCart(cart);
  showToast(`${product.name} added to cart.`);
  return true;
}

function addToCart(id, name, price, stock) {
  // Kept for compatibility with older browser-cached pages.
  addProductToCart({ id, name, price, stock, image_url: "" });
}

function showToast(message) {
  let toast = $("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

async function initProductDetails() {
  if (!(await requireLogin())) return;
  updateCartCount();
  updateAuthLink();
  const box = $("productDetails");
  if (!box) return;
  const id = new URLSearchParams(location.search).get("id");
  if (!id) {
    box.innerHTML = `<div class="card"><h2>Product not selected</h2><a href="index.html">Back to products</a></div>`;
    return;
  }
  box.innerHTML = `<div class="card"><p>Loading product...</p></div>`;
  try {
    const response = await fetch(`${API}/products/${encodeURIComponent(id)}`);
    const product = await getJson(response);
    if (!response.ok) throw new Error(product.detail || "Product not found");
    renderProductDetails(product);
  } catch (error) {
    box.innerHTML = `<div class="card"><h2>Product unavailable</h2><p>${esc(error.message)}</p><a href="index.html">Back to products</a></div>`;
  }
}

function renderProductDetails(product) {
  const box = $("productDetails");
  const out = Number(product.stock) <= 0;
  box.innerHTML = `<div class="product-detail card">
    <div class="detail-image"><img src="${esc(product.image_url || placeholder)}" alt="${esc(product.name)}" onerror="this.onerror=null;this.src='${placeholder}'"></div>
    <div class="detail-info">
      <span class="badge">${esc(product.category)}</span>
      <h1>${esc(product.name)}</h1>
      <p class="detail-description">${esc(product.description || "No description available.")}</p>
      <p class="price detail-price">${money(product.price)}</p>
      <p class="stock ${out ? "out" : ""}">${out ? "Out of stock" : `${product.stock} unit(s) available`}</p>
      <div class="quantity-picker">
        <button type="button" class="secondary" ${out ? "disabled" : ""} onclick="changeDetailQuantity(-1)">−</button>
        <strong id="detailQuantity">1</strong>
        <button type="button" class="secondary" ${out ? "disabled" : ""} onclick="changeDetailQuantity(1)">+</button>
      </div>
      <p id="detailSubtotal" class="hint">${money(product.price)}</p>
      <button type="button" ${out ? "disabled" : ""} onclick="addDetailProductToCart(${product.id})">${out ? "Out of Stock" : "Add to Cart"}</button>
      <a class="button-link secondary" href="cart.html">Go to Cart</a>
      <p><a href="index.html">← Continue shopping</a></p>
    </div>
  </div>`;
  window.currentDetailProduct = product;
}

function changeDetailQuantity(delta) {
  const product = window.currentDetailProduct;
  if (!product) return;
  const el = $("detailQuantity");
  const max = Number(product.stock);
  let quantity = Number(el.textContent || 1) + delta;
  quantity = Math.max(1, Math.min(max, quantity));
  el.textContent = quantity;
  $("detailSubtotal").textContent = `Subtotal: ${money(Number(product.price) * quantity)}`;
}

function addDetailProductToCart(productId) {
  const product = window.currentDetailProduct;
  if (!product || Number(product.id) !== Number(productId)) return;
  const quantity = Number($("detailQuantity")?.textContent || 1);
  if (addProductToCart(product, quantity)) {
    setTimeout(() => { location.href = "cart.html"; }, 350);
  }
}

async function renderCart() {
  if (!(await requireLogin())) return;
  updateCartCount();
  updateAuthLink();
  const box = $("cart");
  if (!box) return;
  const cart = getCart();
  if (!cart.length) {
    box.innerHTML = `<div class="card empty-cart"><h2>Your cart is empty</h2><p>Add products to your cart to continue.</p><a class="button-link" href="index.html">Continue Shopping</a></div>`;
    $("checkoutBtn").style.display = "none";
    $("cartSummary").innerHTML = "";
    return;
  }

  box.innerHTML = `<div class="card"><p>Checking current product stock...</p></div>`;
  const freshCart = [];
  for (const item of cart) {
    try {
      const response = await fetch(`${API}/products/${item.product_id}`);
      const product = await getJson(response);
      if (!response.ok) continue;
      const quantity = Math.min(Number(item.quantity), Number(product.stock));
      if (quantity > 0) {
        freshCart.push({
          product_id: product.id,
          name: product.name,
          price: Number(product.price),
          quantity,
          image_url: product.image_url || "",
          stock: Number(product.stock)
        });
      }
    } catch {
      // Keep the item if the API is temporarily unavailable.
      freshCart.push(item);
    }
  }

  saveCart(freshCart);
  if (!freshCart.length) {
    box.innerHTML = `<div class="card empty-cart"><h2>Your cart is empty</h2><p>Products may be out of stock or no longer available.</p><a class="button-link" href="index.html">Continue Shopping</a></div>`;
    $("checkoutBtn").style.display = "none";
    $("cartSummary").innerHTML = "";
    return;
  }

  box.innerHTML = freshCart.map((item, index) => `
    <div class="card cart-row">
      <img class="cart-image" src="${esc(item.image_url || placeholder)}" alt="${esc(item.name)}" onerror="this.onerror=null;this.src='${placeholder}'">
      <div class="cart-product-info">
        <h3><a href="product.html?id=${item.product_id}">${esc(item.name)}</a></h3>
        <p>${money(item.price)} each</p>
        <p class="hint">Available stock: ${item.stock}</p>
      </div>
      <div class="qty">
        <button type="button" class="secondary" onclick="changeQty(${index},-1)">−</button>
        <strong>${item.quantity}</strong>
        <button type="button" class="secondary" ${item.quantity >= item.stock ? "disabled" : ""} onclick="changeQty(${index},1)">+</button>
        <button type="button" class="danger" onclick="removeCart(${index})">Remove</button>
      </div>
      <strong class="line-total">${money(item.price * item.quantity)}</strong>
    </div>`).join("");

  const total = freshCart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  const count = freshCart.reduce((sum, item) => sum + Number(item.quantity), 0);
  $("cartSummary").innerHTML = `<h3>${count} item(s)</h3><h2>Total: ${money(total)}</h2>`;
  $("checkoutBtn").style.display = "inline-block";
}

async function changeQty(index, delta) {
  const cart = getCart();
  const item = cart[index];
  if (!item) return;
  const newQuantity = Number(item.quantity) + delta;
  if (newQuantity <= 0) {
    cart.splice(index, 1);
    saveCart(cart);
    renderCart();
    return;
  }
  if (newQuantity > Number(item.stock || 0)) {
    // Refresh stock so stale carts don't over-order.
    try {
      const response = await fetch(`${API}/products/${item.product_id}`);
      const product = await getJson(response);
      if (response.ok) item.stock = Number(product.stock);
    } catch {}
    if (newQuantity > Number(item.stock || 0)) {
      alert(`Only ${item.stock || 0} unit(s) are available.`);
      renderCart();
      return;
    }
  }
  item.quantity = newQuantity;
  saveCart(cart);
  renderCart();
}

function removeCart(index) {
  const cart = getCart();
  if (!cart[index]) return;
  if (!confirm(`Remove ${cart[index].name} from the cart?`)) return;
  cart.splice(index, 1);
  saveCart(cart);
  renderCart();
}

async function placeOrder() {
  if (!token()) {
    location.href = "login.html?next=cart.html";
    return;
  }
  const cart = getCart();
  if (!cart.length) {
    $("message").textContent = "Cart is empty.";
    return;
  }

  const button = $("checkoutBtn");
  button.disabled = true;
  button.textContent = "Placing Order...";
  $("message").textContent = "";
  try {
    const response = await fetch(`${API}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ items: cart.map(item => ({ product_id: Number(item.product_id), quantity: Number(item.quantity) })) })
    });
    const data = await getJson(response);
    if (!response.ok) throw new Error(data.detail || "Order failed");
    localStorage.removeItem(cartKey);
    updateCartCount();
    $("message").innerHTML = `Order <strong>#${esc(data.id)}</strong> placed successfully. <a href="orders.html">View Orders</a>`;
    await renderCart();
  } catch (error) {
    $("message").textContent = error.message || "Unable to place order.";
    await renderCart();
  } finally {
    button.disabled = false;
    button.textContent = "Place Order";
  }
}

async function registerUser(event) {
  event.preventDefault();
  const response = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: $("email").value.trim(), password: $("password").value })
  });
  const data = await getJson(response);
  $("message").textContent = response.ok ? "Registration successful. You can login now." : (data.detail || "Registration failed");
}

async function loginUser(event) {
  event.preventDefault();
  const response = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: $("email").value.trim(), password: $("password").value })
  });
  const data = await getJson(response);
  if (response.ok) {
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));
    const next = new URLSearchParams(location.search).get("next") || "index.html";
    location.href = next;
  } else {
    $("message").textContent = data.detail || "Login failed";
  }
}

async function loadOrders() {
  if (!(await requireLogin())) return;
  updateCartCount();
  updateAuthLink();
  const box = $("orders");
  if (!box) return;
  if (!token()) {
    box.innerHTML = `<div class="card">Please <a href="login.html?next=orders.html">login</a> to see your orders.</div>`;
    return;
  }
  const response = await fetch(`${API}/orders`, { headers: authHeaders() });
  const data = await getJson(response);
  box.innerHTML = response.ok
    ? (data.length ? data.map(orderHtml).join("") : `<div class="card">No orders yet.</div>`)
    : `<div class="card">${esc(data.detail || "Unable to load orders")}</div>`;
}

function orderHtml(order) {
  const canCancel = ["PLACED", "PROCESSING"].includes(order.status);
  const itemsTotal = order.items.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0);
  return `<div class="card order">
    <div class="order-head">
      <div><h3>Order #${order.id}</h3><p class="hint">${new Date(order.created_at).toLocaleString()}</p></div>
      <span class="status status-${esc(order.status.toLowerCase())}">${esc(order.status)}</span>
    </div>
    <div class="order-items">${order.items.map(item => `
      <div class="order-item"><span>${esc(item.product_name)} × ${item.quantity}</span><strong>${money(Number(item.unit_price) * Number(item.quantity))}</strong></div>`).join("")}</div>
    <div class="order-total"><span>Order Total</span><strong>${money(order.total || itemsTotal)}</strong></div>
    <div class="order-actions">
      ${canCancel ? `<button type="button" class="danger" onclick="cancelOrder(${order.id})">Cancel Order</button>` : ""}
      ${order.status !== "CANCELLED" ? `<button type="button" class="secondary" onclick="reorder(${order.id})">Order Again</button>` : `<button type="button" class="secondary" onclick="reorder(${order.id})">Buy Again</button>`}
    </div>
  </div>`;
}

async function cancelOrder(id) {
  if (!confirm(`Cancel order #${id}? The purchased stock will be returned to inventory.`)) return;
  try {
    const response = await fetch(`${API}/orders/${id}/cancel`, { method: "POST", headers: authHeaders() });
    const data = await getJson(response);
    if (!response.ok) throw new Error(data.detail || "Unable to cancel order");
    showToast(`Order #${id} cancelled successfully.`);
    await loadOrders();
  } catch (error) {
    alert(error.message || "Unable to cancel order.");
  }
}

async function reorder(id) {
  if (!confirm(`Place the same items from order #${id} again? Current prices and stock will be used.`)) return;
  try {
    const response = await fetch(`${API}/orders/${id}/reorder`, { method: "POST", headers: authHeaders() });
    const data = await getJson(response);
    if (!response.ok) throw new Error(data.detail || "Unable to place the order again");
    showToast(`New order #${data.id} placed successfully.`);
    await loadOrders();
  } catch (error) {
    alert(error.message || "Unable to reorder.");
  }
}

async function initAdmin() {
  if (!(await requireLogin("admin"))) return;
  updateCartCount();
  updateAuthLink();
  await loadDashboard();
  await loadAdminUsers();
  await loadAdminProducts();
  await loadAdminOrders();
}

async function loadDashboard() {
  const response = await fetch(`${API}/admin/dashboard`, { headers: authHeaders() });
  const data = await getJson(response);
  $("dashboard").innerHTML = response.ok
    ? Object.entries(data).map(([key, value]) => `<div class="card stat"><h3>${esc(key.replaceAll("_", " "))}</h3><strong>${key === "total_sales" ? money(value) : esc(value)}</strong></div>`).join("")
    : `<div class="card">${esc(data.detail || "Admin access required")}</div>`;
}

async function createProduct(event) {
  event.preventDefault();
  const body = {
    name: $("name").value.trim(), category: $("category").value.trim(), description: $("description").value.trim(),
    price: Number($("price").value), stock: Number($("stock").value), image_url: $("image_url").value.trim()
  };
  const response = await fetch(`${API}/products`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(body) });
  const data = await getJson(response);
  $("message").textContent = response.ok ? `Product #${data.id} created.` : (data.detail || "Failed");
  if (response.ok) { event.target.reset(); loadAdminProducts(); loadDashboard(); }
}

async function loadAdminUsers() {
  const box = $("adminUsers");
  if (!box) return;
  const response = await fetch(`${API}/admin/users`, { headers: authHeaders() });
  const data = await getJson(response);
  box.innerHTML = response.ok
    ? (data.length ? data.map(user => `
      <div class="card">
        <span class="badge">${esc(user.role)}</span>
        <h3>${esc(user.email)}</h3>
        <p class="hint">User ID: ${user.id}</p>
        <p class="hint">Created: ${new Date(user.created_at).toLocaleString()}</p>
      </div>`).join("") : `<p>No users found.</p>`)
    : `<p>${esc(data.detail || "Unable to load users")}</p>`;
}

async function createCustomer(event) {
  event.preventDefault();
  const body = {
    email: $("userEmail").value.trim(),
    password: $("userPassword").value
  };
  const response = await fetch(`${API}/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body)
  });
  const data = await getJson(response);
  $("userMessage").textContent = response.ok
    ? `Customer ${data.email} created successfully.`
    : (data.detail || "Unable to create user");
  if (response.ok) {
    event.target.reset();
    await loadAdminUsers();
    await loadDashboard();
  }
}

async function loadAdminProducts() {
  const box = $("adminProducts");
  if (!box) return;
  const response = await fetch(`${API}/products?include_inactive=true`, { headers: authHeaders() });
  const data = await getJson(response);
  box.innerHTML = response.ok
    ? data.map(p => `<div class="card"><h3>${esc(p.name)}</h3><p>${money(p.price)} · Stock ${p.stock}</p><p>${p.is_active ? "Active" : "Hidden"}</p><div class="order-actions"><button onclick="editProduct(${p.id},${JSON.stringify(p.name)},${JSON.stringify(p.category)},${Number(p.price)},${p.stock})">Edit</button>${p.is_active ? `<button class="danger" onclick="hideProduct(${p.id})">Hide</button>` : ""}</div></div>`).join("")
    : `<p>${esc(data.detail || "Unable to load")}</p>`;
}

async function editProduct(id, name, category, price, stock) {
  const newName = prompt("Product name", name); if (newName === null) return;
  const newPrice = prompt("Price", price); if (newPrice === null) return;
  const newStock = prompt("Stock", stock); if (newStock === null) return;
  const response = await fetch(`${API}/products/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name: newName.trim(), category, price: Number(newPrice), stock: Number(newStock) })
  });
  const data = await getJson(response);
  if (!response.ok) alert(data.detail || "Update failed");
  else { await loadAdminProducts(); await loadDashboard(); }
}

async function hideProduct(id) {
  if (!confirm("Hide this product from customers?")) return;
  const response = await fetch(`${API}/products/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!response.ok) { const data = await getJson(response); alert(data.detail || "Failed"); }
  else { await loadAdminProducts(); await loadDashboard(); }
}

async function loadAdminOrders() {
  const box = $("adminOrders");
  if (!box) return;
  const response = await fetch(`${API}/admin/orders`, { headers: authHeaders() });
  const data = await getJson(response);
  box.innerHTML = response.ok
    ? (data.length ? data.map(o => `<div class="card order"><h3>Order #${o.id}</h3><p>Customer: ${esc(o.user_email)} · Total: ${money(o.total)}</p><p>Status: <span class="status">${esc(o.status)}</span></p><div class="order-actions">${["PLACED","PROCESSING","SHIPPED","DELIVERED","CANCELLED"].filter(s => s !== o.status).map(s => `<button class="secondary" onclick="setOrderStatus(${o.id},'${s}')">${s}</button>`).join("")}</div></div>`).join("") : `<p>No orders.</p>`)
    : `<p>${esc(data.detail || "Admin access required")}</p>`;
}

async function setOrderStatus(id, status) {
  const response = await fetch(`${API}/orders/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ status }) });
  const data = await getJson(response);
  if (!response.ok) alert(data.detail || "Status update failed");
  else { await loadAdminOrders(); await loadDashboard(); }
}

updateCartCount();
updateAuthLink();
