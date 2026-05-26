# HANDOFF · Módulo Bug Reporter · DTD Studio ERP

> **Documento de continuidad** entre sesiones. Contiene TODAS las decisiones tomadas, especificaciones cerradas, y siguiente paso. Generado en sesión del 26 de mayo de 2026.

---

## 1 · Resumen ejecutivo

El módulo **Bug Reporter** del ERP DTD Studio permite a usuarios internos (admin + reportadores) gestionar bugs, mejoras y sugerencias desde dentro del propio ERP. Tiene 2 caras:

- **Cara reportador** (María/Yiwu/Luis): botón FAB flotante para reportar, vista "Mis reportes" con progreso visual, notificaciones automáticas cuando Sam avanza en sus bugs
- **Cara admin** (Sam · humano): Kanban + tabla + estadísticas, drawer con conversación + datos técnicos + acciones. Botón "Copiar prompt para Claude Code" arma contexto que Sam pega manualmente en otra ventana; **el admin supervisa siempre y decide cuándo cerrar el bug**. Cero automatización de cierre (ver D9 del spec).

Está diseñado COMPLETO. **Iteración final: v1.4.1** (archivo `Bug_Reporter_Demo_v1.4.1_FIX.html`).

---

## 2 · Decisiones tomadas (NO renegociar)

### 2.1 Categorías de reporte
4 tipos: **Error · Mejora · Sugerencia · Pregunta**. Severidad (baja/media/alta/crítica) solo aplica a Error.

### 2.2 Estados del flujo Kanban
5 estados con progreso fijo:

| Estado | % | Cuándo |
|--------|---|--------|
| Nuevo | 0% | Reportado, no revisado |
| Triaje | 25% | Admin lo tomó |
| Esperando info | 40% | Admin pidió más info al reportador |
| En progreso | 65% | Admin codeando el fix |
| Resuelto | 100% | Commit pusheado, bug cerrado |
| Descartado | — | No procede |

### 2.3 Folio
Formato `BUG-XXXXX` (5 dígitos, autogenerado por trigger DB).

### 2.4 Captura automática invisible
El sistema captura SIEMPRE (sin que el usuario sepa):
- 3 últimos errores de consola
- 5 últimos network requests (con status code)
- 30 segundos de session replay (rrweb v2)
- Entorno completo (browser, OS, viewport, URL, módulo, build)

### 2.5 Fotos del usuario
- Máximo **5 fotos** por reporte
- **Sin anotación** (sin markerjs2) en MVP · agregamos después si María lo pide
- Máximo **5MB** por foto
- Métodos: arrastrar, pegar (Ctrl+V), botón capturar pantalla
- Texto del reporte SIEMPRE obligatorio (título + descripción) · fotos son extra

### 2.6 Engagement profesional · NO gamificación infantil
- **SÍ:** barra progreso, timeline visual, mensaje de agradecimiento del admin, card "Tu impacto" con números
- **NO:** trofeos, medallas, estrellas, puntos, niveles, confetti, sonidos de victoria
- Razón: María/Yiwu son profesionales adultos · esto es ERP corporativo, no Duolingo

### 2.7 Asistencia Claude Code (NO automatización · decisión D9 del spec · 2026-05-26)
En el drawer del admin, tab "Acciones" tiene:
- Botón **"Copiar prompt"** → genera markdown completo (bug + contexto técnico + replay) que el admin copia y pega en Claude Code en otra ventana
- Botón **"Tomar este bug"** → cambia estado a "Triaje" + notif al reportador (acción manual del admin, no automática del sistema)
- **NO existe** detección automática de commits ni webhook GitHub. Si el admin commitea con `fix: BUG-XXXXX`, queda solo como convención de trazabilidad en git log; el cierre del bug es siempre por click humano del admin en el drawer

### 2.8 Notificaciones · 4 canales
| Canal | Activo por defecto | Cuándo |
|-------|-------------------|--------|
| In-app (campanita) | ✅ siempre | Todos los eventos |
| Push del navegador | ⚪ pide permiso | Cambios de estado + respuestas |
| Email | ✅ default ON | Bug resuelto + respuesta admin |
| Telegram | ⚪ solo admin | Solo bugs críticos |

