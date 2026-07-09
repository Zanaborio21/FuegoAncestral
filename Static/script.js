/* PARTE 1: CAPA DE BACKEND (Lógica de Negocio, Datos y Servidor) */


let productosMemoria = [];

// --- API Helper
const apiFetch = async (url, method = 'GET', body = null) => {
    const config = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) config.body = JSON.stringify(body);
    const res = await fetch(`http://localhost:3000/api/${url}`, config);
    return { ok: res.ok, data: await res.json() };
};

// Controlador de Autenticación (Backend)
const AuthBackend = {
    async registrarUsuario(datos) {
        if (datos.claveNueva !== datos.confirmarClave) return { ok: false, msg: "¡ERROR! LAS CONTRASEÑAS NO COINCIDEN." };
        if (datos.telefonoCazador.length !== 9 || isNaN(datos.telefonoCazador)) return { ok: false, msg: "¡ERROR! EL TELÉFONO DEBE TENER 9 NÚMEROS." };

        try {
            const { ok, data } = await apiFetch('registrar', 'POST', {
                nombre: datos.nombreCompleto, correo: datos.correoElectronico, clave: datos.claveNueva, telefono: datos.telefonoCazador, direccion: datos.direccionCueva
            });
            if (ok && data.registro) return { ok: true, msg: "¡REGISTRO EXITOSO! INICIANDO SESIÓN..." };
            return { ok: false, msg: `¡ERROR! ${data.error.toUpperCase()}` };
        } catch {
            return { ok: false, msg: "¡ERROR ANCESTRAL! SIN CONEXIÓN SERVIDOR." };
        }
    },

    async loginUsuario(correo, clave) {
        try {
            const { ok, data } = await apiFetch('login', 'POST', { correo, clave });
            if (ok && data.login) {
                localStorage.setItem("usuarioSesion", JSON.stringify(data.usuario));
                data.usuario.historialPedidos?.length ? localStorage.setItem("trackingPedidos", JSON.stringify(data.usuario.historialPedidos)) : localStorage.removeItem("trackingPedidos");
                return { ok: true, msg: "¡ACCESO CONCEDIDO! ENTRANDO A LA CUEVA..." };
            }
            return { ok: false, msg: `¡ERROR! ${data.error.toUpperCase()}` };
        } catch {
            return { ok: false, msg: "¡ERROR ANCESTRAL! SERVIDOR CAÍDO." };
        }
    }
};

// Controlador de la Tienda y Mochila (Backend)
const TiendaBackend = {
    async sincronizarProductos() {
        try {
            const res = await fetch('http://localhost:3000/api/productos');
            productosMemoria = await res.json();
            return { ok: true, productos: productosMemoria };
        } catch (err) {
            console.error("Error al conectar con la base de datos", err);
            return { ok: false, productos: [] };
        }
    },

    agregarItemMochila(id, nombre, precio, esOferta) {
        if (!localStorage.getItem("usuarioSesion")) return { ok: false, msg: "¡ALERTA ANCESTRAL! Inicia sesión para usar la mochila.", redirigir: true };

        let carrito = JSON.parse(localStorage.getItem("carritoTemporal")) || [];
        const idx = carrito.findIndex(item => item.id === id);

        if (esOferta) {
            const dbProd = productosMemoria.find(p => p.ID_PRODUCTO == id);
            const maxStock = dbProd ? Number(dbProd.STOCK) : 0;
            if (idx !== -1) {
                if (carrito[idx].cantidad >= maxStock) return { ok: false, msg: "¡ERROR! NO QUEDAN MÁS RACIONES. ❌", agotado: true };
                carrito[idx].cantidad++;
            } else {
                if (maxStock <= 0) return { ok: false, msg: "¡PRODUCTO EXTINTO! ❌" };
                carrito.push({ id, nombre, precio, cantidad: 1 });
            }
        } else {
            if (idx !== -1) carrito[idx].cantidad++;
            else carrito.push({ id, nombre, precio, cantidad: 1 });
        }

        localStorage.setItem("carritoTemporal", JSON.stringify(carrito));
        const qty = idx !== -1 ? carrito[idx].cantidad : 1;
        return { ok: true, msg: `¡${nombre.toUpperCase()} RESCATADO! 💎`, cantidad: qty };
    }
};

