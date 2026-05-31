# Norte · CHANGELOG (handoffs de Cloud Design)

> Historial humano de las cargas del **Norte visual** (protocolo NORTE-SYNC).
> El detalle técnico vive en `git log` / tags `norte-vX.Y`. El mockup vigente está en `_norte/`.
> Regenerar índice: `node scripts/norte.mjs` · servir: `npx serve docs/design/studio/_norte -l 3010` → http://localhost:3010/_norte

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
