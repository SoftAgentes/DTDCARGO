# Prompt de continuidad · próxima sesión · DTD-Cargo

Copialo tal cual al iniciar la próxima sesión.

> ⚠️ **Actualizado 2026-05-31 (revisión de pendientes).** El bloque crítico de
> pulido sin backend (#1-#14) está **cerrado**. Lo que queda crítico **necesita
> backend real**. No rehagas lo que ya está hecho — ver tabla abajo.

---

```
╔══════════════════════════════════════════════════════════════╗
║  🎯 ESTADO · v2.0 · pulido sin-backend CERRADO (10/10)         ║
║  → próximo golpe real: BACKEND (ver BACKEND-BRIEF.md)          ║
╚══════════════════════════════════════════════════════════════╝

Continuamos en DTD-Cargo. ESTADO ACTUAL: v2.0.
Todo el pulido visual + lógica mock está cerrado. Lo que falta
necesita un backend real (SMTP, OAuth, geocoding, push, scraping)
o es deuda menor de producto (ver más abajo).

Antes de tocar nada leé: CLAUDE.md · HANDOFF.md · nuevo/CHANGELOG.md
(las entradas v2.0, v1.9.2, v1.9.1 resumen lo último).
```

---

## ✅ CERRADO · no rehacer (estaba marcado como pendiente y YA está hecho)

| # | Tarea | Dónde quedó |
|---|---|---|
| 2 | **Profile Modal · persistencia** | `nuevo/modules/wiring.jsx` → actualiza `window.__currentUser` + `D.USERS` + `localStorage('dtd_user_override_{id}')` + evento `dtd-user-updated`; prefs en `localStorage('dtd_prefs')`. Overrides re-aplicados al iniciar en `DTD Studio · ERP.html`. |
| 3 | **OAuth SMTP · callback** | `nuevo/modules/wiring.jsx` → al paso 3 setea `SMTP_PROVIDERS[provider]` (`configured/active/account`). |
| 4 | **Attach files · draft** | `erp/modules/mailing-compose.jsx` → estado `attachments`, chips removibles, badge con contador en "Adjuntar". |
| 5 | **Scheduled send · cola** | `window.__scheduledEmails` + evento `dtd-scheduled-changed`; pestaña **Programados** (`erp/modules/mailing.jsx`) con `nuevo/modules/mailing-scheduled.jsx` (cancelar / enviar ya / KPIs). |
| 6 | **Drag&drop animado · Despacho** | `erp/modules/despacho.jsx` → fila levantada (scale + shadow-pop), destino translateY, transición spring. |
| 7 | **Skeletons de carga** | `erp/components.jsx` `useFirstLoad(key, ms)` + `LoadingRows` en `shipments.jsx` / `invoices.jsx`. |
| 8 | **HideValues (👁) global** | `erp/components.jsx` `useHideValues/setHideValues/getHideValues/maskVal`; aplicado en dashboard, shipments (Valor), invoices (Monto/Saldo). |
| 10 | **TMS · editor de incidencias** | `erp/modules/tms.jsx` `IncidentEditor` (Drawer) + store `window.__tmsIncidents` (crear/editar/eliminar). |
| 14 | **Multi-tenant · filtrado real** | `erp/data.jsx` (TENANTS, `byTenant`, `setTenant`, `currentTenant`, tagging `tenantId`); `TenantSwitcher` en `erp/shell.jsx`; `byTenant` aplicado en dashboard, shipments, clients, suppliers, invoices, costing, calendar, leads, quotes. |

Las 5 visuales nuevas (15-19: perfil usuario, Tu día, Modo cliente, hilo de
comentario, AI Copilot) también están construidas — viven en `nuevo/pantallas/`.
Pendiente menor: consolidarlas como drawers/rutas internas (hoy abren con
`window.open`) y mover `USER_PROFILES`/`THREADS` a `erp/data.jsx`.

---

## 🔴 CRÍTICO RESTANTE · necesita BACKEND REAL (no hacer en mock)

> **Arranque ya hecho (2026-05-31):** el contrato + esquema están escritos —
> `backend/prisma/schema.prisma` (multi-tenant, 1:1 con los mocks),
> `backend/API-CONTRACT.md` (endpoints→stores, regla de oro tenantId-del-JWT) y
> el seam de front `nuevo/api/client.jsx` (`window.DTDApi`/`DTDAuth`, toggle
> mock↔rest, hidrata `ERPData`). Lo que falta es **levantar el servidor**
> (Postgres + Prisma migrate + auth/JWT + worker SMTP), que NO corre en este
> entorno → sesión de Claude Code sobre el repo.

Leer **`BACKEND-BRIEF.md`** y **`PROMPT-BACKEND.md`**. La UI/stub ya existe;
estos puntos solo cierran con servidor + cuentas externas:

1. **Envío SMTP real** — `sendWelcomeEmail()` y el compose hoy escriben a
   localStorage. Falta disparar el mail vía proveedor configurado.
   (`erp/data-bridge.jsx` + `erp/modules/mailing-config.jsx`; template `m-05` listo.)
2. **OAuth callbacks reales** — el flujo mock persiste el provider; falta el
   callback real de Google/Microsoft.
3. **Geocoding real** (Google Maps / Mapbox) — direcciones VE ya estructuradas
   con IPOSTEL para alimentarlo.
4. **Push notifications** (FCM / APNs).
5. **Scraping real** — tasas BCV (4 fuentes mock) + ferias/feriados (hoy la IA
   descubre/normaliza vía `window.claude.complete`).
6. **Aislamiento por tenant server-side** — `byTenant` es filtro cliente;
   en backend `tenantId` debe venir del server y filtrarse en la API.
   (TMS/flota quedó como infra compartida sin `tenantId` a propósito.)
7. **Persistencia compartida entre usuarios** — hoy todo es localStorage /
   stores en memoria (`window.__scheduledEmails`, `__tmsIncidents`, `__comments`).

---

## 🟡 DEUDA MENOR · sí codeable en mock (si no se va a backend todavía)

- ~~**SearchSelect en proveedor + líneas** de Servicios y Tarifas~~ ✅ **HECHO (2026-05-31)** —
  "Proveedor sugerido" y la sección "Proveedores y costos" por tarifa usan `ERPUI.SearchSelect`
  con "+ crear proveedor" (`nuevo/propuesta/servicios-tarifas.jsx`).
- ~~**Catálogo de Servicios → `ERPData`** y enganche real con cotizador/facturación~~ ✅ **HECHO
  (2026-05-31)** — `ERPData.CATALOG` (única fuente) + `ERPUI.CatalogLines` (líneas que toman tarifa
  vigente) enganchado en Factura (→ base/monto) y Cotización (→ total).
  (cada línea referencia un ítem + su tarifa vigente).
- **"+ Crear" global por rol** — filtrar ítems del mega-menú por permisos +
  sección "Frecuentes" que aprenda lo más usado (`erp/shell.jsx`).
- **Consolidar pantallas 15-19** como drawers/rutas internas (ver arriba).
- Integrar **Órdenes esperadas (Almacén CN) + Cobro a caja + Proveedores CN**
  con Servicios y Tarifas.

---

## ⚠ NOTAS PARA LA PRÓXIMA SESIÓN

- TODO archivo nuevo va a `nuevo/`. Si tocás un archivo viejo, anotalo en
  `nuevo/CHANGELOG.md` con archivo + línea + razón.
- Tokens CSS (`var(--*)`) SIEMPRE · cero hex inventados (excepto render fijo en
  blanco como las etiquetas PDF).
- Fuentes del sistema: **Nunito Sans + Sora**; branding: **Archivo / Archivo
  Black**; + **JetBrains Mono** y **Noto Sans SC**. Ninguna otra.
- Sin emoji decorativo · sin gradientes coloridos · sin AI slop.
- **NO REHAGAS NADA EXISTENTE.** Verificá contra la tabla "CERRADO" antes de
  empezar. Si hay duda, preguntá antes de codear.
```
