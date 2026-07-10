import { db, storage, ref, uploadBytes, getDownloadURL, collection, addDoc, getDocs, deleteDoc, updateDoc, setDoc, doc } from './firebase.js';
import { $id } from './utils/dom.js';

// ── Utilidades locales (evita errores de import en PWA) ──
function formatPrice(value) {
  const num = Number(value);
  if (isNaN(num)) return '0';
  return num.toLocaleString('es-AR');
}

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
// ───────────────────────────────────────────

// ═══ TOAST ═══
function toast(msg, tipo = 'ok') {
  let el = $id('admin-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'admin-toast';
    el.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(80px);background:var(--grafito);color:var(--crema);border:1px solid var(--humo);padding:9px 22px;border-radius:99px;font-family:'Inter',sans-serif;font-size:.82rem;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,.6);z-index:9999;transition:transform .3s;white-space:nowrap;pointer-events:none;`;
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.borderColor = tipo === 'error' ? 'rgba(192,57,43,.5)' : 'var(--humo)';
  el.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.transform = 'translateX(-50%) translateY(80px)'; }, 2600);
}

// ═══ MODAL ═══
function abrirModal(html, onConfirm) {
  $id('_admin_modal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = '_admin_modal';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;`;
  overlay.innerHTML = `<div style="background:var(--carbon);border:1px solid var(--grafito);border-radius:16px;padding:28px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;">${html}<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:22px;"><button id="_modal_cancel" class="btn btn-ghost">Cancelar</button><button id="_modal_ok" class="btn btn-primary">Guardar</button></div></div>`;
  document.body.appendChild(overlay);
  const cerrar = () => overlay.remove();
  $id('_modal_cancel').onclick = cerrar;
  overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(); });
  $id('_modal_ok').onclick = () => { if (onConfirm()) cerrar(); };
}

// ═══ HELPERS ═══
function limpiarForm(...ids) { ids.forEach(id => { const el = $id(id); if (!el) return; if (el.type === 'checkbox') el.checked = false; else el.value = ''; }); }
function val(id) { return $id(id)?.value.trim() ?? ''; }
function numVal(id) { return Number($id(id)?.value) || 0; }
function checked(id) { return $id(id)?.checked ?? false; }

// ═══ PREVISUALIZACIÓN Y SUBIDA DE IMAGEN ═══
window.previsualizarImagen = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById('nombreArchivo').textContent = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('previewImagen');
    preview.src = e.target.result;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);
};

