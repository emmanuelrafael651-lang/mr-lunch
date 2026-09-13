// =========================================================
// MR. LUNCH - POS
// app.js
// =========================================================

const API_URL = "/api";

// =========================================================
// ESTADO GLOBAL
// =========================================================

let products = [];
let categories = [];
let sales = [];
let cash = null;
let cashMovements = [];

let cart = [];
let currentCategory = "Todos";
let currentOrderType = "Llevar";
let currentPaymentMethod = "Efectivo";
let cashMovementType = "IN";

let salesChartInstance = null;


// =========================================================
// UTILIDADES
// =========================================================

const $ = (id) => document.getElementById(id);

function money(value) {
    return `$${Number(value || 0).toFixed(2)}`;
}

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

function formatDate(date) {
    if (!date) return "--/--/----";

    const d = new Date(date);

    if (Number.isNaN(d.getTime())) {
        return "--/--/----";
    }

    return d.toLocaleDateString("es-MX");
}

function formatDateTime(date) {
    if (!date) return "--/--/---- --:--";

    const d = new Date(date);

    if (Number.isNaN(d.getTime())) {
        return "--/--/---- --:--";
    }

    return d.toLocaleString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatTime(date) {
    if (!date) return "--:--";

    const d = new Date(date);

    if (Number.isNaN(d.getTime())) {
        return "--:--";
    }

    return d.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit"
    });
}


// =========================================================
// API
// =========================================================

async function apiFetch(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        });

        let data = null;

        try {
            data = await response.json();
        } catch {
            data = null;
        }

        if (!response.ok) {
            const message =
                data?.detail ||
                data?.message ||
                "Ocurrió un error en el servidor.";

            throw new Error(message);
        }

        return data;

    } catch (error) {
        console.error("API ERROR:", error);

        if (
            error instanceof TypeError ||
            error.message?.includes("Failed to fetch")
        ) {
            showToast(
                "No se pudo conectar con el backend. Verifica que FastAPI esté ejecutándose en el puerto 8000.",
                "error"
            );
        } else {
            showToast(
                error.message || "Ocurrió un error.",
                "error"
            );
        }

        throw error;
    }
}


// =========================================================
// TOASTS
// =========================================================

function showToast(message, type = "success") {
    let container = document.getElementById("toastContainer");

    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";

        container.style.position = "fixed";
        container.style.top = "80px";
        container.style.right = "20px";
        container.style.zIndex = "99999";
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.gap = "10px";

        document.body.appendChild(container);
    }

    const toast = document.createElement("div");

    toast.style.padding = "14px 18px";
    toast.style.borderRadius = "10px";
    toast.style.color = "#fff";
    toast.style.fontWeight = "600";
    toast.style.boxShadow = "0 8px 25px rgba(0,0,0,.2)";
    toast.style.maxWidth = "350px";

    toast.style.background =
        type === "error"
            ? "#dc3545"
            : type === "warning"
                ? "#f59e0b"
                : "#16a34a";

    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(20px)";
        toast.style.transition = "all .3s ease";

        setTimeout(() => toast.remove(), 300);
    }, 3000);
}


// =========================================================
// MODALES
// =========================================================

function openModal(id) {
    const modal = $(id);

    if (modal) {
        modal.classList.add("active");
    }
}

function closeModal(id) {
    const modal = $(id);

    if (modal) {
        modal.classList.remove("active");
    }
}

function closeAllModals() {
    document.querySelectorAll(".modal-overlay").forEach(modal => {
        modal.classList.remove("active");
    });
}


// =========================================================
// RELOJ
// =========================================================

function updateClock() {
    const clock = $("liveClock");

    if (!clock) return;

    clock.textContent = new Date().toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}


// =========================================================
// NAVEGACIÓN
// =========================================================

function initNavigation() {
    document.querySelectorAll(".nav-item").forEach(item => {

        item.addEventListener("click", () => {

            const target = item.dataset.target;

            document.querySelectorAll(".nav-item")
                .forEach(nav => nav.classList.remove("active"));

            document.querySelectorAll(".view-page")
                .forEach(view => view.classList.remove("active"));

            item.classList.add("active");

            const page = $(target);

            if (page) {
                page.classList.add("active");
            }
        });
    });
}


// =========================================================
// BIENVENIDA
// =========================================================

function initWelcome() {
    const button = $("btnEnterSystem");

    if (!button) return;

    button.addEventListener("click", async () => {

        const overlay = $("welcomeOverlay");

        if (overlay) {
            overlay.style.display = "none";
        }

        await loadEverything();

        if (!cash || !cash.is_open) {
            setTimeout(() => {
                openModal("modalOpenCash");
            }, 300);
        }
    });
}


// =========================================================
// CATEGORÍAS
// =========================================================

async function loadCategories() {
    try {
        const response = await apiFetch("/categories");

        categories = Array.isArray(response)
            ? response
            : response?.categories || [];

        renderCategories();
        populateProductCategorySelect();
        renderCategoryManagement();

    } catch (error) {
        console.error("Error cargando categorías:", error);
    }
}

