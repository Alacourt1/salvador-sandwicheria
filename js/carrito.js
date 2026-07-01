import { db, collection, addDoc, getDocs } from './firebase.js';
import { saveStorage, loadStorage } from './utils/storage.js';
import { showToast } from './utils/toast.js';
import { $id } from './utils/dom.js';

// ── Utilidades integradas (evita errores de importación) ──
function formatPrice(value) {
  const num = Number(value);
  if (isNaN(num)) return '0';
  return num.toLocaleString('es-AR');
}
// ───────────────────────────────────────────

const WHATSAPP_NUMBER = '5492215376246';
let carrito = loadStorage('carrito', []);
window.codigoDescuento = null;

function guardar() {
  saveStorage('carrito', carrito);
  render();
  if (typeof window.sincBadge === 'function') window.sincBadge();
}

function limpiarDescuentoSiVacio() {
  if (carrito.length === 0 && window.codigoDescuento) {
    window.codigoDescuento = null;
    const inputCodigo = document.getElementById('codigoDescuentoInput');
    const mensajeEl   = document.getElementById('codigoDescuentoMensaje');
    const infoEl      = document.getElementById('codigoDescuentoInfo');
    if (inputCodigo) inputCodigo.value = '';
    if (mensajeEl)   mensajeEl.textContent = '';
    if (infoEl)      infoEl.style.display = 'none';
  }
}

window._renderCarritoExterno = () => {
  carrito = loadStorage('carrito', []);
  render();
  if (typeof window.sincBadge === 'function') window.sincBadge();
};

/**
 * Clave única de ítem dentro del carrito.
 * FIX: antes la clave era solo `nombre`, así que si el cliente
 * agregaba el mismo producto en dos presentaciones distintas
 * (ej: 1 unidad suelta Y 1 pack x3), ambas se mezclaban en la
 * misma línea, sumando cantidades de cosas que en realidad
 * cuestan distinto. Ahora la clave combina nombre + etiqueta de
 * presentación, así "Sánguche de jamón (Unidad)" y "Sánguche de
 * jamón (Pack x3)" son líneas completamente separadas.
 */
function claveItem(nombre, presentacionEtiqueta) {
  return `${nombre}__${presentacionEtiqueta || 'unico'}`;
}

/**
 * Agrega un producto al carrito. Acepta tanto el formato simple
 * de antes (producto sin presentación explícita, para no romper
 * compatibilidad si algún llamador externo lo sigue usando) como
 * el nuevo formato con presentación y cantidad inicial, que es el
 * que ahora usa el modal de selección en menu.js / index.html.
 *
 * @param {Object} producto
 * @param {string} producto.nombre
 * @param {number} producto.precio           Precio unitario de ESA presentación
 * @param {string} [producto.imagen]
 * @param {string} [producto.id]
 * @param {string} [producto.presentacionEtiqueta]  Ej: "Unidad", "Pack x3"
 * @param {number} [producto.presentacionUnidades]  Ej: 1, 3, 6, 12
 * @param {number} [cantidadInicial]  Cuántas veces agregar de una — default 1
 */
window.agregarAlCarrito = (producto, cantidadInicial = 1) => {
  if (!producto || typeof producto !== 'object') {
    console.error('agregarAlCarrito: esperaba un objeto, recibió:', producto);
    showToast('Error al agregar producto', 'error');
    return;
  }
  const nombre   = String(producto.nombre || '').trim();
  const precio   = Number(producto.precio);
  const imagen   = producto.imagen || '';
  const etiqueta = producto.presentacionEtiqueta || null;
  const unidadesPorPresentacion = Number(producto.presentacionUnidades) || 1;
  const cantidad = Math.max(1, Math.floor(Number(cantidadInicial) || 1));

  if (!nombre) return;
  if (isNaN(precio) || precio <= 0) {
    showToast('Precio inválido en el producto', 'error');
    return;
  }

  const clave = claveItem(nombre, etiqueta);
  const itemExistente = carrito.find(i => i.clave === clave);

  if (itemExistente) {
    itemExistente.cantidad += cantidad;
    itemExistente.precio = precio;
  } else {
    carrito.push({
      clave,
      id: producto.id || '',
      nombre,
      precio,
      cantidad,
      imagen,
      presentacionEtiqueta: etiqueta,
      presentacionUnidades: unidadesPorPresentacion,
    });
  }
  guardar();

  const detalle = etiqueta ? ` (${etiqueta})` : '';
  showToast(`✓ ${nombre}${detalle} agregado al pedido`);
};

