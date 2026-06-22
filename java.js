// ============================================================
//  PARTE 1: CONFIGURACIÓN Y ESTADO GLOBAL
// ============================================================

const CONFIG = {
    API_BASE: 'https://unefa2026.onrender.com/api/ecommerce',
    DEFAULT_NOMBRE: 'usuario_demo',
    DEFAULT_CEDULA: 'V12345678',
    IMAGE_PLACEHOLDER: 'https://via.placeholder.com/400x300/333/666?text=Sin+Imagen'
};

const STATE = {
    allProducts: [],
    filteredProducts: [],
    cart: [],
    cartCount: 0,
    isLoading: false,
    currentPage: 'home'
};

// ============================================================
//  PARTE 2: API - COMUNICACIÓN CON EL SERVIDOR
// ============================================================

async function fetchProducts(nombre, cedula) {
    if (!nombre || nombre.trim() === '') {
        throw new Error('El nombre es obligatorio');
    }
    if (!cedula || cedula.trim() === '') {
        throw new Error('La cédula es obligatoria');
    }

    const nombreLimpio = nombre.trim();
    const cedulaLimpia = cedula.trim().toUpperCase();
    
    const url = `${CONFIG.API_BASE}?nombre=${encodeURIComponent(nombreLimpio)}&cedula=${encodeURIComponent(cedulaLimpia)}`;
    
    console.log('📤 URL:', url);
    console.log('👤 Credenciales:', { nombre: nombreLimpio, cedula: cedulaLimpia });

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log('📥 Status:', response.status);

        const textResponse = await response.text();
        console.log('📄 Respuesta cruda:', textResponse.substring(0, 200));

        let data;
        try {
            data = JSON.parse(textResponse);
        } catch (e) {
            throw new Error(`La API no devolvió JSON válido: ${textResponse.substring(0, 100)}`);
        }

        console.log('📦 Datos:', data);

        if (data.success === false) {
            const errorMsg = data.message || data.error || 'Credenciales inválidas';
            throw new Error(`Error de API: ${errorMsg}`);
        }

        if (!data.data || !Array.isArray(data.data)) {
            data.data = [];
        }

        return data;

    } catch (error) {
        console.error('❌ Error:', error);
        if (error.name === 'AbortError') {
            throw new Error('La petición tardó demasiado. Verifica tu conexión.');
        }
        if (error.message.includes('fetch') || error.message.includes('network')) {
            throw new Error('Error de red. No se puede conectar con el servidor.');
        }
        throw error;
    }
}

async function loadProductsFromAPI(nombre, cedula) {
    try {
        const data = await fetchProducts(nombre, cedula);
        
        let products = data.data || [];
        products = products.map((p, index) => ({
            id: p.id || index + 1,
            nombre: p.nombre || 'Producto sin nombre',
            precio: typeof p.precio === 'number' ? p.precio : 0,
            categoria: p.categoria || 'General',
            stock: typeof p.stock === 'number' ? p.stock : 0,
            rating: typeof p.rating === 'number' ? p.rating : 0,
            imagen: p.imagen || null,
            ...p
        }));
        
        return {
            success: true,
            products: products,
            total: data.total_filas || products.length
        };
        
    } catch (error) {
        console.error('❌ Error:', error);
        return {
            success: false,
            products: [],
            total: 0,
            error: error.message || 'Error desconocido'
        };
    }
}

// ============================================================
//  PARTE 3: RENDER - FUNCIONES DE RENDERIZADO
// ============================================================

const imageCache = new Map();

function preloadImage(url) {
    if (imageCache.has(url)) return;
    const img = new Image();
    img.onload = () => {
        imageCache.set(url, true);
        document.querySelectorAll(`img[src="${url}"]`).forEach(el => {
            el.style.opacity = '1';
        });
    };
    img.onerror = () => {
        imageCache.set(url, false);
    };
    img.src = url;
}

function getProductImage(product) {
    if (product.imagen && product.imagen !== 'string' && product.imagen !== '') {
        preloadImage(product.imagen);
        return product.imagen;
    }
    const url = `https://picsum.photos/seed/${product.id}/400/300`;
    preloadImage(url);
    return url;
}

function getRatingStars(rating) {
    const full = Math.floor(rating || 0);
    const half = (rating || 0) % 1 >= 0.5;
    let stars = '⭐'.repeat(full);
    if (half) stars += '✨';
    if (full === 0 && !half) stars = '☆☆☆☆☆';
    return stars || '☆☆☆☆☆';
}