function renderCategories() {
    const container = $("posCategories");

    if (!container) return;

    container.innerHTML = "";

    const allButton = document.createElement("button");

    allButton.type = "button";
    allButton.className =
        `category-btn ${currentCategory === "Todos" ? "active" : ""}`;

    allButton.textContent = "Todos";

    allButton.addEventListener("click", () => {
        currentCategory = "Todos";

        renderCategories();
        renderPOSProducts();
    });

    container.appendChild(allButton);

    categories.forEach(category => {

        const button = document.createElement("button");

        button.type = "button";

        button.className =
            `category-btn ${
                currentCategory === category.id ? "active" : ""
            }`;

        button.textContent = category.name;

        button.addEventListener("click", () => {

            currentCategory = category.id;

            renderCategories();
            renderPOSProducts();
        });

        container.appendChild(button);
    });
}

function populateProductCategorySelect() {
    const select = $("newProdCategory");

    if (!select) return;

    select.innerHTML = "";

    categories.forEach(category => {

        const option = document.createElement("option");

        option.value = category.id;
        option.textContent = category.name;

        select.appendChild(option);
    });
}

function renderCategoryManagement() {
    const container = $("categoryListContainer");

    if (!container) return;

    container.innerHTML = "";

    categories.forEach(category => {

        const row = document.createElement("div");

        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.style.alignItems = "center";
        row.style.padding = "8px 10px";
        row.style.borderRadius = "8px";
        row.style.background = "var(--panel-card)";
        row.style.color = "var(--text-dark)";
        row.style.border = "1px solid var(--border-color)";

        row.innerHTML = `
            <span>${escapeHTML(category.name)}</span>

            <button
                type="button"
                class="btn btn-danger btn-sm"
                data-category-id="${category.id}"
            >
                <i class="fa-solid fa-trash"></i>
            </button>
        `;

        const deleteButton = row.querySelector("button");

        deleteButton.addEventListener("click", async () => {

            const confirmed = confirm(
                `¿Eliminar la categoría "${category.name}"?`
            );

            if (!confirmed) return;

            try {

                await apiFetch(`/categories/${category.id}`, {
                    method: "DELETE"
                });

                showToast("Categoría eliminada.");

                if (currentCategory === category.id) {
                    currentCategory = "Todos";
                }

                await loadCategories();
                await loadProducts();

            } catch (error) {
                console.error(error);
            }
        });

        container.appendChild(row);
    });
}

async function addCategory() {
    const input = $("newCatName");

    if (!input) return;

    const name = input.value.trim();

    if (!name) {
        showToast(
            "Escribe un nombre para la categoría.",
            "warning"
        );

        return;
    }

    try {

        await apiFetch("/categories", {
            method: "POST",
            body: JSON.stringify({
                name
            })
        });

        input.value = "";

        showToast("Categoría creada correctamente.");

        await loadCategories();

    } catch (error) {
        console.error(error);
    }
}


// =========================================================
// PRODUCTOS
// =========================================================

async function loadProducts() {
    try {

        const response = await apiFetch("/products");

        products = Array.isArray(response)
            ? response
            : response?.products || [];

        renderPOSProducts();
        renderAdminProducts();

    } catch (error) {
        console.error("Error cargando productos:", error);
    }
}

function getProductCategoryName(product) {

    const category = categories.find(
        c => c.id === product.category_id
    );

    return category?.name ||
        product.category ||
        "Sin categoría";
}

function createProductCard(product, admin = false) {

    const card = document.createElement("article");

    card.className = "product-card";

    const image =
        product.image ||
        "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=80";

    card.innerHTML = `
        <div class="product-image">
            <img
                src="${escapeHTML(image)}"
                alt="${escapeHTML(product.name)}"
                loading="lazy"
                onerror="this.src='https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=80'"
            >
        </div>

        <div class="product-info">
            <h4>${escapeHTML(product.name)}</h4>

            <span class="product-category">
                ${escapeHTML(getProductCategoryName(product))}
            </span>

            <strong class="product-price">
                ${money(product.price)}
            </strong>
        </div>
    `;

    if (admin) {

        const deleteButton = document.createElement("button");

        deleteButton.type = "button";
        deleteButton.className = "btn btn-danger btn-sm";

        deleteButton.innerHTML =
            '<i class="fa-solid fa-trash"></i> Eliminar';

        deleteButton.addEventListener("click", async event => {

            event.stopPropagation();

            const confirmed = confirm(
                `¿Eliminar "${product.name}"?`
            );

            if (!confirmed) return;

            try {

                await apiFetch(`/products/${product.id}`, {
                    method: "DELETE"
                });

                showToast("Producto eliminado.");

                await loadProducts();

            } catch (error) {
                console.error(error);
            }
        });

        card.appendChild(deleteButton);

    } else {

        card.addEventListener("click", () => {
            addToCart(product);
        });
    }

    return card;
}

function renderPOSProducts() {

    const grid = $("posProductsGrid");

    if (!grid) return;

    grid.innerHTML = "";

    let filteredProducts = products.filter(
        product => product.active !== false
    );

    if (currentCategory !== "Todos") {

        filteredProducts = filteredProducts.filter(
            product => product.category_id === currentCategory
        );
    }

    if (!filteredProducts.length) {

        grid.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-box-open"></i>
                <p>No hay productos en esta categoría.</p>
            </div>
        `;

        return;
    }

    filteredProducts.forEach(product => {
        grid.appendChild(
            createProductCard(product)
        );
    });
}

function renderAdminProducts() {

    const grid = $("adminProductsGrid");

    if (!grid) return;

    grid.innerHTML = "";

    if (!products.length) {

        grid.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-box-open"></i>
                <p>No hay productos registrados.</p>
            </div>
        `;

        return;
    }

    products.forEach(product => {
        grid.appendChild(
            createProductCard(product, true)
        );
    });
}

