# DTD-Cargo · Handoff

> **Documento único de orientación.** Reemplaza a los handoffs/prompts dispersos
> de sesiones previas (`HANDOFF` v1.x, `PROMPT-proxima-sesion`, `PROMPT-CLAUDE-CODE`,
> `design_handoff_dtd_cargo/README`), que se consolidaron acá en **v2.4 (2026-06-01)**.
>
> **Lee en este orden:** `CLAUDE.md` (guardrails de marca · reglas absolutas) →
> [`docs/governance/AGENT-BRIEF.md`](../../../governance/AGENT-BRIEF.md)
> (comportamiento y componentes) → este archivo (estado + arquitectura) →
> `CHANGELOG.md` (bitácora detallada,
> archivo+línea+razón de TODO lo construido) → `backend/README.md` (qué falta para
> producto real).
>
> **Paquete móvil (app de teléfono):** ver `HANDOFF-MOBILE.md` — login único, ruteo
> por rol, sesión persistente, multi-rol, offline y endpoints. Spec visual de sesión:
> `Login y Sesión · Operario.html`.

---

## 🟢 Estado actual · v4.6 (2026-07-10)

> **Versión única del proyecto: v4.6** (2026-07-10). Ciclo de accesibilidad WCAG AA (BD-016…019),
> hardening de gradientes (BD-022/023) y split de terminología MARKBOX/Shipping Mark (BD-021).
> Ver `BRAND-DECISIONS.md` BD-016…027 para el detalle completo.
>
> **✅ Sync completo en este repo (Norte, 2026-07-12):** tokens (`erp/tokens.css`), componentes
> (`erp/components.jsx` → `Badge`), gradientes (`var(--ink)` hardening), docs (`CLAUDE.md`,
> `BRAND.md`, `BRAND-DECISIONS.md`), el barrido `--ink-mute`→`--ink-soft` en texto (BD-019, ~57
> archivos revisados) y el patch BD-028 — todo aplicado. El **Brand Book físico** llegó como
> standalone (todo embebido) y ya está publicado en `docs/design/studio/_norte/Brand Book DTD
> v4.6.html` y `private/marca/brand-book-v4.6.html`; punteros de código actualizados
> (`app/marca/`, `app/interno/(app)/marca/`, `BrandMark.tsx`, `lib/design-tokens.ts`).

> **✅ Patch en este repo (Norte, 2026-07-19 · sigue v4.6):** `NORTE-SYNC-2026-07-19.md` — se cerraron
> 4 decisiones que faltaban (el repo cortaba en BD-028): **Glass (BD-031)** — tokens `--glass-*` a
> producción (`app/globals.css` + `app/studio/tokens.css`, light/dark) + aplicado a la calculadora
> flotante del portal (`PortalCalcFab.tsx`); **Glow de fondo (BD-030)** — token `--bg-glow` (glow
> radial tonal navy→ink, los coloridos siguen prohibidos); **Shipping Mark único (BD-029)** — se retira
> "MARKBOX" del lenguaje visual (sweep de web pública **pendiente** con la reconstrucción de la web);
> **Mockups T2 (BD-032)** — registrado, N/A en producción. `BRAND.md` §AI Slop pasa glass/glow a
> permitido-con-límites. El **Brand Book físico NO se regeneró** (el .zip lo indica). La **web pública
> no se toca** en este ciclo (§0). Detalle: `CHANGELOG.md` (entrada 2026-07-19) + `BRAND-DECISIONS.md`
> BD-029…032.

> **Versión anterior: v4.5** (2026-06-20). Marca y producto comparten un solo
> número visible — sidebar del ERP, títulos del Portal y apps de operario, tokens y Brand
> Book dicen todos **v4.5**. Las menciones a v2.x/v3.x en CHANGELOG y comentarios de código son
> historia (cuándo se construyó cada cosa) y no se reescriben.