function getProductDescription(product) {
    const desc = {
        'Tecnología': 'Producto tecnológico de última generación',
        'Electrónica': 'Dispositivo electrónico de calidad premium',
        'Ropa': 'Prenda de vestir cómoda y con estilo',
        'Hogar': 'Producto para el hogar con diseño moderno',
        'Deportes': 'Equipo deportivo profesional'
    };
    return desc[product.categoria] || 'Producto de alta calidad. ¡No te lo pierdas!';
}

function createProductCard(product) {
    const imageUrl = getProductImage(product);
    const stockText = product.stock > 0 ? `✅ ${product.stock} en stock` : '❌ Sin stock';
    const ratingStars = getRatingStars(product.rating);
    const isAvailable = product.stock > 0;
    const description = getProductDescription(product);

    return `
        <div class="product-card" data-id="${product.id}">
            <div class="product-description-tooltip">${description}</div>
            <img 
                class="product-image" 
                src="${imageUrl}" 
                alt="${product.nombre}"
                loading="lazy"
                style="opacity:0; transition: opacity 0.5s;"
                onerror="this.src='${CONFIG.IMAGE_PLACEHOLDER}'; this.style.opacity='1';"
                onload="this.style.opacity='1';"
            />
            <div class="product-info">
                <div class="product-title" title="${description}">${product.nombre}</div>
                <div class="product-category">📂 ${product.categoria || 'General'}</div>
                <div class="product-price">$${product.precio.toLocaleString()}</div>
                <div class="product-rating">${ratingStars} ${product.rating || 0}</div>
                <div class="product-stock">${stockText}</div>
                <button 
                    class="add-to-cart" 
                    data-id="${product.id}"
                    ${!isAvailable ? 'disabled' : ''}
                >
                    ${isAvailable ? '🛒 Add to Cart' : 'Agotado'}
                </button>
            </div>
        </div>
    `;
}

function renderProducts(products) {
    const container = document.getElementById('productsContainer');
    if (!container) return;

    if (!products || products.length === 0) {
        container.innerHTML = `
            <div class="no-products">
                <p>😕 No hay productos disponibles</p>
                <p style="font-size:0.85rem;color:#666;">Carga los productos o ajusta los filtros.</p>
            </div>
        `;
        return;
    }

    let html = '<div class="products-grid">';
    products.forEach(p => { html += createProductCard(p); });
    html += '</div>';
    container.innerHTML = html;

    if (typeof attachCartEvents === 'function') attachCartEvents();
}