async function saveProduct() {

    const name =
        $("newProdName")?.value.trim();

    const price =
        Number($("newProdPrice")?.value);

    const categoryId =
        Number($("newProdCategory")?.value);

    const image =
        $("newProdImg")?.value.trim() || null;

    if (!name) {
        showToast(
            "Escribe el nombre del producto.",
            "warning"
        );

        return;
    }

    if (!Number.isFinite(price) || price < 0) {
        showToast(
            "Ingresa un precio válido.",
            "warning"
        );

        return;
    }

    if (!categoryId) {
        showToast(
            "Selecciona una categoría.",
            "warning"
        );

        return;
    }

    try {

        await apiFetch("/products", {
            method: "POST",
            body: JSON.stringify({
                name,
                price,
                image,
                category_id: categoryId
            })
        });

        $("newProdName").value = "";
        $("newProdPrice").value = "";
        $("newProdImg").value = "";

        closeModal("modalAddProduct");

        showToast(
            "Producto creado correctamente."
        );

        await loadProducts();

    } catch (error) {
        console.error(error);
    }
}


// =========================================================
// CARRITO
// =========================================================

function addToCart(product) {

    if (!cash?.is_open) {

        showToast(
            "Primero debes abrir la caja para registrar ventas.",
            "warning"
        );

        openModal("modalOpenCash");

        return;
    }

    const existing = cart.find(
        item => item.product_id === product.id
    );

    if (existing) {

        existing.quantity += 1;

    } else {

        cart.push({
            product_id: product.id,
            product_name: product.name,
            price: Number(product.price),
            quantity: 1,
            subtotal: Number(product.price)
        });
    }

    updateCart();
}

function updateCart() {

    cart.forEach(item => {

        item.subtotal =
            item.quantity * item.price;
    });

    renderCart();
}

function renderCart() {

    const container = $("cartItemsList");

    if (!container) return;

    container.innerHTML = "";

    if (!cart.length) {

        container.innerHTML = `
            <div class="empty-cart">
                <i class="fa-solid fa-cart-shopping"></i>
                <p>El carrito está vacío</p>
                <small>Selecciona productos del menú.</small>
            </div>
        `;

    } else {

        cart.forEach((item, index) => {

            const row = document.createElement("div");

            row.className = "cart-item";

            row.innerHTML = `
                <div class="cart-item-info">
                    <strong>
                        ${escapeHTML(item.product_name)}
                    </strong>

                    <span>
                        ${money(item.price)} c/u
                    </span>
                </div>

                <div class="cart-item-actions">

                    <button
                        type="button"
                        class="quantity-btn"
                        data-action="minus"
                    >
                        −
                    </button>

                    <span class="quantity">
                        ${item.quantity}
                    </span>

                    <button
                        type="button"
                        class="quantity-btn"
                        data-action="plus"
                    >
                        +
                    </button>

                    <strong class="cart-item-total">
                        ${money(item.subtotal)}
                    </strong>

                    <button
                        type="button"
                        class="cart-delete"
                        data-action="delete"
                    >
                        <i class="fa-solid fa-trash"></i>
                    </button>

                </div>
            `;

            row.querySelector('[data-action="minus"]')
                .addEventListener("click", () => {

                    if (item.quantity > 1) {
                        item.quantity--;
                    } else {
                        cart.splice(index, 1);
                    }

                    updateCart();
                });

            row.querySelector('[data-action="plus"]')
                .addEventListener("click", () => {

                    item.quantity++;

                    updateCart();
                });

            row.querySelector('[data-action="delete"]')
                .addEventListener("click", () => {

                    cart.splice(index, 1);

                    updateCart();
                });

            container.appendChild(row);
        });
    }

    const subtotal = getCartTotal();

    if ($("cartSubtotal")) {
        $("cartSubtotal").textContent =
            money(subtotal);
    }

    if ($("cartTotal")) {
        $("cartTotal").textContent =
            money(subtotal);
    }

    updateOrderHeader();
}

function getCartTotal() {

    return cart.reduce(
        (total, item) =>
            total + item.quantity * item.price,
        0
    );
}

function clearCart() {

    if (!cart.length) return;

    const confirmed = confirm(
        "¿Quieres vaciar el pedido actual?"
    );

    if (!confirmed) return;

    cart = [];

    updateCart();
}

function updateOrderHeader() {

    const title = $("cartOrderTitle");
    const date = $("cartDate");

    if (title) {

        const next =
            sales.length + 1001;

        title.textContent =
            `Pedido #${next}`;
    }

    if (date) {

        date.textContent =
            formatDate(new Date());
    }
}


// =========================================================
// TIPO DE ORDEN
// =========================================================

function initOrderType() {

    document.querySelectorAll(".btn-order-type")
        .forEach(button => {

            button.addEventListener("click", () => {

                document.querySelectorAll(".btn-order-type")
                    .forEach(btn =>
                        btn.classList.remove("active")
                    );

                button.classList.add("active");

                currentOrderType =
                    button.dataset.type;

                const tableGroup =
                    $("tableSelectorGroup");

                if (tableGroup) {

                    tableGroup.style.display =
                        currentOrderType === "Mesa"
                            ? "block"
                            : "none";
                }
            });
        });
}


