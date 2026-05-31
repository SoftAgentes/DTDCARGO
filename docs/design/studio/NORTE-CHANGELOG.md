# Norte · CHANGELOG (handoffs de Cloud Design)

> Historial humano de las cargas del **Norte visual** (protocolo NORTE-SYNC).
> El detalle técnico vive en `git log` / tags `norte-vX.Y`. El mockup vigente está en `_norte/`.
> Regenerar índice: `node scripts/norte.mjs` · servir: `npx serve docs/design/studio/_norte -l 3010` → http://localhost:3010/_norte

## v1.9 — cargada 2026-05-31 (handoff de Cloud Design; el front llegó a v1.9.2)

Fuente: `Downloads/DTD-Cargo Proyecto Completo (handoff v1.9).zip` (~13.4 MB, 374 archivos).
El ZIP rotula "v1.9" pero internamente trae tres releases del día (v1.9 · v1.9.1 · v1.9.2, ver `nuevo/CHANGELOG.md`).
**Cero eliminaciones** — v1.9 es superset de v1.8. Lo que git detectó como avance real (ignorando ruido LF/CRLF):
**17 archivos con cambios de contenido (+396 / −53)** + **12 archivos nuevos**.

**Pantallas nuevas (v1.9 · 5 visuales que faltaban):**
- `Modo Cliente.html` (raíz) — barra de impersonación admin sobre un iframe del Portal del Cliente V2 (`?as=DTD-XXXX`).
- `nuevo/pantallas/usuario-perfil.{html,jsx}` + `usuario-perfil-data.jsx` — perfil de usuario interno (presencia, asignados por rol, timeline, contacto corporativo, acceso por ROLE_MODULES).
- `nuevo/pantallas/tu-dia.{html,jsx}` — bandeja personal cross-módulo consciente del rol (tareas derivadas de SHIPMENTS/INVOICES/QUOTES/NOTIFS).
- `nuevo/pantallas/hilo-comentario.{html,jsx}` — hilo de comentarios expandido (respuestas anidadas, @menciones, reacciones).
- `nuevo/pantallas/copilot.{html,jsx}` — AI Copilot conversacional (`window.claude.complete`, haiku, con snapshot de datos como contexto).

**Otros archivos nuevos:**
- `BACKEND-BRIEF.md` ⭐ — **brief técnico de backend + multi-tenant para Claude Code**: modelo de datos con `tenant_id`, auth/JWT, endpoints REST, mapa stores-mock→backend, integraciones externas. Es la hoja de ruta prototipo→producto. **Leer antes de empezar el backend del Studio.**
- `nuevo/modules/mailing-scheduled.jsx` — cola de emails programados (KPIs, cancelar / "enviar ya").

**Wiring al ERP (v1.9) + pulido (v1.9.1/.2) — archivos viejos tocados:** `erp/shell.jsx` (topbar Tu día + Copilot, menú usuario Modo cliente), `erp/modules/{users,comments,mailing,mailing-compose,shipments,invoices,despacho,tms}.jsx`, `erp/components.jsx` (`useFirstLoad`, `useHideValues` global), `nuevo/modules/{wiring,dashboard}.jsx`, `portal/app-v2.jsx` (soporte `?as=`). Destacan `tms.jsx` (+95: editor de incidencias), `wiring.jsx` (+56), `mailing-compose.jsx` (+41: adjuntos + programar).

**Overlay "estás aquí":** 2 construidas · 11 en construcción · 11 en diseño (24 pantallas-meta). Las 5 nuevas entran como 📋 Diseño (mockup sin código todavía). El conteo deriva del `status` del SDD por módulo (regla de 3 estados), no solo de "existe la carpeta".

**Peso (fuera de git):** `uploads/`, `scraps/`, `Brand Book v3.0 Package/`, `_norte.html`.

---

## v1.8 — cargada 2026-05-30 (handoff de Cloud Design, fechado 2026-05-31)

Primera carga del NORTE-SYNC. Reemplaza la referencia v1.7 que vivía en el repo.
Fuente: `Downloads/DTD-Cargo Proyecto Completo (handoff v1.8).zip` (13.8 MB).

**Nuevo vs v1.7 (pantallas / carpetas):**
- `Portal del Cliente · V2.html` (nuevo)
- `Registro de cliente · V2.html` (nuevo)
- carpetas `operario/`, `iconos-perfiles/` + `estado-cuenta.jsx`

**Releases que trae el handoff (de `HANDOFF.md` · ESTADO ACTUAL v1.8):**
- **v1.2** — Contabilidad (QuickBooks-like: plan de cuentas, diario/mayor, P&L, balance, lock de período)
- **v1.3** — Mobile ERP (vista móvil admin) + fix dark mode
- **v1.4 / v1.4.1** — Generador de etiquetas PDF bilingüe ES/中文 para suppliers CN
- **v1.5** — Validación MARKBOX server-side + email de bienvenida + Cola QR (storage listener)
- **v1.6** — 9 conexiones wireadas (Adjuntar · Programar · Mi perfil · Cambiar contraseña · Atajos · Generar BL · OAuth · sync HS/AES · Actividad reciente · Mailing Logs)
- **v1.8** — Gestor de columnas reutilizable (6 tablas) + ROLE_MODULES (permisos por rol) + fix render `.erp-route` + Logo Oficial 2 grupos
- **Además:** Plataforma + Super Admin, modo despacho + parciales, alertas de cierre de contenedor/BL a 50 CBM, escaneo por grupo, etiquetado mercancía peligrosa/frágil/marca/licencia, traducción 中文, Operarios PWA, Conciliación bancaria, Vault, perfiles individuales (chofer/camión/agente)

**Overlay "estás aquí":** 13/19 módulos con código en el repo.
**Peso (fuera de git):** `uploads/`, `scraps/`, `Brand Book v3.0 Package/`, `_norte.html`.

<!-- Próximas cargas: agregar la nueva versión ARRIBA de esta. El founder entrega el ZIP completo →
     Claude sobrescribe _norte/ + git diff + nueva entrada aquí. -->