function renderProductsFast(products) {
    const container = document.getElementById('productsContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div style="text-align:center; padding:2rem;">
            <div class="loading-spinner"></div>
            <p style="color:#90caf9; margin-top:1rem;">Cargando productos...</p>
        </div>
    `;
    
    setTimeout(() => renderProducts(products), 300);
}

function showError(message) {
    const container = document.getElementById('productsContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="error-message">
            <strong>⚠️ ${message}</strong>
            <br><small style="color:#ffcdd2;">Revisa la consola (F12) para más detalles.</small>
        </div>
    `;
}

function showLoading(message = '🔄 Cargando productos...') {
    const container = document.getElementById('productsContainer');
    if (!container) return;
    container.innerHTML = `
        <div style="text-align:center; padding:2rem;">
            <div class="loading-spinner"></div>
            <p style="color:#90caf9; margin-top:1rem;">${message}</p>
        </div>
    `;
}

function clearProducts() {
    const container = document.getElementById('productsContainer');
    if (container) {
        container.innerHTML = `
            <div class="no-products">
                <p>🗑️ Productos eliminados</p>
                <p style="font-size:0.85rem;color:#666;">Carga nuevamente para ver los productos.</p>
            </div>
        `;
    }
    STATE.allProducts = [];
    STATE.filteredProducts = [];
}

// ============================================================
//  PARTE 4: FILTROS - LÓGICA DE FILTRADO
// ============================================================

function getActiveFilters() {
    const checkboxes = document.querySelectorAll('.filter-checkbox');
    const select = document.getElementById('muitosSelect');
    
    const filters = {
        marcas: [],
        precios: [],
        generos: [],
        muitos: select ? select.value : ''
    };

    checkboxes.forEach(cb => {
        if (cb.checked) {
            const type = cb.dataset.filter;
            const value = cb.value;
            if (type === 'marca') filters.marcas.push(value);
            else if (type === 'precio') filters.precios.push(value);
            else if (type === 'genero') filters.generos.push(value);
        }
    });

    return filters;
}

function applyFiltersToProducts(products, filters) {
    if (!products || products.length === 0) return [];

    return products.filter(product => {
        if (filters.marcas.length > 0) {
            const marca = product.categoria || product.nombre.split(' ')[0];
            const match = filters.marcas.some(m => marca.includes(m) || product.nombre.includes(m));
            if (!match) return false;
        }

        if (filters.precios.length > 0) {
            const price = product.precio;
            let match = false;
            filters.precios.forEach(range => {
                if (range === '0-500' && price >= 0 && price <= 500) match = true;
                else if (range === '500-1000' && price > 500 && price <= 1000) match = true;
                else if (range === '1000+' && price > 1000) match = true;
            });
            if (!match) return false;
        }

        if (filters.generos.length > 0) {
            const genero = product.rating >= 4 ? 'Hombre' : product.rating >= 3 ? 'Mujer' : 'Unisex';
            if (!filters.generos.includes(genero)) return false;
        }

        if (filters.muitos) {
            const opcion = (product.id % 3) + 1;
            if (`opcion${opcion}` !== filters.muitos) return false;
        }

        return true;
    });
}

function filterProducts() {
    if (!STATE.allProducts || STATE.allProducts.length === 0) {
        showError('Primero carga los productos');
        return;
    }

    const filters = getActiveFilters();
    const filtered = applyFiltersToProducts(STATE.allProducts, filters);
    STATE.filteredProducts = filtered;
    renderProducts(filtered);
}

function clearAllFilters() {
    document.querySelectorAll('.filter-checkbox').forEach(cb => cb.checked = false);
    const select = document.getElementById('muitosSelect');
    if (select) select.value = '';
    STATE.filteredProducts = [...STATE.allProducts];
    renderProducts(STATE.filteredProducts);
}

// ============================================================
//  PARTE 5: CARRITO - LÓGICA DEL CARRITO DE COMPRAS
// ============================================================

function updateCartDisplay() {
    const cartSpan = document.getElementById('cart-count');
    if (cartSpan) {
        cartSpan.textContent = STATE.cart.length;
    }
}

function addToCart(productId) {
    const product = STATE.allProducts.find(p => p.id === productId);
    
    if (!product) {
        showToast('❌ Producto no encontrado', 'error');
        return false;
    }
    
    if (product.stock <= 0) {
        showToast('❌ Producto sin stock', 'error');
        return false;
    }
    
    if (STATE.cart.find(item => item.id === productId)) {
        showToast('⚠️ El producto ya está en el carrito', 'warning');
        return false;
    }
    
    STATE.cart.push({ ...product, quantity: 1 });
    updateCartDisplay();
    
    document.querySelectorAll(`.add-to-cart[data-id="${productId}"]`).forEach(btn => {
        btn.textContent = '✅ Añadido';
        btn.style.backgroundColor = '#2e7d32';
        setTimeout(() => {
            btn.textContent = '🛒 Add to Cart';
            btn.style.backgroundColor = '';
        }, 1500);
    });
    
    showToast(`✅ ${product.nombre} añadido al carrito`, 'success');
    return true;
}

function removeFromCart(productId) {
    const index = STATE.cart.findIndex(item => item.id === productId);
    if (index === -1) {
        showToast('⚠️ Producto no encontrado en el carrito', 'warning');
        return false;
    }
    
    const productName = STATE.cart[index].nombre;
    STATE.cart.splice(index, 1);
    updateCartDisplay();
    showToast(`🗑️ ${productName} eliminado del carrito`, 'info');
    renderCartModal();
    return true;
}

function clearCart() {
    if (STATE.cart.length === 0) {
        showToast('⚠️ El carrito ya está vacío', 'warning');
        return;
    }
    STATE.cart = [];
    updateCartDisplay();
    showToast('🗑️ Carrito vaciado completamente', 'info');
    renderCartModal();
}

function attachCartEvents() {
    document.querySelectorAll('.add-to-cart').forEach(btn => {
        btn.removeEventListener('click', handleCartClick);
        btn.addEventListener('click', handleCartClick);
    });
}

function handleCartClick(e) {
    e.stopPropagation();
    const productId = parseInt(this.dataset.id);
    addToCart(productId);
}

function renderCartModal() {
    const container = document.getElementById('cartItemsContainer');
    const actions = document.getElementById('cartActions');
    
    if (!container) return;
    
    if (STATE.cart.length === 0) {
        container.innerHTML = '<p style="color:#888;">🛒 No hay productos en el carrito</p>';
        if (actions) actions.style.display = 'none';
        return;
    }
    
    let html = '';
    let total = 0;
    
    STATE.cart.forEach(item => {
        total += item.precio * (item.quantity || 1);
        html += `
            <div class="cart-item" data-id="${item.id}">
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.nombre}</div>
                    <div class="cart-item-price">$${item.precio.toLocaleString()} x ${item.quantity || 1}</div>
                </div>
                <div class="cart-item-actions">
                    <button class="remove-item-btn" data-id="${item.id}">🗑️ Eliminar</button>
                </div>
            </div>
        `;
    });
    
    html += `
        <div style="padding:1rem 0; border-top:2px solid #0d47a1; margin-top:0.5rem;">
            <strong style="font-size:1.2rem;">Total: $${total.toLocaleString()}</strong>
        </div>
    `;
    
    container.innerHTML = html;
    if (actions) actions.style.display = 'block';
    
    document.querySelectorAll('.remove-item-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = parseInt(this.dataset.id);
            removeFromCart(id);
        });
    });
}

