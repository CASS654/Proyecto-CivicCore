# CivicCore

Plataforma municipal para reportar y gestionar incidencias ciudadanas (baches, alumbrado, aseo…).
Node.js + Express + SQLite nativo (`node:sqlite`) en el servidor y una SPA en HTML + módulos ES nativos (sin bundler) en el navegador.
Cuatro roles: **invitado**, **vecino**, **trabajador** municipal y **super admin**.

## Ejecutar

Requiere Node.js 22.12 o superior.

```bash
npm install
npm start            # http://localhost:3000  (o doble clic en iniciar-servidor.bat)
npm run dev          # igual, reiniciando al guardar cambios
npm run db:view      # muestra tablas y últimos registros de la base (o ver-base-de-datos.bat)
```

Usuarios de demostración que se crean con una base vacía: `vecino@correo.cl` / `vecino123`,
`funcionario@municipio.gov` / `trabajador123`, `admin@civiccore.gov` / `admin123`.

Variables de entorno (`.env`, ver `.env.example`): `PORT`, `HOST`, `NODE_ENV`, `APP_NAME` y `DB_PATH`
(ruta del archivo SQLite; por defecto `src/data/civiccore.db`).

## Pruebas

```bash
npm test
```

Usa el runner nativo de Node (`node --test`), sin dependencias extra:

- `test/api.test.js`: levanta la app con una base SQLite temporal (`DB_PATH`) y recorre todos los endpoints. Nunca toca `src/data/civiccore.db`.
- `test/domain.test.js`: reglas de negocio del servidor (prioridad, folio, etiquetas, JWT de Google).
- `test/logic.test.mjs`: lógica pura del navegador (filtros, conteos, folio, auditoría).

## Estructura

Capas por responsabilidad y, dentro de cada capa, un archivo por funcionalidad.
Las dependencias van en un solo sentido: `routes → database → domain` en el servidor y
`civiccore.js → views → nav / data / ui / logic / state / config` en el navegador.

```text
src/
├── server.js               Arranque HTTP, IPs de la red local y apagado ordenado
├── app.js                  Express: middlewares, archivos estáticos, rutas; siembra la base al cargar
├── config/index.js         Variables de entorno (puerto, host, ruta de la base)
├── domain.js               Reglas puras: catálogos, prioridad por rol, folio, etiquetas, nombre desde correo, JWT
├── middlewares/
│   ├── auth.js             Usuario de la petición, requireAdmin (403) e IP del cliente
│   └── errorHandler.js     Respuestas 404 y 500
├── routes/                 Cada archivo atiende el prefijo de URL de su nombre bajo /api
│   ├── index.js            Monta los cuatro routers
│   ├── auth.js             /auth: login, registro, Google, logout, perfil, cambio de contraseña
│   ├── incidents.js        /incidents y /stats: listar, detalle, crear, cambiar estado, KPIs
│   ├── admin.js            /admin: usuarios, moderación, auditoría, copias de seguridad, parámetros
│   └── system.js           /status y /info: diagnóstico
├── database/
│   ├── connection.js       Abre SQLite, aplica schema.sql y migraciones
│   ├── seed.js             Datos iniciales si las tablas están vacías
│   ├── incidents.js        Consultas de incidencias y guardado de fotos subidas
│   ├── users.js            Consultas de usuarios y autenticación
│   ├── system.js           Auditoría, parámetros, estadísticas y copias de seguridad
│   └── schema.sql          Tablas e índices
├── data/                   civiccore.db, incidents.json (semilla) y backups/
└── scripts/view-database.js  Visor de la base por consola

public/
├── index.html              Marcado de todas las vistas y modales
├── css/civiccore.css       Estilos propios (Tailwind llega por CDN)
└── js/
    ├── civiccore.js        Entrada: conecta las vistas, eventos globales y window.civicApp (usado por los onclick del HTML)
    ├── config.js           Usuario invitado, permisos por rol, preferencias por defecto
    ├── state.js            Estado en memoria y su guardado en localStorage
    ├── data.js             Cabeceras de sesión, cargas desde la API y búsqueda de folios
    ├── logic.js            Funciones puras (filtros, conteos, folio, auditoría)
    ├── ui.js               Escape de HTML, avisos, sonido
    ├── nav.js              Cambio de vista según permisos y menús por rol
    ├── package.json        {"type":"module"}, para que node --test importe logic.js
    └── views/              Un archivo por pantalla (nombre = id de la vista en el HTML)
        ├── inicio.js       KPIs públicos, rastreo de folio, efecto de scroll
        ├── vecino.js       Portal vecinal y rastreador
        ├── incidencias.js  Bandeja, filtros, modal de detalle y cambio de estado
        ├── mapa.js         Mapa por sectores
        ├── panel.js        KPIs municipales
        ├── nuevo.js        Reporte en 3 pasos, foto, cancelación y comprobante
        ├── auth.js         Login, registro, logout, Google y cambio de contraseña
        ├── admin.js        Hub, padrón, moderación, auditoría y parámetros
        └── ajustes.js      Tema, cuenta, preferencias y accesibilidad
```

## Límites conocidos

Los atajos conscientes están marcados en el código con `shortcut:` y su límite. Para listarlos:

```bash
grep -rn "shortcut:" src public/js
```

Los más importantes son de seguridad: el rol del usuario lo envía el navegador y el servidor lo cree,
las contraseñas se guardan en texto plano y el login con Google no verifica la firma del token.
No usar con datos reales sin resolverlos.

Acceso desde Internet: los scripts de túnel (Localtunnel / Cloudflare) son herramientas locales
que `.gitignore` excluye; no forman parte de este repositorio.
