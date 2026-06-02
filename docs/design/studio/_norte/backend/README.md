# DTD-Cargo · Backend · brief + arranque

> **Para Claude Code.** Documento único de backend (consolida los antiguos
> `BACKEND-BRIEF.md` + `PROMPT-BACKEND.md`, v2.4 · 2026-06-01). Define QUÉ construir
> para pasar de prototipo (mock en memoria/localStorage) a producto real. El diseño y
> el front están completos — **no rehagas pantallas, ya existen.** Acá conectás la
> lógica real detrás de ellas.
>
> **Antes de tocar nada, leé en orden:** `CLAUDE.md` (guardrails de marca · reglas
> absolutas) → `../HANDOFF.md` (estado + arquitectura + mapa de módulos) →
> `../CHANGELOG.md` entero (bitácora con archivo+línea+razón) → `prisma/schema.prisma`
> + `API-CONTRACT.md` (tu punto de partida real).

---

## 0 · Estado actual (de dónde partís)

- **Front:** React + Babel inline, sin build step. Datos mock en `erp/data.jsx`
  expuestos en `window.ERPData` (CLIENTS, SHIPMENTS, INVOICES, USERS, SUPPLIERS, QUOTES,
  WAREHOUSE_CN/VE, RATES, DOCUMENTS, NOTIFS, TMS_*, ROLE_MODULES…).
- **Persistencia hoy:** `localStorage` + stores en memoria (`window.__scheduledEmails`,
  `window.__tmsIncidents`, `window.__comments`, `dtd_user_override_*`, `dtd_prefs`,
  `dtd_dashboard_hide`, `dtd-*-cols-v1`). Todo se pierde o no se comparte entre usuarios.
- **Seam ya listo:** `erp/api/client.jsx` expone `window.DTDApi` / `window.DTDAuth`.
  `window.ERPData` es LA interfaz; el front ya consume por acá en modo `mock`. Cuando tu
  API responda, el front pasa a `rest` con un flip: `DTDApi.config({ mode:'rest', baseUrl })`
  y `DTDApi.hydrate()` rellena `ERPData` desde la API. **No cambies la firma del seam** —
  implementá los endpoints que ya espera (ver `API-CONTRACT.md`).
- **Objetivo:** un backend real que persista, autentique y **aísle por tenant**.

**Regla de migración:** mantené `window.ERPData` como la **interfaz**. Reemplazá su
relleno: en vez de arrays hardcodeados, que el cliente API hidrate `window.ERPData.*` al
loguear. Así el front casi no cambia.

---

## 1 · Plataforma vs Tenant (lo más importante)

DTD-Cargo es **multi-tenant**: una plataforma que opera varias empresas de logística
(DTD-Cargo + aliados + futuros clientes white-label).

| Plano | Usuario | Alcance |
|---|---|---|
| **Plataforma** | Super Admin · Gestor de bugs · Operador de cambios | Cross-tenant. Gestiona tenants, feature flags, billing, salud del sistema. NO ve datos operativos salvo soporte explícito. |
| **Tenant** | Administrador de Tenant + roles operativos (Comercial, Operaciones, Contabilidad, Almacén CN/VE, Soporte) | Aislado a SU tenant. Es el ERP que ya existe. |

### Entidad raíz: `tenant`
```
tenant { id, name, slug, plan, status, brandConfig, codePrefix, createdAt, modulesEnabled[] }
```
- `codePrefix` → prefijo de MARKBOX (DTD usa `DTD`; un aliado usaría el suyo). Los aliados
  comparten la secuencia DTD; otros tenants editan su nomenclatura.
- `modulesEnabled[]` → reemplaza los feature flags locales (`window.FEATURE_FLAG_DEFAULTS`).

---

## 2 · Multi-tenant: la regla de oro

**TODA tabla operativa lleva `tenant_id` y TODA query lo filtra.** Hoy el selector de
tenant existe pero NO filtra server-side — ese es el bug de negocio #1.

- Cada request autenticado resuelve `tenant_id` desde el JWT/sesión.
- El backend **nunca** confía en un `tenant_id` que venga del cliente — lo toma del token.
- Aislamiento a nivel de query (row-level security en Postgres/Supabase es ideal).
- El Super Admin puede impersonar un tenant para soporte (con auditoría).
- **Front:** cada módulo ya recibe `currentUser`. Sumar `currentUser.tenantId` y que el
  cliente API lo mande implícito (vía token). `cn.jsx`, `ve.jsx`, `shipments.jsx` ya
  tienen scoping por hub — extender a tenant.

---

## 3 · Modelo de datos (entidades núcleo)