// Componentes Globales de UI
function MostrarPopupMensaje(texto) {
    const popup = document.createElement("div");
    popup.className = "popup-notificacion-rpg";
    popup.innerText = texto;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 2000);
}

const mostrarAlertaFormulario = (el, msg, color = "var(--color-lava)") => {
    if (!el) return;
    el.style.display = "block";
    el.style.color = el.style.borderColor = color;
    el.innerText = msg;
};

function PintarMochilaLateral() {
    const lista = document.getElementById("lista-items-carrito");
    if (!lista) return;

    const carrito = JSON.parse(localStorage.getItem("carritoTemporal")) || [];
    const vacioText = document.getElementById("lista-inventario-vacia");
    const cajaTotal = document.getElementById("total-inventario-caja");

    vacioText && (vacioText.style.display = carrito.length ? "none" : "block");
    cajaTotal && (cajaTotal.style.display = carrito.length ? "block" : "none");
    lista.innerHTML = "";

    if (!carrito.length) return;

    let total = 0;
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

const FrontEndTemplates = {
    
    /* index.html, navbar, loader, mochila lateral(compartido)*/
    global() {
        window.addEventListener("load", () => {
            const loader = document.getElementById("loader-ancestral");
            if (loader) {
                loader.classList.add("loader-oculto");
                setTimeout(() => loader.style.display = "none", 500); 
            }
        });

        const user = JSON.parse(localStorage.getItem("usuarioSesion"));
        const elLogin = document.getElementById("nav-login");
        const elReg = document.getElementById("nav-registrar");
        const elPerfil = document.getElementById("nav-perfil");
        const elLogout = document.getElementById("nav-logout");

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

        document.getElementById("btn-logout-tribu")?.addEventListener("click", (e) => {
            e.preventDefault();
            ["usuarioSesion", "carritoTemporal", "pedidoConfirmado", "direccionPedidoTemporal", "trackingPedidos"].forEach(k => localStorage.removeItem(k));
            alert("Has salido de la cueva. ¡Regresa pronto, cazador!");
            window.location.href = "index.html";
        });

        document.getElementById("inventario-menu-lateral")?.addEventListener("click", (e) => {
            if (!e.target.classList.contains("btn-eliminar-item-mochila")) return;
            const idx = e.target.getAttribute("data-index");
            let carrito = JSON.parse(localStorage.getItem("carritoTemporal"));
            const idDel = carrito[idx].id;

            carrito.splice(idx, 1);
            localStorage.setItem("carritoTemporal", JSON.stringify(carrito));
            PintarMochilaLateral();

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

        document.getElementById("btn-ir-pagar-tribu")?.addEventListener("click", () => window.location.href = "form_pedido.html");
    },

    /* index.html / menu.html / ofertas.html*/
    async tienda() {
        const tMenu = document.getElementById("tablaProductos");
        const tOfertas = document.getElementById("tablaOfertasUrgentes");

        const resultado = await TiendaBackend.sincronizarProductos();
        if (!resultado.ok) return;

        PintarMochilaLateral();

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
                const b = e.target;
                const res = TiendaBackend.agregarItemMochila(b.getAttribute("data-id"), b.getAttribute("data-nombre"), b.getAttribute("data-precio"), false);
                
                if (res.ok) {
                    PintarMochilaLateral();
                    if (res.cantidad > 1) {
                        MostrarPopupMensaje(`¡BOTÍN DUPLICADO! Llevas x${res.cantidad} de ${b.getAttribute("data-nombre").toUpperCase()} 🎒`);
                    } else {
                        MostrarPopupMensaje(`¡${b.getAttribute("data-nombre").toUpperCase()} AÑADIDO! 🍖`);
                    }
                } else if (res.redirigir) {
                    alert(res.msg);
                    window.location.href = "login.html";
                }
            });
        }

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
                const b = e.target;
                const res = TiendaBackend.agregarItemMochila(b.getAttribute("data-id"), b.getAttribute("data-nombre"), b.getAttribute("data-precio"), true);
                
                if (res.ok) {
                    PintarMochilaLateral();
                    if (res.cantidad > 1) {
                        MostrarPopupMensaje(`¡MÁS RACIONES! Llevas x${res.cantidad} de ${b.getAttribute("data-nombre").toUpperCase()} 🎒`);
                    } else {
                        MostrarPopupMensaje(`¡${b.getAttribute("data-nombre").toUpperCase()} RESCATADO! 💎`);
                    }
                } else if (res.redirigir) {
                    alert(res.msg);
                    window.location.href = "login.html";
                } else if (res.agotado) {
                    MostrarPopupMensaje(res.msg);
                    b.innerText = "AGOTADO 🦴"; b.style.backgroundColor = "#3e2723"; b.disabled = true;
                }
            });
        }
    },

    /*registrar.html*/
    registrar() {
        document.getElementById("formularioRegistro")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const alerta = document.getElementById("alerta-rpg");
            const datos = {
                claveNueva: document.getElementById("claveNueva").value,
                confirmarClave: document.getElementById("confirmarClave").value,
                telefonoCazador: document.getElementById("telefonoCazador").value,
                nombreCompleto: document.getElementById("nombreCompleto").value,
                correoElectronico: document.getElementById("correoElectronico").value,
                direccionCueva: document.getElementById("direccionCueva").value
            };

            const respuesta = await AuthBackend.registrarUsuario(datos);
            if (respuesta.ok) {
                mostrarAlertaFormulario(alerta, respuesta.msg, "var(--color-oro)");
                setTimeout(() => window.location.href = "login.html", 1500);
            } else {
                mostrarAlertaFormulario(alerta, respuesta.msg);
            }
        });
    },

    /*login.html*/
    login() {
        document.getElementById("formularioLogin")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const alerta = document.getElementById("alerta-login-rpg");
            const correo = document.getElementById("correoLogin").value;
            const clave = document.getElementById("claveLogin").value;

            const respuesta = await AuthBackend.loginUsuario(correo, clave);
            if (respuesta.ok) {
                mostrarAlertaFormulario(alerta, respuesta.msg, "#00ff00");
                setTimeout(() => window.location.href = "index.html", 1500);
            } else {
                mostrarAlertaFormulario(alerta, respuesta.msg);
            }
        });
    },

    /*form_pedido.html */
    pedido() {
        const tResumen = document.getElementById("tablaResumenMochila");
        const fPedido = document.getElementById("formularioPedido");
        const cbDirec = document.getElementById("direccionEntrega");
        const user = JSON.parse(localStorage.getItem("usuarioSesion"));

        if (tResumen && user) {
            let carrito = JSON.parse(localStorage.getItem("carritoTemporal")) || [];
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

        if (fPedido) {
            fPedido.addEventListener("submit", async (e) => {
                e.preventDefault();
                const alerta = document.getElementById("alerta-pedido-rpg");
                const dSel = cbDirec ? cbDirec.value : "";
                const btn = document.getElementById("botonEnviarPedido");
                let carrito = JSON.parse(localStorage.getItem("carritoTemporal")) || [];

                if (!dSel) return mostrarAlertaFormulario(alerta, "¡ERROR! SELECCIONA DIRECCIÓN VÁLIDA.");
                if (!carrito.length) return alert("Mochila vacía.");

                if (btn) { btn.disabled = true; btn.innerText = "FORJANDO BANQUETE... 🔥"; }
                localStorage.setItem("direccionPedidoTemporal", dSel);

                try {
                    for (const item of carrito) {
                        await apiFetch('pedidos', 'POST', { correoUsuario: user.CORREO, idProducto: item.id, cantidad: item.cantidad, direccionEntrega: dSel });
                    }
                    mostrarAlertaFormulario(alerta, "¡EL BANQUETE HA SIDO FORJADO EXITOSAMENTE! 🦖", "#00ff00");
                    localStorage.setItem("pedidoConfirmado", "true");
                    setTimeout(() => window.location.href = "pedidos.html", 1800);
                } catch {
                    if (btn) { btn.disabled = false; btn.innerText = "🔥 Enviar Pedido a la Tribu"; }
                    mostrarAlertaFormulario(alerta, "¡ERROR ANCESTRAL! CAÍDA DE BASE DE DATOS.");
                }
            });
        }
    },

    /* pedidos.html*/
    historial() {
        const tHistorial = document.getElementById("tablaHistorialPedidos");
        if (!tHistorial) return;

        const user = JSON.parse(localStorage.getItem("usuarioSesion"));
        let trackLocal = JSON.parse(localStorage.getItem("trackingPedidos")) || [];
        let carReciente = JSON.parse(localStorage.getItem("carritoTemporal")) || [];

        if (carReciente.length && localStorage.getItem("pedidoConfirmado") === "true") {
            const dirElegida = localStorage.getItem("direccionPedidoTemporal") || "Magdalena, Lima";
            carReciente.forEach(item => {
                trackLocal.unshift({ id: Math.floor(1000 + Math.random() * 9000), plato: item.nombre, cantidad: item.cantidad, direccion: dirElegida, estado: "preparandose" });
            });
            localStorage.setItem("trackingPedidos", JSON.stringify(trackLocal));
            ["carritoTemporal", "pedidoConfirmado", "direccionPedidoTemporal"].forEach(k => localStorage.removeItem(k));
        }

        const renderHistorial = () => {
            const tbody = tHistorial.querySelector("tbody"); tbody.innerHTML = "";
            let data = JSON.parse(localStorage.getItem("trackingPedidos")) || [];
            if (!data.length) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #8d6e63; font-style: italic;">No has realizado cacerías...</td></tr>`;
                return false;
            }
            data.forEach(p => {
                let clase = p.estado === "entregado" ? "estado-entregado" : "estado-proceso";
                let txt = p.estado === "preparandose" ? "Preparándose... 🍳" : p.estado === "en camino" ? "En camino... 🦖" : "Entregado ✔";
                const row = document.createElement("tr");
                row.innerHTML = `<td>#${p.id}</td><td><strong>${p.plato}</strong></td><td>${p.cantidad}</td><td>${p.direccion}</td><td><span class="${clase}">${txt}</span></td>`;
                tbody.appendChild(row);
            });
            return true;
        };

        if (renderHistorial()) {
            const loopTribu = setInterval(async () => {
                let current = JSON.parse(localStorage.getItem("trackingPedidos")) || [];
                let m = current.find(p => p.estado === "preparandose" || p.estado === "en camino");
                
                if (m) {
                    let viejo = m.estado;
                    m.estado = viejo === "preparandose" ? "en camino" : "entregado";
                    localStorage.setItem("trackingPedidos", JSON.stringify(current));
                    renderHistorial();
                    
                    let popMsg = viejo === "preparandose" ? `¡Pedido #${m.id} EN CAMINO! 🦖` : `¡Pedido #${m.id} ENTREGADO! ✔`;
                    MostrarPopupMensaje(popMsg);

                    try { await apiFetch(`pedidos/${m.id}/estado`, 'PUT', { nuevoEstado: m.estado }); } 
                    catch { console.error("Error backend."); }
                } else { clearInterval(loopTribu); }
            }, 5000);
        }
    },

    /*perfil.html*/

    perfil() {
        const fClave = document.getElementById("formCambiarClave");
        const fDir = document.getElementById("formNuevaDireccion");
        const lDir = document.getElementById("listaDireccionesPerfil");
        const aPerf = document.getElementById("alerta-perfil-rpg");
        let user = JSON.parse(localStorage.getItem("usuarioSesion"));

        const renderDirecciones = (u) => {
            if (!lDir) return; lDir.innerHTML = "";
            if (!u.direcciones?.length) { lDir.innerHTML = `<li style="color: #8d6e63; font-style: italic;">No registras cuevas secundarias...</li>`; return; }
            u.direcciones.forEach(d => {
                const li = document.createElement("li"); li.style.padding = "5px 0";
                li.innerHTML = `⛺ <span>${d}</span>`; lDir.appendChild(li);
            });
        };

        if (user && lDir) renderDirecciones(user);

        // 🔑 Temporizador para Cambio de Clave
        if (fClave) {
            fClave.addEventListener("submit", async (e) => {
                e.preventDefault();
                const input = document.getElementById("nuevaClavePerfil");
                try {
                    const { ok, data } = await apiFetch('usuario/cambiar-clave', 'PUT', { correo: user.CORREO || user.correo, nuevaClave: input.value });
                    if (ok && data.actualizado) {
                        mostrarAlertaFormulario(aPerf, "¡LA CLAVE HA SIDO REFORJADA! ⚔️", "#00ff00");
                        user.CLAVE = input.value; localStorage.setItem("usuarioSesion", JSON.stringify(user));
                        input.value = "";
                        
                        // 🌟 EFECTO ÚNICO: Se limpia a los 2 segundos
                        setTimeout(() => {
                            aPerf.style.display = "none";
                            aPerf.innerText = "";
                        }, 2000);
                    }
                } catch { 
                    mostrarAlertaFormulario(aPerf, "¡ERROR!"); 
                    setTimeout(() => { aPerf.style.display = "none"; }, 2000);
                }
            });
        }

        // ⛺ Temporizador para Nueva Dirección
        if (fDir) {
            fDir.addEventListener("submit", async (e) => {
                e.preventDefault();
                const input = document.getElementById("nuevaDireccionInput");
                const strDir = input.value.trim();
                try {
                    const { ok, data } = await apiFetch('usuario/nueva-direccion', 'POST', { correo: user.CORREO || user.correo, direccion: strDir });
                    if (ok && data.creado) {
                        if (!user.direcciones) user.direcciones = [];
                        user.direcciones.push(strDir);
                        localStorage.setItem("usuarioSesion", JSON.stringify(user));
                        renderDirecciones(user); 
                        input.value = "";
                        mostrarAlertaFormulario(aPerf, "¡NUEVA CUEVA ANOTADA! ⛺", "#00ff00");
                        
                        setTimeout(() => {
                            aPerf.style.display = "none";
                            aPerf.innerText = "";
                        }, 2000);
                    }
                } catch { 
                    mostrarAlertaFormulario(aPerf, "¡ERROR!"); 
                    setTimeout(() => { aPerf.style.display = "none"; }, 2000);
                }
            });
        }
    }
};

/* ==========================================================================
   🚀 ROUTER: Enrutador que dispara el Frontend según el archivo abierto
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
    FrontEndTemplates.global();

    const pathSeguimientos = window.location.pathname.split('/');
    const archivoActual = pathSeguimientos[pathSeguimientos.length - 1].toLowerCase();

    if (archivoActual === "" || archivoActual === "index.html" || archivoActual === "menu.html" || archivoActual === "ofertas.html") {
        FrontEndTemplates.tienda();
    } 
    else if (archivoActual === "registrar.html") {
        FrontEndTemplates.registrar();
    } 
    else if (archivoActual === "login.html") {
        FrontEndTemplates.login();
    }
    else if (archivoActual === "form_pedido.html") {
        FrontEndTemplates.pedido();
    }
    else if (archivoActual === "pedidos.html") {
        FrontEndTemplates.historial();
    }
    else if (archivoActual === "perfil.html") {
        FrontEndTemplates.perfil();
    }
});