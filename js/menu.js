import {

  db,
  collection,
  getDocs

} from './firebase.js';

const contenedor =
  document.getElementById('menu-container');

const categoriasContainer =
  document.getElementById('categorias');

let productos = [];
let categoriaActual = 'TODOS';
async function cargarProductos() {

  const querySnapshot =
    await getDocs(collection(db, "productos"));

  productos = [];

  querySnapshot.forEach((documento) => {

    productos.push({
      id: documento.id,
      ...documento.data()
    });
  });

  crearCategorias();

  aplicarFiltros();
}

function crearCategorias() {

  categoriasContainer.innerHTML = '';

  const categorias =
    [...new Set(
      productos.map(p => p.categoria)
    )];

  categoriasContainer.innerHTML += `

    <button onclick="
      filtrarCategoria('TODOS')
    ">
      Todos
    </button>
  `;

  categorias.forEach(categoria => {

    categoriasContainer.innerHTML += `

      <button onclick="
        filtrarCategoria('${categoria}')
      ">
        ${categoria}
      </button>
    `;
  });
}

window.filtrarCategoria =
  (categoria) => {

  categoriaActual = categoria;

  aplicarFiltros();
};

function mostrarProductos(lista) {

  contenedor.innerHTML = '';

  lista.forEach(p => {

    if (!p.disponible) return;

    let precioHTML = '';

    let precioFinal = p.precio;

    if (p.oferta) {

      precioFinal =
        p.precio -
        (p.precio * p.descuento / 100);

      precioHTML = `

        <p style="
          text-decoration: line-through;
          color: gray;
        ">
          $${p.precio}
        </p>

        <strong>
          $${precioFinal}
        </strong>

        <p style="color:red;">
          🔥 ${p.descuento}% OFF
        </p>
      `;

    } else {

      precioHTML = `
        <strong>$${p.precio}</strong>
      `;
    }

    contenedor.innerHTML += `

      <div class="producto">

        <img
          src="${p.imagenURL}"
          width="200"
        >

        <h2>${p.nombre}</h2>

        <p>${p.descripcion}</p>

        <p>
          📂 ${p.categoria}
        </p>

        ${precioHTML}

        <br><br>

        <button onclick="
          agregarAlCarrito(
            '${p.nombre}',
            ${precioFinal}
          )
        ">
          Agregar al carrito
        </button>

      </div>
    `;
  });
}
function aplicarFiltros() {

  const textoBusqueda =
    document.getElementById('busqueda')
      .value
      .toLowerCase();

  let listaFiltrada = productos;

  if (categoriaActual !== 'TODOS') {

    listaFiltrada =
      listaFiltrada.filter(
        p =>
          p.categoria === categoriaActual
      );
  }

  listaFiltrada =
    listaFiltrada.filter(
      p =>
        p.nombre
          .toLowerCase()
          .includes(textoBusqueda)
    );

  mostrarProductos(listaFiltrada);
}

document
  .getElementById('busqueda')
  .addEventListener(
    'input',
    aplicarFiltros
  );
cargarProductos();