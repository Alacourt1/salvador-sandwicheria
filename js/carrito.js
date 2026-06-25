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

window._renderCarritoExterno = () => {
  carrito = loadStorage('carrito', []);
  render();
  if (typeof window.sincBadge === 'function') window.sincBadge();
};

window.agregarAlCarrito = (producto) => {
  if (!producto || typeof producto !== 'object') {
    console.error('agregarAlCarrito: esperaba un objeto, recibió:', producto);
    showToast('Error al agregar producto', 'error');
    return;
  }
  const nombre = String(producto.nombre || '').trim();
  const precio = Number(producto.precio);
  const imagen = producto.imagen || '';

  if (!nombre) return;
  if (isNaN(precio) || precio <= 0) {
    showToast('Precio inválido en el producto', 'error');
    return;
  }

  const itemExistente = carrito.find(i => i.nombre === nombre);
  if (itemExistente) {
    itemExistente.cantidad++;
  } else {
    carrito.push({ id: producto.id || '', nombre, precio, cantidad: 1, imagen });
  }
  guardar();
  showToast(`✓ ${nombre} agregado al pedido`);
};

window.cambiarCantidad = (nombre, delta) => {
  const item = carrito.find(i => i.nombre === nombre);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) carrito = carrito.filter(i => i.nombre !== nombre);
  guardar();
};

window.eliminarDelCarrito = (nombre) => {
  carrito = carrito.filter(i => i.nombre !== nombre);
  guardar();
};

window.pedirPorWhatsApp = async () => {
  if (carrito.length === 0) {
    showToast('El carrito está vacío', 'error');
    return;
  }
  const nombre        = $id('clienteNombre')?.value.trim()        || '';
  const telefono      = $id('clienteTelefono')?.value.trim()      || '';
  const direccion     = $id('clienteDireccion')?.value.trim()     || '';
  const observaciones = $id('clienteObservaciones')?.value.trim() || '';
  let total = carrito.reduce((suma, item) => suma + item.precio * item.cantidad, 0);
  let descuentoAplicado = 0;
  if (window.codigoDescuento && window.codigoDescuento.porcentaje) {
    descuentoAplicado = Math.round(total * window.codigoDescuento.porcentaje / 100);
    total -= descuentoAplicado;
  }

  try {
    await addDoc(collection(db, 'pedidos'), {
      clienteNombre: nombre,
      clienteTelefono: telefono,
      clienteDireccion: direccion,
      clienteObservaciones: observaciones,
      productos: carrito,
      total,
      fecha: new Date().toISOString(),
      estado: 'pendiente',
      codigoDescuento: window.codigoDescuento || null,
      totalConDescuento: total
    });
  } catch (err) {
    console.error('Error al guardar pedido:', err);
    showToast('Error al guardar el pedido. Intentá nuevamente.', 'error');
    return;
  }

  const lineas = carrito.map(item => `• ${item.cantidad}x ${item.nombre} — $${formatPrice(item.precio * item.cantidad)}`);
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
    partes.push(`💰 Total con descuento: $${formatPrice(total)}`);
  } else {
    partes.push(`*Total: $${formatPrice(total)}*`);
  }

  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(partes.join('\n'))}`, '_blank');
  carrito = [];
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
    return `
      <div class="item-carrito">
        <div class="item-thumb">${thumbHTML}</div>
        <div class="item-info">
          <div class="item-nombre">${esc(item.nombre)}</div>
          <div class="item-precio-unit">$${formatPrice(precio)} c/u</div>
        </div>
        <div class="item-controles">
          <button class="ctrl-btn" onclick="cambiarCantidad('${esc(item.nombre)}', -1)">−</button>
          <span class="ctrl-cantidad">${cantidad}</span>
          <button class="ctrl-btn" onclick="cambiarCantidad('${esc(item.nombre)}', 1)">+</button>
        </div>
        <div class="item-subtotal">$${formatPrice(subtotal)}</div>
        <button class="btn-quitar-item" onclick="eliminarDelCarrito('${esc(item.nombre)}')" title="Quitar">✕</button>
      </div>`;
  }).join('');
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// ═══ APLICAR CÓDIGO DE DESCUENTO ═══
async function aplicarCodigoDescuento() {
  const input = document.getElementById('codigoDescuentoInput');
  const mensajeEl = document.getElementById('codigoDescuentoMensaje');
  const codigo = input?.value.trim().toUpperCase();

  if (!codigo) {
    mensajeEl.textContent = 'Ingresá un código válido';
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