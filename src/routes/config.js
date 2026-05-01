const express = require('express');
const { pool } = require('../db');
const router  = express.Router();

const SUBCUENTAS = ['ahorro','personal','matrimonio','hijos','deudas'];

// GET /api/config
router.get('/', async (_req, res) => {
  try {
    const [cfg, saldos, catIng, catGasto] = await Promise.all([
      pool.query('SELECT clave, valor FROM config'),
      pool.query('SELECT subcuenta, monto FROM saldos_iniciales'),
      pool.query('SELECT * FROM categorias_ingresos ORDER BY especial NULLS LAST, nombre'),
      pool.query('SELECT * FROM categorias_gastos ORDER BY nombre'),
    ]);

    const cfgMap = {};
    cfg.rows.forEach(r => { cfgMap[r.clave] = r.valor; });

    const saldosMap = {};
    saldos.rows.forEach(r => { saldosMap[r.subcuenta] = parseFloat(r.monto); });

    res.json({
      pension:         parseFloat(cfgMap.pension || 1997),
      darkMode:        cfgMap.dark_mode !== 'false',
      saldosIniciales: saldosMap,
      catIngresos:     catIng.rows,
      catGastos:       catGasto.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error cargando config' });
  }
});

// PUT /api/config/pension
router.put('/pension', async (req, res) => {
  const { monto } = req.body;
  if (!monto || isNaN(monto) || monto < 0)
    return res.status(400).json({ error: 'Monto inválido' });
  try {
    await pool.query(
      `INSERT INTO config(clave,valor) VALUES('pension',$1)
       ON CONFLICT(clave) DO UPDATE SET valor=$1`, [String(monto)]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error guardando pensión' });
  }
});

// PUT /api/config/dark-mode
router.put('/dark-mode', async (req, res) => {
  const { darkMode } = req.body;
  try {
    await pool.query(
      `INSERT INTO config(clave,valor) VALUES('dark_mode',$1)
       ON CONFLICT(clave) DO UPDATE SET valor=$1`, [String(darkMode)]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error guardando tema' });
  }
});

// PUT /api/config/saldos-iniciales
router.put('/saldos-iniciales', async (req, res) => {
  const { saldos } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [sub, monto] of Object.entries(saldos)) {
      if (!SUBCUENTAS.includes(sub)) continue;
      await client.query(
        `INSERT INTO saldos_iniciales(subcuenta,monto) VALUES($1,$2)
         ON CONFLICT(subcuenta) DO UPDATE SET monto=$2`,
        [sub, parseFloat(monto) || 0]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error guardando saldos' });
  } finally {
    client.release();
  }
});

// POST /api/config/categorias-ingresos
router.post('/categorias-ingresos', async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const r = await pool.query(
      `INSERT INTO categorias_ingresos(nombre,especial) VALUES($1,NULL)
       ON CONFLICT(nombre) DO NOTHING RETURNING *`,
      [nombre.trim()]
    );
    res.json(r.rows[0] || { nombre });
  } catch (err) {
    res.status(500).json({ error: 'Error agregando categoría' });
  }
});

// DELETE /api/config/categorias-ingresos/:id
router.delete('/categorias-ingresos/:id', async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM categorias_ingresos WHERE id=$1 AND especial IS NULL`,
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando categoría' });
  }
});

// POST /api/config/categorias-gastos
router.post('/categorias-gastos', async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const r = await pool.query(
      `INSERT INTO categorias_gastos(nombre) VALUES($1)
       ON CONFLICT(nombre) DO NOTHING RETURNING *`,
      [nombre.trim()]
    );
    res.json(r.rows[0] || { nombre });
  } catch (err) {
    res.status(500).json({ error: 'Error agregando categoría' });
  }
});

// DELETE /api/config/categorias-gastos/:id
router.delete('/categorias-gastos/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM categorias_gastos WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando categoría' });
  }
});

module.exports = router;
