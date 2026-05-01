const express = require('express');
const { pool } = require('../db');
const router  = express.Router();

const VALIDAS = ['ahorro','personal','matrimonio','hijos','deudas'];

// GET /api/gastos?subcuenta=X
router.get('/', async (req, res) => {
  const { subcuenta } = req.query;
  try {
    let q = 'SELECT * FROM gastos';
    const params = [];
    if (subcuenta && VALIDAS.includes(subcuenta)) {
      q += ' WHERE subcuenta=$1';
      params.push(subcuenta);
    }
    q += ' ORDER BY fecha DESC, created_at DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error cargando gastos' });
  }
});

// POST /api/gastos
router.post('/', async (req, res) => {
  const { subcuenta, fecha, categoria, descripcion, monto } = req.body;
  if (!subcuenta || !VALIDAS.includes(subcuenta))
    return res.status(400).json({ error: 'Subcuenta inválida' });
  if (!fecha || !monto || monto <= 0)
    return res.status(400).json({ error: 'Fecha y monto requeridos' });
  try {
    const r = await pool.query(
      `INSERT INTO gastos(subcuenta,fecha,categoria,descripcion,monto)
       VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [subcuenta, fecha, categoria||'', descripcion||'', monto]
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error registrando gasto' });
  }
});

// DELETE /api/gastos/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM gastos WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando gasto' });
  }
});

module.exports = router;
