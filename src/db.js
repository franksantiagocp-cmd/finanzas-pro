const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const SUBCUENTAS = ['ahorro','personal','matrimonio','hijos','deudas'];

const CATS_INGRESO_DEFAULT = [
  { nombre:'Sueldo',              especial:'sueldo' },
  { nombre:'Rendimientos',        especial:'rendimientos' },
  { nombre:'Ganancia Matrimonio', especial:'ganancia_matrimonio' },
  { nombre:'Honorarios',          especial:null },
  { nombre:'Freelance',           especial:null },
  { nombre:'Venta',               especial:null },
];

const CATS_GASTO_DEFAULT = [
  'Supermercado','Restaurantes','Transporte','Servicios',
  'Entretenimiento','Salud','Ropa','Educación',
];

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS config (
        clave VARCHAR(100) PRIMARY KEY,
        valor TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS saldos_iniciales (
        subcuenta VARCHAR(50) PRIMARY KEY,
        monto NUMERIC(14,2) DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS categorias_ingresos (
        id        SERIAL PRIMARY KEY,
        nombre    VARCHAR(255) UNIQUE NOT NULL,
        especial  VARCHAR(50)
      );

      CREATE TABLE IF NOT EXISTS categorias_gastos (
        id     SERIAL PRIMARY KEY,
        nombre VARCHAR(255) UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ingresos (
        id          SERIAL PRIMARY KEY,
        fecha       DATE NOT NULL,
        categoria   VARCHAR(255) NOT NULL,
        monto       NUMERIC(14,2) NOT NULL,
        descripcion TEXT DEFAULT '',
        dist_ahorro     NUMERIC(14,2) DEFAULT 0,
        dist_personal   NUMERIC(14,2) DEFAULT 0,
        dist_matrimonio NUMERIC(14,2) DEFAULT 0,
        dist_hijos      NUMERIC(14,2) DEFAULT 0,
        dist_deudas     NUMERIC(14,2) DEFAULT 0,
        created_at  TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS gastos (
        id          SERIAL PRIMARY KEY,
        subcuenta   VARCHAR(50) NOT NULL,
        fecha       DATE NOT NULL,
        categoria   VARCHAR(255) DEFAULT '',
        descripcion TEXT DEFAULT '',
        monto       NUMERIC(14,2) NOT NULL,
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);

    // Config defaults
    const cfgRows = [
      ['pension', '1997'],
      ['dark_mode', 'true'],
    ];
    for (const [clave, valor] of cfgRows) {
      await client.query(
        `INSERT INTO config(clave,valor) VALUES($1,$2) ON CONFLICT(clave) DO NOTHING`,
        [clave, valor]
      );
    }

    // Saldos iniciales
    for (const s of SUBCUENTAS) {
      await client.query(
        `INSERT INTO saldos_iniciales(subcuenta,monto) VALUES($1,0) ON CONFLICT(subcuenta) DO NOTHING`,
        [s]
      );
    }

    // Categorías ingreso
    for (const c of CATS_INGRESO_DEFAULT) {
      await client.query(
        `INSERT INTO categorias_ingresos(nombre,especial) VALUES($1,$2) ON CONFLICT(nombre) DO NOTHING`,
        [c.nombre, c.especial]
      );
    }

    // Categorías gasto
    for (const nombre of CATS_GASTO_DEFAULT) {
      await client.query(
        `INSERT INTO categorias_gastos(nombre) VALUES($1) ON CONFLICT(nombre) DO NOTHING`,
        [nombre]
      );
    }

    await client.query('COMMIT');
    console.log('✅ Base de datos lista');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error DB:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
