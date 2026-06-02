# DTD-Cargo · Contrato de API REST  ·  v0.1

> **Para Claude Code (backend).** Este doc es el contrato entre el backend real y el
> front existente. Cada endpoint mapea a un store mock que hoy vive en `window.*`.
> **Regla de oro:** todo endpoint resuelve `tenantId` del JWT — **nunca** del body/query.
> en modo `mock` lee `window.ERPData` / localStorage; en modo `rest` pega contra estos endpoints.
> El front consume todo a través del seam `window.DTDApi` (ver `erp/api/client.jsx`):

---

## Auth

| Método | Ruta | Body / Notas | Hoy en front |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` → `{ accessToken, refreshToken, user }` | mock currentUser |
| POST | `/auth/refresh` | `{ refreshToken }` → `{ accessToken }` | — |
| POST | `/auth/2fa` | `{ token }` TOTP · campo `user.twoFa` ya existe | — |
| POST | `/auth/logout` | invalida refresh | — |
| GET | `/me` | usuario del token (con `tenantId`, `role`, `preferences`) | `window.__currentUser` |
| PATCH | `/me` | persiste "Mi perfil" + `preferences` | `localStorage('dtd_user_override_*')` / `dtd_prefs` |

El `accessToken` lleva `{ userId, tenantId, role }`. `tenantId = null` ⇒ usuario de Plataforma.

## Plataforma (super_admin)

| Método | Ruta | Notas |
|---|---|---|
| GET | `/tenants` | lista de tenants (cross-tenant) |
| POST | `/tenants` | crea tenant (`codePrefix`, `plan`, `modulesEnabled`) |
| PATCH | `/tenants/:id` | toggles de módulos, `ivaEnabled`, branding |
| POST | `/tenants/:id/impersonate` | soporte con auditoría (audit_log) |

## Comercial

| Método | Ruta | Mapea a |
|---|---|---|
| GET | `/clients?segment=&status=&q=&page=` | `ERPData.CLIENTS` (+ `DTDData.clients`) |
| POST | `/clients` | genera MARKBOX server-side (`nextMarkbox`) |
| GET | `/clients/:markbox` | detalle |
| PATCH | `/clients/:id` | — |
| GET | `/suppliers?clientId=` | `ERPData.SUPPLIERS` |
| POST | `/suppliers` | — |
| POST | `/clients/:id/orders` | genera `code` = `{markbox}-{prov#}-{compra#}` (`order.seq`) |
| GET | `/quotes` · POST `/quotes` | `ERPData.QUOTES` |

## Logística

| Método | Ruta | Mapea a |
|---|---|---|
| GET | `/shipments?status=&clientId=&page=` | `ERPData.SHIPMENTS` |
| POST | `/shipments` | genera `DTDU-XXXXXX` server-side |
| PATCH | `/shipments/:id/status` | transición de estado |
| GET | `/warehouse/cn` · `/warehouse/ve` | `ERPData.WAREHOUSE_CN/VE` + `DTDData.cnInbox` |
| POST | `/warehouse/cn/receive` | recepción + fotos (S3) → `warehouse_evt` |
| POST | `/containers/:id/consolidate` | motor LCL→FCL (bin-packing CBM/peso) |

## Finanzas

| Método | Ruta | Mapea a |
|---|---|---|
| GET | `/invoices?status=&clientId=` | `ERPData.INVOICES` |
| POST | `/invoices` | genera `F-2026-XXXX` + asiento automático |
| POST | `/invoices/:id/pay` | registra pago → baja `paidAmount`/saldo |
| GET | `/accounts` | plan de cuentas (161, jerárquico) |
| GET | `/journal` · POST `/journal` | asientos |
| GET | `/rates` | `ERPRates` (BCV/paralelo/CNY) — alimentado por scraping/worker |

## Comunicación / Operación

| Método | Ruta | Mapea a (mock store) |
|---|---|---|
| GET | `/comments?recordType=&recordId=` · POST `/comments` | `window.__comments` |
| POST | `/emails/schedule` · GET `/emails/scheduled` · DELETE `/emails/scheduled/:id` | `window.__scheduledEmails` (worker procesa en `scheduledAt`) |
| GET/POST/PATCH/DELETE | `/tms/incidents` | `window.__tmsIncidents` |
| GET | `/documents?shipmentId=` · POST `/documents` | `ERPData.DOCUMENTS` (storage S3/R2) |
| GET | `/audit?…` | append-only |

## Integraciones externas (necesitan cuentas/keys reales)

| Servicio | Endpoint front-facing | Worker / Nota |
|---|---|---|
| SMTP/OAuth (Gmail/MS/SendGrid) | `/emails/schedule` | worker consume cola en `scheduledAt`; templates `m-05` ES/EN/ZH listos |
| WhatsApp Business API | `/comments` (channel) | línea CRM `0412 166 8021` |
| Geocoding (Google/Mapbox) | `/despacho/route` | hoy `distanceToStopKm` es mock |
| Push (FCM/APNs) | suscripción + `/notifs` | alertas CBM≥50 / ETA en demora |
| Storage (S3/R2) | URLs firmadas | `warehouse_evt.photos`, `document.url` |

---

## Paginación y filtros (estándar)

```
GET /clients?page=1&pageSize=50&sort=markbox&dir=asc&q=polar&segment=Industrial&status=active
→ { data: [...], page, pageSize, total }
```

Las tablas del front ya tienen orden/columnas/filtros persistidos (`dtd-*-cols-v1`);
el backend solo debe respetar estos query params.