> **🚀 Ya LIVE en producción (repo Claude Code · 2026-07-02).** Este Norte es la fuente de diseño;
> lo de abajo ya está **shipped en prod** (se anota para que el Norte refleje la realidad del
> producto — misma marca/versión v4.5, cada cosa identificada por su SDD).
>
> **⚠️ Partes donde PRODUCCIÓN SUPERÓ este Norte** (incorporar en la próxima iteración de diseño):
> - **Perfil del Portal (`portal/app.jsx` · PortalProfile):** prod tiene **N direcciones de entrega
>   con predeterminada** + **estimado de entrega por dirección** (reusa config del calculador) +
>   **avatar editable** (foto o iniciales, separada del documento de identidad) + card "¿Importas
>   para tu negocio?" · **SDD-0138** (migr 0198/0199). El prototipo aún muestra una sola dirección.
> - **Usuarios & Roles (`erp/modules/*users*`):** `users.jsx` prometía el scope de almacén en el
>   alta; prod lo tiene **y más**: `warehouse_scope` cn·ve·all por usuario + **desactivación real**
>   (RLS + ban en Auth + anti-lockout) + **auditoría append-only** de cambios de rol/disable/scope +
>   capabilities (`approve_money`) · **SDD-0085 hardening 3 + SDD-0139** (migr 0200-0202). El rol
>   **marketing** ve los 4 módulos transversales (dashboard, calendario, menciones, bugs).
>
> **Corte 2026-07-02** — shipped desde el corte anterior (resumen por área):
> - **Portal:** reportar pago + hitos del embarque + cut-off · **SDD-0134/0132/0133** (migr 0195/0196) ·
>   registro de cliente real · **SDD-0131** (migr 0194) · **Club DTD** · **SDD-0116** · crédito de
>   referido auto-acreditado en la 1ª factura · **SDD-0051 F2** (migr 0197) · correos de Auth
>   brandeados (reset/OTP/cambio de email).
> - **Studio ERP:** módulo **Administración** completo, 11 secciones · **SDD-0120→0130** (migr
>   0190-0193) · **buscador global ⌘K** permission-aware · **SDD-0135** · fix del invite de usuarios
>   (migr 0203).
> - **Empleados / móvil:** onboarding del empleado + recibo de nómina PDF en `/m/emp` ·
>   **SDD-0113/0117** · barrido phone-first de las apps de operario (migr 0183/0184).
> - **Público:** `/enlaces` (link-in-bio de Instagram, diseño de este Norte `handoff-enlaces`) LIVE +
>   guía interna en el hub de marca.
>
> **Corte 2026-06-20:**
> - **Packing List trilingüe del proveedor** + Caja Padre + etiquetas QR (verificables en
>   `/verificar`) + dirección del proveedor · **SDD-0097** (migr 0148).
> - **Cotizador público de fletes** en `/cotizador-flete` · **SDD-0095**.
> - **Sitio público:** home con un solo CTA (sin botón de WhatsApp) · registro simplificado ·
>   pestaña **Finanzas** en el Portal · calculadora con recargo por densidad.
> - **Prealertas · menú de servicios de recepción** sobre la prealerta · **SDD-0098** (migr 0150).
> - **Academia:** portal del alumno (detalle/progreso/diplomas) + cohortes/asistencia · **SDD-0093 Slice B** (migr 0149).
> - **Kommo write-back** deployado (en dry-run) · **correo del Portal branded** vía Resend SMTP.

Prototipo funcional de **alta fidelidad** (React in-HTML, sin build). Todo "anda"
con mock data realista persistida en `localStorage`. **No hay backend todavía.**

- **Pulido sin-backend:** cerrado (skeletons, hide-values, drag&drop, scheduled send,
  multi-tenant *cliente*, perfiles, Tu día, Modo cliente, hilos, AI Copilot…).
- **Consolidación de repo (v2.4):** cerrada — ver abajo.
- **Lo último (v2.5 · 2026-06-07):** celebración del Shipping Mark al registrar la compra en el
  Portal (`portal/registro.jsx`), **tarjeta de presentación** como pieza oficial de marca
  (`Tarjeta de Presentación.html`), **Brand Book → v3.5**, y un chequeo de links/conflictos
  para este handoff. Detalle completo en `CHANGELOG.md` (entrada 2026-06-07). La versión del
  ERP en el sidebar se alineó a **v2.5** (los módulos de contabilidad/nómina/backend ya lo estaban).
