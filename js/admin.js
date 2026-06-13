import {

  db,

  collection,
  addDoc,
  getDocs,

  deleteDoc,
  updateDoc,
  doc

} from './firebase.js';

const lista =
  document.getElementById(
    'lista-productos'
  );

const listaPedidos =
  document.getElementById(
    'lista-pedidos'
  );

const listaClientes =
  document.getElementById(
    'lista-clientes'
  );
  const rankingProductos =
  document.getElementById(
    'productos-mas-vendidos'
  );



// ========================
// PRODUCTOS
// ========================

window.agregarProducto =
  async () => {

  try {

    await addDoc(
      collection(db, "productos"),
      {

        nombre:
          document.getElementById(
            'nombre'
          ).value,

        descripcion:
          document.getElementById(
            'descripcion'
          ).value,

        precio: Number(
          document.getElementById(
            'precio'
          ).value
        ),

        categoria:
          document.getElementById(
            'categoria'
          ).value,

        descuento: Number(
          document.getElementById(
            'descuento'
          ).value
        ),

        oferta:
          document.getElementById(
            'oferta'
          ).checked,

        disponible: true,

        imagenURL:
          "https://via.placeholder.com/200"

      }
    );

    alert("Producto agregado 🚀");

    cargarProductos();

  } catch (error) {

    console.error(error);

    alert("Error");
  }
};

async function cargarProductos() {

  lista.innerHTML = '';

  const querySnapshot =
    await getDocs(
      collection(db, "productos")
    );

  querySnapshot.forEach((documento) => {

    const p = documento.data();

    lista.innerHTML += `

      <div style="
        border:1px solid gray;
        padding:10px;
        margin:10px;
      ">

        <h3>${p.nombre}</h3>

        <p>${p.descripcion}</p>

        <strong>$${p.precio}</strong>

        <br><br>

        <p>
          Oferta:
          ${p.oferta ? '✅' : '❌'}
        </p>

        <p>
          Disponible:
          ${p.disponible ? '✅' : '❌'}
        </p>

        <br><br>

        <button onclick="
          eliminarProducto(
            '${documento.id}'
          )
        ">
          Eliminar
        </button>

        <button onclick="
          toggleDisponible(
            '${documento.id}',
            ${p.disponible}
          )
        ">
          ${p.disponible
            ? 'Desactivar'
            : 'Activar'}
        </button>

        <button onclick="
          editarProducto(
            '${documento.id}',
            '${p.nombre}',
            '${p.descripcion}',
            ${p.precio}
          )
        ">
          Editar
        </button>

      </div>
    `;
  });
}

window.eliminarProducto =
  async (id) => {

  const confirmar =
    confirm("¿Eliminar producto?");

  if (!confirmar) return;

  await deleteDoc(
    doc(db, "productos", id)
  );

  cargarProductos();
};

window.toggleDisponible =
  async (id, estadoActual) => {

  await updateDoc(
    doc(db, "productos", id),
    {

      disponible: !estadoActual
    }
  );

  cargarProductos();
};

window.editarProducto =
  async (
    id,
    nombreActual,
    descripcionActual,
    precioActual
  ) => {

  const nuevoNombre =
    prompt(
      "Nuevo nombre",
      nombreActual
    );

  const nuevaDescripcion =
    prompt(
      "Nueva descripción",
      descripcionActual
    );

  const nuevoPrecio =
    prompt(
      "Nuevo precio",
      precioActual
    );

  await updateDoc(
    doc(db, "productos", id),
    {

      nombre: nuevoNombre,

      descripcion: nuevaDescripcion,

      precio: Number(nuevoPrecio)
    }
  );

  cargarProductos();
};



// ========================
// PEDIDOS
// ========================

async function cargarPedidos() {

  listaPedidos.innerHTML = '';

  let totalPedidos = 0;

  let ventasTotales = 0;

  let pedidosPendientes = 0;

  let pedidosEntregados = 0;
let ventasHoy = 0;

let ventasMes = 0;

let pedidosHoy = 0;
let contadorProductos = {};
  const querySnapshot =
    await getDocs(
      collection(db, "pedidos")
    );

  querySnapshot.forEach((documento) => {

    const pedido = documento.data();
const fechaPedido =
  new Date(pedido.fecha);

const hoy =
  new Date();

const mismoDia =
  fechaPedido.toDateString() ===
  hoy.toDateString();

const mismoMes =
  fechaPedido.getMonth() ===
  hoy.getMonth()
  &&
  fechaPedido.getFullYear() ===
  hoy.getFullYear();
    totalPedidos++;

    ventasTotales += pedido.total;

    if (pedido.estado === 'pendiente') {

      pedidosPendientes++;
    }

    if (pedido.estado === 'entregado') {

      pedidosEntregados++;
    }
    if (mismoDia) {

  ventasHoy += pedido.total;

  pedidosHoy++;
}

if (mismoMes) {

  ventasMes += pedido.total;
}

    let productosHTML = '';

    pedido.productos.forEach((p) => {
if (!contadorProductos[p.nombre]) {

  contadorProductos[p.nombre] = 0;
}

contadorProductos[p.nombre] +=
  p.cantidad;
      productosHTML += `

        <li>
          ${p.nombre}
          x${p.cantidad}
        </li>
      `;
    });

    listaPedidos.innerHTML += `

      <div style="
        border:1px solid black;
        margin:10px;
        padding:10px;
      ">

        <h3>
          Pedido
        </h3>

        <ul>
          ${productosHTML}
        </ul>

        <strong>
          Total:
          $${pedido.total}
        </strong>
        <p>
  👤 ${pedido.clienteNombre || ''}
</p>

<p>
  📱 ${pedido.clienteTelefono || ''}
</p>

<p>
  📍 ${pedido.clienteDireccion || ''}
</p>

<p>
  📝 ${pedido.clienteObservaciones || ''}
</p>

        <p>
          Estado:
          <strong>
            ${pedido.estado}
          </strong>
        </p>

        <select onchange="
          cambiarEstadoPedido(
            '${documento.id}',
            this.value
          )
        ">

          <option value="pendiente"
            ${pedido.estado === 'pendiente'
              ? 'selected'
              : ''
            }
          >
            Pendiente
          </option>

          <option value="preparando"
            ${pedido.estado === 'preparando'
              ? 'selected'
              : ''
            }
          >
            Preparando
          </option>

          <option value="enviado"
            ${pedido.estado === 'enviado'
              ? 'selected'
              : ''
            }
          >
            Enviado
          </option>

          <option value="entregado"
            ${pedido.estado === 'entregado'
              ? 'selected'
              : ''
            }
          >
            Entregado
          </option>

          <option value="cancelado"
            ${pedido.estado === 'cancelado'
              ? 'selected'
              : ''
            }
          >
            Cancelado
          </option>

        </select>

        <p>
          Fecha:
          ${pedido.fecha}
        </p>

      </div>
    `;
  });

  document.getElementById(
    'total-pedidos'
  ).innerText = totalPedidos;

  document.getElementById(
    'ventas-totales'
  ).innerText = ventasTotales;

  document.getElementById(
    'pedidos-pendientes'
  ).innerText = pedidosPendientes;

  document.getElementById(
    'pedidos-entregados'
  ).innerText = pedidosEntregados;
}
document.getElementById(
  'ventas-hoy'
).innerText = ventasHoy;