async function subirImagen(file) {
  if (!file) return null;
  const nombreArchivo = `productos/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, nombreArchivo);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

// ═══ PRODUCTOS ═══
window.agregarProducto = async () => {
  const nombre      = val('nombre');
  const categoria   = val('categoria');
  const descripcion = val('descripcion');
  const precio      = numVal('precio');
  const descuento   = numVal('descuento');
  const oferta      = checked('oferta');
  const esBebida    = checked('esBebida');
  const precioDocena = numVal('precioDocena');
  const precio3unidades = numVal('precio3unidades');
  const precio6unidades = numVal('precio6unidades');

  const fileInput = document.getElementById('imagenFile');
  const archivo = fileInput?.files[0] || null;
  let imagenURL = val('imagenURL');

  if (archivo) {
    try {
      imagenURL = await subirImagen(archivo);
    } catch (err) {
      console.error(err);
      toast('Error al subir la imagen', 'error');
      return;
    }
  }

  if (!nombre || !categoria) {
    toast('Completá nombre y categoría', 'error');
    return;
  }
  if (!precio && !precioDocena && !precio3unidades && !precio6unidades) {
    toast('Completá al menos un precio (unitario, 3 un., 6 un. o docena)', 'error');
    return;
  }

  try {
    await addDoc(collection(db, 'productos'), {
      nombre, categoria, descripcion,
      precio, descuento, oferta, esBebida,
      disponible: true,
      imagenURL: imagenURL || '',
      precioDocena: precioDocena > 0 ? precioDocena : null,
      precio3unidades: precio3unidades > 0 ? precio3unidades : null,
      precio6unidades: precio6unidades > 0 ? precio6unidades : null
    });
    limpiarForm('nombre','categoria','descripcion','precio','precioDocena','precio3unidades','precio6unidades','descuento','oferta','esBebida','imagenURL');
    if (fileInput) fileInput.value = '';
    const preview = document.getElementById('previewImagen');
    if (preview) preview.style.display = 'none';
    const nombreArc = document.getElementById('nombreArchivo');
    if (nombreArc) nombreArc.textContent = '';
    toast('✓ Producto agregado');
    cargarProductos();
  } catch (err) {
    console.error(err);
    toast('Error al agregar producto', 'error');
  }
};

async function cargarProductos() {
  const lista = $id('lista-productos');
  if (!lista) return;
  lista.innerHTML = `<p style="color:var(--gris);text-align:center;padding:30px 0;font-size:.85rem;">Cargando...</p>`;
  try {
    const snap = await getDocs(collection(db, 'productos'));
    if (snap.empty) {
      lista.innerHTML = `<p style="color:var(--gris);text-align:center;padding:30px 0;font-size:.85rem;">No hay productos cargados aún</p>`;
      return;
    }
    lista.innerHTML = '';
    snap.forEach(documento => {
      const p = documento.data(), id = documento.id;
      const row = document.createElement('div'); row.className = 'prod-admin-row';
      row.innerHTML = `
        ${p.imagenURL ? `<img class="prod-admin-img" src="${p.imagenURL}" alt="${escapeHTML(p.nombre)}">` : `<div class="prod-admin-img" style="display:flex;align-items:center;justify-content:center;font-size:1.4rem;background:var(--humo);">🥖</div>`}
        <div class="prod-admin-info">
          <div class="prod-admin-nombre">${escapeHTML(p.nombre)}</div>
          <div class="prod-admin-meta">${escapeHTML(p.categoria||'—')} ${p.oferta ? ` · <span style="color:var(--mostaza);">🔥 ${p.descuento}% OFF</span>` : ''}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0;">
          <div class="prod-admin-precio">$${formatPrice(p.precio)}</div>
          <span class="badge ${p.disponible !== false ? 'badge-verde' : 'badge-rojo'}">${p.disponible !== false ? 'Activo' : 'Inactivo'}</span>
        </div>
        <div class="prod-admin-acciones">
          <button class="btn btn-ghost btn-sm" data-edit="${id}">✏️ Editar</button>
          <button class="btn btn-danger btn-sm" data-del="${id}">🗑️</button>
        </div>`;
      row.querySelector('[data-edit]').onclick = () => editarProducto(id, p);
      row.querySelector('[data-del]').onclick = () => eliminarProducto(id, p.nombre);
      lista.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    lista.innerHTML = `<p style="color:var(--rojo);padding:20px 0;font-size:.85rem;">Error cargando productos</p>`;
  }
}

function editarProducto(id, datos) {
  const html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><strong style="font-size:1rem;">Editar producto</strong></div>
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div class="form-campo"><label>Nombre</label><input id="_e_nombre" type="text" value="${escapeHTML(datos.nombre||'')}"></div>
      <div class="form-campo"><label>Categoría</label><input id="_e_categoria" type="text" value="${escapeHTML(datos.categoria||'')}"></div>
      <div class="form-campo"><label>Descripción</label><input id="_e_descripcion" type="text" value="${escapeHTML(datos.descripcion||'')}"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-campo"><label>Precio ($)</label><input id="_e_precio" type="number" value="${datos.precio||0}" min="0"></div>
        <div class="form-campo"><label>Descuento (%)</label><input id="_e_descuento" type="number" value="${datos.descuento||0}" min="0" max="99"></div>
      </div>
      <div class="form-campo">
        <label>Precio por docena ($)</label>
        <input id="_e_precioDocena" type="number" value="${datos.precioDocena||0}" min="0">
      </div>
      <div class="form-campo">
        <label>Precio por 6 unidades ($)</label>
        <input id="_e_precio6unidades" type="number" value="${datos.precio6unidades||0}" min="0">
      </div>
      <div class="form-campo">
        <label>Precio por 3 unidades ($)</label>
        <input id="_e_precio3unidades" type="number" value="${datos.precio3unidades||0}" min="0">
      </div>
      <div class="form-campo"><label>URL de imagen</label><input id="_e_imagen" type="url" value="${escapeHTML(datos.imagenURL||'')}" placeholder="https://..."></div>
      <div style="display:flex;flex-direction:column;gap:8px;padding:6px 0;">
        <label style="display:flex;align-items:center;gap:8px;font-size:.84rem;color:var(--gris-l);cursor:pointer;"><input type="checkbox" id="_e_oferta" ${datos.oferta ? 'checked' : ''}> En oferta</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:.84rem;color:var(--gris-l);cursor:pointer;"><input type="checkbox" id="_e_disponible" ${datos.disponible !== false ? 'checked' : ''}> Disponible</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:.84rem;color:var(--gris-l);cursor:pointer;"><input type="checkbox" id="_e_esBebida" ${datos.esBebida ? 'checked' : ''}> 🥤 Es una bebida</label>
      </div>
    </div>`;
  abrirModal(html, () => {
    const nombre = $id('_e_nombre')?.value.trim(), categoria = $id('_e_categoria')?.value.trim();
    const precio = Number($id('_e_precio')?.value) || 0, descuento = Number($id('_e_descuento')?.value) || 0;
    const descripcion = $id('_e_descripcion')?.value.trim() || '';
    const imagenURL = $id('_e_imagen')?.value.trim() || '';
    const oferta = $id('_e_oferta')?.checked ?? false;
    const disponible = $id('_e_disponible')?.checked ?? true;
    const esBebida = $id('_e_esBebida')?.checked ?? false;
    const precioDocena = Number($id('_e_precioDocena')?.value) || 0;
    const precio3unidades = Number($id('_e_precio3unidades')?.value) || 0;
    const precio6unidades = Number($id('_e_precio6unidades')?.value) || 0;
    if (!nombre || !categoria) { toast('Completá nombre y categoría', 'error'); return false; }
    if (!precio && !precioDocena && !precio3unidades && !precio6unidades) { toast('Completá al menos un precio', 'error'); return false; }
    updateDoc(doc(db, 'productos', id), {
      nombre, categoria, descripcion, precio, descuento, oferta, disponible, esBebida, imagenURL,
      precioDocena: precioDocena > 0 ? precioDocena : null,
      precio3unidades: precio3unidades > 0 ? precio3unidades : null,
      precio6unidades: precio6unidades > 0 ? precio6unidades : null
    })
      .then(() => { toast('✓ Producto actualizado'); cargarProductos(); })
      .catch(err => { console.error(err); toast('Error al guardar', 'error'); });
    return true;
  });
}