Derivado 1:1 de los mocks. Todas con `id`, `tenant_id`, `created_at`, `updated_at`.
**El esquema completo ya está en `prisma/schema.prisma` — revisalo y ajustá, no lo rehagas.**

```
tenant        { id, name, slug, plan, status, code_prefix, modules_enabled[] }
user          { id, tenant_id|null, name, email, role, team, status, two_fa, phone, avatar, scope }
                ↑ tenant_id NULL = usuario de Plataforma (Super Admin etc.)
client        { id, tenant_id, markbox, name, company, rif, segment, city, status }   // MARKBOX = code_prefix-NNNN
supplier      { id, tenant_id, client_id, name, cn_name, city, province, industry, contact_* }
order         { id, tenant_id, client_id, supplier_id, seq, code, status, created_at }  // code = MARKBOX-PROV-COMPRA
shipment      { id, tenant_id, client_id, order_id, type, origin, destination, cbm, weight, value, status, etd, eta }
box           { id, tenant_id, shipment_id, order_id, label, qr, status, flags[] }      // flags: peligrosa/frágil/marca/licencia
invoice       { id, tenant_id, client_id, shipment_id, amount, currency, issued, due, status, paid }
quote         { id, tenant_id, client_id, type, origin, destination, cbm, total_usd, status, agent_id }
warehouse_evt { id, tenant_id, shipment_id, hub, type, payload, photos[], created_at }
document      { id, tenant_id, shipment_id|client_id, kind, url, status }
container     { id, tenant_id, code, seal, bl, cbm_total, status, partials[] }
comment       { id, tenant_id, record_type, record_id, author_id, body, mentions[], reactions, parent_id }
scheduled_email { id, tenant_id, to, subject, channel, iso, status, attachments[] }
tms_incident  { id, tenant_id, truck, type, severity, date, desc, cost, status }
audit_log     { id, tenant_id, actor_id, action, target, before, after, ip, created_at }
```

### Nomenclatura MARKBOX (crítica — ver `CLAUDE.md` + portal/registro)
- Cliente: `{code_prefix}-{NNNN}` → `DTD-5509`
- Compra: `{markbox}-{proveedor#}-{compra#}` → `DTD-5509-1-2`
- El contador por proveedor vive en `order.seq`. La validación/unicidad ya existe en front
  (`validateMarkboxFormat`/`nextMarkbox` en `erp/data-bridge.jsx`) — moverla al backend como
  fuente de verdad. Numeraciones `F-`, `DTDU-`, `CXP-`, `REF-`, `REC-`, `DOC-` son
  secuenciales server-side.

---

## 4 · Auth

- **JWT** (access + refresh) o sesiones server-side. El token lleva `user_id`,
  `tenant_id` (null para Plataforma), `role`.
- **Login:** tenant users por email+password (o MARKBOX en el Portal). Super Admin por
  dominio/flag de Plataforma.
- **2FA:** el campo `two_fa` ya está en USERS — implementar TOTP.
- **Permisos:** `ROLE_MODULES` (en `erp/data.jsx`) es la matriz rol→módulos. Llevarla al
  backend y validar cada endpoint, no solo ocultar en el front.
- **Portal del cliente:** auth separada (cliente externo · solo ve SUS datos, `client_id`
  del token). Soporta impersonación admin vía `?as=` (Modo Cliente) — protegerla detrás de rol admin.

---

## 5 · Endpoints mínimos (REST — detalle en `API-CONTRACT.md`)

```
POST  /auth/login            /auth/refresh        /auth/2fa
GET   /me                    PATCH /me            (persiste "Mi perfil" — hoy localStorage)
GET   /tenants               POST /tenants        PATCH /tenants/:id        (Plataforma)
GET   /clients?…             POST /clients        GET /clients/:markbox
GET   /suppliers             POST /suppliers      POST /clients/:id/orders  (genera siguiente code)
GET   /shipments?status=…    PATCH /shipments/:id/status
GET   /warehouse/cn          POST /warehouse/cn/receive   POST /containers/:id/consolidate
GET   /invoices              POST /invoices       POST /invoices/:id/pay
GET   /quotes                POST /quotes
GET   /comments?record=…     POST /comments       (con mentions → notificación)
POST  /emails/schedule       GET /emails/scheduled  DELETE /emails/scheduled/:id
GET   /tms/incidents         POST /tms/incidents   PATCH/DELETE …
GET   /audit?…               (append-only)
```
Todos filtran por `tenant_id` del token. Paginación + filtros (las tablas ya los tienen en el front).

---

## 6 · Integraciones externas (necesitan cuentas/keys reales)

