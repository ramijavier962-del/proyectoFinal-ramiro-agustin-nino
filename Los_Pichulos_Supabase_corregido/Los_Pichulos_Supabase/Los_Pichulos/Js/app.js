(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const money = (value) => new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0
  }).format(Number(value) || 0);
  const makeId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const todayKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('es-AR');
  };
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  const sb = window.supabaseClient;
  const page = document.body.dataset.page;
  const app = $('#app');
  let products = [];
  let sales = [];
  let settings = { store: 'Los Pichulos', phone: '', email: '' };

  function ensureSupabase() {
    if (!sb) throw new Error('No se pudo iniciar Supabase. Revisá Js/supabase-config.js y el orden de los scripts.');
  }

  function checkError(error) {
    if (error) throw new Error(error.message || 'Ocurrió un error al comunicarse con Supabase.');
  }

  function table(rows, headers) {
    const content = rows || '<tr><td colspan="8" class="empty">Todavía no hay registros.</td></tr>';
    return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${content}</tbody></table></div>`;
  }

  function flash(message) {
    const notice = document.createElement('div');
    notice.className = 'notice';
    notice.textContent = message;
    app.prepend(notice);
    setTimeout(() => notice.remove(), 3500);
  }

  function download(name, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function csv(name, rows) {
    const content = '\ufeff' + rows.map((row) => row.map((value) =>
      `"${String(value ?? '').replaceAll('"', '""')}"`
    ).join(';')).join('\n');
    download(name, new Blob([content], { type: 'text/csv;charset=utf-8' }));
  }

  function lowCount() {
    return products.filter((product) => product.stock <= 5).length;
  }

  function dashboard() {
    const todaysSales = sales.filter((sale) => sale.date === todayKey());
    app.innerHTML = `
      <section class="grid">
        <article class="card"><div class="metric-label">Ventas de hoy</div><div class="metric-value">${money(todaysSales.reduce((sum, sale) => sum + sale.total, 0))}</div><div class="metric-note">${todaysSales.length} operaciones registradas</div></article>
        <article class="card"><div class="metric-label">Unidades en inventario</div><div class="metric-value">${products.reduce((sum, product) => sum + product.stock, 0)}</div><div class="metric-note">En ${products.length} productos</div></article>
        <article class="card"><div class="metric-label">Productos con stock bajo</div><div class="metric-value">${lowCount()}</div><div class="metric-note">5 unidades o menos</div></article>
      </section>
      <section class="panel"><div class="panel-head"><h2>Últimos productos registrados</h2><a class="btn btn-sm" href="regiprendas.html">＋ Agregar prenda</a></div>
        ${table(products.slice(-6).reverse().map((p) => `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.size)}</td><td>${money(p.price)}</td><td>${p.stock}</td><td><span class="pill ${p.stock === 0 ? 'out' : p.stock <= 5 ? 'low' : ''}">${p.stock === 0 ? 'Sin stock' : p.stock <= 5 ? 'Stock bajo' : 'Disponible'}</span></td></tr>`).join(''), ['Prenda', 'Talle', 'Precio', 'Stock', 'Estado'])}
      </section>
      <section class="panel"><div class="panel-head"><h2>Actividad reciente</h2><a href="reporte.html" class="muted small">Ver reportes →</a></div>
        ${table(sales.slice(-5).reverse().map((s) => `<tr><td>${formatDate(s.created)}</td><td>${esc(s.name)}</td><td>${s.qty}</td><td>${money(s.total)}</td></tr>`).join(''), ['Fecha', 'Producto', 'Cantidad', 'Total'])}
      </section>`;
  }

  function bindDelete() {
    document.querySelectorAll('[data-delete]').forEach((button) => {
      button.addEventListener('click', async () => {
        const productId = button.dataset.delete;
        if (!confirm('¿Eliminar este producto del inventario?')) return;
        button.disabled = true;
        try {
          ensureSupabase();
          const { error } = await sb.from('productos').delete().eq('id', productId);
          checkError(error);
          products = products.filter((product) => product.id !== productId);
          render();
          flash('Prenda eliminada de Supabase.');
        } catch (error) {
          button.disabled = false;
          alert(error.message);
        }
      });
    });
  }

  function productForm() {
    app.innerHTML = `
      <section class="panel"><div class="panel-head"><h2>Registrar nueva prenda</h2><span class="muted small">Completá los datos del producto</span></div>
        <form id="productForm"><div class="form-grid">
          <div class="field"><label>Nombre de la prenda *</label><input name="name" required maxlength="80" placeholder="Ej. Remera oversize"></div>
          <div class="field"><label>Marca</label><input name="brand" maxlength="60" placeholder="Ej. Nike"></div>
          <div class="field"><label>Talle *</label><input name="size" required maxlength="30" placeholder="Ej. M, L, 42"></div>
          <div class="field"><label>Precio unitario (ARS) *</label><input name="price" type="number" min="0" step="1" required placeholder="15000"></div>
          <div class="field"><label>Stock inicial *</label><input name="stock" type="number" min="0" step="1" required placeholder="10"></div>
          <div class="field"><label>Categoría</label><select name="category"><option>General</option><option>Remeras</option><option>Pantalones</option><option>Buzos</option><option>Camperas</option><option>Accesorios</option></select></div>
        </div><button class="btn" type="submit">Guardar prenda</button></form>
      </section>
      <section class="panel"><div class="panel-head"><h2>Inventario actual</h2><span class="muted small">${products.length} productos</span></div>
        ${table(products.map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.brand || '—')}</td><td>${esc(p.size)}</td><td>${money(p.price)}</td><td>${p.stock}</td><td><button class="btn btn-danger btn-sm" data-delete="${esc(p.id)}">Eliminar</button></td></tr>`).join(''), ['Prenda', 'Marca', 'Talle', 'Precio', 'Stock', 'Acción'])}
      </section>`;

    $('#productForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      const data = new FormData(form);
      const product = {
        id: makeId(),
        nombre: String(data.get('name')).trim(),
        marca: String(data.get('brand') || '').trim(),
        talle: String(data.get('size')).trim(),
        precio: Number(data.get('price')),
        stock: Number(data.get('stock')),
        categoria: String(data.get('category') || 'General')
      };
      if (!product.nombre || !product.talle || !Number.isFinite(product.precio) || product.precio < 0 || !Number.isInteger(product.stock) || product.stock < 0) {
        alert('Revisá los datos ingresados. El precio y el stock deben ser valores válidos.');
        return;
      }
      button.disabled = true;
      try {
        ensureSupabase();
        const { data: saved, error } = await sb.from('productos').insert(product).select().single();
        checkError(error);
        products.push({ id: saved.id, name: saved.nombre, brand: saved.marca, size: saved.talle, price: Number(saved.precio), stock: Number(saved.stock), category: saved.categoria });
        productForm();
        flash('Prenda guardada en Supabase.');
      } catch (error) {
        button.disabled = false;
        alert(error.message);
      }
    });
    bindDelete();
  }

  function stockPage() {
    app.innerHTML = `<section class="panel"><div class="panel-head"><h2>Inventario de prendas</h2><a class="btn btn-sm" href="regiprendas.html">＋ Nueva prenda</a></div>
      <div class="toolbar"><input id="search" placeholder="Buscar por nombre, marca o talle…"><select id="stockFilter"><option value="all">Todos los estados</option><option value="low">Stock bajo (≤ 5)</option><option value="out">Sin stock</option></select></div>
      <div id="stockTable" style="margin-top:18px"></div></section>`;
    const draw = () => {
      const query = $('#search').value.toLowerCase();
      const filter = $('#stockFilter').value;
      const list = products.filter((p) =>
        `${p.name} ${p.brand} ${p.size}`.toLowerCase().includes(query) &&
        (filter === 'all' || (filter === 'low' && p.stock > 0 && p.stock <= 5) || (filter === 'out' && p.stock === 0))
      );
      $('#stockTable').innerHTML = table(list.map((p) => `<tr><td><b>${esc(p.name)}</b><div class="muted small">${esc(p.brand || 'Sin marca')}</div></td><td>${esc(p.category || 'General')}</td><td>${esc(p.size)}</td><td>${money(p.price)}</td><td>${p.stock}</td><td><span class="pill ${p.stock === 0 ? 'out' : p.stock <= 5 ? 'low' : ''}">${p.stock === 0 ? 'Sin stock' : p.stock <= 5 ? 'Stock bajo' : 'Disponible'}</span></td></tr>`).join(''), ['Prenda', 'Categoría', 'Talle', 'Precio', 'Cantidad', 'Estado']);
    };
    $('#search').addEventListener('input', draw);
    $('#stockFilter').addEventListener('change', draw);
    draw();
  }

  function salesPage() {
    app.innerHTML = `<section class="panel"><div class="panel-head"><h2>Registrar nueva venta</h2><span class="muted small">El stock se descuenta automáticamente</span></div>
      <form id="saleForm"><div class="form-grid">
        <div class="field"><label>Producto *</label><select name="product" id="saleProduct" required><option value="">Seleccionar producto</option>${products.filter((p) => p.stock > 0).map((p) => `<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.size)} · ${p.stock} disp.</option>`).join('')}</select></div>
        <div class="field"><label>Cantidad *</label><input name="qty" id="saleQty" type="number" min="1" value="1" required></div>
        <div class="field"><label>Precio unitario</label><input id="salePrice" readonly placeholder="Se completa al elegir"></div>
        <div class="field"><label>Total de la venta</label><input id="saleTotal" readonly placeholder="$0"></div>
        <div class="field"><label>Medio de pago</label><select name="payment"><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option><option>Otro</option></select></div>
        <div class="field"><label>Cliente (opcional)</label><input name="customer" maxlength="120" placeholder="Nombre del cliente"></div>
      </div><button class="btn" type="submit">Confirmar venta</button></form>
    </section><section class="panel"><h2>Ventas recientes</h2><div style="margin-top:15px">${table(sales.slice(-8).reverse().map((s) => `<tr><td>${formatDate(s.created)}</td><td>${esc(s.name)}</td><td>${s.qty}</td><td>${esc(s.payment)}</td><td>${money(s.total)}</td></tr>`).join(''), ['Fecha', 'Producto', 'Cantidad', 'Pago', 'Total'])}</div></section>`;

    const updateTotal = () => {
      const product = products.find((p) => p.id === $('#saleProduct').value);
      const quantity = Number($('#saleQty').value) || 0;
      $('#salePrice').value = product ? money(product.price) : '';
      $('#saleTotal').value = product ? money(product.price * quantity) : '';
      $('#saleQty').max = product ? product.stock : 1;
    };
    $('#saleProduct').addEventListener('change', updateTotal);
    $('#saleQty').addEventListener('input', updateTotal);

    $('#saleForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      const data = new FormData(form);
      const product = products.find((p) => p.id === data.get('product'));
      const quantity = Number(data.get('qty'));
      if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > product.stock) {
        alert('Verificá el producto y la cantidad disponible.');
        return;
      }
      button.disabled = true;
      try {
        ensureSupabase();
        // La función SQL registra la venta y descuenta el stock en una sola operación.
        const { data: result, error } = await sb.rpc('registrar_venta', {
          p_id: makeId(),
          p_producto_id: product.id,
          p_cantidad: quantity,
          p_medio_pago: String(data.get('payment') || 'Efectivo'),
          p_cliente: String(data.get('customer') || '').trim()
        });
        checkError(error);
        const [{ data: freshProducts, error: productsError }, { data: freshSales, error: salesError }] = await Promise.all([
          sb.from('productos').select('*').order('created_at', { ascending: true }),
          sb.from('ventas').select('*').order('creado_en', { ascending: true })
        ]);
        checkError(productsError);
        checkError(salesError);
        products = (freshProducts || []).map(mapProduct);
        sales = (freshSales || []).map(mapSale);
        salesPage();
        flash(result?.mensaje || 'Venta registrada en Supabase y stock actualizado.');
      } catch (error) {
        button.disabled = false;
        alert(error.message);
      }
    });
  }

  function reports() {
    const total = sales.reduce((sum, sale) => sum + sale.total, 0);
    const units = sales.reduce((sum, sale) => sum + sale.qty, 0);
    app.innerHTML = `<section class="grid"><article class="card"><div class="metric-label">Facturación acumulada</div><div class="metric-value">${money(total)}</div></article><article class="card"><div class="metric-label">Unidades vendidas</div><div class="metric-value">${units}</div></article><article class="card"><div class="metric-label">Operaciones</div><div class="metric-value">${sales.length}</div></article></section>
      <section class="panel"><div class="panel-head"><h2>Historial de ventas</h2><div class="toolbar"><button class="btn btn-outline btn-sm" id="exportSales">Exportar ventas CSV</button><button class="btn btn-outline btn-sm" id="exportStock">Exportar stock CSV</button></div></div>
      ${table(sales.slice().reverse().map((s) => `<tr><td>${formatDate(s.created)}</td><td>${esc(s.name)}</td><td>${s.qty}</td><td>${esc(s.payment)}</td><td>${money(s.total)}</td></tr>`).join(''), ['Fecha', 'Producto', 'Cantidad', 'Pago', 'Total'])}</section>`;
    $('#exportSales').addEventListener('click', () => csv('ventas.csv', [['Fecha', 'Producto', 'Cantidad', 'Precio unitario', 'Total', 'Pago', 'Cliente'], ...sales.map((s) => [s.created, s.name, s.qty, s.unitPrice, s.total, s.payment, s.customer])]));
    $('#exportStock').addEventListener('click', () => csv('inventario.csv', [['Producto', 'Marca', 'Talle', 'Categoría', 'Precio', 'Stock'], ...products.map((p) => [p.name, p.brand, p.size, p.category, p.price, p.stock])]));
  }

  async function saveSettings(values) {
    const rows = Object.entries(values).map(([key, value]) => ({ clave: key, valor: String(value ?? '') }));
    const { error } = await sb.from('configuracion').upsert(rows, { onConflict: 'clave' });
    checkError(error);
  }

  function settingsPage() {
    app.innerHTML = `<section class="panel"><div class="panel-head"><h2>Datos de la tienda</h2></div><form id="settingsForm"><div class="form-grid">
      <div class="field"><label>Nombre de la tienda</label><input name="store" value="${esc(settings.store)}" required></div>
      <div class="field"><label>Teléfono</label><input name="phone" value="${esc(settings.phone)}"></div>
      <div class="field"><label>Correo electrónico</label><input name="email" type="email" value="${esc(settings.email)}"></div>
    </div><button class="btn" type="submit">Guardar configuración</button></form></section>
    <section class="panel"><h2>Datos y seguridad</h2><p class="muted small">Los productos, las ventas y la configuración se guardan en Supabase. Podés acceder al sistema desde distintos equipos con conexión a internet.</p>
      <div class="toolbar"><button class="btn btn-outline" id="backup">Descargar copia de seguridad</button><label class="btn btn-outline" for="restore" style="margin:0;cursor:pointer">Restaurar copia</label><input id="restore" type="file" accept="application/json" hidden></div>
    </section>`;

    $('#settingsForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        ensureSupabase();
        settings = Object.fromEntries(new FormData(event.currentTarget));
        await saveSettings(settings);
        flash('Configuración guardada en Supabase.');
      } catch (error) {
        alert(error.message);
      } finally {
        button.disabled = false;
      }
    });

    $('#backup').addEventListener('click', () => {
      const backup = { version: 1, createdAt: new Date().toISOString(), products, sales, settings };
      download('respaldo-lospichulos.json', new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    });

    $('#restore').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!confirm('La restauración agregará o actualizará los registros del archivo. No eliminará los registros que ya existen en Supabase. ¿Querés continuar?')) {
        event.target.value = '';
        return;
      }
      try {
        const backup = JSON.parse(await file.text());
        if (!Array.isArray(backup.products) || !Array.isArray(backup.sales) || !backup.settings || typeof backup.settings !== 'object') {
          throw new Error('El archivo no tiene la estructura de un respaldo de Los Pichulos.');
        }
        const productRows = backup.products.map((p) => ({
          id: String(p.id), nombre: String(p.name), marca: String(p.brand || ''), talle: String(p.size),
          precio: Number(p.price), stock: Number(p.stock), categoria: String(p.category || 'General')
        }));
        const saleRows = backup.sales.map((s) => ({
          id: String(s.id), producto_id: s.productId ? String(s.productId) : null,
          producto_nombre: String(s.name), talle: String(s.size || ''), cantidad: Number(s.qty),
          precio_unitario: Number(s.unitPrice), total: Number(s.total), medio_pago: String(s.payment || 'Efectivo'),
          cliente: String(s.customer || ''), fecha: String(s.date || todayKey()), creado_en: s.created || new Date().toISOString()
        }));
        if (productRows.some((p) => !p.id || !p.nombre || !p.talle || !Number.isFinite(p.precio) || p.precio < 0 || !Number.isInteger(p.stock) || p.stock < 0)) {
          throw new Error('Hay productos con datos inválidos en el respaldo.');
        }
        if (saleRows.some((s) => !s.id || !s.producto_nombre || !Number.isInteger(s.cantidad) || s.cantidad < 1 || !Number.isFinite(s.total))) {
          throw new Error('Hay ventas con datos inválidos en el respaldo.');
        }
        ensureSupabase();
        if (productRows.length) {
          const { error } = await sb.from('productos').upsert(productRows, { onConflict: 'id' });
          checkError(error);
        }
        if (saleRows.length) {
          const { error } = await sb.from('ventas').upsert(saleRows, { onConflict: 'id' });
          checkError(error);
        }
        await saveSettings(backup.settings);
        await loadData();
        render();
        flash('Respaldo restaurado. Los registros anteriores que no estaban en el archivo se conservaron.');
      } catch (error) {
        alert(error.message || 'No se pudo restaurar el respaldo.');
      } finally {
        event.target.value = '';
      }
    });
  }

  function mapProduct(p) {
    return { id: p.id, name: p.nombre, brand: p.marca, size: p.talle, price: Number(p.precio), stock: Number(p.stock), category: p.categoria };
  }

  function mapSale(s) {
    return { id: s.id, productId: s.producto_id, name: s.producto_nombre, size: s.talle, qty: Number(s.cantidad), unitPrice: Number(s.precio_unitario), total: Number(s.total), payment: s.medio_pago, customer: s.cliente, date: s.fecha, created: s.creado_en };
  }

  async function loadData() {
    ensureSupabase();
    const [productResult, salesResult, configResult] = await Promise.all([
      sb.from('productos').select('*').order('created_at', { ascending: true }),
      sb.from('ventas').select('*').order('creado_en', { ascending: true }),
      sb.from('configuracion').select('*')
    ]);
    checkError(productResult.error);
    checkError(salesResult.error);
    checkError(configResult.error);
    products = (productResult.data || []).map(mapProduct);
    sales = (salesResult.data || []).map(mapSale);
    settings = { store: 'Los Pichulos', phone: '', email: '' };
    (configResult.data || []).forEach((row) => { settings[row.clave] = row.valor; });
  }

  function render() {
    const pages = { dashboard, products: productForm, stock: stockPage, sales: salesPage, reports, settings: settingsPage };
    (pages[page] || dashboard)();
  }

  $('#logoutBtn')?.addEventListener('click', async () => {
    try {
      ensureSupabase();
      const { error } = await sb.auth.signOut();
      checkError(error);
    } catch (error) {
      alert(error.message);
    } finally {
      location.href = 'iniarsesion.html';
    }
  });

  if ($('#loginForm')) {
    $('#loginForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = $('#loginMessage');
      const button = event.currentTarget.querySelector('button[type="submit"]');
      message.textContent = 'Verificando acceso…';
      button.disabled = true;
      try {
        ensureSupabase();
        const { data, error } = await sb.auth.signInWithPassword({
          email: $('#email').value.trim(), password: $('#password').value
        });
        checkError(error);
        if (!data.session) throw new Error('No se pudo iniciar la sesión.');
        location.href = 'indexx.html';
      } catch (error) {
        message.textContent = error.message;
        button.disabled = false;
      }
    });
  }

  if (page) {
    if ($('#today')) $('#today').textContent = new Date().toLocaleDateString('es-AR', { dateStyle: 'full' });
    document.querySelectorAll('[data-nav]').forEach((link) => link.classList.toggle('active', link.dataset.nav === page));
    (async () => {
      try {
        ensureSupabase();
        const { data, error } = await sb.auth.getSession();
        checkError(error);
        if (!data.session) {
          location.href = 'iniarsesion.html';
          return;
        }
        await loadData();
        render();
      } catch (error) {
        app.innerHTML = `<section class="panel"><h2>No se pudo conectar con Supabase</h2><p class="muted">${esc(error.message)}</p><p>Revisá la URL y la clave pública en <b>Js/supabase-config.js</b>, ejecutá el archivo <b>supabase.sql</b> en el SQL Editor y verificá las políticas de acceso.</p></section>`;
      }
    })();
  }
})();