window.eliminarProducto = async (id, nombre) => {
  if (!confirm(`¿Eliminar "${nombre}"?`)) return;
  try {
    await deleteDoc(doc(db, 'productos', id));
    toast(`✓ "${nombre}" eliminado`);
    cargarProductos();
  } catch (err) {
    console.error(err);
    toast('Error al eliminar', 'error');
  }
};

// ═══ PEDIDOS + STATS + RANKING ═══
async function cargarPedidos() {
  const lista = $id('lista-pedidos');
  if (!lista) return;
  lista.innerHTML = `<p style="color:var(--gris);text-align:center;padding:30px 0;font-size:.85rem;">Cargando...</p>`;
  try {
    const snap = await getDocs(collection(db, 'pedidos'));
    let totalPedidos = 0, ventasTotales = 0, pedidosPendientes = 0, pedidosEntregados = 0;
    let pedidosHoy = 0, ventasHoy = 0, ventasMes = 0;
    const contadorProductos = {};
    const hoy = new Date(), dHoy = hoy.toDateString(), mes = hoy.getMonth(), anio = hoy.getFullYear();

    if (snap.empty) {
      lista.innerHTML = `<p style="color:var(--gris);text-align:center;padding:30px 0;font-size:.85rem;">Sin pedidos aún</p>`;
      actualizarStats({ totalPedidos:0, ventasTotales:0, pedidosPendientes:0, pedidosEntregados:0, pedidosHoy:0, ventasHoy:0, ventasMes:0, ticketPromedio:0 });
      renderRanking({});
      return;
    }

    lista.innerHTML = '';
    snap.forEach(documento => {
      const pedido = documento.data(), id = documento.id;
      const fecha = pedido.fecha ? new Date(pedido.fecha) : null;

      totalPedidos++;
      ventasTotales += pedido.total || 0;
      if (pedido.estado === 'pendiente') pedidosPendientes++;
      if (pedido.estado === 'entregado') pedidosEntregados++;
      if (fecha) {
        if (fecha.toDateString() === dHoy) { pedidosHoy++; ventasHoy += pedido.total || 0; }
        if (fecha.getMonth() === mes && fecha.getFullYear() === anio) ventasMes += pedido.total || 0;
      }

      (pedido.productos||[]).forEach(p => {
        const key = p.nombre || 'Sin nombre';
        contadorProductos[key] = (contadorProductos[key] || 0) + (p.cantidad || 1);
      });

      const card = document.createElement('div'); card.className = 'pedido-card';
      const estadoBadge = { pendiente:'badge-mostaza', preparando:'badge-mostaza', enviado:'badge-gris', entregado:'badge-verde', cancelado:'badge-rojo' }[pedido.estado] || 'badge-gris';
      card.innerHTML = `
        <div class="pedido-header">
          <div>
            <div style="font-weight:600;font-size:.9rem;">${escapeHTML(pedido.clienteNombre||'Sin nombre')}</div>
            <div style="font-size:.72rem;color:var(--gris);">${fecha ? fecha.toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'}) : '—'}</div>
          </div>
          <span class="badge ${estadoBadge}">${pedido.estado||'pendiente'}</span>
        </div>
        ${(pedido.clienteTelefono||pedido.clienteDireccion) ? `
          <div class="pedido-cliente-info">
            ${pedido.clienteTelefono ? `<span>📱 ${escapeHTML(pedido.clienteTelefono)}</span>` : ''}
            ${pedido.clienteDireccion ? `<span>📍 ${escapeHTML(pedido.clienteDireccion)}</span>` : ''}
            ${pedido.clienteObservaciones ? `<span style="color:var(--gris);">📝 ${escapeHTML(pedido.clienteObservaciones)}</span>` : ''}
          </div>` : ''}
        <ul class="pedido-productos">
          ${(pedido.productos||[]).map(p => `<li><span>${p.cantidad}x <strong>${escapeHTML(p.nombre)}</strong></span><span style="color:var(--gris);">$${formatPrice(p.precio * p.cantidad)}</span></li>`).join('')}
        </ul>
        <div class="pedido-footer">
          <div class="pedido-total">$${formatPrice(pedido.total||0)}</div>
          <select class="select-estado" data-id="${id}">
            ${['pendiente','preparando','enviado','entregado','cancelado'].map(e => `<option value="${e}" ${pedido.estado===e?'selected':''}>${ {pendiente:'Pendiente',preparando:'Preparando',enviado:'Enviado',entregado:'Entregado',cancelado:'Cancelado'}[e] }</option>`).join('')}
          </select>
          <button class="btn btn-danger btn-sm" style="margin-left:8px;" onclick="window.eliminarPedido('${id}')">🗑️</button>
        </div>`;

      card.querySelector('.select-estado').addEventListener('change', async (e) => {
        try {
          await updateDoc(doc(db, 'pedidos', id), { estado: e.target.value });
          card.querySelector('.badge').className = `badge ${ {pendiente:'badge-mostaza',preparando:'badge-mostaza',enviado:'badge-gris',entregado:'badge-verde',cancelado:'badge-rojo'}[e.target.value] }`;
          card.querySelector('.badge').textContent = e.target.value;
          toast(`✓ Estado actualizado a "${e.target.value}"`);
        } catch (err) { console.error(err); toast('Error al cambiar estado', 'error'); }
      });

      lista.appendChild(card);
    });

    const ticketPromedio = totalPedidos > 0 ? Math.round(ventasTotales / totalPedidos) : 0;
    actualizarStats({ totalPedidos, ventasTotales, pedidosPendientes, pedidosEntregados, pedidosHoy, ventasHoy, ventasMes, ticketPromedio });
    renderRanking(contadorProductos);
  } catch (err) {
    console.error(err);
    lista.innerHTML = `<p style="color:var(--rojo);padding:20px 0;font-size:.85rem;">Error cargando pedidos</p>`;
  }
}