// =========================================================
// CHECKOUT
// =========================================================

function openCheckout() {

    if (!cart.length) {

        showToast(
            "Agrega al menos un producto al pedido.",
            "warning"
        );

        return;
    }

    if (!cash?.is_open) {

        showToast(
            "La caja está cerrada.",
            "warning"
        );

        openModal("modalOpenCash");

        return;
    }

    currentPaymentMethod = "Efectivo";

    document.querySelectorAll(".btn-pay-method")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.method === "Efectivo"
            );
        });

    const total = getCartTotal();

    if ($("modalCheckoutTotal")) {

        $("modalCheckoutTotal").textContent =
            money(total);
    }

    if ($("inputPaidAmount")) {
        $("inputPaidAmount").value = "";
    }

    updatePaymentUI();

    openModal("modalCheckout");
}

function updatePaymentUI() {

    const group = $("cashPaymentGroup");

    if (!group) return;

    group.style.display = "block";

    const label =
        group.querySelector("label");

    if (label) {

        label.textContent =
            currentPaymentMethod === "Efectivo"
                ? "Efectivo Recibido"
                : "Monto recibido";
    }

    const input =
        $("inputPaidAmount");

    if (!input) return;

    if (currentPaymentMethod !== "Efectivo") {

        input.value =
            getCartTotal().toFixed(2);
    }

    updateChange();
}

function updateChange() {

    const total =
        getCartTotal();

    const paid =
        Number($("inputPaidAmount")?.value || 0);

    const change =
        paid - total;

    if ($("textChangeDue")) {

        $("textChangeDue").textContent =
            money(Math.max(change, 0));
    }
}

function addNumpadValue(value) {

    const input =
        $("inputPaidAmount");

    if (!input) return;

    if (value === "DEL") {

        input.value =
            input.value.slice(0, -1);

    } else if (value === ".") {

        if (!input.value.includes(".")) {
            input.value += ".";
        }

    } else {

        input.value += value;
    }

    updateChange();
}

function setQuickCash(value) {

    const input =
        $("inputPaidAmount");

    if (!input) return;

    input.value =
        Number(value).toFixed(2);

    updateChange();
}

function setExactCash() {
    setQuickCash(getCartTotal());
}


// =========================================================
// CONFIRMAR VENTA
// =========================================================

async function confirmPayment() {

    if (!cart.length) {

        showToast(
            "El carrito está vacío.",
            "warning"
        );

        return;
    }

    const total =
        getCartTotal();

    let paid = total;

    if (currentPaymentMethod === "Efectivo") {

        paid =
            Number($("inputPaidAmount")?.value || 0);

        if (paid < total) {

            showToast(
                `Faltan ${money(total - paid)} para completar el pago.`,
                "warning"
            );

            return;
        }
    }

    const table =
        currentOrderType === "Mesa"
            ? $("selectMesa")?.value || null
            : null;

    const salePayload = {

        order_type:
            currentOrderType,

        table,

        payment_method:
            currentPaymentMethod,

        total:
            Number(total.toFixed(2)),

        details:
            cart.map(item => ({

                product_id:
                    item.product_id,

                product_name:
                    item.product_name,

                quantity:
                    item.quantity,

                price:
                    Number(item.price.toFixed(2)),

                subtotal:
                    Number(
                        (item.quantity * item.price)
                            .toFixed(2)
                    )
            }))
    };

    try {

        const response =
            await apiFetch("/sales", {
                method: "POST",
                body: JSON.stringify(salePayload)
            });

        const sale =
            response?.sale || response;

        if (!sale) {
            throw new Error(
                "El backend no devolvió la venta creada."
            );
        }

        const change =
            currentPaymentMethod === "Efectivo"
                ? paid - total
                : 0;

        closeModal("modalCheckout");

        showReceipt(
            sale,
            paid,
            change
        );

        cart = [];

        updateCart();

        await loadSales();
        await loadCash();

    } catch (error) {

        console.error(
            "Error confirmando venta:",
            error
        );
    }
}


// =========================================================
// RECIBO
// =========================================================

function playSaleSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();

        const notes = [880, 1318.5]; // A5 -> E6, un "cha-ching" corto

        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.value = freq;

            const start = ctx.currentTime + i * 0.09;

            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(start);
            osc.stop(start + 0.3);
        });
    } catch (error) {
        console.warn("No se pudo reproducir el sonido de venta:", error);
    }
}

