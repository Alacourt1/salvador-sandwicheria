import { db, auth, collection, addDoc, getDocs, getDoc, doc } from './firebase.js';
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
// MEJORA: evita que dos toques rápidos en "Confirmar pedido" disparen
// dos flujos de pedirPorWhatsApp() en paralelo — cada uno esperando su
// propio modal de upsell de bebida, pero compitiendo por los MISMOS
// botones del DOM. Un click solo puede resolver UNA de las dos
// promesas en danza, dejando a la otra esperando para siempre — eso
// se sentía como que "se trababa" el pedido.
let procesandoPedido = false;

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
  // MEJORA: se guarda si este ítem viene con precio de "Ofertas
  // del día" — lo necesita el cálculo del código de descuento más
  // abajo, para no aplicar el % del código sobre algo que ya tiene
  // un descuento de oferta encima.
  const enOferta = Boolean(producto.enOferta);

  if (itemExistente) {
    itemExistente.cantidad += cantidad;
    itemExistente.precio = precio;
    itemExistente.enOferta = enOferta;
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
      enOferta,
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

// ═══ UPSELL: ofrecer una bebida antes de confirmar ═══
// MEJORA: si el catálogo tiene productos marcados como bebida
// (desde el admin) y el carrito todavía no tiene ninguna, se
// ofrece sumar una antes de mandar el pedido por WhatsApp. Se
// compara por "id" contra el catálogo en vez de guardar un flag
// en el item del carrito, así no se toca la forma de los items
// que ya arma agregarAlCarrito.
function obtenerBebidasDisponibles() {
  const catalogo = window._catalogoActual || [];
  return catalogo.filter(p => p.esBebida && p.disponible !== false && p.precio > 0);
}

function carritoYaTieneBebida(bebidas) {
  return carrito.some(item => bebidas.some(b => b.id && b.id === item.id));
}

function mostrarUpsellBebida() {
  return new Promise((resolve) => {
    const bebidas = obtenerBebidasDisponibles();
    const overlay  = document.getElementById('modalUpsellOverlay');
    const opciones = document.getElementById('upsellOpciones');
    const btnOmitir = document.getElementById('upsellOmitir');

    if (!bebidas.length || carritoYaTieneBebida(bebidas) || !overlay || !opciones || !btnOmitir) {
      resolve(false);
      return;
    }

    opciones.innerHTML = bebidas.slice(0, 4).map((b, i) => `
      <button type="button" class="upsell-opcion-btn" data-i="${i}">
        <span class="upsell-opcion-nombre">${String(b.nombre || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>
        <span class="upsell-opcion-precio">+$${formatPrice(b.precio)}</span>
      </button>
    `).join('');

    overlay.classList.add('show');

    const botones = Array.from(opciones.querySelectorAll('.upsell-opcion-btn'));
    const limpiar = () => {
      overlay.classList.remove('show');
      botones.forEach(b => b.removeEventListener('click', onElegir));
      btnOmitir.removeEventListener('click', onOmitir);
    };
    const onOmitir = () => { limpiar(); resolve(false); };
    const onElegir = (e) => {
      const i = Number(e.currentTarget.dataset.i);
      const b = bebidas[i];
      window.agregarAlCarrito({ id: b.id, nombre: b.nombre, precio: b.precio, imagen: b.imagenURL || '' }, 1);
      limpiar();
      resolve(true);
    };
    botones.forEach(b => b.addEventListener('click', onElegir));
    btnOmitir.addEventListener('click', onOmitir);
  });
}

window.pedirPorWhatsApp = async () => {
  if (procesandoPedido) return; // ya hay un pedido en curso — se ignora el toque extra
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
    // FIX: 'center' podía confundirse entre los distintos
    // contenedores con scroll anidados (drawer-cliente con su
    // propio scroll interno + drawer-items). 'nearest' mueve lo
    // mínimo necesario para que el campo sea visible, sin arriesgar
    // a que el drawer completo se desplace de forma inesperada.
    inputNombre?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    showToast('Completá tu nombre antes de confirmar el pedido', 'error');
    return;
  }

  // MEJORA: bloqueo real contra doble envío — desde acá hasta el
  // "finally" de abajo, un segundo toque al botón no hace nada.
  procesandoPedido = true;
  const btnConfirmar = document.querySelector('.btn-pedir-wa');
  const htmlOriginalBtn = btnConfirmar?.innerHTML;
  if (btnConfirmar) {
    btnConfirmar.disabled = true;
    btnConfirmar.style.opacity = '.6';
    btnConfirmar.style.pointerEvents = 'none';
  }

  try {

  // Se ofrece una bebida ACÁ — antes de calcular subtotal/total,
  // para que si el cliente suma una, quede reflejada en el pedido
  // que se guarda y en el mensaje de WhatsApp.
  await mostrarUpsellBebida();

  const subtotal = carrito.reduce((suma, item) => suma + item.precio * item.cantidad, 0);
  let total = subtotal;
  let descuentoAplicado = 0;
  if (window.codigoDescuento && window.codigoDescuento.porcentaje) {
    // MEJORA: el código de descuento ya NO se aplica sobre
    // productos que vienen de "Ofertas del día" — solo sobre el
    // resto del carrito (catálogo a precio normal). Antes se
    // calculaba sobre el subtotal completo, así que un producto ya
    // rebajado terminaba con DOS descuentos apilados.
    const subtotalSinOferta = carrito.reduce((suma, item) => item.enOferta ? suma : suma + item.precio * item.cantidad, 0);
    descuentoAplicado = Math.round(subtotalSinOferta * window.codigoDescuento.porcentaje / 100);
    total -= descuentoAplicado;
  }

  try {
    await addDoc(collection(db, 'pedidos'), {
      // FIX CRÍTICO: acá faltaba guardar el uid del cliente. El
      // historial "Ver mis pedidos" filtra pedidos comparando
      // contra el uid del usuario logueado — sin este campo, esa
      // comparación nunca daba verdadero y el historial quedaba
      // vacío para siempre, sin importar cuántos pedidos reales
      // tuviera el cliente.
      uid: auth.currentUser?.uid || null,
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

  // FIX CRÍTICO DE SEGURIDAD: acá antes se llamaba a un hook que
  // acreditaba puntos de fidelidad EN EL MOMENTO DE PEDIR, sin que
  // el negocio confirmara ni entregara nada. Eso se podía explotar
  // pidiendo en bucle sin pagar ni retirar nunca nada. Los puntos
  // ahora se acreditan del lado del admin, solo cuando marca el
  // pedido como "entregado" — ver js/admin.js.

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

  } finally {
    // Se ejecuta SIEMPRE — pedido exitoso, error al guardar, o
    // cualquier "return" temprano de acá para abajo — así el botón
    // nunca queda pegado en estado "procesando" para siempre.
    procesandoPedido = false;
    if (btnConfirmar) {
      btnConfirmar.disabled = false;
      btnConfirmar.style.opacity = '';
      btnConfirmar.style.pointerEvents = '';
      if (htmlOriginalBtn) btnConfirmar.innerHTML = htmlOriginalBtn;
    }
  }
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
    const thumbHTML = item.imagen ? `<img src="${esc(item.imagen)}" alt="${esc(item.nombre)}" style="width:100%;height:100%;object-fit:cover;">` : '🥖';

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
  // MEJORA: si todo el carrito son productos de "Ofertas del día",
  // el código no tiene nada sobre qué aplicarse — se avisa de
  // entrada en vez de dejar que parezca que el código no funcionó.
  if (carrito.every(item => item.enOferta)) {
    mensajeEl.textContent = 'Este código no aplica: todo tu carrito ya está en Ofertas del día';
    return;
  }

  try {
    // FIX DE SEGURIDAD: antes esto traía TODA la colección de
    // códigos de descuento al navegador y buscaba la coincidencia
    // en el cliente — cualquiera podía abrir las herramientas de
    // desarrollador y listar TODOS los códigos existentes (activos,
    // inactivos, pensados para un cliente puntual, etc.), sin
    // necesidad de conocer ninguno de antemano. Ahora se pide
    // directamente el documento cuyo ID ES el código — Firestore
    // solo entrega ese código puntual si ya lo escribiste, sin
    // exponer el resto de la colección.
    const codigoSnap = await getDoc(doc(db, 'descuentos', codigo));
    const encontrado = codigoSnap.exists() && codigoSnap.data().activo;

    if (encontrado) {
      const data = codigoSnap.data();
      window.codigoDescuento = { codigo: data.codigo, porcentaje: data.porcentaje };
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