function actualizarStats(s) {
  const set = (id, val) => { const el = $id(id); if (el) el.textContent = typeof val === 'number' ? val.toLocaleString('es-AR') : val; };
  set('total-pedidos', s.totalPedidos);
  set('ventas-totales', s.ventasTotales);
  set('pedidos-pendientes', s.pedidosPendientes);
  set('pedidos-entregados', s.pedidosEntregados);
  set('pedidos-hoy', s.pedidosHoy);
  set('ventas-hoy', s.ventasHoy);
  set('ventas-mes', s.ventasMes);
  set('ticket-promedio', s.ticketPromedio);
}

function renderRanking(contador) {
  const cont = $id('productos-mas-vendidos');
  if (!cont) return;
  const ranking = Object.entries(contador).sort((a,b) => b[1]-a[1]).slice(0,8);
  if (!ranking.length) {
    cont.innerHTML = `<p style="color:var(--gris);font-size:.85rem;">Sin datos de ventas aún</p>`;
    return;
  }
  cont.innerHTML = ranking.map(([nombre, cant], i) => `
    <div class="ranking-row">
      <span class="ranking-pos">${i+1}</span>
      <span class="ranking-nombre">${escapeHTML(nombre)}</span>
      <span class="ranking-cant">${cant} vendido${cant!==1?'s':''}</span>
    </div>`).join('');
}

