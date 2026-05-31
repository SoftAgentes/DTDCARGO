# DTD-Cargo · Brief técnico de Backend + Multi-tenant

> **Para Claude Code.** Este documento define QUÉ construir para pasar de prototipo (mock en memoria/localStorage) a producto real. El diseño/front está completo (v1.9.2). Lo único que falta para lanzar es esto: **backend + auth + multi-tenant**.
>
> Leé primero `CLAUDE.md` (marca + nomenclatura MARKBOX), `HANDOFF.md` y `nuevo/CHANGELOG.md`. No rehagas pantallas — ya existen. Acá conectás la lógica real detrás de ellas.

---

## 0 · Estado actual (de dónde partís)

- **Front:** React + Babel inline, sin build step. Datos mock en `erp/data.jsx` expuestos en `window.ERPData` (CLIENTS, SHIPMENTS, INVOICES, USERS, SUPPLIERS, QUOTES, WAREHOUSE_CN/VE, RATES, DOCUMENTS, NOTIFS, TMS_*, ROLE_MODULES…).
- **Persistencia hoy:** `localStorage` + stores en memoria (`window.__scheduledEmails`, `window.__tmsIncidents`, `window.__comments`, `dtd_user_override_*`, `dtd_prefs`, `dtd_dashboard_hide`, `dtd-*-cols-v1`). Todo se pierde o no se comparte entre usuarios.
- **Objetivo:** un backend real que persista, autentique y **aísle por tenant**, exponiendo una API que el front consuma en vez de `window.ERPData`.

**Regla de migración:** mantené `window.ERPData` como la **interfaz**. Reemplazá su relleno: en vez de arrays hardcodeados, que un cliente API hidrate `window.ERPData.*` al loguear. Así el front casi no cambia.

---

## 1 · Concepto Plataforma vs Tenant (lo más importante)

DTD-Cargo es **multi-tenant**: una plataforma que opera varias empresas de logística (DTD-Cargo + aliados + futuros clientes white-label).

### Dos planos de usuario (ya diseñados — ver pantallas de Plataforma/Super Admin)

| Plano | Usuario | Alcance |
|---|---|---|
| **Plataforma** | Super Admin · Gestor de bugs · Operador de cambios | Cross-tenant. Gestiona tenants, feature flags, billing, salud del sistema. NO ve datos operativos de los clientes salvo soporte explícito. |
| **Tenant** | **Administrador de Tenant** + roles operativos (Comercial, Operaciones, Contabilidad, Almacén CN/VE, Soporte) | Aislado a SU tenant. Es el ERP que ya existe. |

### Entidad raíz: `tenant`
```
tenant { id, name, slug, plan, status, brandConfig, codePrefix, createdAt, modulesEnabled[] }
```
- `codePrefix` → el prefijo de MARKBOX (DTD usa `DTD`; un aliado usaría el suyo). Los aliados comparten la secuencia DTD; otros tenants editan su nomenclatura (ya existe la opción en Administración de tenants).
- `modulesEnabled[]` → reemplaza los feature flags locales (`window.FEATURE_FLAG_DEFAULTS`).

---

## 2 · Multi-tenant: la regla de oro

**TODA tabla operativa lleva `tenant_id` y TODA query lo filtra.** Hoy el selector de tenant existe pero NO filtra — ese es el bug de negocio #1.

- Cada request autenticado resuelve `tenant_id` desde el JWT/sesión.
- El backend **nunca** confía en un `tenant_id` que venga del cliente — lo toma del token.
- Aislamiento a nivel de query (row-level security si usás Postgres/Supabase es ideal).
- El Super Admin de Plataforma puede impersonar un tenant para soporte (con auditoría).

**Front:** cada módulo ya recibe `currentUser`. Sumar `currentUser.tenantId` y que el cliente API lo mande implícito (vía token). Los módulos `cn.jsx`, `ve.jsx`, `shipments.jsx` ya tienen scoping por hub — extender a tenant.

---

## 3 · Modelo de datos (entidades núcleo)