- **Lo único que falta para lanzar es el backend real** → `backend/README.md`.

### Lo que cerró v2.4 (sesión de consolidación)
1. **Entrypoint único** `DTD Studio · ERP.html` (se eliminó el clon `Nort v2.4`).
2. **Fuentes de verdad únicas:** assets → `assets/` · tokens → `erp/tokens.css` ·
   marca → `CLAUDE.md` · Brand Book → `Brand Book DTD v4.5.html`. Se borraron
   snapshots viejos que revertían la migración tipográfica.
   **Regla de sync con Norte:** cada actualización de marca se lleva completa a
   Claude Code; allí se eliminan los brand books anteriores y solo queda la versión
   nueva como referencia (protocolo completo en `CLAUDE.md` § Sincronización).
3. **Split `erp/` vs `nuevo/` retirado:** todo lo que vivía en `nuevo/` se movió a su
   lugar canónico (`erp/`, `erp/modules/`, `pantallas/`, `operario/`, `propuesta/`,
   `mobile/`). **Los archivos nuevos van directo a su lugar definitivo** — ya no hay antesala.
4. **"+ Crear" adaptado al rol** + sección "Frecuentes" + enganche con el catálogo.
5. **6 pantallas full-page** (Tu día, Perfil, Hilo, Copilot, Estado de cuenta, Modo
   cliente) montan como **overlay interno** del ERP (`window.__erpOverlay`), ya no con
   `window.open`. Sus datos viven en `erp/data.jsx`.
6. **Higiene de docs:** handoffs/prompts dispersos consolidados a este archivo +
   `backend/README.md`; bitácora única en `CHANGELOG.md` (raíz).

---

## 🧱 Arquitectura (cómo está armado)

- **Sin build.** `DTD Studio · ERP.html` carga, en orden, vía `<script type="text/babel" src=...>`:
  React 18 + ReactDOM + Babel standalone → fundaciones (`erp/icons.jsx`, `erp/i18n-cn.jsx`,
  `erp/data.jsx`, `erp/components.jsx`, `erp/rates.jsx`, `erp/shell.jsx`) → módulos
  `erp/modules/*` → seam de datos (`erp/data-bridge.jsx`, `erp/api/client.jsx`) →
  pantallas overlay (`pantallas/*.jsx`) → bootstrap inline.
- **Registro de módulos:** el sidebar se define en `erp/shell.jsx` (`MODULES[]`, con
  `group`, `parent` para sub-grupos, `badge`). El router vive en el bootstrap de
  `DTD Studio · ERP.html` (`moduleMap`), que mapea cada `id` a un `window.Module*`.
  Permisos por rol en `erp/data.jsx` (`ROLE_MODULES`).
- **Cada módulo** es `function ModuleXxx({ goTo, currentUser, ... })` autoexpuesto en
  `window.ModuleXxx`. Navegación global: `window.__erpGoTo(moduleId, recordId?, view?)`.
- **Overlays full-page:** `window.__erpOverlay(kind, params)` / `window.__erpCloseOverlay()`
  (`OverlayHost` en `erp/shell.jsx`). `kind` ∈ `tudia · perfil · hilo · copilot ·
  estadocuenta · modocliente`. Cada pantalla va envuelta en IIFE (`/* @iife */`) para
  aislar helpers homónimos entre archivos; solo escapa el `window.X = X`.
- **Datos** en globals: `window.ERPData` (clientes Shipping Mark `DTD-XXXX`, embarques
  `DTDU-XXXXXX`, facturas `F-2026-XXXX`, usuarios, proveedores CN, perfiles, hilos…) y
  data-modules por feature (`window.TesoreriaData`, `NavieraData`, `ContabilidadData`,
  `FiscalData`, `DocumentosData`, `CobranzasData`, `FidelizacionData`, `ConversacionesData`).
  Tasas en `window.ERPRates` (BCV/paralelo/CNY, `fmtUsd`/`fmtBs`).