function showReceipt(sale, paid, change) {

    playSaleSound();

    if ($("receiptTicketId")) {

        $("receiptTicketId").textContent =
            sale.ticket || "Ticket";
    }

    const body =
        $("ticketDetailsBody");

    if (!body) return;

    const saleDetails =
        sale.details ||
        [];

    body.innerHTML = `
        <div style="text-align:left">

            <div style="
                display:flex;
                justify-content:space-between
            ">
                <span>Ticket</span>

                <strong>
                    ${escapeHTML(sale.ticket || "Ticket")}
                </strong>
            </div>

            <div style="
                display:flex;
                justify-content:space-between
            ">
                <span>Fecha</span>

                <strong>
                    ${formatDateTime(sale.date)}
                </strong>
            </div>

            <hr>

            ${
                saleDetails.length
                    ? saleDetails.map(item => `
                        <div style="
                            display:flex;
                            justify-content:space-between;
                            gap:10px;
                            margin:8px 0;
                        ">
                            <span>
                                ${item.quantity} ×
                                ${escapeHTML(item.product_name)}
                            </span>

                            <strong>
                                ${money(item.subtotal)}
                            </strong>
                        </div>
                    `).join("")
                    : `
                        <p>
                            Detalle de venta no disponible.
                        </p>
                    `
            }

            <hr>

            <div style="
                display:flex;
                justify-content:space-between
            ">
                <span>Total</span>

                <strong>
                    ${money(sale.total)}
                </strong>
            </div>

            <div style="
                display:flex;
                justify-content:space-between
            ">
                <span>Método</span>

                <strong>
                    ${escapeHTML(
                        sale.payment_method ||
                        currentPaymentMethod
                    )}
                </strong>
            </div>

            ${
                sale.payment_method === "Efectivo"
                    ? `
                        <div style="
                            display:flex;
                            justify-content:space-between
                        ">
                            <span>Recibido</span>

                            <strong>
                                ${money(paid)}
                            </strong>
                        </div>

                        <div style="
                            display:flex;
                            justify-content:space-between
                        ">
                            <span>Cambio</span>

                            <strong>
                                ${money(change)}
                            </strong>
                        </div>
                    `
                    : ""
            }

        </div>
    `;

    openModal("modalReceipt");
}


// =========================================================
// VENTAS
// =========================================================

async function loadSales() {

    try {

        const response =
            await apiFetch("/sales");

        sales = Array.isArray(response)
            ? response
            : response?.sales || [];

        renderSalesTable();
        renderDashboard();

    } catch (error) {

        console.error(
            "Error cargando ventas:",
            error
        );
    }
}

function renderSalesTable() {

    const tbody =
        $("salesTableBody");

    if (!tbody) return;

    tbody.innerHTML = "";

    if (!sales.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center">
                    No hay ventas registradas.
                </td>
            </tr>
        `;

        return;
    }

    [...sales]
        .reverse()
        .forEach(sale => {

            const row =
                document.createElement("tr");

            const typeText =
                sale.order_type === "Mesa"
                    ? `${sale.order_type} / ${sale.table || "-"}`
                    : sale.order_type;

            row.innerHTML = `
                <td>
                    <strong>
                        ${escapeHTML(sale.ticket)}
                    </strong>
                </td>

                <td>
                    ${formatDateTime(sale.date)}
                </td>

                <td>
                    ${escapeHTML(typeText)}
                </td>

                <td>
                    Cajero Principal
                </td>

                <td>
                    ${escapeHTML(sale.payment_method)}
                </td>

                <td>
                    <strong>
                        ${money(sale.total)}
                    </strong>
                </td>
            `;

            tbody.appendChild(row);
        });
}


// =========================================================
// DASHBOARD
// =========================================================

function renderDashboard() {

    const totalSales =
        sales.reduce(
            (sum, sale) =>
                sum + Number(sale.total || 0),
            0
        );

    const orderCount =
        sales.length;

    const average =
        orderCount > 0
            ? totalSales / orderCount
            : 0;

    const cashTotal =
        getExpectedCash();

    if ($("dashSalesTotal")) {

        $("dashSalesTotal").textContent =
            money(totalSales);
    }

    if ($("dashOrderCount")) {

        $("dashOrderCount").textContent =
            orderCount;
    }

    if ($("dashCashTotal")) {

        $("dashCashTotal").textContent =
            money(cashTotal);
    }

    if ($("dashAvgTicket")) {

        $("dashAvgTicket").textContent =
            money(average);
    }

    renderRecentSales();
    renderSalesChart();
}

function renderRecentSales() {

    const container =
        $("dashRecentSalesList");

    if (!container) return;

    container.innerHTML = "";

    const recent =
        [...sales]
            .reverse()
            .slice(0, 5);

    if (!recent.length) {

        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-receipt"></i>
                <p>No hay ventas todavía.</p>
            </div>
        `;

        return;
    }

    recent.forEach(sale => {

        const row =
            document.createElement("div");

        row.className =
            "recent-sale-item";

        row.innerHTML = `
            <div>

                <strong>
                    ${escapeHTML(sale.ticket)}
                </strong>

                <small>
                    ${formatTime(sale.date)}
                    ·
                    ${escapeHTML(sale.payment_method)}
                </small>

            </div>

            <strong>
                ${money(sale.total)}
            </strong>
        `;

        container.appendChild(row);
    });
}


// =========================================================
// CAJA
// =========================================================

async function loadCash() {

    try {

        const response =
            await apiFetch("/cash");

        cash =
            response?.cash || response;

        updateCashUI();

        await loadCashMovements();

        renderDashboard();

    } catch (error) {

        console.error(
            "Error cargando caja:",
            error
        );
    }
}

function getExpectedCash() {

    if (!cash) return 0;

    return (
        Number(cash.initial_fund || 0) +
        Number(cash.cash_sales || 0) +
        Number(cash.cash_in || 0) -
        Number(cash.cash_out || 0)
    );
}

