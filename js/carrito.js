import {

  db,
  collection,
  addDoc

} from './firebase.js';
let carrito = JSON.parse(
  localStorage.getItem('carrito')
) || [];

function guardarCarrito() {

  localStorage.setItem(
    'carrito',
    JSON.stringify(carrito)
  );
}

window.agregarAlCarrito = (
  nombre,
  precio
) => {

  const productoExistente = carrito.find(
    p => p.nombre === nombre
  );

  if (productoExistente) {

    productoExistente.cantidad++;

  } else {

    carrito.push({
      nombre,
      precio,
      cantidad: 1
    });
  }

  guardarCarrito();

  actualizarCarrito();
};

window.eliminarDelCarrito = (nombre) => {

  carrito = carrito.filter(
    p => p.nombre !== nombre
  );

  guardarCarrito();

  actualizarCarrito();
};

function actualizarCarrito() {

  const carritoContainer =
    document.getElementById('carrito');

  carritoContainer.innerHTML = '';

  let total = 0;

  carrito.forEach(item => {

    total += item.precio * item.cantidad;

    carritoContainer.innerHTML += `
      <div class="item-carrito">

        <strong>${item.nombre}</strong>

        x${item.cantidad}

        - $${item.precio * item.cantidad}

        <button onclick="
          eliminarDelCarrito('${item.nombre}')
        ">
          ❌
        </button>

      </div>
    `;
  });

  carritoContainer.innerHTML += `
    <hr>
    <h3>Total: $${total}</h3>

    <button onclick="pedirPorWhatsApp()">
      Pedir por WhatsApp
    </button>
  `;
}

window.pedirPorWhatsApp =
  async () => {

  if (carrito.length === 0) {

    alert("El carrito está vacío");

    return;
  }

  let mensaje =
    "Hola, quiero pedir:%0A%0A";

  carrito.forEach(item => {

    mensaje +=
      `- ${item.nombre} x${item.cantidad}`
      + ` = $${item.precio * item.cantidad}%0A`;
  });
const clienteNombre =
  document.getElementById(
    'clienteNombre'
  ).value;

const clienteTelefono =
  document.getElementById(
    'clienteTelefono'
  ).value;

const clienteDireccion =
  document.getElementById(
    'clienteDireccion'
  ).value;

const clienteObservaciones =
  document.getElementById(
    'clienteObservaciones'
  ).value;
  const total = carrito.reduce(
    (acc, item) =>
      acc + item.precio * item.cantidad,
    0
  );

 mensaje += `

%0ATotal: $${total}

%0A%0A👤 Cliente:
${clienteNombre}

%0A📱 Teléfono:
${clienteTelefono}

%0A📍 Dirección:
${clienteDireccion}

%0A📝 Observaciones:
${clienteObservaciones}
`;

  try {

    await addDoc(
      collection(db, "pedidos"),
      {
        clienteNombre,

clienteTelefono,

clienteDireccion,

clienteObservaciones,

        productos: carrito,

        total,

        fecha:
          new Date().toISOString(),

        estado: "pendiente"
      }
    );

    window.open(
      `https://wa.me/5491112345678?text=${mensaje}`,
      '_blank'
    );

    carrito = [];

    guardarCarrito();

    actualizarCarrito();

    alert("Pedido enviado 🚀");

  } catch (error) {

    console.error(error);

    alert("Error al guardar pedido");
  }
};

actualizarCarrito();