### 2.9 Sonido
- **Default ON** con beep corto (Web Audio API)
- Toggle visible en panel de campanita (icono altavoz)
- Persistido en `localStorage`

### 2.10 Tema light/dark
- Sistema dual `[data-theme]` del Brand Book módulo #15
- Toggle de 3 opciones: Light / Auto / Dark
- Respeta `prefers-color-scheme` cuando está en Auto
- Persistido en `localStorage`

### 2.11 Filtro por módulo
La barra de filtros del Bug Tracker tiene 3 grupos:
- **Tipo:** Todos · Críticos · Errores · Mejoras · Sugerencias
- **Reportador:** Contadora · Op. CN · Op. VE
- **Módulo:** Tracking · Contabilidad · SENIAT · CRM · etc.

### 2.12 Roles autorizados a ver el FAB
admin, owner, contadora, operario_cn, operario_ve, operario_multi, bodeguero_ve. **NUNCA** en el portal/cliente.

### 2.13 Detección automática de duplicados
Sistema agrupa bugs por hash `sha256(módulo + url + stack_signature)`. Muestra contador `×3` en la card del bug.

### 2.14 Estado "Esperando info" pausa el SLA
Cuando un bug pasa a "Esperando info", el reloj de SLA se pausa hasta que el reportador responda.

---

## 3 · Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + JSX inline + Tailwind v4 |
| Tokens | tokens.css del Brand Book v2.4 |
| Backend | Supabase (Postgres + RLS + Edge Functions + Realtime + Storage) |
| Session replay | rrweb v2 (open source) |
| Anotación | markerjs2 (NO en MVP) |
| Notif Telegram | Bot API |
| Email | Resend.com |
| Push browser | Web Push API + Service Worker |

---

## 4 · Brand Book v2.4 · reglas inviolables

### Tokens light (default)
```css
--bg-base:#FBFAF7; --bg-surface:#FFFFFF; --bg-elevated:#F2F0EC;
--ink:#0F1E3D; --ink-soft:#6B6B6B; --border:#E8E6E2;
--wine:#7F0F1A; --wine-deep:#5E0A12; --wine-soft:#C2747F;
--success:#1F8A5B; --warning:#B8893A; --danger:#A8323E; --info:#2A6FDB;
```

### Tokens dark (módulo #15)
```css
[data-theme="dark"] {
  --bg-base:#0B1428; --bg-surface:#16264A; --bg-elevated:#1F3160;
  --ink:#F2F0EC; --ink-soft:#A8B0C4; --border:rgba(255,255,255,0.10);
  --wine:#A8323E; --wine-soft:#D89AA4;
  --success:#4CC38A; --warning:#E0B265; --danger:#E07485; --info:#6FA6F0;
}
```

### Fuentes
- Body: `Archivo` (300-900)
- Display: `Archivo Black`
- Mono: `JetBrains Mono`

### Prohibido
Emojis decorativos en UI · gradientes coloridos · glassmorphism · hex hardcoded · mascotas · slogans cursi · gamificación infantil.

---

## 5 · Schema de base de datos (5 tablas)