- **Seam de API:** `window.DTDApi` / `window.DTDAuth` (`erp/api/client.jsx`). `window.ERPData`
  es LA interfaz; toggle `mode:'mock'|'rest'`. En mock espeja el contrato leyendo
  `ERPData`/`DTDData`; en rest hace `fetch`. **No cambiar la firma del seam** al portar.
- **Config de negocio:** `window.DTDConfig` (localStorage + evento `dtd-cfg-changed`);
  export CSV en `window.DTDExport.csv()`.
- **Componentes compartidos:** `window.ERPUI` (`Btn, Input, Select, Badge, Card, Table,
  KPI, Drawer, Modal, Tabs, Avatar, Progress, Toolbar, Field, EmptyState, PageHeader,
  SearchSelect, CatalogLines`, columnas configurables).
- **Apps de operario · reuso de flujos:** las apps móviles exponen sus sub-flujos para
  que el launcher multi-rol (`Operario Multi.html`) los reuse sin re-login ni rediseño:
  `operario/bodeguero.jsx` → `window.BodegueroFlows = { ReceptionFlow, DispatchFlow }`;
  `operario/ve.jsx` (envuelto en IIFE) → `window.OperarioVEFlows = { DeliveryFlow }`.
  **Regla:** todo `.jsx` que se co-cargue con otro va en IIFE (escape solo `window.X`),
  porque los scripts Babel comparten scope global y los helpers homónimos (`Steps`,
  `Login`, `MobileHeader`…) se pisan. `ve.jsx` ya migró; `bodeguero.jsx` sigue en
  scope global (funciona porque su par, `ve.jsx`, está aislado).

---

## 🗺 Mapa de módulos (cada uno = candidato a endpoint real)

> Detalle con archivo+línea+razón en `CHANGELOG.md`.

| Módulo | Archivo | Backend que pide |
|---|---|---|
| **Tesorería** | `erp/modules/tesoreria*.jsx` | Caja multi-moneda (USD/VES/USDT/CNY), CxP, órdenes de pago/remesas CN · ejecución wire/USDT + aprobación multi-firma |
| **Naviera & Consolidación** | `erp/modules/naviera*.jsx` | Itinerarios (sailings + cut-off), bookings/BL, LCL→FCL · scraping de itinerarios, emisión BL, bin-packing CBM/peso |
| **Conversaciones** | `erp/modules/conversaciones*.jsx` | Bandeja unificada WhatsApp/email/portal · WhatsApp Business API, IMAP/SMTP, webhooks, SLA |
| **Portal · Soporte + Fidelización/Referidos** | `portal/app.jsx`, `erp/modules/fidelizacion*.jsx` | Casos de soporte, niveles por facturación, programa de referidos con créditos |
| **Dirección · Tablero ejecutivo** | `erp/modules/direccion.jsx` | Cabina del dueño (solo lectura, Admin-only) que cruza todos los módulos |
| **Flujo de trabajo** | `erp/modules/flujo-trabajo.jsx` | Workflow map estilo QuickBooks · bienvenida por rol + nodos con badges en vivo |
| **Documentos · Hub (DMS)** | `erp/modules/documentos*.jsx` | Carpetas + doc↔transacción; embed `window.DocsForTransaction({kind,id})` · subida real, preview, OCR, versionado |
| **Fiscal · SENIAT** (opcional) | `erp/modules/fiscal*.jsx` | Libro Ventas/Compras, Retenciones, Declaración IVA (USD + VES@BCV) · TXT/XML SENIAT. Controlado por toggle IVA |
| **Reportes** | `erp/modules/reports.jsx` | 2 niveles + Constructor (report builder: fuente→agrupar→métrica→filtro→export CSV) |
| **Cobranzas** | `erp/modules/cobranzas*.jsx` | Cola CxC vencidas + seguimiento/promesa/bitácora · envío real de recordatorios, registrar pago que baje saldo |
| **Facturación IVA-aware** | `erp/modules/invoices.jsx` | Discrimina base+IVA cuando el toggle IVA está ON |

