# Directrices de Desarrollo - CivicCore

## 1. Cambios Visuales y Estéticos (Modo Rápido)
- Cuando el usuario solicite un cambio puramente visual, cosmético o de interfaz (por ejemplo: ajustar textos, títulos, colores, clases de Tailwind, ocultar/mostrar secciones, márgenes o layout):
  - **Aplicar la modificación directamente** en los archivos afectados (`public/index.html`, `public/js/civiccore.js`, etc.) en un solo paso.
  - **NO ejecutar comandos lentos de verificación en terminal** (evitar `Invoke-WebRequest`, inspección de puertos, chequeo de procesos de Node o pruebas repetitivas de red).
  - Responder rápidamente para que el usuario recargue su navegador y valide visualmente de inmediato.

## 2. Modificaciones Críticas de Backend y Lógica
- Reservar las comprobaciones de consola (como `node --check` o pruebas de API) exclusivamente para cuando se modifiquen esquemas de base de datos (`src/database/db.js`), endpoints del servidor (`src/routes/api.js`) o seguridad de autenticación.