function updateCashUI() {

    const isOpen =
        Boolean(cash?.is_open);

    const topBadge =
        $("topbarCashBadge");

    const topText =
        $("topbarCashText");

    if (topBadge) {

        topBadge.classList.toggle(
            "badge-open",
            isOpen
        );

        topBadge.classList.toggle(
            "badge-closed",
            !isOpen
        );
    }

    if (topText) {

        topText.textContent =
            isOpen
                ? "CAJA ABIERTA"
                : "CAJA CERRADA";
    }

    const pageBadge =
        $("cashPageBadge");

    if (pageBadge) {

        pageBadge.textContent =
            isOpen
                ? "🟢 CAJA ABIERTA"
                : "🔴 CAJA CERRADA";
    }

    if ($("cashInitVal")) {

        $("cashInitVal").textContent =
            money(cash?.initial_fund);
    }

    if ($("cashSalesVal")) {

        $("cashSalesVal").textContent =
            money(cash?.cash_sales);
    }

    if ($("cashInVal")) {

        $("cashInVal").textContent =
            `+${money(cash?.cash_in)}`;
    }

    if ($("cashOutVal")) {

        $("cashOutVal").textContent =
            `-${money(cash?.cash_out)}`;
    }

    if ($("cashExpectedVal")) {

        $("cashExpectedVal").textContent =
            money(getExpectedCash());
    }

    const openButton =
        $("btnInCash");

    const outButton =
        $("btnOutCash");

    const closeButton =
        $("btnCloseDay");

    if (openButton) {
        openButton.disabled = !isOpen;
    }

    if (outButton) {
        outButton.disabled = !isOpen;
    }

    if (closeButton) {
        closeButton.disabled = !isOpen;
    }

    updateAudit();
}

async function openCash() {

    const amount =
        Number($("inputInitCash")?.value || 0);

    if (!Number.isFinite(amount) || amount < 0) {

        showToast(
            "Ingresa un fondo inicial válido.",
            "warning"
        );

        return;
    }

    try {

        const response =
            await apiFetch("/cash/open", {
                method: "POST",
                body: JSON.stringify({
                    initial_fund: amount
                })
            });

        cash =
            response?.cash || response;

        if ($("inputInitCash")) {
            $("inputInitCash").value = "";
        }

        closeModal("modalOpenCash");

        showToast(
            "Caja abierta correctamente."
        );

        await loadSales();
        updateCashUI();
        renderDashboard();

    } catch (error) {

        console.error(error);
    }
}

function openCashMovement(type) {

    if (!cash?.is_open) {

        showToast(
            "La caja está cerrada.",
            "warning"
        );

        openModal("modalOpenCash");

        return;
    }

    cashMovementType =
        type;

    const title =
        $("cashMovTitle");

    if (title) {

        title.textContent =
            type === "IN"
                ? "Entrada de Dinero"
                : "Salida de Dinero";
    }

    if ($("inputMovAmount")) {
        $("inputMovAmount").value = "";
    }

    if ($("inputMovConcept")) {
        $("inputMovConcept").value = "";
    }

    openModal("modalCashMovement");
}

async function saveCashMovement() {

    const amount =
        Number($("inputMovAmount")?.value || 0);

    const concept =
        $("inputMovConcept")?.value.trim();

    if (!Number.isFinite(amount) || amount <= 0) {

        showToast(
            "Ingresa un monto válido.",
            "warning"
        );

        return;
    }

    if (!concept) {

        showToast(
            "Escribe el concepto del movimiento.",
            "warning"
        );

        return;
    }

    try {

        await apiFetch("/cash/movement", {
            method: "POST",
            body: JSON.stringify({
                type: cashMovementType,
                amount,
                concept
            })
        });

        closeModal("modalCashMovement");

        showToast(
            cashMovementType === "IN"
                ? "Entrada registrada."
                : "Salida registrada."
        );

        await loadCash();

    } catch (error) {

        console.error(error);
    }
}

async function loadCashMovements() {

    try {

        const response =
            await apiFetch("/cash/movements");

        cashMovements =
            Array.isArray(response)
                ? response
                : response?.movements || [];

        renderCashMovements();

    } catch (error) {

        console.error(
            "Error cargando movimientos:",
            error
        );
    }
}

