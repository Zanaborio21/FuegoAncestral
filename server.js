const express = require('express');
const oracledb = require('oracledb');
const cors = require('cors');
require('dotenv').config(); 

const app = express();
app.use(express.json());
app.use(cors());

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECTION_STRING
};

app.post('/api/registrar', async (req, res) => {
    const { nombre, correo, clave, telefono, direccion } = req.body;
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        const existe = await connection.execute(
            `SELECT CORREO FROM USUARIOS WHERE CORREO = :correo`,
            [correo]
        );

        if (existe.rows.length > 0) {
            return res.status(400).json({ error: "este miembro ya existe en la tribu" });
        }

        await connection.execute(
            `INSERT INTO USUARIOS (CORREO, NOMBRE, CLAVE, TELEFONO) 
             VALUES (:correo, :nombre, :clave, :telefono)`,
            [correo, nombre, clave, telefono]
        );

        await connection.execute(
            `INSERT INTO DIRECCIONES (CORREO_USUARIO, DIRECCION) 
             VALUES (:correo, :direccion)`,
            [correo, direccion]
        );

        await connection.commit();
        res.json({ registro: true });

    } catch (err) {
        console.error(err);
        if (connection) await connection.rollback();
        res.status(500).json({ error: "error del servidor al fundar el cazador" });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
});

app.post('/api/login', async (req, res) => {
    const { correo, clave } = req.body;
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        
        const result = await connection.execute(
            `SELECT CORREO, NOMBRE, TELEFONO FROM USUARIOS WHERE CORREO = :correo AND CLAVE = :clave`,
            [correo, clave],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length > 0) {
            const usuarioLogueado = result.rows[0];

            // Jalar direcciones vinculadas
            const dirResult = await connection.execute(
                `SELECT DIRECCION FROM DIRECCIONES WHERE CORREO_USUARIO = :correo`,
                [usuarioLogueado.CORREO],
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );

            usuarioLogueado.direcciones = dirResult.rows.map(d => d.DIRECCION);

            const pedidosResult = await connection.execute(
                `SELECT P.ID_PEDIDO as id, PR.NOMBRE as plato, P.CANTIDAD as cantidad, P.DIRECCION_ENTREGA as direccion, P.ESTADO as estado
                 FROM PEDIDOS P 
                 JOIN PRODUCTOS PR ON P.ID_PRODUCTO = PR.ID_PRODUCTO 
                 WHERE P.CORREO_USUARIO = :correo
                 ORDER BY P.ID_PEDIDO DESC`,
                [usuarioLogueado.CORREO],
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );

            usuarioLogueado.historialPedidos = pedidosResult.rows.map(p => ({
                id: p.ID || p.id,
                plato: p.PLATO || p.plato,
                cantidad: p.CANTIDAD || p.cantidad,
                direccion: p.DIRECCION || p.direccion,
                estado: p.ESTADO || p.estado || 'preparandose'
            }));

            res.json({ login: true, usuario: usuarioLogueado });
        } else {
            res.status(401).json({ login: false, error: "credenciales invalidas en la tribu" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "error del servidor ancestral" });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
});

app.get('/api/productos', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(
            `SELECT ID_PRODUCTO, NOMBRE, DESCRIPCION, PRECIO_REGULAR, PRECIO_OFERTA, STOCK, ES_OFERTA FROM PRODUCTOS`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "no se pudieron jalar los platos ancestrales" });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
});

app.post('/api/pedidos', async (req, res) => {
    const { correoUsuario, idProducto, cantidad, direccionEntrega } = req.body;
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        
        const result = await connection.execute(
            `INSERT INTO PEDIDOS (CORREO_USUARIO, ID_PRODUCTO, CANTIDAD, DIRECCION_ENTREGA) 
             VALUES (:correoUsuario, :idProducto, :cantidad, :direccionEntrega)
             RETURNING ID_PEDIDO INTO :idPedido`,
            {
                correoUsuario, idProducto, cantidad, direccionEntrega,
                idPedido: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
            }
        );
        
        await connection.commit();
        const idGenerado = result.outBinds.idPedido[0];
        res.json({ creado: true, idPedido: idGenerado });
    } catch (err) {
        console.error(err);
        if (connection) await connection.rollback();
        res.status(500).json({ error: "no se pudo registrar el banquete" });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
});

app.put('/api/pedidos/:id/estado', async (req, res) => {
    const pedidoId = req.params.id;
    const { nuevoEstado } = req.body;
    let connection;

    const estadosValidos = ['preparandose', 'en camino', 'entregado', 'cancelado'];
    if (!estadosValidos.includes(nuevoEstado)) {
        return res.status(400).json({ error: "estado ancestral no valido" });
    }

    try {
        connection = await oracledb.getConnection(dbConfig);
        await connection.execute(
            `UPDATE PEDIDOS SET ESTADO = :nuevoEstado WHERE ID_PEDIDO = :pedidoId`,
            [nuevoEstado, pedidoId]
        );
        await connection.commit();
        res.json({ actualizado: true, estado: nuevoEstado });
    } catch (err) {
        console.error(err);
        if (connection) await connection.rollback();
        res.status(500).json({ error: "error al cambiar el estado del banquete" });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
});

app.put('/api/usuario/cambiar-clave', async (req, res) => {
    const { correo, nuevaClave } = req.body;

    if (!correo || !nuevaClave) {
        return res.status(400).json({ actualizado: false, error: "faltan coordenadas para cambiar la clave" });
    }

    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig); 

        const result = await connection.execute(
            `UPDATE USUARIOS SET CLAVE = :nuevaClave WHERE CORREO = :correo`,
            [nuevaClave, correo]
        );

        await connection.commit();

        if (result.rowsAffected && result.rowsAffected > 0) {
            res.json({ actualizado: true, mensaje: "clave modificada en la base de datos real" });
        } else {
            res.status(404).json({ actualizado: false, error: "no se encontro al cazador en la tribu" });
        }

    } catch (err) {
        console.error(err);
        if (connection) await connection.rollback();
        res.status(500).json({ error: "error del servidor al mutar la clave en oracle" });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
});

app.post('/api/usuario/nueva-direccion', async (req, res) => {
    const { correo, direccion } = req.body;
    let connection;

    if (!correo || !direccion) {
        return res.status(400).json({ error: "Faltan datos para registrar la cueva." });
    }

    try {
        connection = await oracledb.getConnection(dbConfig);

        await connection.execute(
            `INSERT INTO DIRECCIONES (CORREO_USUARIO, DIRECCION) 
             VALUES (:correo, :direccion)`,
            [correo, direccion]
        );

        await connection.commit();
        res.json({ creado: true, mensaje: "Cueva añadida con éxito a Oracle." });

    } catch (err) {
        console.error(err);
        if (connection) await connection.rollback();
        res.status(500).json({ error: "No se pudo guardar la dirección en el servidor ancestral." });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
});

app.listen(3000, () => {
    console.log("servidor de la tribu corriendo en http://localhost:3000");
});