```sql
-- 1. Reportes
CREATE TABLE bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT UNIQUE NOT NULL, -- BUG-XXXXX autogenerado
  tenant_id UUID NOT NULL,
  reporter_id UUID NOT NULL REFERENCES auth.users,
  category TEXT CHECK (category IN ('error','improve','suggest','question')),
  severity TEXT CHECK (severity IN ('baja','media','alta','critica')),
  state TEXT CHECK (state IN ('nuevo','triaje','espera','progreso','resuelto','descartado')),
  progress_pct INT GENERATED ALWAYS AS (
    CASE state
      WHEN 'nuevo' THEN 0
      WHEN 'triaje' THEN 25
      WHEN 'espera' THEN 40
      WHEN 'progreso' THEN 65
      WHEN 'resuelto' THEN 100
      ELSE 0
    END
  ) STORED,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  module TEXT NOT NULL,
  url TEXT,
  browser_info JSONB,
  duplicate_hash TEXT, -- sha256(module + url + stack_signature)
  duplicate_count INT DEFAULT 0,
  eta_days INT,
  admin_thanks TEXT,
  commit_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 2. Adjuntos (fotos del usuario)
CREATE TABLE bug_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id UUID NOT NULL REFERENCES bug_reports ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes <= 5242880), -- 5MB
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Datos técnicos auto-capturados
CREATE TABLE bug_tech_data (
  bug_id UUID PRIMARY KEY REFERENCES bug_reports ON DELETE CASCADE,
  console_logs JSONB,
  network_requests JSONB,
  session_replay_url TEXT,
  environment JSONB
);

-- 4. Conversación (hilo)
CREATE TABLE bug_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id UUID NOT NULL REFERENCES bug_reports ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users,
  author_type TEXT CHECK (author_type IN ('user','admin','system')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Timeline / activity log
CREATE TABLE bug_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id UUID NOT NULL REFERENCES bug_reports ON DELETE CASCADE,
  event_type TEXT, -- new, review, work, commit, done, state_change
  actor_id UUID REFERENCES auth.users,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Preferencias de notificación por usuario
CREATE TABLE user_notification_prefs (
  user_id UUID PRIMARY KEY REFERENCES auth.users,
  channel_inapp BOOLEAN DEFAULT TRUE,
  channel_push BOOLEAN DEFAULT FALSE,
  channel_email BOOLEAN DEFAULT TRUE,
  channel_telegram BOOLEAN DEFAULT FALSE,
  telegram_chat_id TEXT,
  notify_on_state_change BOOLEAN DEFAULT TRUE,
  notify_on_admin_reply BOOLEAN DEFAULT TRUE,
  notify_on_resolved BOOLEAN DEFAULT TRUE,
  notify_on_critical BOOLEAN DEFAULT TRUE,
  sound_enabled BOOLEAN DEFAULT TRUE
);

-- 7. Notificaciones
CREATE TABLE bug_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users,
  bug_id UUID REFERENCES bug_reports,
  type TEXT, -- new_reply, state_change, resolved, critical_alert, duplicate_detected
  payload JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security (RLS)
- Usuario solo ve SUS bugs · admin ve TODOS los bugs del tenant
- Sistema visible solo para `role IN ('admin','owner')` en `app_metadata`

---

## 6 · Endpoints API (Edge Functions)

| Endpoint | Método | Quién | Acción |
|----------|--------|-------|--------|
| `/api/bugs` | POST | Reportador | Crear bug nuevo |
| `/api/bugs` | GET | Admin / Usuario | Listar (filtrado por RLS) |
| `/api/bugs/:id` | GET | Admin / dueño | Ver detalle |
| `/api/bugs/:id/state` | PATCH | Admin | Cambiar estado · dispara notif |
| `/api/bugs/:id/messages` | POST | Admin / dueño | Agregar mensaje al hilo |
| `/api/bugs/:id/attachments` | POST | Reportador | Subir foto (max 5MB) |
| `/api/bugs/:id/take` | POST | Admin | Botón "Tomar bug" · estado→triaje |
| `/api/bugs/:id/prompt` | GET | Admin | Genera markdown para copy/paste a Claude Code |

---

## 7 · Iteraciones de mockup (histórico)

| Versión | Aporte |
|---------|--------|
| v0.1 | 4 pantallas iniciales |
| v0.2 | Features tipo CATFIRE adaptadas |
| v1.0 | 5 features expertas (auto-capture, replay, dedup, Telegram, esperando-info) |
| v1.1 | Botones funcionales (Kanban/Tabla/Stats) |
| v1.2 | Engagement profesional + integración Claude Code |
| v1.3 | Dark/light/auto + persistencia + Brand Book compliance |
| v1.4 | Notificaciones 4 canales + sonido + filtro por módulo |
| **v1.4.1** | **FIX · Tabla y Estadísticas funcionando** ← **VIGENTE** |

---

## 8 · Lo que QUEDA pendiente

### 8.1 Documentación
- [ ] Actualizar `BUG-REPORTER-SPEC.md` con nuevos campos:
  - `progress_pct`, `eta_days`, `admin_thanks`, `timeline_events`
  - `user_notification_prefs` (todas las columnas)
  - Tokens dark del Brand Book módulo #15
  - Config de fotos (5 máx · sin anotación · 5MB)
  - 4 canales de notificación con plantillas
  - Filtro por módulo en el Kanban admin

### 8.2 Setup repo GitHub (URGENTE antes de codear)
Repo privado `DTDCARGO` en `C:\Users\Trabajo\Desktop\DTDCargo`. Estado actual:
- ✅ Clonado con GitHub Desktop
- ✅ `.gitignore` existe (reglas básicas Next.js)
- ❌ 247 archivos pendientes de commit incluyen:
  - 30+ `pasted-XXXXX.png` (capturas basura de chats)
  - PDFs confidenciales (Acuerdo de confidencialidad, Servicios DTD)
  - XLSX con datos sensibles clientes
  - `.next/` build artifacts
  - ZIPs grandes

**Acciones pendientes:**
1. Agregar al `.gitignore` (via GitHub Desktop → Repository Settings → Ignored Files):
```
# Capturas pegadas de chats
**/pasted-*.png

