// le dom
// memoria de mi carrito
let productosMemoria = [];

// pantalla de carga
window.addEventListener("load", () => {
    const loader = document.getElementById("loader-ancestral");
    if (loader) {
        loader.classList.add("loader-oculto");
        setTimeout(() => loader.style.display = "none", 500); 
    }
});

// pop up
function MostrarPopupMensaje(texto) {
    const popup = document.createElement("div");
    popup.className = "popup-notificacion-rpg";
    popup.innerText = texto;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 2000);
}

// Mochila dom
function PintarMochilaLateral() {
    const lista = document.getElementById("lista-items-carrito");
    if (!lista) return;

    // jala la mochila vacia
    const carrito = JSON.parse(localStorage.getItem("carritoTemporal")) || [];
    const vacioText = document.getElementById("lista-inventario-vacia");
    const cajaTotal = document.getElementById("total-inventario-caja");

    // agranda y reduce la mochila por cantidad
    vacioText && (vacioText.style.display = carrito.length ? "none" : "block");
    cajaTotal && (cajaTotal.style.display = carrito.length ? "block" : "none");
    lista.innerHTML = "";

    if (!carrito.length) return;

    let total = 0;
    
    // lista los item de mi mochila
    carrito.forEach((item, index) => {
        total += parseFloat(item.precio) * item.cantidad;
        const li = document.createElement("li");
        li.className = "item-mochila-fila";
        li.innerHTML = `
            <div>
                <span class="cantidad-item-mochila">x${item.cantidad}</span> ${item.nombre}<br>
                <span class="precio-item-mochila">S/ ${(item.precio * item.cantidad).toFixed(2)}</span>
            </div>
            <button class="btn-eliminar-item-mochila" data-index="${index}">X</button>`;
        lista.appendChild(li);
    });

    const txtTotal = document.getElementById("total-dinero-inventario");
    if (txtTotal) txtTotal.innerText = `S/ ${total.toFixed(2)}`;
}

// 🔹 dom alertas
const mostrarAlerta = (el, msg, color = "var(--color-lava)") => {
    if (!el) return;
    el.style.display = "block";
    el.style.color = el.style.borderColor = color; //color
    el.innerText = msg; //mensaje
};

// Manipulacion dom, nav si esta logeado o no
function InicializarInterfazLocal() {
    const sesion = localStorage.getItem("usuarioSesion");
    const user = sesion ? JSON.parse(sesion) : null;

    const elLogin = document.getElementById("nav-login");
    const elReg = document.getElementById("nav-registrar");
    const elPerfil = document.getElementById("nav-perfil");
    const elLogout = document.getElementById("nav-logout");

    // confirmacion del logeo
    if (user) {
        elLogin && (elLogin.style.display = "none");
        elReg && (elReg.style.display = "none");
        elLogout && (elLogout.style.display = "inline-block");
        if (elPerfil) {
            elPerfil.style.display = "inline-block";
            const link = elPerfil.querySelector("a");
            if (link) {
                link.innerText = `Perfil: ${user.NOMBRE}`;
                link.style.color = "var(--color-oro)";
                link.style.fontWeight = "bold";
            }
        }
    } else {
        elLogin && (elLogin.style.display = "inline-block");
        elReg && (elReg.style.display = "inline-block");
        elPerfil && (elPerfil.style.display = "none");
        elLogout && (elLogout.style.display = "none");
    }

    // evento on click deslogeo
    document.getElementById("btn-logout-tribu")?.addEventListener("click", (e) => {
        e.preventDefault();
        // Limpia el local storage
        ["usuarioSesion", "carritoTemporal", "pedidoConfirmado", "direccionPedidoTemporal", "trackingPedidos"].forEach(k => localStorage.removeItem(k));
        alert("Has salido de la cueva. ¡Regresa pronto, cazador!");
        window.location.href = "index.html";
    });

    // borrar item de la mochila
    document.getElementById("inventario-menu-lateral")?.addEventListener("click", (e) => {
        if (!e.target.classList.contains("btn-eliminar-item-mochila")) return;
        const idx = e.target.getAttribute("data-index");
        let carrito = JSON.parse(localStorage.getItem("carritoTemporal"));
        const idDel = carrito[idx].id;

        carrito.splice(idx, 1);
        localStorage.setItem("carritoTemporal", JSON.stringify(carrito));
        PintarMochilaLateral();

        // bloqueo si se acaba la oferta
        const btnAfectado = document.querySelector(`[data-id="${idDel}"]`);
        if (btnAfectado) {
            btnAfectado.disabled = false;
            if (btnAfectado.classList.contains("btn-caza-oferta")) {
                btnAfectado.innerText = "Rescatar Ya"; btnAfectado.style.backgroundColor = "var(--color-lava)";
            } else {
                btnAfectado.innerText = "Añadir al Pedido"; btnAfectado.style.backgroundColor = "";
            }
        }
        MostrarPopupMensaje("¡ÍTEM DEVUELTO AL ALMACÉN! 🏹");
    });

    // redireccion a form pedido
    document.getElementById("btn-ir-pagar-tribu")?.addEventListener("click", () => window.location.href = "form_pedido.html");
}


