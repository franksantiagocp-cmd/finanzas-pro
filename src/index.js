require('dotenv').config();
const express = require('express');
const path    = require('path');
const { initDB } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/config',    require('./routes/config'));
app.use('/api/ingresos',  require('./routes/ingresos'));
app.use('/api/gastos',    require('./routes/gastos'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, '../public/index.html'))
);

async function start() {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`🚀 http://localhost:${PORT}`);
      console.log('📊 Finanzas Pro listo');
    });
  } catch (err) {
    console.error('❌ Error al iniciar:', err.message);
    process.exit(1);
  }
}

start();