document.getElementById(
  'ventas-mes'
).innerText = ventasMes;

document.getElementById(
  'pedidos-hoy'
).innerText = pedidosHoy;

const ticketPromedio =

  totalPedidos > 0
    ? Math.round(
        ventasTotales / totalPedidos
      )
    : 0;

document.getElementById(
  'ticket-promedio'
).innerText = ticketPromedio;

window.cambiarEstadoPedido =
  async (id, nuevoEstado) => {

  await updateDoc(
    doc(db, "pedidos", id),
    {

      estado: nuevoEstado
    }
  );

  cargarPedidos();
};

rankingProductos.innerHTML = '';

const rankingOrdenado =

  Object.entries(contadorProductos)

    .sort((a, b) => b[1] - a[1]);

rankingOrdenado.forEach((item) => {

  rankingProductos.innerHTML += `

    <div style="
      border:1px solid gray;
      padding:10px;
      margin:10px;
    ">

      <strong>
        ${item[0]}
      </strong>

      <p>
        Vendidos:
        ${item[1]}
      </p>

    </div>
  `;
});

// ========================
// CLIENTES
// ========================

window.agregarCliente =
  async () => {

  const nombre =
    document.getElementById(
      'cliente-nombre'
    ).value;

  const telefono =
    document.getElementById(
      'cliente-telefono'
    ).value;

  if (!nombre || !telefono) {

    alert("Completa datos");

    return;
  }

  await addDoc(
    collection(db, "clientes"),
    {

      nombre,

      telefono,

      fechaRegistro:
        new Date().toISOString()
    }
  );

  document.getElementById(
    'cliente-nombre'
  ).value = '';

  document.getElementById(
    'cliente-telefono'
  ).value = '';

  cargarClientes();
};

async function cargarClientes() {

  listaClientes.innerHTML = '';

  const querySnapshot =
    await getDocs(
      collection(db, "clientes")
    );

  querySnapshot.forEach((documento) => {

    const cliente = documento.data();

    listaClientes.innerHTML += `

      <div style="
        border:1px solid gray;
        padding:10px;
        margin:10px;
      ">

        <h3>
          ${cliente.nombre}
        </h3>

        <p>
          📱 ${cliente.telefono}
        </p>

        <button onclick="
          enviarPromo(
            '${cliente.telefono}'
          )
        ">
          Enviar promo
        </button>

        <button onclick="
          eliminarCliente(
            '${documento.id}'
          )
        ">
          Eliminar
        </button>

      </div>
    `;
  });
}

window.eliminarCliente =
  async (id) => {

  await deleteDoc(
    doc(db, "clientes", id)
  );

  cargarClientes();
};

window.enviarPromo =
  (telefono) => {

  const mensaje =
    prompt("Mensaje promoción");

  if (!mensaje) return;

  window.open(
    `https://wa.me/${telefono}?text=${mensaje}`,
    '_blank'
  );
};

document
  .getElementById('buscar-cliente')
  .addEventListener(
    'input',
    async (e) => {

      const texto =
        e.target.value.toLowerCase();

      listaClientes.innerHTML = '';

      const querySnapshot =
        await getDocs(
          collection(db, "clientes")
        );

      querySnapshot.forEach((documento) => {

        const cliente =
          documento.data();

        if (
          !cliente.nombre
            .toLowerCase()
            .includes(texto)
        ) return;

        listaClientes.innerHTML += `

          <div style="
            border:1px solid gray;
            padding:10px;
            margin:10px;
          ">

            <h3>
              ${cliente.nombre}
            </h3>

            <p>
              📱 ${cliente.telefono}
            </p>

          </div>
        `;
      });
    }
  );



// ========================
// INICIALIZAR
// ========================

cargarProductos();

cargarPedidos();

cargarClientes();