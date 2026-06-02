# DTD-Cargo · API Contract (handoff a backend)

> **Para Claude Code / devs.** Mapea cada *seam* del prototipo (hoy mock en el navegador)
> a su endpoint REST. La regla de migración es: **mismas firmas, otra implementación** —
> donde hoy se lee/escribe `localStorage` vía `window.DTDData` / `window.DTDFlags` /
> `window.LegalData`, mañana se llama a estos endpoints. No cambia el código de UI que
> consume los seams; cambia el cuerpo de las funciones del bridge.
>
> **Convenciones globales**
> - Auth: todo request (salvo `/auth/login`) lleva `Authorization: Bearer <accessToken>`.
> - **Multi-tenant:** el `tenantId` viaja en el token; el servidor filtra **toda** consulta
>   por tenant. El cliente nunca elige tenant. (Hoy se deriva del prefijo del MARKBOX vía
>   `tenantForMarkbox()` — en prod lo define el token.)
> - Fechas ISO-8601 UTC. Montos en USD salvo que se indique moneda.
> - Errores: `{ error: { code, message } }` + HTTP status estándar.
> - Idempotencia en POST sensibles (aceptaciones, pagos): header `Idempotency-Key`.

---

## 1 · Auth y sesión
Reemplaza el `DIRECTORY` mock de `Operario · App.html` y la sesión en `localStorage`.

| Acción | Endpoint | Devuelve / notas |
|---|---|---|
| Login | `POST /auth/login` `{ user, pass, deviceId }` | `{ accessToken, refreshToken, profile }` · `profile = { user, name, initials, tenant, site, vehicle, roles[] }`. **El rol lo decide el backend** (ruteo del APK). |
| Renovar | `POST /auth/refresh` `{ refreshToken }` | `{ accessToken }` (silencioso al abrir la app) |
| Logout / revocar | `POST /auth/logout` · `POST /auth/revoke` `{ deviceId }` | mata el refresh token del dispositivo (equipo perdido) |
| Crear/validar PIN | `POST /auth/pin` `{ pin }` · desbloqueo local | el PIN desbloquea la sesión guardada; **no** viaja como contraseña. 5 fallos → exige re-login |
| Reset de acceso (admin) | `POST /operarios/{id}/reset-pin` | PIN temporal 24 h (módulo Operarios PWA) |

**Roles** → ruteo: `operario` (CN), `almacenista` (bodega), `transportista` (chofer),
multi-rol (≥2 → picker). Ver `HANDOFF-MOBILE.md`.

---

## 2 · Clientes y MARKBOX
Seam: `window.DTDData.clients` (store) + helpers de MARKBOX.

| Acción | Endpoint | Notas |
|---|---|---|
| Listar / detalle | `GET /clients` · `GET /clients/{markbox}` | filtrado por tenant |
| Crear (registro portal) | `POST /clients` `{ name, company, rif, ... }` | **asigna MARKBOX secuencial server-side** (`DTD-XXXX`); reemplaza el contador local. El MARKBOX se asigna recién al verificar (dirección + cédula) |
| Verificar | `POST /clients/{markbox}/verify` | dispara asignación de MARKBOX si estaba en revisión |

---

## 3 · Cotizaciones (cotizador → cotización formal → aceptación)
Seam: `pushPortalQuote()`, `clientQuotes()` (store `portalQuotes`) + estados de embarque.

| Acción | Endpoint | Notas |
|---|---|---|
| Solicitar (cotizador exprés) | `POST /quotes/requests` `{ markbox, origin, dest, service, cbm, estimate }` | crea la cotización formal con `id` `Q-2026-XXXX`, `quoteStage:'en-proceso'` (no aceptable aún). Devuelve `ref` `SOL-2026-XXX` |
| Listar del cliente | `GET /quotes?client={markbox}` | aparecen en "Mis envíos" |
| Finalizar (agente) | `PATCH /quotes/{id}` `{ quoteStage:'lista', amount, cbm, weight }` | la deja **aceptable** |
| Reliquidar por medida real (CN) | `PATCH /quotes/{id}` `{ cbm, weight, amount, measured:true }` | si difiere de lo aceptado → exige **re-aceptación** (AUT-04a) |

**Estados de embarque** (`status`): `cotizado` → `recibido CN` → `consolidado` → `tránsito`
→ `aduana VE` → `liberado` → `entregado`. El **contenedor `DTDU-XXXXXX` se asigna al
consolidar** (antes el id es `Q-2026-XXXX`, sin contenedor).

---

## 4 · Aceptación legal de T&C (evidencia) — CRÍTICO
Seam: `window.LegalData.ACCEPTANCES` + modal del Portal. **Almacenamiento inmutable/auditado.**

