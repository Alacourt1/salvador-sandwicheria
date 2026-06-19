import { db, collection, getDocs } from './firebase.js';
import { formatPrice }             from './utils/format.js';
import { escapeHTML }              from './utils/escapeHTML.js';
import { $id, $qsa }              from './utils/dom.js';

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
           precioDocena: Number(data.precioDocena) || 0,  // ← nueva línea
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
    const tieneOferta  = producto.oferta && producto.descuento > 0;
    const precioFinal  = tieneOferta ? Math.round(producto.precio * (1 - producto.descuento / 100)) : producto.precio;
    const precioSeguro = Number(precioFinal) || 0;
    const nombre      = escapeHTML(producto.nombre);
    const descripcion = escapeHTML(producto.descripcion);
    const categoria   = escapeHTML(producto.categoria);
    const imagenSrc   = producto.imagenURL || '';

    const card = document.createElement('div');
    card.className = 'producto';
    card.innerHTML = `
      <div class="prod-thumb">
        ${imagenSrc ? `<img src="${imagenSrc}" alt="${nombre}" loading="lazy">` : `<div class="prod-thumb-emoji">🥖</div>`}
        ${tieneOferta ? `<div class="prod-oferta-chip">−${producto.descuento}%</div>` : ''}
      </div>
      <div class="producto-body">
        <div class="prod-cat-label">${categoria}</div>
        <h2>${nombre}</h2>
        <p class="prod-desc">${descripcion}</p>
        <div class="prod-footer">
          <div class="prod-precio-wrap">
            ${tieneOferta ? `<div class="prod-precio-original">$${formatPrice(producto.precio)}</div>` : ''}
            <div class="prod-precio-final">$${formatPrice(precioSeguro)}</div>
            ${producto.precioDocena && producto.precioDocena > 0 ? `<div class="prod-precio-docena">🛒 x12 un. $${formatPrice(producto.precioDocena)}</div>` : ''}
          </div>
          <button class="btn-agregar">+ Agregar</button>
        </div>
      </div>`;
    card.querySelector('.btn-agregar').addEventListener('click', () => {
      window.agregarAlCarrito({
        id:     producto.id,
        nombre: producto.nombre,
        precio: precioSeguro,
        imagen: producto.imagenURL || '',
      });
    });
    fragment.appendChild(card);
  });
  grid.appendChild(fragment);
}

function actualizarPromociones() {
  const ofertas = productos.filter(p => p.oferta && p.descuento > 0);
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