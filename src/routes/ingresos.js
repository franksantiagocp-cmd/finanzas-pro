const express = require('express');
const { pool } = require('../db');
const router  = express.Router();

function calcDist(monto, especial, pension) {
  const m = parseFloat(monto);
  const p = parseFloat(pension) || 0;
  const d = { ahorro:0, personal:0, matrimonio:0, hijos:0, deudas:0 };

  if (especial === 'sueldo') {
    d.hijos = Math.min(p, m);
    const resto = Math.max(0, m - p);
    d.ahorro = d.personal = d.matrimonio = d.deudas = resto / 4;
  } else if (especial === 'rendimientos') {
    d.ahorro = m;
  } else if (especial === 'ganancia_matrimonio') {
    d.matrimonio = m;
  } else {
    d.ahorro = d.personal = d.matrimonio = d.hijos = d.deudas = m * 0.2;
  }
  return d;
}

// GET /api/ingresos
router.get('/', async (_req, res) => {
  try {
    const r = await pool.query(
      'SELECT * FROM ingresos ORDER BY fecha DESC, created_at DESC'
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error cargando ingresos' });
  }
});

// GET /api/ingresos/preview?monto=X&categoria_id=Y
router.get('/preview', async (req, res) => {
  const { monto, categoria_id } = req.query;
  if (!monto || !categoria_id) return res.status(400).json({ error: 'Faltan parámetros' });
  try {
    const [cfg, cat] = await Promise.all([
      pool.query(`SELECT valor FROM config WHERE clave='pension'`),
      pool.query(`SELECT especial FROM categorias_ingresos WHERE id=$1`, [categoria_id]),
    ]);
    const pension  = parseFloat(cfg.rows[0]?.valor || 1997);
    const especial = cat.rows[0]?.especial || null;
    res.json(calcDist(monto, especial, pension));
  } catch (err) {
    res.status(500).json({ error: 'Error calculando distribución' });
  }
});

// POST /api/ingresos
router.post('/', async (req, res) => {
  const { fecha, categoria_id, monto, descripcion } = req.body;
  if (!fecha || !categoria_id || !monto || monto <= 0)
    return res.status(400).json({ error: 'Fecha, categoría y monto requeridos' });
  try {
    const [cfg, cat] = await Promise.all([
      pool.query(`SELECT valor FROM config WHERE clave='pension'`),
      pool.query(`SELECT nombre, especial FROM categorias_ingresos WHERE id=$1`, [categoria_id]),
    ]);
    if (!cat.rows.length) return res.status(400).json({ error: 'Categoría no encontrada' });

    const pension  = parseFloat(cfg.rows[0]?.valor || 1997);
    const especial = cat.rows[0].especial;
    const categoria= cat.rows[0].nombre;
    const d = calcDist(monto, especial, pension);

    const r = await pool.query(
      `INSERT INTO ingresos
        (fecha,categoria,monto,descripcion,
         dist_ahorro,dist_personal,dist_matrimonio,dist_hijos,dist_deudas)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [fecha, categoria, monto, descripcion||'',
       d.ahorro, d.personal, d.matrimonio, d.hijos, d.deudas]
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error registrando ingreso' });
  }
});

// DELETE /api/ingresos/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM ingresos WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando ingreso' });
  }
});

module.exports = router;