# Confidenciales
**/Acuerdo*.pdf
**/Contrato*.pdf
**/NUEVO FORMATO*.xlsx
**/DTD-*-cost.xlsx

# Build / cache
.env*
.next/
out/
build/
dist/
coverage/
node_modules/

# Sistema
Thumbs.db
.DS_Store
.vscode/
.idea/

# Comprimidos
*.zip
*.rar
*.7z
```
2. Revisar manualmente los 247 archivos y descartar basura
3. Hacer commit limpio inicial
4. Ejecutar `git tag pre-bug-reporter` antes de empezar Fase 1

### 8.3 Implementación · 6 fases (12-14 días)
1. **Fase 1 · DB + RLS + endpoints** (3 días)
2. **Fase 2 · UI base reportador (modal + FAB)** (2 días)
3. **Fase 3 · UI admin (Kanban + tabla + drawer)** (2 días)
4. **Fase 4 · Auto-captura técnica (rrweb + console + network)** (2 días)
5. **Fase 5 · Notificaciones 4 canales** (3 días)
6. **Fase 6 · Polish admin** (banner bugs estancados + export CSV) (1 día) — **NO incluye webhook ni cierre automático** (ver D9 del spec)

---

## 9 · Mockup vigente

Archivo: `Bug_Reporter_Demo_v1.4.1_FIX.html`

Probarlo en navegador antes de codear · permite demostrarle a María/Yiwu el flujo completo sin haber escrito una línea de código todavía.

---

## 10 · Reglas de Sam (persona)

- **Idioma:** español venezolano · términos técnicos en inglés
- **Estilo:** directo, práctico, sin relleno, sin marketing-talk
- **Respuestas:** ≤500 palabras salvo que pida más detalle
- **Formato:** "Estamos · Meta · Avance" al inicio · "Siguiente paso" al cierre
- **División:** si una tarea tiene >3 pasos, dividir en fases
- **NO alabanzas vacías:** si algo está bien, decir "me gusta" + facts. Si no, corregir con justificación
- **Recordatorios:** sugerir `/in` (actualizar CLAUDE.md), cerrar sesión, guardar, compilar, cuando proceda
- **Formato preferido:** listas, tablas, comparaciones, ASCII rápido cuando ayude

---

## 11 · Glosario

| Término | Significado |
|---------|-------------|
| FAB | Floating Action Button · el botón rojo flotante para reportar |
| Triaje | Estado del bug cuando el admin lo tomó pero aún no codea |
| Drawer | Panel lateral derecho que se abre al clickear un bug en el Kanban |
| Replay | Sesión grabada con rrweb · invisible para el usuario, visible para admin |
| Tenant | Cliente del SaaS · cada negocio tiene su propio espacio aislado |
| MARKBOX | Código identificador único de envíos DTDCargo |
| IGTF | Impuesto a Grandes Transacciones Financieras (Venezuela) |
| SENIAT | Servicio Nacional Integrado de Administración Aduanera y Tributaria (Venezuela) |

---

**Fin del handoff. La próxima sesión arranca con este documento + el HTML del mockup v1.4 + el `CLAUDE.md` actualizado del repo.**