### Toggle clave: IVA/SENIAT (OFF por defecto)
`window.DTDConfig.get('iva')` controla toda la capa fiscal. **Apagado por defecto**
(DTD hoy no maneja IVA). Se activa en **Administración → "Impuestos · IVA/SENIAT"**
(`erp/modules/dtd-config.jsx`). OFF oculta: tab "Fiscal · SENIAT", reporte "Posición
IVA", desglose de IVA en Facturación. Reactivo vía `dtd-cfg-changed`. En backend = preferencia de tenant.

---

## 📁 Entrypoints

| Archivo | Qué es |
|---|---|
| `DTD Studio · ERP.html` | ERP admin (entry principal) |
| `Portal del Cliente.html` + `portal/app.jsx` | Portal externo del cliente |
| `Registro Cliente.html` + `portal/registro.jsx` | Alta de cliente |
| `Portal Cliente Mobile.html`, `Mobile ERP.html` | Versiones móviles |
| `Operario CN/VE/Multi.html`, `Bodeguero VE.html`, `Camionero.html` | Apps de operario |
| `Despacho · Vista 3.html`, `Mapa de Proceso.html` | Operación / proceso |
| `Brand Book DTD v4.5.html`, `Logo Oficial.html`, `Iconos de Perfil.html`, `Aplicaciones de Marca.html` | Identidad |
| `CLAUDE.md` | **Guardrails de marca — LEER PRIMERO** |
| `HANDOFF-MOBILE.md` | **Paquete completo del teléfono** — auth, ruteo por rol, sesión, multi-rol, offline, endpoints |
| `Login y Sesión · Operario.html` | Spec visual de la lógica de sesión (6 estados) |
| `BRAND-MIGRATION-2026-05.md` | Spec del sistema de logo (4 variantes, `ERPUI.Lockup`) |
| `CHANGELOG.md` | Bitácora detallada (archivo+línea+razón) |
| `backend/README.md` + `backend/API-CONTRACT.md` + `backend/prisma/schema.prisma` | Handoff de backend |

---

## 🎨 Design tokens (no re-derivar)

Todos en **`erp/tokens.css`** (light + dark + densidad). Resumen:
- **Color:** `--wine #7F0F1A` (+ deep/soft/tint/bg), `--bg-base #FBFAF7`,
  `--bg-sidebar #0F1E3D` (navy), `--ink #0F1E3D`; semánticos `--success #1F8A5B` /
  `--warning #B8893A` (dorado, no naranja) / `--danger #A8323E` / `--info #2A6FDB`,
  cada uno con su `-bg`.
- **Tipografía (capa SISTEMA):** `--f-sans` Nunito Sans · `--f-display` Sora ·
  `--f-mono` JetBrains Mono · `--f-cn` Noto Sans SC (solo chino).
  **Capa BRANDING (constante):** `--f-brand` Archivo · `--f-brand-display` Archivo Black.
- **Spacing** escala 4px (`--s-1..--s-16`), radios (`--r-xs..--r-pill`), sombras
  (`--shadow-xs..--shadow-pop`), motion (`--ease`, `--dur*`).

Ver `CLAUDE.md` para las reglas absolutas (paleta, fuentes, prohibición de AI slop, nomenclatura Shipping Mark).

---

## ✅ Reglas que no se rompen (resumen — detalle en `CLAUDE.md`)

1. **Solo tokens CSS** (`var(--*)`). Cero hex inventados (excepto render fijo en blanco
   como las etiquetas PDF).
2. **Fuentes:** sistema → Nunito Sans + Sora; branding → Archivo / Archivo Black; +
   JetBrains Mono y Noto Sans SC. Ninguna otra.
3. **Cero AI slop:** sin gradientes coloridos, sin emoji decorativo, sin glassmorphism.
4. **Componentes del sistema** (`window.ERPUI`) primero. Inventar solo con `/* TODO: brand-review */`.
5. **Shipping Mark:** término único en todos los contextos; mismo valor (`DTD-XXXX`); de cara al
   proveedor CN se acompaña del chino: "Shipping Mark (唛头)".
6. **Avisar antes de violar** una regla (formato `BRAND-CHECK` en `CLAUDE.md`).
7. **No rehacer lo existente.** Verifica contra el `CHANGELOG.md`. Si hay duda, preguntá.