// ═══ CLIENTES ═══
window.agregarCliente = async () => {
  const nombre   = val('cliente-nombre');
  const telefono = val('cliente-telefono');
  if (!nombre || !telefono) { toast('Completá nombre y teléfono', 'error'); return; }
  try {
    await addDoc(collection(db, 'clientes'), { nombre, telefono, fechaRegistro: new Date().toISOString() });
    limpiarForm('cliente-nombre','cliente-telefono');
    toast('✓ Cliente agregado');
    cargarClientes();
  } catch (err) { console.error(err); toast('Error al agregar cliente', 'error'); }
};

async function cargarClientes(filtro = '') {
  const lista = $id('lista-clientes');
  if (!lista) return;
  try {
    const snap = await getDocs(collection(db, 'clientes'));
    const clientes = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => !filtro || c.nombre?.toLowerCase().includes(filtro.toLowerCase()));
    if (!clientes.length) {
      lista.innerHTML = `<p style="color:var(--gris);font-size:.85rem;padding:20px 0;">${filtro ? 'Sin resultados' : 'Sin clientes aún'}</p>`;
      return;
    }
    lista.innerHTML = '';
    clientes.forEach(c => {
      const div = document.createElement('div'); div.className = 'cliente-card';
      div.innerHTML = `
        <div class="cliente-nombre">${escapeHTML(c.nombre)}</div>
        <div class="cliente-tel">📱 ${escapeHTML(c.telefono)}</div>
        <div class="cliente-acciones">
          <button class="btn btn-success btn-sm" data-promo="${escapeHTML(c.telefono)}">📣 Promo</button>
          <button class="btn btn-danger  btn-sm" data-del="${c.id}" data-nombre="${escapeHTML(c.nombre)}">🗑️</button>
        </div>`;
      div.querySelector('[data-promo]').onclick = (e) => enviarPromo(e.target.dataset.promo);
      div.querySelector('[data-del]').onclick   = (e) => eliminarCliente(e.target.dataset.del, e.target.dataset.nombre);
      lista.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    lista.innerHTML = `<p style="color:var(--rojo);font-size:.85rem;padding:20px 0;">Error cargando clientes</p>`;
  }
}

async function eliminarCliente(id, nombre) {
  if (!confirm(`¿Eliminar a "${nombre}"?`)) return;
  try { await deleteDoc(doc(db, 'clientes', id)); toast(`✓ "${nombre}" eliminado`); cargarClientes(); }
  catch (err) { console.error(err); toast('Error al eliminar', 'error'); }
}

function enviarPromo(telefono) {
  const html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><strong style="font-size:1rem;">Enviar promoción</strong></div>
    <div class="form-campo">
      <label>Mensaje</label>
      <textarea id="_promo_msg" rows="4" style="background:var(--grafito);border:1px solid var(--humo);border-radius:6px;padding:10px 12px;color:var(--crema);font-family:'Inter',sans-serif;font-size:.85rem;outline:none;width:100%;resize:none;" placeholder="Ej: ¡Hola! Esta semana 20% de descuento en todos los combos 🔥"></textarea>
    </div>`;
  abrirModal(html, () => {
    const msg = $id('_promo_msg')?.value.trim();
    if (!msg) { toast('Escribí un mensaje', 'error'); return false; }
    window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(msg)}`, '_blank');
    return true;
  });
}

$id('buscar-cliente')?.addEventListener('input', e => cargarClientes(e.target.value));