function checkout() {
    if (STATE.cart.length === 0) {
        showToast('⚠️ No hay productos en el carrito', 'warning');
        return;
    }
    
    const facturaCheck = document.getElementById('facturaCheck');
    const responseDiv = document.getElementById('checkoutResponse');
    const tieneFactura = facturaCheck ? facturaCheck.checked : false;
    
    responseDiv.innerHTML = `
        <div style="text-align:center; padding:1rem;">
            <div class="loading-spinner" style="margin:0 auto;"></div>
            <p style="color:#90caf9; margin-top:0.5rem;">Procesando pago...</p>
        </div>
    `;
    
    setTimeout(() => {
        const total = STATE.cart.reduce((sum, item) => sum + (item.precio * (item.quantity || 1)), 0);
        
        responseDiv.innerHTML = `
            <div style="background:#1b5e20; padding:1.5rem; border-radius:8px; text-align:center;">
                <h3 style="color:#a5d6a7;">✅ ¡Compra Exitosa!</h3>
                <p style="color:white; margin-top:0.5rem;">
                    Su pago de <strong>$${total.toLocaleString()}</strong> se ha efectuado correctamente 
                    desde la cuenta de su banco agregada a la plataforma.
                </p>
                ${tieneFactura ? '<p style="color:#90caf9; margin-top:0.5rem;">📄 Se generará su factura electrónica</p>' : ''}
                <button onclick="closeCartModal(); clearCart();" 
                        style="margin-top:1rem; padding:0.5rem 1.5rem; background:#0d47a1; color:white; border:none; border-radius:4px; cursor:pointer;">
                    Cerrar y continuar
                </button>
            </div>
        `;
        
        STATE.cart.forEach(item => {
            const product = STATE.allProducts.find(p => p.id === item.id);
            if (product) product.stock -= (item.quantity || 1);
        });
        
        showToast('✅ Compra realizada con éxito', 'success');
    }, 2000);
}

