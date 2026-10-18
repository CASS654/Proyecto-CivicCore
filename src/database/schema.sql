-- ====================================================================
-- CivicCore - Esquema de Base de Datos Relacional (SQL)
-- Sistema con Control de Acceso Basado en Roles (4 Niveles)
-- Motor: SQLite 3
-- ====================================================================

-- 1. Tabla de Usuarios y Credenciales
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('invitado', 'vecino', 'trabajador', 'admin')),
    rut_dni TEXT,
    department TEXT,                         -- Ej: 'Junta de Vecinos', 'Dirección de Obras'
    status TEXT NOT NULL DEFAULT 'active',   -- 'active', 'suspended'
    created_at TEXT NOT NULL
);

-- 2. Tabla Principal de Incidencias Urbanas con Prioridades
CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,                       -- Ej: 'CIV-8950'
    folio TEXT UNIQUE NOT NULL,                -- Ej: '#CIV-8950'
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,                    -- 'vialidad', 'alumbrado', 'aseo', etc.
    category_label TEXT NOT NULL,
    category_icon TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',        -- 'new', 'progress', 'resolved'
    status_label TEXT NOT NULL,
    urgency TEXT NOT NULL DEFAULT 'medium',    -- 'low', 'medium', 'high', 'critical'
    urgency_label TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'app',
    channel_label TEXT NOT NULL,
    address TEXT NOT NULL,
    sector TEXT NOT NULL,                      -- 'centro', 'norte', 'sur', etc.
    sector_label TEXT NOT NULL,
    reported_by TEXT NOT NULL,
    reported_by_role TEXT NOT NULL DEFAULT 'invitado', -- 'invitado', 'vecino', 'trabajador', 'admin'
    priority_level INTEGER NOT NULL DEFAULT 1, -- 1: Normal (Invitado), 2: Alta (Vecino), 3: Muy Alta (Trabajador), 4: Crítica (Admin)
    priority_label TEXT NOT NULL DEFAULT 'Normal',
    is_verified INTEGER DEFAULT 0,
    assigned_team TEXT DEFAULT 'Por asignar',
    image_url TEXT,
    coord_x INTEGER DEFAULT 50,
    coord_y INTEGER DEFAULT 50,
    moderated_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 3. Tabla de Historial y Auditoría de Estados
CREATE TABLE IF NOT EXISTS incident_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id TEXT NOT NULL,
    action TEXT NOT NULL,                      -- 'CREADO', 'CAMBIO_ESTADO', 'MODERADO', etc.
    user_name TEXT DEFAULT 'Sistema',
    user_role TEXT DEFAULT 'sistema',
    previous_status TEXT,
    new_status TEXT,
    details TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);

-- 4. Tabla de Auditoría General del Sistema (Super Admin)
CREATE TABLE IF NOT EXISTS system_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,                      -- 'LOGIN', 'USER_CREATED', 'ROLE_CHANGE', 'SITE_SETTINGS'
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    target_info TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL
);

-- 5. Tabla de Parámetros Globales del Sitio (Modificables por Super Admin)
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT NOT NULL
);

-- 6. Índices para Alto Rendimiento
CREATE INDEX IF NOT EXISTS idx_incidents_priority ON incidents(priority_level DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_category ON incidents(category);
CREATE INDEX IF NOT EXISTS idx_incidents_sector ON incidents(sector);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