// ══════════════════════════════════════
//  CONFIGURACIÓN DEL SITIO (CMS)
// ══════════════════════════════════════
const CONFIG_DOC_ID = 'siteConfig';

async function cargarConfiguracion() {
  try {
    const docSnap = await getDocs(collection(db, 'config'));
    let data = {};
    docSnap.forEach(doc => {
      if (doc.id === CONFIG_DOC_ID) data = doc.data();
    });

    document.getElementById('cfg-heroTitle').value       = data.heroTitle || '';
    document.getElementById('cfg-heroSubtitle').value    = data.heroSubtitle || '';
    document.getElementById('cfg-heroChipText').value    = data.heroChipText || '';
    document.getElementById('cfg-heroImageURL').value    = data.heroImageURL || '';
    document.getElementById('cfg-promoBannerText').value = data.promoBannerText || '';
    document.getElementById('cfg-footerDesc').value      = data.footerDesc || '';
    document.getElementById('cfg-contactPhone').value    = data.contactPhone || '';
    document.getElementById('cfg-contactInstagram').value= data.contactInstagram || '';
    document.getElementById('cfg-horariosLunesViernes').value = data.horariosLunesViernes || '';
    document.getElementById('cfg-horariosSabados').value = data.horariosSabados || '';
  } catch (err) {
    console.error('Error cargando configuración:', err);
  }
}

window.guardarConfiguracion = async () => {
  const data = {
    heroTitle:       document.getElementById('cfg-heroTitle').value.trim(),
    heroSubtitle:    document.getElementById('cfg-heroSubtitle').value.trim(),
    heroChipText:    document.getElementById('cfg-heroChipText').value.trim(),
    heroImageURL:    document.getElementById('cfg-heroImageURL').value.trim(),
    promoBannerText: document.getElementById('cfg-promoBannerText').value.trim(),
    footerDesc:      document.getElementById('cfg-footerDesc').value.trim(),
    contactPhone:    document.getElementById('cfg-contactPhone').value.trim(),
    contactInstagram:document.getElementById('cfg-contactInstagram').value.trim(),
    horariosLunesViernes: document.getElementById('cfg-horariosLunesViernes').value.trim(),
    horariosSabados: document.getElementById('cfg-horariosSabados').value.trim(),
  };

  try {
    const docRef = doc(db, 'config', 'siteConfig');
    await setDoc(docRef, data, { merge: true });
    document.getElementById('cfg-status').textContent = '✓ Configuración guardada';
    setTimeout(() => document.getElementById('cfg-status').textContent = '', 2500);
  } catch (err) {
    console.error('Error guardando configuración:', err);
    toast('Error al guardar configuración', 'error');
  }
};

cargarConfiguracion();

window.eliminarPedido = async (id) => {
  if (!confirm('¿Eliminar este pedido permanentemente?')) return;
  try {
    await deleteDoc(doc(db, 'pedidos', id));
    toast('✓ Pedido eliminado');
    cargarPedidos();
  } catch (err) {
    console.error(err);
    toast('Error al eliminar pedido', 'error');
  }
};

// ══════════════════════════════════════
//  RECOMPENSAS
// ══════════════════════════════════════

window.agregarRecompensa = async () => {
  const umbralPuntos = numVal('rec-umbralPuntos');
  const descripcion  = val('rec-descripcion');
  const mensaje      = val('rec-mensaje');

  if (!umbralPuntos || !descripcion) {
    toast('Completá umbral en puntos y descripción', 'error');
    return;
  }

  try {
    await addDoc(collection(db, 'recompensas'), {
      umbralPuntos,
      descripcion,
      mensaje: mensaje || `Quiero canjear mi recompensa: ${descripcion}`,
    });
    limpiarForm('rec-umbralPuntos','rec-descripcion','rec-mensaje');
    toast('✓ Recompensa agregada');
    cargarRecompensas();
  } catch (err) {
    console.error(err);
    toast('Error al agregar recompensa', 'error');
  }
};