Derivado de los mocks actuales. Todas con `id`, `tenant_id`, `created_at`, `updated_at`.

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
warehouse_evt { id, tenant_id, shipment_id, hub, type, payload, photos[], created_at }  // recepciones CN, adjuntos
document      { id, tenant_id, shipment_id|client_id, kind, url, status }
container     { id, tenant_id, code, seal, bl, cbm_total, status, partials[] }           // consolidación CN
comment       { id, tenant_id, record_type, record_id, author_id, body, mentions[], reactions, parent_id }
scheduled_email { id, tenant_id, to, subject, channel, iso, status, attachments[] }
tms_incident  { id, tenant_id, truck, type, severity, date, desc, cost, status }
audit_log     { id, tenant_id, actor_id, action, target, before, after, ip, created_at }
```

### Nomenclatura MARKBOX (crítica — ver CLAUDE.md + portal/registro)
- Cliente: `{code_prefix}-{NNNN}` → `DTD-5509`
- Compra: `{markbox}-{proveedor#}-{compra#}` → `DTD-5509-1-2`
- El **contador por proveedor** vive en `order.seq`. La validación/unicidad ya existe en front (`validateMarkboxFormat`/`nextMarkbox`) — moverla al backend como fuente de verdad.

---

## 4 · Auth

- **JWT** (access + refresh) o sesiones server-side. El token lleva `user_id`, `tenant_id` (null para Plataforma), `role`.
- **Login:** Tenant users entran por email+password (o el MARKBOX en el Portal del Cliente). Super Admin entra por un dominio/flag de Plataforma.
- **2FA:** el campo `two_fa` ya está en USERS — implementar TOTP.
- **Permisos:** `ROLE_MODULES` (en `erp/data.jsx`) es la matriz rol→módulos. Llevarla al backend y validar cada endpoint, no solo ocultar en el front.
- **Portal del cliente:** auth separada (cliente externo). El cliente solo ve SUS datos (`client_id` del token). Ya soporta impersonación admin vía `?as=` (Modo Cliente) — proteger eso detrás de rol admin.

---

## 5 · Endpoints mínimos (REST sugerido)

```
POST  /auth/login            /auth/refresh        /auth/2fa
GET   /me                    PATCH /me            (persiste "Mi perfil" — hoy es localStorage)
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

Todos filtran por `tenant_id` del token. Paginación + filtros (las tablas ya tienen orden/columnas/filtros en el front).

---

## 6 · Integraciones externas (lo de "#8 servicios externos")

Estas NO se pueden mockear — necesitan cuentas/keys reales. Dejar la UI conectada a estos endpoints:

| Servicio | Para qué | Nota |
|---|---|---|
| **SMTP / OAuth real** (Gmail/Microsoft/SendGrid) | Envío real de los emails (templates `m-05` ya en ES/EN/ZH). El front ya programa a `scheduled_email`. | Un worker procesa la cola en su `iso`. |
| **WhatsApp Business API** | Línea CRM atención al cliente (`0412 166 8021`). | El front ya marca "WhatsApp API". |
| **Geocoding** (Google/Mapbox) | Despacho: ordenar paquetes por distancia real (hoy `distanceToStopKm` es mock). | |
| **Push** (FCM/APNs) | Alertas críticas (contenedor a 50 CBM, ETA en demora). | |
| **Storage** (S3/R2) | Fotos de recepción CN + adjuntos + documentos/BL. | `warehouse_evt.photos`, `document.url`. |

---

## 7 · Orden sugerido de implementación

1. **Esquema + tenant_id en todo** + auth (login/JWT/me). Sin esto nada persiste.
2. **Hidratar `window.ERPData` desde la API** al loguear (reemplazar arrays mock). Front casi no cambia.
3. **Multi-tenant filtrado** en cada endpoint (la regla de oro).
4. **CRUD persistente** de las entidades núcleo (clients/orders/shipments/invoices) + MARKBOX server-side.
5. **Storage** (fotos/docs) + **cola de emails** (worker).
6. **Integraciones externas** (SMTP, WhatsApp, geocoding, push) una por una.

---

## 8 · Stores mock a reemplazar (mapa rápido)

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

**Cuando dudes, preguntá.** El front es la fuente de verdad del COMPORTAMIENTO esperado; este doc es la fuente de verdad de la ARQUITECTURA. No rompas la nomenclatura MARKBOX ni el aislamiento por tenant — son las dos cosas que no se negocian.