// Api

// api helper para automatizar la interfaz -> server
const apiFetch = async (url, method = 'GET', body = null) => {
    const config = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) config.body = JSON.stringify(body);
    const res = await fetch(`http://localhost:3000/api/${url}`, config);
    return { ok: res.ok, data: await res.json() };
};

// Activa el dom y servicios
async function CargarDomYServicios() {
    // jala lo necesario para pintar la interfaz
    InicializarInterfazLocal();

    const sesion = localStorage.getItem("usuarioSesion");
    const user = sesion ? JSON.parse(sesion) : null;

    const tMenu = document.getElementById("tablaProductos");
    const tOfertas = document.getElementById("tablaOfertasUrgentes");
    
    // sincroniza y traer los productos del menu y ofertas
    if (tMenu || tOfertas) {
        PintarMochilaLateral();
        try {
            const res = await fetch('http://localhost:3000/api/productos');
            productosMemoria = await res.json();
        } catch (err) { console.error("Error al conectar con la base de datos", err); }
    }

    // validacion de formularios y eventos
    document.getElementById("formularioRegistro")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const alerta = document.getElementById("alerta-rpg");
        const v = (id) => document.getElementById(id).value;

        // validacion de form crear usuario
        if (v("claveNueva") !== v("confirmarClave")) return mostrarAlerta(alerta, "¡ERROR! LAS CONTRASEÑAS NO COINCIDEN.");
        if (v("telefonoCazador").length !== 9 || isNaN(v("telefonoCazador"))) return mostrarAlerta(alerta, "¡ERROR! EL TELÉFONO DEBE TENER 9 NÚMEROS.");

        try {
            const { ok, data } = await apiFetch('registrar', 'POST', {
                nombre: v("nombreCompleto"), correo: v("correoElectronico"), clave: v("claveNueva"), telefono: v("telefonoCazador"), direccion: v("direccionCueva")
            });
            if (ok && data.registro) {
                mostrarAlerta(alerta, "¡REGISTRO EXITOSO! INICIANDO SESIÓN...", "var(--color-oro)");
                setTimeout(() => window.location.href = "login.html", 1500);
            } else {
                mostrarAlerta(alerta, `¡ERROR! ${data.error.toUpperCase()}`);
            }
        } catch { mostrarAlerta(alerta, "¡ERROR ANCESTRAL! SIN CONEXIÓN SERVIDOR."); }
    });

    // validacion de login
    document.getElementById("formularioLogin")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const alerta = document.getElementById("alerta-login-rpg");
        try {
            const { ok, data } = await apiFetch('login', 'POST', { correo: document.getElementById("correoLogin").value, clave: document.getElementById("claveLogin").value });
            if (ok && data.login) {
                localStorage.setItem("usuarioSesion", JSON.stringify(data.usuario));
                data.usuario.historialPedidos?.length ? localStorage.setItem("trackingPedidos", JSON.stringify(data.usuario.historialPedidos)) : localStorage.removeItem("trackingPedidos");
                mostrarAlerta(alerta, "¡ACCESO CONCEDIDO! ENTRANDO A LA CUEVA...", "#00ff00");
                setTimeout(() => window.location.href = "index.html", 1500);
            } else {
                mostrarAlerta(alerta, `¡ERROR! ${data.error.toUpperCase()}`);
            }
        } catch { mostrarAlerta(alerta, "¡ERROR ANCESTRAL! SERVIDOR CAÍDO."); }
    });

    // Pinta mis procutos del menu
    if (tMenu && productosMemoria.length) {
        const tbody = tMenu.querySelector("tbody");
        tbody.innerHTML = "";
        productosMemoria.filter(p => Number(p.ES_OFERTA) === 0).forEach(plato => {
            const fila = document.createElement("tr");
            fila.innerHTML = `
                <td><strong>${plato.NOMBRE}</strong></td>
                <td>${plato.DESCRIPCION}</td>
                <td>S/ ${Number(plato.PRECIO_REGULAR).toFixed(2)}</td>
                <td>S/ ${Number(plato.PRECIO_OFERTA).toFixed(2)}</td>
                <td><button class="btn-caza-menu" data-id="${plato.ID_PRODUCTO}" data-nombre="${plato.NOMBRE}" data-precio="${plato.PRECIO_OFERTA}">Añadir al Pedido</button></td>`;
            tbody.appendChild(fila);
        });

        tMenu.addEventListener("click", (e) => {
            if (!e.target.classList.contains("btn-caza-menu")) return;
            if (!localStorage.getItem("usuarioSesion")) {
                alert("¡ALERTA ANCESTRAL! Inicia sesión para usar la mochila.");
                return window.location.href = "login.html";
            }
            const b = e.target;
            let carrito = JSON.parse(localStorage.getItem("carritoTemporal")) || [];
            const idx = carrito.findIndex(item => item.id === b.getAttribute("data-id"));

            if (idx !== -1) carrito[idx].cantidad++;
            else carrito.push({ id: b.getAttribute("data-id"), nombre: b.getAttribute("data-nombre"), precio: b.getAttribute("data-precio"), quantity: 1, cantidad: 1 });

            localStorage.setItem("carritoTemporal", JSON.stringify(carrito));
            PintarMochilaLateral();
            MostrarPopupMensaje(`¡${b.getAttribute("data-nombre").toUpperCase()} AÑADIDO! 🍖`);
        });
    }

    // Stock unidades permitidas
    if (tOfertas && productosMemoria.length) {
        const tbody = tOfertas.querySelector("tbody");
        tbody.innerHTML = "";
        productosMemoria.filter(p => Number(p.ES_OFERTA) === 1).forEach(plato => {
            const fila = document.createElement("tr");
            let msg = plato.STOCK <= 5 ? `¡Solo quedan ${plato.STOCK} raciones!` : "¡Oferta limitada!";
            fila.innerHTML = `
                <td><strong>${plato.NOMBRE}</strong></td>
                <td>S/ ${Number(plato.PRECIO_REGULAR).toFixed(2)}</td>
                <td style="color: var(--color-oro); font-weight: bold;">S/ ${Number(plato.PRECIO_OFERTA).toFixed(2)}</td>
                <td><span class="estado-proceso">${msg}</span></td>
                <td><button class="btn-caza-oferta" style="background: var(--color-lava);" data-id="${plato.ID_PRODUCTO}" data-nombre="${plato.NOMBRE}" data-precio="${plato.PRECIO_OFERTA}">Rescatar Ya</button></td>`;
            tbody.appendChild(fila);
        });

        tOfertas.addEventListener("click", (e) => {
            if (!e.target.classList.contains("btn-caza-oferta")) return;
            if (!localStorage.getItem("usuarioSesion")) {
                alert("¡ALERTA ANCESTRAL! Inicia sesión para rescatar ofertas.");
                return window.location.href = "login.html";
            }
            const b = e.target;
            const id = b.getAttribute("data-id");
            const dbProd = productosMemoria.find(p => p.ID_PRODUCTO == id);
            const maxStock = dbProd ? Number(dbProd.STOCK) : 0;

            let carrito = JSON.parse(localStorage.getItem("carritoTemporal")) || [];
            const idx = carrito.findIndex(item => item.id === id);

            if (idx !== -1) {
                if (carrito[idx].cantidad >= maxStock) {
                    MostrarPopupMensaje("¡ERROR! NO QUEDAN MÁS RACIONES. ❌");
                    b.innerText = "AGOTADO 🦴"; b.style.backgroundColor = "#3e2723"; b.disabled = true;
                    return;
                }
                carrito[idx].cantidad++;
            } else {
                if (maxStock <= 0) return MostrarPopupMensaje("¡PRODUCTO EXTINTO! ❌");
                carrito.push({ id, nombre: b.getAttribute("data-nombre"), precio: b.getAttribute("data-precio"), cantidad: 1 });
            }

            localStorage.setItem("carritoTemporal", JSON.stringify(carrito));
            PintarMochilaLateral();
            const qty = idx !== -1 ? carrito[idx].cantidad : 1;
            MostrarPopupMensaje(qty === maxStock ? `¡ÚLTIMA RACIÓN DE ${b.getAttribute("data-nombre").toUpperCase()}! 💎` : `¡${b.getAttribute("data-nombre").toUpperCase()} RESCATADO! 💎`);
        });
    }

    // Vista del resumen y pago(checkout)
    const tResumen = document.getElementById("tablaResumenMochila");
    const fPedido = document.getElementById("formularioPedido");
    const cbDirec = document.getElementById("direccionEntrega");

    if (tResumen) {
        if (!user) { alert("¡ACCESO DENEGADO! Identifícate."); return window.location.href = "login.html"; }
        let carrito = JSON.parse(localStorage.getItem("carritoTemporal")) || [];
        if (!carrito.length) { alert("Tu mochila está vacía."); return window.location.href = "menu.html"; }

        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        setVal("nombreCliente", user.NOMBRE);
        setVal("telefonoContacto", user.TELEFONO);

        if (cbDirec && user.direcciones) {
            cbDirec.innerHTML = '<option value="" disabled selected>Selecciona destino...</option>';
            user.direcciones.forEach(d => cbDirec.add(new Option(d, d)));
        }

        const tbody = tResumen.querySelector("tbody"); tbody.innerHTML = "";
        let total = 0;
        carrito.forEach(item => {
            const sub = parseFloat(item.precio) * item.cantidad; total += sub;
            const row = document.createElement("tr");
            row.innerHTML = `<td><strong>${item.nombre}</strong></td><td>S/ ${parseFloat(item.precio).toFixed(2)}</td><td>x${item.cantidad}</td><td>S/ ${sub.toFixed(2)}</td>`;
            tbody.appendChild(row);
        });
        const txtTotalForjar = document.getElementById("total-pedido-forjar");
        if (txtTotalForjar) txtTotalForjar.innerText = `S/ ${total.toFixed(2)}`;
    }

    // validacion y envio a la db
    if (fPedido) {
        fPedido.addEventListener("submit", async (e) => {
            e.preventDefault();
            const alerta = document.getElementById("alerta-pedido-rpg");
            const dSel = cbDirec ? cbDirec.value : "";
            const btn = document.getElementById("botonEnviarPedido");
            let carrito = JSON.parse(localStorage.getItem("carritoTemporal")) || [];

            if (!dSel) return mostrarAlerta(alerta, "¡ERROR! SELECCIONA DIRECCIÓN VÁLIDA.");
            if (!carrito.length) return alert("Mochila vacía.");

            if (btn) { btn.disabled = true; btn.innerText = "FORJANDO BANQUETE... 🔥"; }
            localStorage.setItem("direccionPedidoTemporal", dSel);

            try {
                // envio de alerta de confirmacion
                for (const item of carrito) {
                    await apiFetch('pedidos', 'POST', { correoUsuario: user.CORREO, idProducto: item.id, cantidad: item.cantidad, direccionEntrega: dSel });
                }
                mostrarAlerta(alerta, "¡EL BANQUETE HA SIDO FORJADO EXITOSAMENTE! 🦖", "#00ff00");
                localStorage.setItem("pedidoConfirmado", "true");
                setTimeout(() => window.location.href = "pedidos.html", 1800);
            } catch {
                if (btn) { btn.disabled = false; btn.innerText = "🔥 Enviar Pedido a la Tribu"; }
                mostrarAlerta(alerta, "¡ERROR ANCESTRAL! CAÍDA DE BASE DE DATOS.");
            }
        });
    }

    // 🔹 Simulacion de proceso de envio y entrega
    const tHistorial = document.getElementById("tablaHistorialPedidos");
    if (tHistorial) {
        if (!user) { alert("Debes loguearte."); return window.location.href = "login.html"; }

        let trackLocal = JSON.parse(localStorage.getItem("trackingPedidos")) || [];
        let carReciente = JSON.parse(localStorage.getItem("carritoTemporal")) || [];

        if (carReciente.length && localStorage.getItem("pedidoConfirmado") === "true") {
            const dirElegida = localStorage.getItem("direccionPedidoTemporal") || (user.direcciones ? user.direcciones[0] : "Magdalena, Lima");
            carReciente.forEach(item => {
                trackLocal.unshift({ id: Math.floor(1000 + Math.random() * 9000), plato: item.nombre, cantidad: item.cantidad, direccion: dirElegida, estado: "preparandose" });
            });
            localStorage.setItem("trackingPedidos", JSON.stringify(trackLocal));
            ["carritoTemporal", "pedidoConfirmado", "direccionPedidoTemporal"].forEach(k => localStorage.removeItem(k));
        } else { localStorage.removeItem("pedidoConfirmado"); }

        // 🔹 [MANIPULACIÓN DEL DOM] -> Render de filas reactivas del historial
        const renderHistorial = () => {
            const tbody = tHistorial.querySelector("tbody"); tbody.innerHTML = "";
            let data = JSON.parse(localStorage.getItem("trackingPedidos")) || [];
            if (!data.length) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #8d6e63; font-style: italic;">No has realizado cacerías...</td></tr>`;
                return false;
            }
            data.forEach(p => {
                let clase = p.estado === "entregado" ? "estado-entregado" : "estado-proceso";
                let txt = p.estado === "preparandose" ? "Preparandose... 🍳" : p.estado === "en camino" ? "En camino... 🦖" : "Entregado ✔";
                const row = document.createElement("tr");
                row.innerHTML = `<td>#${p.id}</td><td><strong>${p.plato}</strong></td><td>${p.cantidad}</td><td>${p.direccion}</td><td><span class="${clase}">${txt}</span></td>`;
                tbody.appendChild(row);
            });
            return true;
        };

        // Put
        if (renderHistorial()) {
            const loopTribu = setInterval(async () => {
                let current = JSON.parse(localStorage.getItem("trackingPedidos")) || [];
                let m = current.find(p => p.estado === "preparandose" || p.estado === "en camino");
                
                if (m) {
                    let viejo = m.estado;
                    m.estado = viejo === "preparandose" ? "en camino" : "entregado";
                    localStorage.setItem("trackingPedidos", JSON.stringify(current));
                    renderHistorial(); // Refresco del DOM
                    
                    let popMsg = viejo === "preparandose" ? `¡Pedido #${m.id} EN CAMINO! 🦖` : `¡Pedido #${m.id} ENTREGADO! ✔`;
                    MostrarPopupMensaje(popMsg);

                    // sincronizacion con la api (loop)
                    try { await apiFetch(`pedidos/${m.id}/estado`, 'PUT', { nuevoEstado: m.estado }); } 
                    catch { console.error("Error al actualizar estado en backend remoto."); }
                } else { clearInterval(loopTribu); }
            }, 5000);
        }
    }

    // Modificacion del perfil
    const fClave = document.getElementById("formCambiarClave");
    const fDir = document.getElementById("formNuevaDireccion");
    const lDir = document.getElementById("listaDireccionesPerfil");
    const aPerf = document.getElementById("alerta-perfil-rpg");

    const renderDirecciones = (u) => {
        if (!lDir) return; lDir.innerHTML = "";
        if (!u.direcciones?.length) { lDir.innerHTML = `<li style="color: #8d6e63; font-style: italic; padding: 5px 0;">No registras cuevas secundarias...</li>`; return; }
        u.direcciones.forEach(d => {
            const li = document.createElement("li"); li.style.padding = "8px 0"; li.style.borderBottom = "1px dashed #333";
            li.innerHTML = `⛺ <span>${d}</span>`; lDir.appendChild(li);
        });
    };

    if (fClave) {
        fClave.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!localStorage.getItem("usuarioSesion")) return window.location.href = "login.html";
            const input = document.getElementById("nuevaClavePerfil");
            try {
                const { ok, data } = await apiFetch('usuario/cambiar-clave', 'PUT', { correo: user.CORREO || user.correo, nuevaClave: input.value });
                if (ok && data.actualizado) {
                    mostrarAlerta(aPerf, "¡LA CLAVE HA SIDO REFORJADA! ⚔️", "#00ff00");
                    user.CLAVE = input.value; localStorage.setItem("usuarioSesion", JSON.stringify(user));
                    input.value = "";
                } else { mostrarAlerta(aPerf, `¡ERROR! ${data.error?.toUpperCase()}`); }
            } catch { mostrarAlerta(aPerf, "¡ERROR! SERVIDOR COLAPASADO."); }
        });
    }

    if (fDir) {
        fDir.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!localStorage.getItem("usuarioSesion")) return window.location.href = "login.html";
            const input = document.getElementById("nuevaDireccionInput");
            const strDir = input.value.trim();
            try {
                const { ok, data } = await apiFetch('usuario/nueva-direccion', 'POST', { correo: user.CORREO || user.correo, direccion: strDir });
                if (ok && data.creado) {
                    if (!user.direcciones) user.direcciones = [];
                    user.direcciones.push(strDir);
                    localStorage.setItem("usuarioSesion", JSON.stringify(user));
                    renderDirecciones(user); input.value = "";
                    mostrarAlerta(aPerf, "¡NUEVA CUEVA ANOTADA EXITOSAMENTE! ⛺", "#00ff00");
                } else { mostrarAlerta(aPerf, `¡ERROR! ${data.error.toUpperCase()}`); }
            } catch { mostrarAlerta(aPerf, "¡ERROR ANCESTRAL! SIN SERVIDOR."); }
        });
    }
}

// Inicializador de todooo !!!
document.addEventListener("DOMContentLoaded", CargarDomYServicios);