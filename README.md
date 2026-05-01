# Finanzas Pro v3

Sistema de finanzas personales · Node.js + PostgreSQL · Sin login · Listo para Railway.

---

## Deploy en Railway (paso a paso)

### 1. Sube a GitHub

```bash
# Desde la carpeta finanzas3/
git init
git add .
git commit -m "finanzas pro v3"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/finanzas-pro.git
git push -u origin main
```

### 2. Crea el proyecto en Railway

1. Ve a **railway.app** → **New Project**
2. **Deploy from GitHub repo** → selecciona tu repo
3. Dentro del mismo proyecto: **+ New → Database → PostgreSQL**

### 3. Variables de entorno

En tu servicio Node → pestaña **Variables**:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Se copia automático desde el servicio PostgreSQL |
| `NODE_ENV` | `production` |

> Solo esas dos. Sin SESSION_SECRET, sin bcrypt.

### 4. Listo

Cada `git push` a `main` redespliega automáticamente.

---

## Desarrollo local

```bash
cp .env.example .env
# edita .env con tu postgres local
npm install
npm run dev
```

---

## Estructura

```
finanzas3/
├── src/
│   ├── index.js          ← Servidor Express
│   ├── db.js             ← Schema PostgreSQL + seed
│   └── routes/
│       ├── config.js     ← Pensión, saldos iniciales, categorías
│       ├── ingresos.js   ← CRUD ingresos + distribución automática
│       ├── gastos.js     ← CRUD gastos por subcuenta
│       └── dashboard.js  ← Resumen y datos para gráficas
├── public/
│   ├── index.html        ← SPA completa
│   ├── css/app.css       ← Diseño profesional
│   └── js/app.js         ← Lógica frontend
├── package.json
├── .gitignore
└── .env.example
```

---

## Recomendaciones futuras (para monetización)

Si en algún momento quieres vender este sistema como SaaS:

1. **Agregar autenticación** — usar `better-auth` o `lucia` (librerías modernas, sin complejidad de Passport). Cada usuario tendría sus propios datos aislados.
2. **Multi-tenant** — agregar `usuario_id` a todas las tablas (como en versiones anteriores).
3. **Stripe para pagos** — plan mensual de $99-199 MXN es viable para un nicho de finanzas personales.
4. **Landing page** — una página simple con los beneficios y un CTA de registro.
5. **Dominio propio** — Railway permite dominios custom en el plan Hobby ($5/mes).
