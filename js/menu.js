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

  // MEJORA: el título de la sección ahora refleja lo que se está
  // viendo. Antes decía "Todos los productos" siempre, aunque se
  // filtrara por categoría o se buscara algo — confundía porque el
  // título no coincidía con la grilla. textContent = sin riesgo XSS.
  const tituloEl = $id('menuTitulo');
  if (tituloEl) {
    if (texto) {
      tituloEl.textContent = `Resultados para “${busquedaInput.value.trim()}”`;
    } else if (categoriaActual !== 'TODOS') {
      tituloEl.textContent = categoriaActual;
    } else {
      tituloEl.textContent = 'Todos los productos';
    }
  }
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

  // FIX: confirmado como regla de negocio — el % de descuento
  // configurado en el admin se aplica por igual a TODAS las
  // presentaciones que el producto tenga, no solo a la unidad.
  // Antes los packs (x3/x6/x12) siempre mostraban su precio de
  // lista sin ningún descuento, aunque el producto estuviera
  // marcado como oferta.
  function aplicarDescuento(precio) {
    return tieneOferta ? Math.round(precio * (1 - producto.descuento / 100)) : precio;
  }

  const presentaciones = [];

  if (unit > 0) {
    presentaciones.push({
      unidades: 1,
      etiqueta: 'Unidad',
      precioOriginal: unit,
      precioFinal: aplicarDescuento(unit),
      tieneOferta,
    });
  }
  if (trio > 0) {
    presentaciones.push({
      unidades: 3,
      etiqueta: 'Pack x3',
      precioOriginal: trio,
      precioFinal: aplicarDescuento(trio),
      tieneOferta,
    });
  }
  if (seis > 0) {
    presentaciones.push({
      unidades: 6,
      etiqueta: 'Pack x6',
      precioOriginal: seis,
      precioFinal: aplicarDescuento(seis),
      tieneOferta,
    });
  }
  if (docena > 0) {
    presentaciones.push({
      unidades: 12,
      etiqueta: 'Docena (x12)',
      precioOriginal: docena,
      precioFinal: aplicarDescuento(docena),
      tieneOferta,
    });
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

    // FIX: se centraliza todo el cálculo de precios/descuentos en
    // obtenerPresentaciones(), la misma función que usa el modal
    // y las promociones. Antes este bloque recalculaba todo a
    // mano y nunca aplicaba el descuento a los packs (x3/x6/x12),
    // y el chip de oferta en la imagen solo aparecía si había
    // precio unitario configurado.
    const presentaciones = obtenerPresentaciones(producto);
    const hayOferta = producto.oferta && producto.descuento > 0 && presentaciones.length > 0;

    let lineasPrecio = '';
    if (presentaciones.length === 0) {
      lineasPrecio = `<div class="prod-precio-final" style="font-size:.9rem; color:var(--gris);">Consultar precio</div>`;
    } else {
      presentaciones.forEach(pres => {
        if (pres.unidades === 1) {
          lineasPrecio += `
            <div class="prod-precio-final">$${formatPrice(pres.precioFinal)} <small>/un.</small></div>
            ${pres.tieneOferta ? `<div class="prod-precio-original">$${formatPrice(pres.precioOriginal)}</div>` : ''}
          `;
        } else {
          const claseLinea = pres.unidades === 12 ? 'prod-precio-promo' : 'prod-precio-docena';
          const iconoLinea = pres.unidades === 12 ? '🔥' : '🛒';
          lineasPrecio += `
            <div class="${claseLinea}">
              ${iconoLinea} ${pres.etiqueta}. $${formatPrice(pres.precioFinal)}
              ${pres.tieneOferta ? `<span style="text-decoration:line-through; color:var(--gris); margin-left:4px;">$${formatPrice(pres.precioOriginal)}</span>` : ''}
            </div>`;
        }
      });
    }

    const card = document.createElement('div');
    card.className = 'producto';
    card.innerHTML = `
      <div class="prod-thumb">
        ${imagenSrc ? `<img src="${imagenSrc}" alt="${nombre}" loading="lazy" onerror="this.outerHTML='<div class=&quot;prod-thumb-emoji&quot;>🥖</div>';">` : `<div class="prod-thumb-emoji">🥖</div>`}
        ${hayOferta ? `<div class="prod-oferta-chip">−${producto.descuento}%</div>` : ''}
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
    // Reutiliza `presentaciones`, ya calculado arriba para mostrar
    // los precios en la card — evita recalcular lo mismo dos veces.
    if (presentaciones.length > 0) {
      card.querySelector('.btn-agregar').addEventListener('click', () => {
        window.abrirModalPresentacion({
          id:     producto.id,
          nombre: producto.nombre,
          imagen: producto.imagenURL || '',
          presentaciones,
        });
      });
    } else {
      // Sin precio configurado: el botón queda deshabilitado en
      // vez de quedar clickeable sin hacer nada.
      const btn = card.querySelector('.btn-agregar');
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
    }

    fragment.appendChild(card);
  });
  grid.appendChild(fragment);
}

function actualizarPromociones() {
  // FIX: antes solo se consideraba oferta si el producto tenía
  // precio unitario (p.precio > 0). Si un producto SOLO tenía
  // configurado precio por pack (x3/x6/x12) y se marcaba como
  // oferta en el admin, nunca aparecía en el banner ni en la
  // grilla de promociones. Ahora se considera oferta si tiene
  // CUALQUIER precio configurado, sin importar la presentación.
  const ofertas = productos.filter(p => {
    if (!p.oferta || !(p.descuento > 0)) return false;
    const tieneAlgunPrecio = (p.precio || 0) > 0
      || (p.precio3unidades || 0) > 0
      || (p.precio6unidades || 0) > 0
      || (p.precioDocena    || 0) > 0;
    return tieneAlgunPrecio;
  });

  const seccion     = $id('promociones');
  const contenedor  = $id('promociones-container');
  const banner      = $id('ofertaBanner');

  if (ofertas.length > 0) {
    seccion.classList.add('visible');
    banner.classList.add('visible');

    contenedor.innerHTML = '';
    const fragment = document.createDocumentFragment();

    ofertas.forEach(p => {
      const nombreSeguro = escapeHTML(p.nombre);

      // FIX: el descuento se aplica por igual a TODAS las
      // presentaciones que el producto tenga (confirmado como
      // criterio de negocio), usando la misma función
      // obtenerPresentaciones() que ya calcula esto para las
      // cards normales — así ambos lugares quedan sincronizados.
      const presentaciones = obtenerPresentaciones(p);
      if (presentaciones.length === 0) return; // por seguridad, no debería pasar acá

      // Se muestra en la card de promo la presentación más barata
      // disponible como precio de referencia ("Desde $X" si hay
      // más de una opción). El cliente elige la presentación
      // exacta (x1/x3/x6/x12) en el modal al tocar "+ Agregar" —
      // mismo comportamiento que las cards normales del menú, así
      // nunca se agrega automáticamente sin que el cliente elija.
      const masBarata = presentaciones.reduce((min, p) => p.precioFinal < min.precioFinal ? p : min, presentaciones[0]);
      const hayVariasPresentaciones = presentaciones.length > 1;

      const card = document.createElement('div');
      card.className = 'promo-card';
      card.innerHTML = `
        <div class="promo-card-img">${p.imagenURL ? `<img src="${p.imagenURL}" alt="${nombreSeguro}" onerror="this.outerHTML='🥖';">` : '🥖'}</div>
        <div class="promo-card-body">
          <div class="promo-card-badge">-${p.descuento}%</div>
          <div class="promo-card-nombre">${nombreSeguro}</div>
          <div class="promo-card-precios">
            ${masBarata.tieneOferta ? `<span class="promo-card-original">$${formatPrice(masBarata.precioOriginal)}</span>` : ''}
            <span class="promo-card-final">${hayVariasPresentaciones ? 'Desde ' : ''}$${formatPrice(masBarata.precioFinal)}</span>
          </div>
          <button class="promo-card-btn">+ Agregar</button>
        </div>`;

      // FIX: confirmado como comportamiento correcto — el botón
      // SIEMPRE abre el modal de selección de presentación y
      // cantidad, nunca agrega directo la más barata. Si el
      // producto solo tiene una presentación disponible, el modal
      // igual se abre pero con una sola opción ya preseleccionada,
      // así el flujo es idéntico en todos los casos.
      card.querySelector('.promo-card-btn').addEventListener('click', () => {
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