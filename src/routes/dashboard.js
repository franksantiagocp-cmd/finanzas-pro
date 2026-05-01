const express = require('express');
const { pool } = require('../db');
const router  = express.Router();

const SUBCUENTAS = ['ahorro','personal','matrimonio','hijos','deudas'];

// GET /api/dashboard
router.get('/', async (_req, res) => {
  try {
    const [saldosR, distR, gastosR, ultIng, ultGas, ingCat, ingMes, gasCat] =
      await Promise.all([
        pool.query('SELECT subcuenta, monto FROM saldos_iniciales'),
        pool.query(`
          SELECT
            COALESCE(SUM(dist_ahorro),0)     AS ahorro,
            COALESCE(SUM(dist_personal),0)   AS personal,
            COALESCE(SUM(dist_matrimonio),0) AS matrimonio,
            COALESCE(SUM(dist_hijos),0)      AS hijos,
            COALESCE(SUM(dist_deudas),0)     AS deudas
          FROM ingresos`),
        pool.query(`
          SELECT subcuenta, COALESCE(SUM(monto),0) AS total
          FROM gastos GROUP BY subcuenta`),
        pool.query(`
          SELECT id,fecha,categoria,monto,descripcion
          FROM ingresos ORDER BY fecha DESC, created_at DESC LIMIT 6`),
        pool.query(`
          SELECT id,subcuenta,fecha,categoria,monto,descripcion
          FROM gastos ORDER BY fecha DESC, created_at DESC LIMIT 6`),
        pool.query(`
          SELECT categoria, SUM(monto) AS total
          FROM ingresos GROUP BY categoria ORDER BY total DESC`),
        pool.query(`
          SELECT TO_CHAR(fecha,'YYYY-MM') AS mes, SUM(monto) AS total
          FROM ingresos GROUP BY mes ORDER BY mes DESC LIMIT 6`),
        pool.query(`
          SELECT categoria, SUM(monto) AS total
          FROM gastos GROUP BY categoria ORDER BY total DESC LIMIT 10`),
      ]);

    const iniciales = {};
    saldosR.rows.forEach(r => { iniciales[r.subcuenta] = parseFloat(r.monto); });

    const ing = distR.rows[0];
    const gastMap = {};
    gastosR.rows.forEach(r => { gastMap[r.subcuenta] = parseFloat(r.total); });

    const saldos = {};
    SUBCUENTAS.forEach(s => {
      const ini = parseFloat(iniciales[s] || 0);
      const i   = parseFloat(ing[s] || 0);
      const g   = parseFloat(gastMap[s] || 0);
      saldos[s] = { inicial: ini, ingresado: i, gastado: g, saldo: ini + i - g };
    });

    res.json({
      saldos,
      ultIngresos: ultIng.rows,
      ultGastos:   ultGas.rows,
      graficas: {
        ingPorCat:   ingCat.rows,
        ingPorMes:   ingMes.rows.reverse(),
        gasPorCat:   gasCat.rows,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error cargando dashboard' });
  }
});

module.exports = router;
