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

const grid               = $id('menu-container');
const categoriasContainer = $id('categorias');
const busquedaInput      = $id('busqueda');

async function cargarProductos() {
  mostrarEstado('⏳', 'Cargando menú...');
  try {
    const snap = await getDocs(collection(db, 'productos'));
    productos = snap.docs
      .map(doc => {
        const data = doc.data();
        return {
          id:          doc.id,
          nombre:      data.nombre      || '',
          descripcion: data.descripcion || '',
          categoria:   data.categoria   || '',
          precio:      Number(data.precio)    || 0,
          precio3unidades: Number(data.precio3unidades) || 0,
          precio6unidades: Number(data.precio6unidades) || 0,  // ← nuevo campo
          precioDocena: Number(data.precioDocena) || 0,
          descuento:   Number(data.descuento) || 0,
          oferta:      Boolean(data.oferta),
          disponible:  data.disponible !== false,
          imagenURL:   data.imagenURL  || '',
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

    const card = document.createElement('div');
    card.className = 'producto';
    card.innerHTML = `
      <div class="prod-thumb">
        ${imagenSrc ? `<img src="${imagenSrc}" alt="${nombre}" loading="lazy">` : `<div class="prod-thumb-emoji">🥖</div>`}
        ${producto.oferta && producto.descuento > 0 && producto.precio > 0 ? `<div class="prod-oferta-chip">−${producto.descuento}%</div>` : ''}
      </div>
      <div class="producto-body">
        <div class="prod-cat-label">${categoria}</div>
        <h2>${nombre}</h2>
        <p class="prod-desc">${descripcion}</p>
        <div class="prod-footer">
          <div class="prod-precio-wrap">
            ${(() => {
              const unit = producto.precio || 0;
              const trio = producto.precio3unidades || 0;
              const seis = producto.precio6unidades || 0;
              const docena = producto.precioDocena || 0;
              const tieneOfertaUnit = producto.oferta && producto.descuento > 0 && unit > 0;
              let mainPrice = 0;
              let mainLabel = '';
              let extraLines = '';

              // Prioridad: 3u → 6u → 12u → unitario
              if (trio > 0) {
                mainPrice = trio;
                mainLabel = '/x3 un.';
                if (unit > 0) {
                  if (tieneOfertaUnit) extraLines += `<div class="prod-precio-original">$${formatPrice(unit)}</div>`;
                  extraLines += `<div class="prod-precio-docena">🛒 x1 un. $${formatPrice(unit)}</div>`;
                }
                if (seis > 0 && seis !== trio) extraLines += `<div class="prod-precio-docena">🛒 x6 un. $${formatPrice(seis)}</div>`;
                if (docena > 0 && docena !== trio) extraLines += `<div class="prod-precio-docena">🛒 x12 un. $${formatPrice(docena)}</div>`;
              } else if (seis > 0) {
                mainPrice = seis;
                mainLabel = '/x6 un.';
                if (unit > 0) {
                  if (tieneOfertaUnit) extraLines += `<div class="prod-precio-original">$${formatPrice(unit)}</div>`;
                  extraLines += `<div class="prod-precio-docena">🛒 x1 un. $${formatPrice(unit)}</div>`;
                }
                if (trio > 0 && trio !== seis) extraLines += `<div class="prod-precio-docena">🛒 x3 un. $${formatPrice(trio)}</div>`;
                if (docena > 0 && docena !== seis) extraLines += `<div class="prod-precio-docena">🛒 x12 un. $${formatPrice(docena)}</div>`;
              } else if (docena > 0) {
                mainPrice = docena;
                mainLabel = '/x12 un.';
                if (unit > 0) {
                  if (tieneOfertaUnit) extraLines += `<div class="prod-precio-original">$${formatPrice(unit)}</div>`;
                  extraLines += `<div class="prod-precio-docena">🛒 x1 un. $${formatPrice(unit)}</div>`;
                }
                if (trio > 0 && trio !== docena) extraLines += `<div class="prod-precio-docena">🛒 x3 un. $${formatPrice(trio)}</div>`;
                if (seis > 0 && seis !== docena) extraLines += `<div class="prod-precio-docena">🛒 x6 un. $${formatPrice(seis)}</div>`;
              } else if (unit > 0) {
                mainPrice = tieneOfertaUnit ? Math.round(unit * (1 - producto.descuento / 100)) : unit;
                mainLabel = '/un.';
                if (tieneOfertaUnit) extraLines += `<div class="prod-precio-original">$${formatPrice(unit)}</div>`;
                if (trio > 0) extraLines += `<div class="prod-precio-docena">🛒 x3 un. $${formatPrice(trio)}</div>`;
                if (seis > 0) extraLines += `<div class="prod-precio-docena">🛒 x6 un. $${formatPrice(seis)}</div>`;
                if (docena > 0) extraLines += `<div class="prod-precio-docena">🛒 x12 un. $${formatPrice(docena)}</div>`;
              } else {
                return `<div class="prod-precio-final" style="font-size:.9rem; color:var(--gris);">Consultar precio</div>`;
              }
              return `
                ${extraLines}
                <div class="prod-precio-final">$${formatPrice(mainPrice)} <small>${mainLabel}</small></div>
              `;
            })()}
          </div>
          <button class="btn-agregar" data-id="${producto.id}">+ Agregar</button>
        </div>
      </div>`;
    card.querySelector('.btn-agregar').addEventListener('click', () => {
      window.agregarAlCarrito({
        id:     producto.id,
        nombre: producto.nombre,
        precio: (() => {
          const unit = producto.precio || 0;
          const trio = producto.precio3unidades || 0;
          const seis = producto.precio6unidades || 0;
          const docena = producto.precioDocena || 0;
          // Prioridad para el carrito: 3u → 6u → 12u → unitario
          if (trio > 0) return trio;
          if (seis > 0) return seis;
          if (docena > 0) return docena;
          if (unit > 0) return producto.oferta && producto.descuento > 0 ? Math.round(unit * (1 - producto.descuento / 100)) : unit;
          return 0;
        })(),
        imagen: producto.imagenURL || '',
      });
    });
    fragment.appendChild(card);
  });
  grid.appendChild(fragment);
}

function actualizarPromociones() {
  const ofertas = productos.filter(p => p.oferta && p.descuento > 0 && p.precio > 0);
  const seccion = $id('promociones');
  const contenedor = $id('promociones-container');
  const banner = $id('ofertaBanner');
  if (ofertas.length > 0) {
    seccion.classList.add('visible');
    banner.classList.add('visible');
    contenedor.innerHTML = ofertas.map(p => {
      const precioFinal = Math.round(p.precio * (1 - p.descuento / 100));
      return `
        <div class="promo-card">
          <div class="promo-card-img">${p.imagenURL ? `<img src="${p.imagenURL}" alt="${escapeHTML(p.nombre)}">` : '🥖'}</div>
          <div class="promo-card-body">
            <div class="promo-card-badge">-${p.descuento}%</div>
            <div class="promo-card-nombre">${escapeHTML(p.nombre)}</div>
            <div class="promo-card-precios">
              <span class="promo-card-original">$${formatPrice(p.precio)}</span>
              <span class="promo-card-final">$${formatPrice(precioFinal)}</span>
            </div>
            <button class="promo-card-btn" onclick="window.agregarAlCarrito({nombre:'${escapeHTML(p.nombre)}', precio:${precioFinal}, imagen:'${p.imagenURL||''}'})">+ Agregar</button>
          </div>
        </div>`;
    }).join('');
  } else {
    seccion.classList.remove('visible');
    banner.classList.remove('visible');
  }
}

function actualizarHeroStats() {
  const deco = $id('heroDeco');
  if (!deco) return;
  const totalProductos = productos.length;
  const categoriasUnicas = new Set(productos.map(p => p.categoria).filter(Boolean)).size;
  const ofertasCount = productos.filter(p => p.oferta).length;
  deco.innerHTML = `
    <div class="hero-stat">🥪 ${totalProductos} productos</div>
    <div class="hero-stat">📂 ${categoriasUnicas} categorías</div>
    ${ofertasCount > 0 ? `<div class="hero-stat">🔥 ${ofertasCount} ofertas</div>` : ''}
  `;
}

cargarProductos();