function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    const colors = {
        success: '#2e7d32',
        error: '#c62828',
        warning: '#e65100',
        info: '#0d47a1'
    };
    
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        background: ${colors[type] || colors.info};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        margin-bottom: 0.5rem;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
        font-weight: 500;
    `;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function closeCartModal() {
    const modal = document.getElementById('cartModal');
    if (modal) modal.style.display = 'none';
}

function openCartModal() {
    const modal = document.getElementById('cartModal');
    if (modal) {
        renderCartModal();
        document.getElementById('checkoutResponse').innerHTML = '';
        modal.style.display = 'block';
    }
}

// ============================================================
//  PARTE 6: SOPORTE - LÓGICA DEL MÓDULO DE SOPORTE
// ============================================================

function openSupportModal() {
    const modal = document.getElementById('supportModal');
    if (modal) {
        modal.style.display = 'block';
        document.getElementById('customErrorContainer').style.display = 'none';
        document.getElementById('supportResponse').innerHTML = '';
        document.getElementById('customErrorDesc').value = '';
        document.querySelectorAll('.support-option').forEach(btn => {
            btn.style.background = '#333';
            btn.style.borderColor = '#555';
        });
    }
}

function closeSupportModal() {
    const modal = document.getElementById('supportModal');
    if (modal) modal.style.display = 'none';
}

function initSupport() {
    const modal = document.getElementById('supportModal');
    const closeBtn = modal ? modal.querySelector('.close-modal') : null;
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeSupportModal);
    }
    
    document.querySelectorAll('.support-option').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.support-option').forEach(b => {
                b.style.background = '#333';
                b.style.borderColor = '#555';
            });
            this.style.background = '#0d47a1';
            this.style.borderColor = '#0d47a1';
            
            const errorType = this.dataset.error;
            const customContainer = document.getElementById('customErrorContainer');
            const responseDiv = document.getElementById('supportResponse');
            
            if (errorType === 'Otro') {
                customContainer.style.display = 'block';
                responseDiv.innerHTML = '';
            } else {
                customContainer.style.display = 'none';
                responseDiv.innerHTML = `
                    <div style="background:#1b5e20; padding:1rem; border-radius:4px; margin-top:1rem;">
                        <p>✅ Reporte enviado: <strong>${errorType}</strong></p>
                        <p style="font-size:0.85rem; color:#90caf9; margin-top:0.5rem;">
                            Nuestro equipo técnico revisará tu caso a la brevedad.
                        </p>
                    </div>
                `;
                showToast('✅ Reporte enviado correctamente', 'success');
            }
        });
    });
    
    document.getElementById('sendSupportBtn').addEventListener('click', function() {
        const desc = document.getElementById('customErrorDesc').value.trim();
        const responseDiv = document.getElementById('supportResponse');
        
        if (!desc) {
            responseDiv.innerHTML = `
                <div style="background:#c62828; padding:1rem; border-radius:4px; margin-top:1rem;">
                    ⚠️ Por favor, describe tu problema antes de enviar.
                </div>
            `;
            return;
        }
        
        responseDiv.innerHTML = `
            <div style="background:#1b5e20; padding:1rem; border-radius:4px; margin-top:1rem;">
                <p>✅ Reporte enviado exitosamente</p>
                <p style="font-size:0.85rem; color:#90caf9; margin-top:0.5rem;">
                    <strong>Descripción:</strong> ${desc}
                </p>
                <p style="font-size:0.85rem; color:#90caf9;">
                    Nuestro equipo técnico revisará tu caso a la brevedad.
                </p>
            </div>
        `;
        document.getElementById('customErrorDesc').value = '';
        document.getElementById('customErrorContainer').style.display = 'none';
        showToast('✅ Reporte enviado correctamente', 'success');
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeSupportModal();
    });
}

// ============================================================
//  PARTE 7: NAVEGACIÓN - NOVEDADES Y OFERTAS
// ============================================================

function showNovedades() {
    if (!STATE.allProducts || STATE.allProducts.length === 0) {
        showError('No hay productos para mostrar');
        return;
    }
    
    const novedades = [...STATE.allProducts]
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 8);
    
    const container = document.getElementById('productsContainer');
    if (container) {
        container.innerHTML = `
            <div style="margin-bottom:1rem;">
                <h2 style="color:#90caf9;">🌟 Novedades - Lo más popular</h2>
                <p style="color:#888;">Los productos mejor calificados por nuestra comunidad</p>
            </div>
        `;
    }
    renderProducts(novedades);
    document.querySelector('.logo').textContent = '🌟 NOVEDADES';
}

function showOfertas() {
    if (!STATE.allProducts || STATE.allProducts.length === 0) {
        showError('No hay productos para mostrar');
        return;
    }
    
    const shuffled = [...STATE.allProducts].sort(() => Math.random() - 0.5);
    const ofertas = shuffled.slice(0, 6).map(product => {
        const descuento = Math.floor(Math.random() * 30) + 10;
        const precioOriginal = product.precio;
        const precioConDescuento = Math.floor(precioOriginal * (1 - descuento / 100));
        return { ...product, precio: precioConDescuento, precioOriginal, descuento };
    });
    
    const container = document.getElementById('productsContainer');
    if (container) {
        container.innerHTML = `
            <div style="margin-bottom:1rem;">
                <h2 style="color:#ff5722;">🔥 Ofertas Especiales</h2>
                <p style="color:#888;">Promociones exclusivas con descuentos especiales</p>
            </div>
        `;
    }
    
    const originalRender = renderProducts;
    renderProducts = function(products) {
        const container = document.getElementById('productsContainer');
        if (!container) return;
        if (!products || products.length === 0) {
            container.innerHTML += `<div class="no-products"><p>😕 No hay ofertas disponibles</p></div>`;
            return;
        }
        
        let html = '<div class="products-grid">';
        products.forEach(product => {
            const imageUrl = getProductImage(product);
            const ratingStars = getRatingStars(product.rating);
            const isAvailable = product.stock > 0;
            const description = getProductDescription(product);
            
            const ofertaBadge = product.descuento ? 
                `<span style="position:absolute; top:10px; right:10px; background:#ff5722; color:white; padding:0.2rem 0.8rem; border-radius:20px; font-weight:bold; font-size:0.8rem; z-index:10;">
                    -${product.descuento}%
                </span>` : '';
            
            const precioOriginalHTML = product.precioOriginal ? 
                `<span style="text-decoration:line-through; color:#888; font-size:0.9rem; margin-right:0.5rem;">
                    $${product.precioOriginal.toLocaleString()}
                </span>` : '';
            
            html += `
                <div class="product-card" data-id="${product.id}">
                    ${ofertaBadge}
                    <div class="product-description-tooltip">${description}</div>
                    <img 
                        class="product-image" 
                        src="${imageUrl}" 
                        alt="${product.nombre}"
                        loading="lazy"
                        style="opacity:0; transition: opacity 0.5s;"
                        onerror="this.src='${CONFIG.IMAGE_PLACEHOLDER}'; this.style.opacity='1';"
                        onload="this.style.opacity='1';"
                    />
                    <div class="product-info">
                        <div class="product-title" title="${description}">${product.nombre}</div>
                        <div class="product-category">📂 ${product.categoria || 'General'}</div>
                        <div class="product-price">
                            ${precioOriginalHTML}
                            $${product.precio.toLocaleString()}
                        </div>
                        <div class="product-rating">${ratingStars} ${product.rating || 0}</div>
                        <div class="product-stock">${isAvailable ? '✅ En stock' : '❌ Sin stock'}</div>
                        <button 
                            class="add-to-cart" 
                            data-id="${product.id}"
                            ${!isAvailable ? 'disabled' : ''}
                        >
                            ${isAvailable ? '🛒 Add to Cart' : 'Agotado'}
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML += html;
        attachCartEvents();
    };
    renderProducts(ofertas);
    setTimeout(() => { renderProducts = originalRender; }, 100);
    document.querySelector('.logo').textContent = '🔥 OFERTAS';
}

