import { db, collection, getDocs } from './firebase.js';
import { $id, $qsa } from './utils/dom.js';

// ── Utilidades integradas (evita errores de importación) ──
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

let productos       = [];
let categoriaActual = 'TODOS';

const grid                = $id('menu-container');
const categoriasContainer = $id('categorias');
const busquedaInput       = $id('busqueda');

async function cargarProductos() {
  mostrarEstado('⏳', 'Cargando menú...');
  try {
    const snap = await getDocs(collection(db, 'productos'));
    productos = snap.docs
      .map(doc => {
        const data = doc.data();
        return {
          id:              doc.id,
          nombre:          data.nombre          || '',
          descripcion:     data.descripcion     || '',
          categoria:       data.categoria        || '',
          precio:          Number(data.precio)          || 0,
          precio3unidades: Number(data.precio3unidades) || 0,
          precio6unidades: Number(data.precio6unidades) || 0,
          precioDocena:    Number(data.precioDocena)    || 0,
          descuento:       Number(data.descuento) || 0,
          oferta:          Boolean(data.oferta),
          disponible:      data.disponible !== false,
          imagenURL:       data.imagenURL || '',
        };
      })
      .filter(p => p.disponible);

    if (!productos.length) {
      mostrarEstado('🥖', 'No hay productos disponibles aún');
      return;
    }

    renderCategorias();
    aplicarFiltros();
    actualizarPromociones();
    actualizarHeroStats();
  } catch (err) {
    console.error('Error cargando productos:', err);
    mostrarEstado('⚠️', 'Error cargando el menú. Revisá tu conexión.');
  }
}

function mostrarEstado(icono, texto) {
  grid.innerHTML = `<div class="estado-menu"><div class="estado-icono">${icono}</div><p>${texto}</p></div>`;
}

function renderCategorias() {
  const cats = ['TODOS', ...new Set(productos.map(p => p.categoria).filter(Boolean))];
  categoriasContainer.innerHTML = '';
  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.textContent = cat === 'TODOS' ? 'Todos' : cat;
    if (cat === categoriaActual) btn.classList.add('activa');
    btn.addEventListener('click', () => {
      categoriaActual = cat;
      $qsa('#categorias button').forEach(b => b.classList.remove('activa'));
      btn.classList.add('activa');
      aplicarFiltros();
    });
    categoriasContainer.appendChild(btn);
  });
}

function aplicarFiltros() {
  const texto = (busquedaInput?.value || '').toLowerCase().trim();
  let lista = [...productos];
  if (categoriaActual !== 'TODOS') lista = lista.filter(p => p.categoria === categoriaActual);
  if (texto) lista = lista.filter(p => p.nombre.toLowerCase().includes(texto) || p.descripcion.toLowerCase().includes(texto));
  renderProductos(lista);
  $id('menuCount').textContent = `${lista.length} producto${lista.length !== 1 ? 's' : ''}`;
}

/**
 * Devuelve la lista de presentaciones disponibles para un
 * producto (x1, x3, x6, x12), cada una con su precio unitario
 * de esa presentación y el precio final ya con descuento si
 * corresponde. Solo incluye las presentaciones que el producto
 * realmente tiene configuradas (precio > 0).
 */
function obtenerPresentaciones(producto) {
  const unit   = producto.precio          || 0;
  const trio   = producto.precio3unidades || 0;
  const seis   = producto.precio6unidades || 0;
  const docena = producto.precioDocena    || 0;
  const tieneOferta = producto.oferta && producto.descuento > 0;

  const presentaciones = [];

  if (unit > 0) {
    const final = tieneOferta ? Math.round(unit * (1 - producto.descuento / 100)) : unit;
    presentaciones.push({
      unidades: 1,
      etiqueta: 'Unidad',
      precioOriginal: unit,
      precioFinal: final,
      tieneOferta,
    });
  }
  if (trio > 0) {
    presentaciones.push({ unidades: 3, etiqueta: 'Pack x3', precioOriginal: trio, precioFinal: trio, tieneOferta: false });
  }
  if (seis > 0) {
    presentaciones.push({ unidades: 6, etiqueta: 'Pack x6', precioOriginal: seis, precioFinal: seis, tieneOferta: false });
  }
  if (docena > 0) {
    presentaciones.push({ unidades: 12, etiqueta: 'Docena (x12)', precioOriginal: docena, precioFinal: docena, tieneOferta: false });
  }

  return presentaciones;
}