async function cargarRecompensas() {
  const lista = document.getElementById('lista-recompensas');
  if (!lista) return;

  try {
    const snap = await getDocs(collection(db, 'recompensas'));
    const recompensas = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => a.umbralPuntos - b.umbralPuntos);

    if (!recompensas.length) {
      lista.innerHTML = `<p style="color:var(--gris); font-size:.85rem; padding:20px 0;">No hay recompensas configuradas</p>`;
      return;
    }

    lista.innerHTML = recompensas.map(r => `
      <div class="prod-admin-row" style="justify-content:space-between;">
        <div>
          <strong>${r.umbralPuntos} pts</strong>
          <span style="margin-left:12px; color:var(--gris-l);">${r.descripcion}</span>
        </div>
        <button class="btn btn-danger btn-sm" onclick="eliminarRecompensa('${r.id}')">🗑️</button>
      </div>
    `).join('');

  } catch (err) {
    console.error(err);
    lista.innerHTML = `<p style="color:var(--rojo);">Error cargando recompensas</p>`;
  }
}

window.eliminarRecompensa = async (id) => {
  if (!confirm('¿Eliminar esta recompensa?')) return;
  try {
    await deleteDoc(doc(db, 'recompensas', id));
    toast('✓ Recompensa eliminada');
    cargarRecompensas();
  } catch (err) {
    console.error(err);
    toast('Error al eliminar', 'error');
  }
};

cargarRecompensas();