function navigateTo(page) {
    STATE.currentPage = page;
    switch(page) {
        case 'novedades': showNovedades(); break;
        case 'ofertas': showOfertas(); break;
        case 'soporte': openSupportModal(); break;
        case 'carrito': openCartModal(); break;
        default:
            document.querySelector('.logo').textContent = '🛒 TIENDA';
            renderProducts(STATE.filteredProducts.length > 0 ? STATE.filteredProducts : STATE.allProducts);
            break;
    }
}

function initNavigation() {
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            if (page === 'soporte') { openSupportModal(); return; }
            if (page === 'carrito') { openCartModal(); return; }
            navigateTo(page);
        });
    });
}

// ============================================================
//  PARTE 8: MAIN - CARGA DE PRODUCTOS
// ============================================================

async function loadProducts() {
    const nombreInput = document.getElementById('nombreInput');
    const cedulaInput = document.getElementById('cedulaInput');
    
    let nombre = nombreInput ? nombreInput.value.trim() : CONFIG.DEFAULT_NOMBRE;
    let cedula = cedulaInput ? cedulaInput.value.trim() : CONFIG.DEFAULT_CEDULA;
    
    if (!nombre) nombre = CONFIG.DEFAULT_NOMBRE;
    if (!cedula) cedula = CONFIG.DEFAULT_CEDULA;

    if (STATE.isLoading) {
        showToast('⏳ Ya está cargando productos...', 'warning');
        return;
    }
    
    STATE.isLoading = true;
    showLoading(`🔄 Conectando con API...`);

    try {
        console.log('🚀 Iniciando carga...');
        console.log('👤 Credenciales:', { nombre, cedula });
        
        const result = await loadProductsFromAPI(nombre, cedula);
        
        console.log('📊 Resultado:', result);
        
        if (result.success && result.products.length > 0) {
            STATE.allProducts = result.products;
            STATE.filteredProducts = [...result.products];
            renderProductsFast(STATE.filteredProducts);
            showToast(`✅ ${STATE.allProducts.length} productos cargados`, 'success');
        } else {
            const errorMsg = result.error || 'No se encontraron productos';
            console.error('❌ Error:', errorMsg);
            
            STATE.allProducts = [];
            STATE.filteredProducts = [];
            renderProducts([]);
            
            let userMessage = 'No se pudieron cargar los productos. ';
            if (errorMsg.includes('Credenciales') || errorMsg.includes('autenticación')) {
                userMessage += 'Verifica tu nombre y cédula.';
            } else if (errorMsg.includes('red') || errorMsg.includes('conexión')) {
                userMessage += 'Verifica tu conexión a internet.';
            } else {
                userMessage += `Error: ${errorMsg}`;
            }
            
            showError(userMessage);
            showToast('❌ ' + userMessage, 'error');
        }
    } catch (error) {
        console.error('❌ Error:', error);
        STATE.allProducts = [];
        STATE.filteredProducts = [];
        renderProducts([]);
        showError(`❌ Error: ${error.message || 'Error inesperado'}`);
        showToast(`❌ Error: ${error.message || 'Error inesperado'}`, 'error');
    } finally {
        STATE.isLoading = false;
    }
}