| Acción | Endpoint | Notas |
|---|---|---|
| Documentos vigentes | `GET /legal/docs` | `[{ key, name, version, effective, body }]` (T&C, Condiciones del Operador) |
| Registrar aceptación | `POST /legal/acceptances` `{ client, quote, docs:[{name,version}], cbm, weight, total }` | el **servidor** sella: `at` (server time), **`ip` real**, **`hash`** (SHA-256 del payload+docs), `id` `AC-2026-XXXX`. Inmutable. Idempotente. Recién entonces habilita facturar (gate AUT-04) |
| Consultar registro | `GET /legal/acceptances?client=&doc=&version=` | bitácora (módulo Aceptaciones T&C) |
| Publicar versión | `POST /legal/docs/{key}/versions` | nueva versión; las aceptaciones previas conservan su versión histórica (no se reescriben) |

> La aceptación se ata a la **medida** (cbm/weight/total): si la medición real difiere de la
> aceptada → re-aceptación obligatoria antes de facturar.

---

## 5 · Bandeja del portal (eventos cliente → ERP)
Seam: `pushPortalEvent()`, `markPortalRead()` (store `portalInbox`).

| Acción | Endpoint | Notas |
|---|---|---|
| Publicar evento | `POST /portal-inbox` `{ kind, markbox, title, detail, meta }` | `kind`: `registro`\|`cotizacion`\|`recompra`. Auto-tag `tenantId` |
| Listar / marcar leído | `GET /portal-inbox` · `PATCH /portal-inbox/read` `{ ids[] }` | badge de notificaciones del ERP |

---

## 6 · Facturación, tesorería, contabilidad
Seam: `INVOICES` + módulos. Aplica la **regla calculadora** en inputs de monto (client-side).

| Acción | Endpoint |
|---|---|
| Facturas | `GET /invoices?client=` · `POST /invoices` · `PATCH /invoices/{id}` |
| Cobros / pagos | `POST /invoices/{id}/payments` `{ amount, rate, currency }` |
| **Gate de facturación** | `POST /invoices` valida que exista aceptación legal vigente para esa medición (AUT-04) |

---

## 7 · Operación CN + sync offline (apps de operario)
Seam: `cnInbox` + estado local de las apps. **Offline-first.**

| Acción | Endpoint | Notas |
|---|---|---|
| Recepción CN | `GET /receptions` · `POST /receptions` `{ markbox, boxes, cbm, weight, ranges[], flags[], photos[] }` | escaneo + medición; dispara reliquidación de cotización |
| Despacho / armar camión | `POST /dispatches` `{ truck, driver, items[] }` | pase QR |
| Rutas del chofer | `GET /routes?assignee=me&day=today` · `POST /routes/{id}/confirm` | el chofer confirma la carga asignada |
| POD / entrega | `POST /deliveries/{id}/pod` `{ signature, photo, receivedBy }` | |
| **Sync offline** | `POST /sync/batch` `{ ops:[...] }` | drena la cola outbox (escaneos/fotos/POD generados sin señal); el servidor resuelve por timestamp |
| Archivos | `POST /files` (multipart) → URL | fotos de recepción/POD a object storage |

---

## 8 · Catálogos y configuración
Seam: stores `rates`, `routes`, `cities`, `rules` + `window.DTDFlags`.

| Acción | Endpoint | Notas |
|---|---|---|
| Tasas / rutas / ciudades / reglas | `GET/PUT /config/rates` · `/config/routes` · `/config/cities` · `/config/rules` | |
| **Feature flags** | `GET /config/flags` · `PATCH /config/flags` `{ key, value }` | **a nivel tenant** (hoy localStorage por dispositivo). Ej. `referidos` OFF → portal muestra "Próximamente" |

---

## 9 · Notificaciones
Seam: `sendWelcomeEmail()`, `emailsSent` (log), quick replies de Conversaciones.

| Canal | Integración |
|---|---|
| WhatsApp | WhatsApp Business API (plantillas + webhooks de estado) |
| Email | SMTP saliente + IMAP entrante (bandeja Conversaciones) |
| Push | FCM/APNs para las apps de operario |

---

## Orden de implementación sugerido
1. **Auth + sesión + multi-tenant** (base de todo).
2. **Clientes + MARKBOX secuencial** server-side.
3. **Cotizaciones + aceptación legal** (con evidencia inmutable real) → **gate de facturación**.
4. **Facturación / tesorería**.
5. **Operación CN + sync offline** (apps de operario) + **object storage**.
6. **Config + feature flags a nivel tenant**.
7. **Notificaciones** (WhatsApp/email/push).

> Regla transversal: **el servidor es la frontera de seguridad.** La app decide *qué muestra*;
> el backend decide *qué permite* (verifica tenant + permisos en cada request).
