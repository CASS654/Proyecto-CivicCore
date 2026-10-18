# 🌐 Servidor Web Local a Internet & CivicCore (Tarea Santamaría)

Proyecto completo de gestión de incidencias ciudadanas desarrollado con **Node.js**, **Express**, **SQLite** y arquitectura responsiva (*Mobile & Desktop*), accesible desde Internet mediante:
1. **Localtunnel** (Subdominio personalizado: `https://tarea-santamaria.loca.lt`)
2. **Cloudflare Tunnel** (Dirección temporal cifrada: `https://*.trycloudflare.com`)

---

## 📁 Estructura del Proyecto

```text
Tarea Santamaria/
├── package.json                   # Dependencias y scripts npm
├── .env                           # Configuración (puerto, host, subdominio)
├── .env.example                   # Plantilla de variables de entorno
├── .gitignore                     # Archivos ignorados por git
├── iniciar-servidor.bat           # Inicia el servidor Node.js (puerto 3000)
├── iniciar-tunel-localtunnel.bat  # Inicia el túnel personalizado (Localtunnel)
├── iniciar-todo-localtunnel.bat   # Inicia Servidor + Localtunnel juntos
├── iniciar-tunel.bat              # Inicia el túnel de Cloudflare
├── iniciar-todo.bat               # Inicia Servidor + Cloudflare juntos
├── ver-base-de-datos.bat          # Explora las tablas y datos de SQLite en consola
├── README.md                      # Esta guía
├── src/
│   ├── server.js                  # Núcleo del servidor, IPs locales, shutdown
│   ├── app.js                     # Express, middlewares, cors, logger
│   ├── tunnel-localtunnel.js      # Script de túnel con detección de IP pública
│   ├── database/
│   │   ├── schema.sql             # Esquema DDL SQL oficial de la base de datos
│   │   └── db.js                  # Conexión nativa SQLite (node:sqlite) y DAOs
│   ├── data/
│   │   └── civiccore.db           # Archivo físico de la Base de Datos SQLite
│   ├── services/
│   │   └── incidentService.js     # Capa de lógica de negocio
│   ├── scripts/
│   │   └── view-database.js       # Visor CLI de tablas y registros SQL
│   └── routes/
│       ├── index.js               # Enrutador principal
│       └── api.js                 # API REST (/api/incidents, /api/stats, /api/status)
└── public/
    ├── index.html                 # Frontend SPA responsivo (Móvil y Escritorio)
    ├── css/
    │   └── civiccore.css          # Estilos y animaciones del sistema CivicCore
    └── js/
        └── civiccore.js           # Lógica cliente (SPA, búsqueda, filtros, mapa)
```

---

## 🗄️ Base de Datos Relacional (SQLite)

Los datos se almacenan en una base de datos relacional SQLite real en [`src/data/civiccore.db`](file:///c:/Users/cesar/Downloads/Tarea%20Santamaria/src/data/civiccore.db).

### Tablas Creadas:
1. **`incidents`**: Almacena todos los reportes urbanos (folio, título, categoría, prioridad, cuadrante, dirección, denunciante, estado y evidencia).
2. **`incident_logs`**: Tabla de auditoría que registra cada cambio de estado o acción ejecutada sobre una incidencia con su marca de tiempo exacta.

### ¿Cómo ver los datos guardados en la Base de Datos?
Haz doble clic en:
👉 **`ver-base-de-datos.bat`**

O desde la terminal:
```powershell
npm run db:view
```
Verás una tabla con todas las incidencias y el historial de cambios registrados.

---

## 🚀 Cómo Iniciar el Servidor y el Túnel

### Paso 1: Iniciar Servidor y Túnel Personalizado
Haz doble clic en:
👉 **`iniciar-todo-localtunnel.bat`**

Se abrirán dos ventanas:
1. **Servidor:** Corriendo en `http://localhost:3000` conectado a SQLite.
2. **Túnel:** Mostrando tu enlace `https://tarea-santamaria.loca.lt` y tu contraseña (IP pública).

### Paso 2: Probar desde el Celular
1. Entra a `https://tarea-santamaria.loca.lt` desde el celular con datos móviles.
2. Si te pide el "Tunnel Password", pega la IP pública indicada en la ventana del túnel y pulsa "Submit".
3. Reporta un incidente desde el botón flotante `+` en tu celular.
4. Vuelve a tu computadora o ejecuta `ver-base-de-datos.bat` para comprobar cómo el reporte se guardó inmediatamente en la base de datos SQLite.