async function testAPI() {
    const nombreInput = document.getElementById('nombreInput');
    const cedulaInput = document.getElementById('cedulaInput');
    
    const nombre = nombreInput ? nombreInput.value.trim() : CONFIG.DEFAULT_NOMBRE;
    const cedula = cedulaInput ? cedulaInput.value.trim() : CONFIG.DEFAULT_CEDULA;
    
    console.log('🧪 Probando API...');
    console.log('👤 Credenciales:', { nombre, cedula });
    
    try {
        const result = await fetchProducts(nombre, cedula);
        console.log('✅ API respondió:', result);
        showToast('✅ Conexión API exitosa', 'success');
        return result;
    } catch (error) {
        console.error('❌ Error:', error);
        showToast('❌ Error: ' + error.message, 'error');
        throw error;
    }
}

function clearAllProducts() {
    if (STATE.cart.length > 0 && !confirm('⚠️ Hay productos en el carrito. ¿Seguro que quieres limpiar los productos?')) {
        return;
    }
    clearProducts();
    showToast('🗑️ Productos eliminados', 'info');
}

function initUI() {
    console.log('🔧 Inicializando UI...');
    
    document.getElementById('loadProductsBtn')?.addEventListener('click', loadProducts);
    document.getElementById('clearProductsBtn')?.addEventListener('click', clearAllProducts);
    
    document.getElementById('nombreInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loadProducts();
    });
    document.getElementById('cedulaInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loadProducts();
    });
    
    document.getElementById('applyFiltersBtn')?.addEventListener('click', filterProducts);
    document.getElementById('clearFiltersBtn')?.addEventListener('click', clearAllFilters);
    
    initCart();
    initSupport();
    initNavigation();
    
    console.log('✅ UI inicializada');
}

function initCart() {
    STATE.cart = [];
    STATE.cartCount = 0;
    updateCartDisplay();
    attachCartEvents();
    
    const modal = document.getElementById('cartModal');
    const closeBtn = modal ? modal.querySelector('.close-modal') : null;
    const checkoutBtn = document.getElementById('checkoutBtn');
    const clearCartBtn = document.getElementById('clearCartBtn');
    
    if (closeBtn) closeBtn.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
    if (checkoutBtn) checkoutBtn.addEventListener('click', checkout);
    if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);
    
    window.addEventListener('click', (e) => {
        if (e.target === modal && modal) modal.style.display = 'none';
    });
}

// ============================================================
//  PARTE 9: INICIO DE LA APLICACIÓN
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('========================================');
    console.log('🛒 Ecommerce App Iniciada');
    console.log('📦 API:', CONFIG.API_BASE);
    console.log('👤 Usuario:', CONFIG.DEFAULT_NOMBRE);
    console.log('========================================');
    
    try {
        initUI();
        setTimeout(() => {
            console.log('🔄 Carga automática...');
            loadProducts();
        }, 1000);
    } catch (error) {
        console.error('❌ Error:', error);
    }
});

window.loadProducts = loadProducts;
window.testAPI = testAPI;
window.clearAllProducts = clearAllProducts;

console.log('💡 Comandos: testAPI() - loadProducts()');
console.log('========================================');