window.cambiarCantidad = (clave, delta) => {
  const item = carrito.find(i => i.clave === clave);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) carrito = carrito.filter(i => i.clave !== clave);
  limpiarDescuentoSiVacio();
  guardar();
};

window.eliminarDelCarrito = (clave) => {
  carrito = carrito.filter(i => i.clave !== clave);
  limpiarDescuentoSiVacio();
  guardar();
};

window.pedirPorWhatsApp = async () => {
  if (carrito.length === 0) {
    showToast('El carrito está vacío', 'error');
    return;
  }

  const inputNombre   = $id('clienteNombre');
  const nombre        = inputNombre?.value.trim()                  || '';
  const telefono      = $id('clienteTelefono')?.value.trim()      || '';
  const direccion     = $id('clienteDireccion')?.value.trim()     || '';
  const observaciones = $id('clienteObservaciones')?.value.trim() || '';

  // FIX: antes no había ningún bloqueo — se podía confirmar un
  // pedido por WhatsApp con el formulario de datos completamente
  // vacío. Ahora el nombre es obligatorio: si falta, se abre el
  // formulario colapsado (si estaba cerrado) y se enfoca el
  // campo, para que el cliente vea de inmediato qué falta
  // completar en vez de solo recibir un mensaje de error genérico.
  if (!nombre) {
    const drawerClienteBar = document.getElementById('drawerClienteBar');
    const drawerCliente    = document.getElementById('drawerCliente');
    if (drawerCliente && !drawerCliente.classList.contains('expandido')) {
      drawerClienteBar?.classList.add('expandido');
      drawerCliente.classList.add('expandido');
    }
    inputNombre?.focus();
    inputNombre?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('Completá tu nombre antes de confirmar el pedido', 'error');
    return;
  }

  const subtotal = carrito.reduce((suma, item) => suma + item.precio * item.cantidad, 0);
  let total = subtotal;
  let descuentoAplicado = 0;
  if (window.codigoDescuento && window.codigoDescuento.porcentaje) {
    descuentoAplicado = Math.round(subtotal * window.codigoDescuento.porcentaje / 100);
    total -= descuentoAplicado;
  }

  try {
    await addDoc(collection(db, 'pedidos'), {
      clienteNombre: nombre,
      clienteTelefono: telefono,
      clienteDireccion: direccion,
      clienteObservaciones: observaciones,
      productos: carrito,
      subtotal,
      descuentoAplicado,
      total,
      fecha: new Date().toISOString(),
      estado: 'pendiente',
      codigoDescuento: window.codigoDescuento || null,
    });
  } catch (err) {
    console.error('Error al guardar pedido:', err);
    showToast('Error al guardar el pedido. Intentá nuevamente.', 'error');
    return;
  }

  // FIX: cada línea del mensaje de WhatsApp ahora incluye la
  // presentación cuando corresponde, para que el local sepa
  // exactamente qué armar (ej: "2x Sánguche de jamón (Pack x3)"
  // en vez de un genérico "2x Sánguche de jamón" que podía
  // confundirse con 2 unidades sueltas).
  const lineas = carrito.map(item => {
    const detalle = item.presentacionEtiqueta ? ` (${item.presentacionEtiqueta})` : '';
    return `• ${item.cantidad}x ${item.nombre}${detalle} — $${formatPrice(item.precio * item.cantidad)}`;
  });

  const partes = [
    '🥖 *Nuevo pedido — Salvador Sanguchería*',
    '',
    ...lineas,
    '─────────────────',
    nombre ? `👤 Nombre: ${nombre}` : null,
    telefono ? `📱 Tel: ${telefono}` : null,
    direccion ? `📍 Dirección: ${direccion}` : null,
    observaciones ? `📝 Obs: ${observaciones}` : null,
  ].filter(Boolean);

  if (window.codigoDescuento) {
    partes.push(`🏷️ Código: ${window.codigoDescuento.codigo} (-${window.codigoDescuento.porcentaje}%)`);
    partes.push(`💰 Subtotal: $${formatPrice(subtotal)}`);
    partes.push(`💰 Total con descuento: $${formatPrice(total)}`);
  } else {
    partes.push(`*Total: $${formatPrice(total)}*`);
  }

  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(partes.join('\n'))}`, '_blank');

  carrito = [];
  window.codigoDescuento = null;
  guardar();
  showToast('¡Pedido enviado! 🚀');
};

function render() {
  const cont = $id('carrito');
  if (!cont) return;
  if (carrito.length === 0) {
    cont.innerHTML = `<div class="drawer-vacio"><div class="drawer-vacio-icono">🛒</div><p>Tu carrito está vacío</p><small>Agregá productos del menú</small></div>`;
    return;
  }
  cont.innerHTML = carrito.map(item => {
    const precio   = Number(item.precio)   || 0;
    const cantidad = Number(item.cantidad) || 1;
    const subtotal = precio * cantidad;
    const thumbHTML = item.imagen ? `<img src="${item.imagen}" alt="${esc(item.nombre)}" style="width:100%;height:100%;object-fit:cover;">` : '🥖';

    // Muestra la presentación debajo del nombre cuando existe,
    // para que el cliente vea con claridad qué eligió.
    const presentacionHTML = item.presentacionEtiqueta
      ? `<div class="item-presentacion">${esc(item.presentacionEtiqueta)}</div>`
      : '';

    return `
      <div class="item-carrito">
        <div class="item-thumb">${thumbHTML}</div>
        <div class="item-info">
          <div class="item-nombre">${esc(item.nombre)}</div>
          ${presentacionHTML}
          <div class="item-precio-unit">$${formatPrice(precio)} c/u</div>
        </div>
        <div class="item-controles">
          <button class="ctrl-btn" onclick="cambiarCantidad('${esc(item.clave)}', -1)">−</button>
          <span class="ctrl-cantidad">${cantidad}</span>
          <button class="ctrl-btn" onclick="cambiarCantidad('${esc(item.clave)}', 1)">+</button>
        </div>
        <div class="item-subtotal">$${formatPrice(subtotal)}</div>
        <button class="btn-quitar-item" onclick="eliminarDelCarrito('${esc(item.clave)}')" title="Quitar">✕</button>
      </div>`;
  }).join('');
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// ═══ APLICAR CÓDIGO DE DESCUENTO ═══
async function aplicarCodigoDescuento() {
  const input     = document.getElementById('codigoDescuentoInput');
  const mensajeEl = document.getElementById('codigoDescuentoMensaje');
  const codigo    = input?.value.trim().toUpperCase();

  if (!codigo) {
    mensajeEl.textContent = 'Ingresá un código válido';
    return;
  }
  if (carrito.length === 0) {
    mensajeEl.textContent = 'Agregá productos antes de aplicar un código';
    return;
  }

  try {
    const snap = await getDocs(collection(db, 'descuentos'));
    let encontrado = false;
    snap.forEach(doc => {
      const data = doc.data();
      if (data.codigo === codigo && data.activo) {
        window.codigoDescuento = { codigo: data.codigo, porcentaje: data.porcentaje };
        encontrado = true;
      }
    });

    if (encontrado) {
      mensajeEl.textContent = `✓ Código aplicado: ${window.codigoDescuento.porcentaje}% de descuento`;
      document.getElementById('codigoPorcentaje').textContent = window.codigoDescuento.porcentaje;
      document.getElementById('codigoDescuentoInfo').style.display = 'block';
      guardar();
    } else {
      window.codigoDescuento = null;
      mensajeEl.textContent = 'Código inválido o inactivo';
      document.getElementById('codigoDescuentoInfo').style.display = 'none';
      guardar();
    }
  } catch (err) {
    console.error(err);
    mensajeEl.textContent = 'Error al verificar el código';
  }
}

document.getElementById('aplicarCodigoBtn')?.addEventListener('click', aplicarCodigoDescuento);

render();
if (typeof window.sincBadge === 'function') window.sincBadge();