function renderCashMovements() {

    const tbody =
        $("cashMovementsTable");

    if (!tbody) return;

    tbody.innerHTML = "";

    if (!cashMovements.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center">
                    No hay movimientos registrados.
                </td>
            </tr>
        `;

        return;
    }

    cashMovements.forEach(movement => {

        const row =
            document.createElement("tr");

        const isIn =
            movement.type === "IN";

        row.innerHTML = `
            <td>
                ${formatTime(movement.date)}
            </td>

            <td>
                <span class="${isIn ? "text-green" : "text-red"}">
                    ${isIn ? "Entrada" : "Salida"}
                </span>
            </td>

            <td>
                <strong>
                    ${isIn ? "+" : "-"}${money(movement.amount)}
                </strong>
            </td>

            <td>
                ${escapeHTML(movement.concept)}
            </td>
        `;

        tbody.appendChild(row);
    });
}


// =========================================================
// CUADRE DE CAJA
// =========================================================

function updateAudit() {

    const input =
        $("inputCountedCash");

    const diffText =
        $("auditDiffText");

    const badge =
        $("auditBadge");

    if (!input || !diffText || !badge) {
        return;
    }

    const counted =
        Number(input.value || 0);

    const expected =
        getExpectedCash();

    const difference =
        counted - expected;

    diffText.textContent =
        money(difference);

    if (Math.abs(difference) < 0.01) {

        badge.textContent =
            "🟢 CAJA CUADRADA";

    } else if (difference > 0) {

        badge.textContent =
            "🔵 SOBRANTE";

    } else {

        badge.textContent =
            "🔴 FALTANTE";
    }
}

async function closeDay() {

    if (!cash?.is_open) {

        showToast(
            "La caja ya está cerrada.",
            "warning"
        );

        return;
    }

    const counted =
        Number(
            $("inputCountedCash")?.value || 0
        );

    if (!Number.isFinite(counted) || counted < 0) {

        showToast(
            "Ingresa el efectivo contado.",
            "warning"
        );

        return;
    }

    const expected =
        getExpectedCash();

    const difference =
        counted - expected;

    const message =
        `Efectivo esperado: ${money(expected)}\n` +
        `Efectivo contado: ${money(counted)}\n` +
        `Diferencia: ${money(difference)}\n\n` +
        `¿Cerrar la caja?`;

    if (!confirm(message)) {
        return;
    }

    try {

        await apiFetch("/cash/close", {
            method: "POST"
        });

        showToast(
            "Caja cerrada correctamente."
        );

        await loadCash();
        await loadSales();

        if ($("inputCountedCash")) {
            $("inputCountedCash").value = "";
        }

    } catch (error) {

        console.error(error);
    }
}


// =========================================================
// GRÁFICA: VENTAS DEL TURNO
// =========================================================

function renderSalesChart() {

    const canvas =
        $("salesChart");

    if (
        !canvas ||
        typeof Chart === "undefined"
    ) {
        return;
    }

    if (salesChartInstance) {
        salesChartInstance.destroy();
        salesChartInstance = null;
    }

    if (!sales.length) {

        salesChartInstance =
            new Chart(canvas, {

                type: "line",

                data: {
                    labels: ["Sin ventas todavía"],
                    datasets: [
                        {
                            label: "Ventas ($)",
                            data: [0],
                            borderColor: "#f97316",
                            backgroundColor: "rgba(249, 115, 22, 0.15)",
                            fill: true,
                            tension: 0.3
                        }
                    ]
                },

                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });

        return;
    }

    // Orden cronológico y suma acumulada de ventas del turno
    const ordered =
        [...sales].sort(
            (a, b) => new Date(a.date) - new Date(b.date)
        );

    let running = 0;

    const labels = ordered.map(sale =>
        new Date(sale.date).toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit"
        })
    );

    const data = ordered.map(sale => {
        running += Number(sale.total || 0);
        return running;
    });

    salesChartInstance =
        new Chart(canvas, {

            type: "line",

            data: {
                labels,
                datasets: [
                    {
                        label: "Ventas acumuladas ($)",
                        data,
                        borderColor: "#f97316",
                        backgroundColor: "rgba(249, 115, 22, 0.15)",
                        fill: true,
                        tension: 0.3,
                        pointRadius: 3
                    }
                ]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: { display: false },

                    tooltip: {
                        callbacks: {
                            label: (context) => money(context.raw)
                        }
                    }
                },

                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => money(value)
                        }
                    }
                }
            }
        });
}




// =========================================================
// EVENTOS
// =========================================================
// EVITAR REFRESCO / SUBMIT ACCIDENTAL
// =========================================================

function preventFormRefresh() {

    // Evita cualquier submit real de formularios
    document.addEventListener("submit", event => {

        event.preventDefault();
        event.stopPropagation();

        console.warn(
            "SUBMIT BLOQUEADO: se evitó la recarga de la página."
        );

        return false;
    }, true);


    // Evita Enter dentro de inputs/selects
    document.addEventListener("keydown", event => {

        if (event.key !== "Enter") {
            return;
        }

        const target = event.target;

        if (!target) {
            return;
        }

        if (
            target.tagName === "INPUT" ||
            target.tagName === "SELECT" ||
            target.tagName === "TEXTAREA"
        ) {

            // Excepción: permitir Enter para agregar categoría
            if (target.id === "newCatName") {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            console.warn(
                "ENTER BLOQUEADO: se evitó un submit accidental."
            );
        }
    }, true);


    // IMPORTANTE:
    // Todos los botones que NO sean explícitamente submit
    // serán tratados como type="button".
    document.querySelectorAll("button").forEach(button => {

        if (!button.hasAttribute("type")) {
            button.setAttribute("type", "button");
        }
    });
}
function initEvents() {

    // =====================================================
    // PRODUCTOS
    // =====================================================

    $("btnOpenNewProductModal")
        ?.addEventListener(
            "click",
            () => {

                populateProductCategorySelect();

                if (!categories.length) {

                    showToast(
                        "Primero crea una categoría.",
                        "warning"
                    );

                    return;
                }

                openModal(
                    "modalAddProduct"
                );
            }
        );

    $("btnSaveProduct")
        ?.addEventListener(
            "click",
            saveProduct
        );


    // =====================================================
    // CATEGORÍAS
    // =====================================================

    $("btnOpenCategoryModal")
        ?.addEventListener(
            "click",
            () => {

                renderCategoryManagement();

                openModal(
                    "modalManageCategories"
                );
            }
        );

    $("btnAddCategory")
        ?.addEventListener(
            "click",
            addCategory
        );

    $("newCatName")
        ?.addEventListener(
            "keydown",
            event => {

                if (event.key === "Enter") {
                    addCategory();
                }
            }
        );


    // =====================================================
    // CARRITO
    // =====================================================

    $("btnClearCart")
        ?.addEventListener(
            "click",
            clearCart
        );

    $("btnOpenCheckout")
        ?.addEventListener(
            "click",
            openCheckout
        );


    // =====================================================
    // CAJA
    // =====================================================

    $("btnInCash")
        ?.addEventListener(
            "click",
            () => openCashMovement("IN")
        );

    $("btnOutCash")
        ?.addEventListener(
            "click",
            () => openCashMovement("OUT")
        );

    $("btnCloseDay")
        ?.addEventListener(
            "click",
            closeDay
        );

    $("btnConfirmOpenCash")
        ?.addEventListener(
            "click",
            openCash
        );

    $("inputCountedCash")
        ?.addEventListener(
            "input",
            updateAudit
        );


    // =====================================================
    // MOVIMIENTO DE CAJA
    // =====================================================

    $("btnSaveCashMovement")
        ?.addEventListener(
            "click",
            saveCashMovement
        );


    // =====================================================
    // MÉTODOS DE PAGO
    // =====================================================

    document.querySelectorAll(".btn-pay-method")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(".btn-pay-method")
                        .forEach(btn =>
                            btn.classList.remove("active")
                        );

                    button.classList.add("active");

                    currentPaymentMethod =
                        button.dataset.method;

                    updatePaymentUI();
                }
            );
        });


    // =====================================================
    // NUMPAD
    // =====================================================

    document.querySelectorAll(".btn-numpad")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    addNumpadValue(
                        button.dataset.val
                    );
                }
            );
        });


    // =====================================================
    // EFECTIVO RÁPIDO
    // =====================================================

    document.querySelectorAll(".btn-quick-cash")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    if (
                        button.dataset.exact ===
                        "true"
                    ) {

                        setExactCash();

                        return;
                    }

                    setQuickCash(
                        Number(
                            button.dataset.cash
                        )
                    );
                }
            );
        });


    // =====================================================
    // INPUT EFECTIVO
    // =====================================================

    $("inputPaidAmount")
        ?.addEventListener(
            "input",
            updateChange
        );


    // =====================================================
    // CONFIRMAR PAGO
    // =====================================================

    $("btnConfirmPayment")
        ?.addEventListener(
            "click",
            confirmPayment
        );


    // =====================================================
    // FINALIZAR RECIBO
    // =====================================================

    $("btnFinishReceipt")
        ?.addEventListener(
            "click",
            () => {

                closeModal(
                    "modalReceipt"
                );

                currentOrderType =
                    "Llevar";

                document
                    .querySelectorAll(
                        ".btn-order-type"
                    )
                    .forEach(btn => {

                        btn.classList.toggle(
                            "active",
                            btn.dataset.type ===
                            "Llevar"
                        );
                    });

                if ($("tableSelectorGroup")) {

                    $("tableSelectorGroup")
                        .style.display =
                        "none";
                }

                updateCart();
            }
        );


    // =====================================================
    // CERRAR MODALES
    // =====================================================

    document
        .querySelectorAll(".close-modal")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const modal =
                        button.closest(
                            ".modal-overlay"
                        );

                    if (modal) {
                        modal.classList.remove(
                            "active"
                        );
                    }
                }
            );
        });


    // =====================================================
    // CLIC FUERA DEL MODAL
    // =====================================================

    document
        .querySelectorAll(".modal-overlay")
        .forEach(modal => {

            modal.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        modal
                    ) {

                        modal.classList.remove(
                            "active"
                        );
                    }
                }
            );
        });


    // =====================================================
    // ESCAPE
    // =====================================================

    document.addEventListener(
        "keydown",
        event => {

            if (event.key === "Escape") {
                closeAllModals();
            }
        }
    );
}


// =========================================================
// CARGA GENERAL
// =========================================================

async function loadEverything() {

    try {

        // Primero cargamos categorías porque
        // los productos dependen de ellas.

        await loadCategories();

        await Promise.all([
            loadProducts(),
            loadSales(),
            loadCash()
        ]);

        renderCategories();
        renderPOSProducts();
        renderAdminProducts();
        renderCart();
        renderDashboard();
        updateCashUI();

    } catch (error) {

        console.error(
            "Error cargando el sistema:",
            error
        );
    }
}

// =========================================================
// DEBUG — DETECTAR BOTONES PRESIONADOS
// =========================================================

document.addEventListener("click", event => {

    const button = event.target.closest("button");

    if (!button) return;

    console.log(
        "BOTÓN PRESIONADO:",
        button.id || "(sin ID)",
        "type:",
        button.type || "(sin type)",
        "texto:",
        button.textContent.trim()
    );
});


// =========================================================
// INICIALIZACIÓN
// =========================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "Iniciando Mr. Lunch POS..."
        );

        // Evitar submits y refrescos accidentales
        preventFormRefresh();

        // Reloj
        updateClock();

        setInterval(
            updateClock,
            1000
        );

        // Navegación
        initNavigation();

        // Pantalla de bienvenida
        initWelcome();

        // Tipo de pedido
        initOrderType();

        // Eventos generales
        initEvents();

        // Carrito inicial
        renderCart();

        console.log(
            "Mr. Lunch POS iniciado correctamente."
        );
    }
);