// ══════════════════════════════════════
//  MÉTRICAS DE PUNTOS — usuarios y canjes
// ══════════════════════════════════════
// MEJORA: antes no existía ninguna vista de quién tiene puntos
// acumulados ni de qué canjes se hicieron. Todo lo que sigue lee
// /usuarios (cuentas con puntos) y /movimientosPuntos (historial
// de puntos ganados/canjeados, que ahora se registra desde
// index.html en cada pedido y en cada canje).
async function cargarMetricasPuntos() {
  const elUsuarios     = $id('lista-usuarios-puntos');
  const elCanjes       = $id('lista-canjes');
  const statUsuarios   = $id('rec-stat-usuarios');
  const statCirculacion = $id('rec-stat-circulacion');
  const statCanjes     = $id('rec-stat-canjes');
  const statPendientes = $id('rec-stat-pendientes');
  if (!elUsuarios) return;

  try {
    const [usuariosSnap, movimientosSnap] = await Promise.all([
      getDocs(collection(db, 'usuarios')),
      getDocs(collection(db, 'movimientosPuntos')),
    ]);

    const usuarios = usuariosSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => (u.puntos || 0) > 0 || (u.dineroAcumulado || 0) > 0)
      .sort((a, b) => (b.puntos || 0) - (a.puntos || 0));

    const movimientos = movimientosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const canjes = movimientos
      .filter(m => m.tipo === 'canjeado')
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    // ── Métricas reales ──
    const puntosEnCirculacion = usuariosSnap.docs.reduce((suma, d) => suma + (d.data().puntos || 0), 0);
    const canjesPendientes = canjes.filter(c => c.estado === 'pendiente').length;

    if (statUsuarios)    statUsuarios.textContent    = usuarios.length;
    if (statCirculacion) statCirculacion.textContent = puntosEnCirculacion.toLocaleString('es-AR');
    if (statCanjes)      statCanjes.textContent      = canjes.length;
    if (statPendientes)  statPendientes.textContent  = canjesPendientes;

    // ── Lista de usuarios con puntos ──
    if (!usuarios.length) {
      elUsuarios.innerHTML = `<p style="color:var(--gris); font-size:.85rem; padding:20px 0;">Todavía no hay clientes con puntos acumulados.</p>`;
    } else {
      elUsuarios.innerHTML = usuarios.map(u => `
        <div class="prod-admin-row" style="justify-content:space-between;">
          <div>
            <strong>${escapeHTML(u.nombreUsuario || u.email || 'Cliente sin nombre')}</strong>
            ${u.email ? `<span style="margin-left:12px; color:var(--gris-l); font-size:.78rem;">${escapeHTML(u.email)}</span>` : ''}
            <div style="color:var(--gris-l); font-size:.78rem; margin-top:2px;">Total gastado: $${formatPrice(u.dineroAcumulado || 0)}</div>
          </div>
          <div style="text-align:right;">
            <strong style="color:var(--mostaza);">${(u.puntos || 0).toLocaleString('es-AR')} pts</strong>
          </div>
        </div>
      `).join('');
    }

    // ── Lista de canjes (verificación anti-abuso) ──
    if (!canjes.length) {
      elCanjes.innerHTML = `<p style="color:var(--gris); font-size:.85rem; padding:20px 0;">Todavía no hay canjes registrados.</p>`;
    } else {
      elCanjes.innerHTML = canjes.slice(0, 50).map(c => `
        <div class="prod-admin-row" style="justify-content:space-between;">
          <div>
            <strong style="letter-spacing:.08em;">${escapeHTML(c.codigo || '—')}</strong>
            <span style="margin-left:12px;">${escapeHTML(c.motivo || '')}</span>
            <div style="color:var(--gris-l); font-size:.78rem; margin-top:2px;">
              ${escapeHTML(c.clienteNombre || 'Cliente')} · ${c.puntos || 0} pts · ${new Date(c.fecha).toLocaleDateString()}
            </div>
          </div>
          <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
            <span class="badge ${c.estado === 'entregado' ? 'badge-verde' : 'badge-gris'}">${c.estado === 'entregado' ? 'Entregado' : 'Pendiente'}</span>
            ${c.estado !== 'entregado' ? `<button class="btn btn-primary btn-sm" onclick="marcarCanjeEntregado('${c.id}')">Marcar entregado</button>` : ''}
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error(err);
    elUsuarios.innerHTML = `<p style="color:var(--rojo);">Error cargando usuarios con puntos</p>`;
    if (elCanjes) elCanjes.innerHTML = `<p style="color:var(--rojo);">Error cargando canjes</p>`;
  }
}

window.marcarCanjeEntregado = async (id) => {
  try {
    await updateDoc(doc(db, 'movimientosPuntos', id), { estado: 'entregado' });
    toast('✓ Canje marcado como entregado');
    cargarMetricasPuntos();
  } catch (err) {
    console.error(err);
    toast('Error al actualizar el canje', 'error');
  }
};

cargarMetricasPuntos();

// ══════════════════════════════════════
//  CÓDIGOS DE DESCUENTO
// ══════════════════════════════════════

window.agregarCodigoDescuento = async () => {
  const codigo    = val('dc-codigo').toUpperCase().trim();
  const porcentaje = numVal('dc-porcentaje');
  const activo    = document.getElementById('dc-activo')?.checked ?? true;

  if (!codigo || !porcentaje) {
    toast('Completá el código y el porcentaje', 'error');
    return;
  }

  try {
    await addDoc(collection(db, 'descuentos'), {
      codigo,
      porcentaje,
      activo
    });
    limpiarForm('dc-codigo','dc-porcentaje');
    document.getElementById('dc-activo').checked = true;
    toast('✓ Código agregado');
    cargarCodigosDescuento();
  } catch (err) {
    console.error(err);
    toast('Error al agregar código', 'error');
  }
};

async function cargarCodigosDescuento() {
  const lista = document.getElementById('lista-descuentos');
  if (!lista) return;

  try {
    const snap = await getDocs(collection(db, 'descuentos'));
    const codigos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (!codigos.length) {
      lista.innerHTML = `<p style="color:var(--gris); font-size:.85rem; padding:20px 0;">No hay códigos creados</p>`;
      return;
    }

    lista.innerHTML = codigos.map(c => `
      <div class="prod-admin-row" style="justify-content:space-between;">
        <div>
          <strong>${escapeHTML(c.codigo)}</strong>
          <span style="margin-left:12px; color:var(--gris-l);">-${c.porcentaje}%</span>
          <span class="badge ${c.activo ? 'badge-verde' : 'badge-rojo'}">${c.activo ? 'Activo' : 'Inactivo'}</span>
        </div>
        <button class="btn btn-danger btn-sm" onclick="eliminarCodigoDescuento('${c.id}')">🗑️</button>
      </div>
    `).join('');

  } catch (err) {
    console.error(err);
    lista.innerHTML = `<p style="color:var(--rojo);">Error cargando códigos</p>`;
  }
}

window.eliminarCodigoDescuento = async (id) => {
  if (!confirm('¿Eliminar este código?')) return;
  try {
    await deleteDoc(doc(db, 'descuentos', id));
    toast('✓ Código eliminado');
    cargarCodigosDescuento();
  } catch (err) {
    console.error(err);
    toast('Error al eliminar', 'error');
  }
};

cargarCodigosDescuento();

// ═══ INIT ═══
cargarProductos();
cargarPedidos();
cargarClientes();