| Servicio | Para qué | Nota |
|---|---|---|
| **SMTP / OAuth real** (Gmail/Microsoft/SendGrid) | Envío real de emails (templates `m-05` ES/EN/ZH). El front ya programa a `scheduled_email`. | Worker procesa la cola en su `iso`. |
| **WhatsApp Business API** | Línea CRM atención al cliente (`0412 166 8021`). | El front ya marca "WhatsApp API". |
| **Geocoding** (Google/Mapbox) | Despacho: ordenar paquetes por distancia real (hoy `distanceToStopKm` es mock). | |
| **Push** (FCM/APNs) | Alertas críticas (contenedor a 50 CBM, ETA en demora). | |
| **Storage** (S3/R2) | Fotos de recepción CN + adjuntos + BL. | `warehouse_evt.photos`, `document.url`. |
| **Scraping** | Tasas BCV (4 fuentes) + ferias/feriados (hoy la IA normaliza vía `window.claude.complete`). | |

---

## 7 · Orden de implementación (de mayor a menor valor)

1. **Esquema + `tenant_id` en todo + auth** (login/JWT/me). Sin esto nada persiste.
   `prisma migrate` sobre Postgres + **seed** mínimo (1 tenant DTD + usuarios por rol) desde los mocks.
2. **Hidratar `window.ERPData` desde la API** al loguear (reemplazar arrays mock). Flip del
   seam a `rest`; verificá `DTDApi.hydrate()` módulo por módulo. **No rompas la UI.**
3. **Multi-tenant filtrado** en cada endpoint (la regla de oro).
4. **CRUD persistente** de las entidades núcleo (clients/orders/shipments/invoices) +
   MARKBOX/`DTDU-`/`F-` server-side.
5. **Finanzas:** Facturación → asientos automáticos; Cobranzas (pago baja saldo real);
   Tesorería (CxP + pagos/remesas con aprobación multi-firma).
6. **Fiscal (si IVA ON):** Libro de Ventas desde facturas; TXT/XML SENIAT.
7. **Logística:** Naviera (itinerarios), emisión BL, consolidación LCL→FCL.
8. **Storage** (fotos/docs) + **cola de emails** (worker) + **integraciones externas** una por una.
9. **BI:** Dirección + Reportes en vivo; export real .xlsx/PDF.

---

## 8 · Reglas de negocio que NO se negocian

- **Moneda funcional USD**, pero VES @ BCV para lo fiscal (la declaración SENIAT es en bolívares).
- **Toggle IVA/SENIAT = preferencia de tenant, OFF por defecto** (`window.DTDConfig.get('iva')`).
  OFF = sin capa fiscal (tab Fiscal, reporte IVA, desglose de factura ocultos). El front ya
  reacciona vía evento `dtd-cfg-changed`.
- **MARKBOX** y aislamiento por tenant son las dos cosas que no se rompen.
- **Auditoría:** cada acción sensible (crear/editar/eliminar asiento, pago, cambio de config)
  se registra en `audit_log`.

---

## 9 · Stores mock a reemplazar (mapa rápido)

| Mock actual | Reemplazar por |
|---|---|
| `window.ERPData.*` (arrays) | hidratación desde API por tenant |
| `localStorage('dtd_user_override_*')` | `PATCH /me` |
| `localStorage('dtd_prefs')` | `user.preferences` en backend |
| `window.__scheduledEmails` | tabla `scheduled_email` + worker |
| `window.__tmsIncidents` | tabla `tms_incident` |
| `window.__comments` | tabla `comment` |
| `FEATURE_FLAG_DEFAULTS` / `MODULE_FLAG_MAP` | `tenant.modules_enabled[]` |
| `ROLE_MODULES` (front) | matriz de permisos validada server-side |

---

## Stack sugerido (proponé alternativa si tenés mejor criterio)

- **Front:** Vite + React + TypeScript. Portar `erp/tokens.css` 1:1 y `erp/components.jsx`
  a componentes tipados. Conservar el contrato `goTo(moduleId, recordId?, view?)` y los
  embeds (`DocsForTransaction({kind,id})`).
- **Back:** REST (o tRPC) + Postgres + Prisma. Multi-tenant.
- **Auth:** sesión por rol (Admin, Comercial, Operaciones, Contabilidad, Almacén CN/VE,
  Soporte) validada por endpoint con `ROLE_MODULES`.

**Cuando dudes, preguntá.** El front es la fuente de verdad del COMPORTAMIENTO esperado;
este doc + `API-CONTRACT.md` + `schema.prisma` son la fuente de verdad de la ARQUITECTURA.