function renderProductos(lista) {
  if (!lista.length) {
    mostrarEstado('🔍', 'No encontramos resultados');
    return;
  }
  grid.innerHTML = '';
  const fragment = document.createDocumentFragment();

  lista.forEach(producto => {
    const nombre      = escapeHTML(producto.nombre);
    const descripcion = escapeHTML(producto.descripcion);
    const categoria   = escapeHTML(producto.categoria);
    const imagenSrc   = producto.imagenURL || '';

    const unit   = producto.precio          || 0;
    const trio   = producto.precio3unidades || 0;
    const seis   = producto.precio6unidades || 0;
    const docena = producto.precioDocena    || 0;
    const tieneOfertaUnit = producto.oferta && producto.descuento > 0 && unit > 0;

    let lineasPrecio = '';
    if (unit > 0) {
      const precioFinal = tieneOfertaUnit ? Math.round(unit * (1 - producto.descuento / 100)) : unit;
      lineasPrecio += `
        <div class="prod-precio-final">$${formatPrice(precioFinal)} <small>/un.</small></div>
        ${tieneOfertaUnit ? `<div class="prod-precio-original">$${formatPrice(unit)}</div>` : ''}
      `;
    }
    if (trio > 0 && trio !== unit) {
      lineasPrecio += `<div class="prod-precio-docena">🛒 x3 un. $${formatPrice(trio)}</div>`;
    }
    if (seis > 0 && seis !== unit) {
      lineasPrecio += `<div class="prod-precio-docena">🛒 x6 un. $${formatPrice(seis)}</div>`;
    }
    if (docena > 0) {
      lineasPrecio += `<div class="prod-precio-promo">🔥 x12 un. $${formatPrice(docena)}</div>`;
    }
    if (!unit && !trio && !seis && !docena) {
      lineasPrecio = `<div class="prod-precio-final" style="font-size:.9rem; color:var(--gris);">Consultar precio</div>`;
    }

    const card = document.createElement('div');
    card.className = 'producto';
    card.innerHTML = `
      <div class="prod-thumb">
        ${imagenSrc ? `<img src="${imagenSrc}" alt="${nombre}" loading="lazy">` : `<div class="prod-thumb-emoji">🥖</div>`}
        ${producto.oferta && producto.descuento > 0 && unit > 0 ? `<div class="prod-oferta-chip">−${producto.descuento}%</div>` : ''}
      </div>
      <div class="producto-body">
        <div class="prod-cat-label">${categoria}</div>
        <h2>${nombre}</h2>
        <p class="prod-desc">${descripcion}</p>
        <div class="prod-footer">
          <div class="prod-precio-wrap">${lineasPrecio}</div>
          <button class="btn-agregar">+ Agregar</button>
        </div>
      </div>`;

    // FIX: el botón ya no decide automáticamente qué presentación
    // cargar (antes priorizaba x3→x6→x12→unidad sin preguntar,
    // lo que confundía al cliente que quería comprar solo 1
    // unidad). Ahora siempre abre el modal de selección, donde el
    // cliente elige presentación y cantidad antes de confirmar.
    card.querySelector('.btn-agregar').addEventListener('click', () => {
      const presentaciones = obtenerPresentaciones(producto);
      if (presentaciones.length === 0) return; // sin precio configurado, no hace nada
      window.abrirModalPresentacion({
        id:        producto.id,
        nombre:    producto.nombre,
        imagen:    producto.imagenURL || '',
        presentaciones,
      });
    });

    fragment.appendChild(card);
  });
  grid.appendChild(fragment);
}

function actualizarPromociones() {
  const ofertas     = productos.filter(p => p.oferta && p.descuento > 0 && p.precio > 0);
  const seccion     = $id('promociones');
  const contenedor  = $id('promociones-container');
  const banner      = $id('ofertaBanner');

  if (ofertas.length > 0) {
    seccion.classList.add('visible');
    banner.classList.add('visible');

    contenedor.innerHTML = '';
    const fragment = document.createDocumentFragment();

    ofertas.forEach(p => {
      const precioFinal = Math.round(p.precio * (1 - p.descuento / 100));
      const nombreSeguro = escapeHTML(p.nombre);

      const card = document.createElement('div');
      card.className = 'promo-card';
      card.innerHTML = `
        <div class="promo-card-img">${p.imagenURL ? `<img src="${p.imagenURL}" alt="${nombreSeguro}">` : '🥖'}</div>
        <div class="promo-card-body">
          <div class="promo-card-badge">-${p.descuento}%</div>
          <div class="promo-card-nombre">${nombreSeguro}</div>
          <div class="promo-card-precios">
            <span class="promo-card-original">$${formatPrice(p.precio)}</span>
            <span class="promo-card-final">$${formatPrice(precioFinal)}</span>
          </div>
          <button class="promo-card-btn">+ Agregar</button>
        </div>`;

      // Mismo criterio que las cards normales: abre el modal de
      // presentación en vez de agregar directo.
      card.querySelector('.promo-card-btn').addEventListener('click', () => {
        const presentaciones = obtenerPresentaciones(p);
        if (presentaciones.length === 0) return;
        window.abrirModalPresentacion({
          id:     p.id,
          nombre: p.nombre,
          imagen: p.imagenURL || '',
          presentaciones,
        });
      });

      fragment.appendChild(card);
    });

    contenedor.appendChild(fragment);
  } else {
    seccion.classList.remove('visible');
    banner.classList.remove('visible');
  }
}

function actualizarHeroStats() {
  const deco = $id('heroDeco');
  if (!deco) return;
  const totalProductos   = productos.length;
  const categoriasUnicas = new Set(productos.map(p => p.categoria).filter(Boolean)).size;
  const ofertasCount     = productos.filter(p => p.oferta).length;
  deco.innerHTML = `
    <div class="hero-stat">🥪 ${totalProductos} productos</div>
    <div class="hero-stat">📂 ${categoriasUnicas} categorías</div>
    ${ofertasCount > 0 ? `<div class="hero-stat">🔥 ${ofertasCount} ofertas</div>` : ''}
  `;
}

busquedaInput?.addEventListener('input', aplicarFiltros);

cargarProductos();