# Inventario · sesión 2026-05-25

> Listado exhaustivo de archivos tocados en la sesión de hoy, agrupado por release. Incluye el módulo Despacho (estable desde v1.0/v1.1, primer empaque) y los 4 releases del 2026-05-25.

---

## Despacho legacy (v1.0 + v1.1 · estable desde antes)

> Estructura completa del módulo Despacho. No se tocó hoy pero es la primera vez que se empaqueta para Claude Code.

### Archivos nuevos

| Path | Una línea |
|---|---|
| `erp/modules/despacho.jsx` | **Vista 1 · Admin**: cola priorizada drag&drop + scoring 0-100 + modal asignación con capacity bar + panel órdenes activas + cancelar OD. ~1500 líneas. |
| `erp/modules/despacho-rules.jsx` | **Vista 2 · Reglas**: cards plegables Stripe/Linear, política "Pago primero" anclada, sliders puntos por regla, presets Equilibrado/FIFO. Persiste a `dtd-rules`. |
| `erp/modules/despacho-dashboard.jsx` | **Dashboard**: 5 KPIs (Total ODs/Completadas/On-time/Tarde+Cancel/Tiempo prom) + ranking rutas + top ciudades. |
| `erp/modules/admin-routes.jsx` | **Admin → Rutas**: CRUD rutas (directa vs intermedias) + catálogo ciudades per-tenant (Estado/Municipio/CP IPOSTEL). |
| `erp/modules/venezuela-catalog.jsx` | **Catálogo VE**: 24 estados + ~85 municipios + ~95 ciudades + CP IPOSTEL. `window.VECatalog`. |
| `erp/od-bridge.jsx` | Pipeline ODs · `publish/advance/cancel/reassign/subscribe/forHub/forDriver`. `window.DTDBridge`. |
| `operario/bodeguero-despacho.jsx` | **Vista 3 · Bodeguero VE**: role picker + 2 sub-modos (Despachar LIFO / Recibir mercancía) + escáner mock + carga fraccionada P1/P2. |
| `operario/camionero.jsx` | **Transportista VE**: GPS + ruta del día + foto fachada + bloque SENIAT + POD bottom-sheet + advance al bridge. |
| `Despacho · Vista 1.html` · `Despacho · Vista 2.html` · `Despacho · Vista 3.html` · `Admin · Rutas.html` · `Camionero.html` | Shells standalone del sandbox · **NO van al repo Next.js**. |

### Archivos modificados (línea + razón)

| Path | Línea | Cambio |
|---|---|---|
| `erp/modules/cn.jsx` | ~73 + ~320 | Columna "Descripción mercancía" + campo obligatorio en `ReceptionForm` + helper `liberarADespacho(rec)` que publica al `cnInbox` del bridge + 7 mocks enriquecidos. SENIAT lo exige; chofer lo necesita en entregas. |
| `erp/modules/admin.jsx` | ~190 + ~1095 | Sub-sección "Administrar rutas" en nivel BÁSICO + feature toggle "Ubicación en bodega" (default OFF). |
| `erp/data.jsx` | ~148-156 | `WAREHOUSE_CN` con campo `description` por entry. |
| `erp/shell.jsx` | ~14-18 | Entries de sidebar: `despacho`, `despacho-rules`, `despacho-dashboard`, `admin-routes` (todos OPERACIÓN). |
| `DTD Studio · ERP.html` | ~85-94, ~192 | Script tags + entries en `moduleMap` para los 5 módulos + 2 bridges + venezuela-catalog. |

---

## v1.4 · Etiquetas PDF suppliers CN (2026-05-25)

### Archivos nuevos

| Path | Una línea |
|---|---|
| `nuevo/modules/label-generator.jsx` | Plancha PDF bilingüe ES/中文 con MARKBOX + Box X/Y + QR mock procedural + 4 formatos (A4 8-up/4-up, térmico 100×150/100×100) + print stylesheet @page en mm reales + modal "Mensaje al supplier" con copy ES+CN y wire a Compose. ~700 líneas. |

### Archivos modificados

| Path | Línea | Cambio |
|---|---|---|
| `erp/shell.jsx` | ~15 | Entry sidebar `{ id: 'labels', group: 'OPERACIÓN', label: 'Etiquetas CN', icon: 'tag' }` debajo de "Cola de QR". |
| `DTD Studio · ERP.html` | ~107, ~223 | Script tag `nuevo/modules/label-generator.jsx` + `labels: window.ModuleLabelGenerator` en moduleMap. |

---

## v1.4.1 · Copias por caja ×1–×4 (2026-05-25)

### Archivos modificados

| Path | Línea | Cambio |
|---|---|---|
| `nuevo/modules/label-generator.jsx` | ~400-470 | Control segmentado ×1/×2/×3/×4 en card "CAJAS · BOX X/Y" · default ×2 · duplica labels manteniendo box index idéntico (copias indistinguibles) · key React por `${pageIndex}-${labelIndex}` · helper `boxesInRange` · mensaje supplier ES/CN actualizado para explicar el conteo · resumen preview con "N cajas × M copias". |

---

## v1.5 · Críticos + quick wins (2026-05-25)

### Archivos modificados (sin nuevos)

| Path | Línea | Cambio |
|---|---|---|
| `erp/data-bridge.jsx` | ~58-130 | **MARKBOX helpers**: `validateMarkboxFormat(code)` regex `/^DTD-\d{4,5}$/`, `allKnownMarkboxes()` set vs bridge+seed, `isMarkboxUnique(code)`, `nextMarkbox()` defensivo con retry de hasta 10. **Email helpers**: `renderTemplate(body, vars)`, `sendWelcomeEmail(client)` que lee template m-05 + persiste a `emailsSent` store + pushea audit log entry. **Store nuevo**: `emailsSent` (key `dtd-emails-sent`). Expuestos en `window.DTDData`. |
| `portal/registro.jsx` | ~42, ~52-100, ~110, ~410 | `submit()` usa `nextMarkbox()` con doble check de formato + llama `sendWelcomeEmail(newClient)` + state `emailSent` + UI verde "Email enviado" cuando éxito · saca emoji 📨 (brand-check). |
| `erp/modules/clients.jsx` | ~131 | 2 botones nuevos `ghost` antes de "Email" en drawer detalle: "Estado de cuenta" → abre `nuevo/pantallas/estado-cuenta.html?id={markbox}` en nueva pestaña · "Etiquetas" → `goTo('labels', markbox)`. |
| `nuevo/modules/qr-queue.jsx` | ~34 | Segundo `useEffect` en `useQrOrders` con `storage` event listener · re-lee del localStorage cuando otro tab pushea · no genera loop con el `useEffect` de persistencia. |

---

## v1.6 · 9 conexiones rotas reparadas (2026-05-25)

### Archivos nuevos

| Path | Una línea |
|---|---|
| `nuevo/modules/wiring.jsx` | **Singleton de modals globales** expuestos en `window.DTDWiring`: `openAttachModal({onSelect})` con dropzone multi-file, `openScheduleModal({onSchedule})` con date/time + atajos + tz, `openProfileModal({tab})` con 3 tabs (profile/password/prefs), `openShortcutsModal()` con 5 grupos de keyboard shortcuts, `openGenerateBLModal()` con flow embarque→tipo→preview, `openOAuthFlow(provider)` mock 3 pasos. Patrón: un solo `<MountHost />` en `<App>` que renderea el modal activo. ~750 líneas. |

### Archivos modificados

| Path | Línea | Cambio |
|---|---|---|
| `erp/modules/mailing-compose.jsx` | ~141-142 | Wireados onClick de "Programar" → `openScheduleModal` y "Adjuntar" → `openAttachModal`. |
| `erp/modules/documents.jsx` | ~62 | Wireado onClick de "Generar BL" → `openGenerateBLModal`. |
| `erp/modules/mailing-config.jsx` | ~148 | Wireado onClick de "Conectar con Google/Microsoft" → `openOAuthFlow(p.id)`. |
| `erp/shell.jsx` | ~400-436 | User menu reemplazado de array strings a array de objetos `{label, action}` con onClick para Mi perfil/Cambiar contraseña/Preferencias/Atajos → `openProfileModal({tab})` o `openShortcutsModal()`. "Cerrar sesión" con `confirm + reload`. |
| `erp/modules/admin.jsx` | ~1226-1240 | `CodesSyncHeader` ahora persiste `lastSync` en `localStorage` key `dtd_codes_lastsync_${source}` + state local + interval 30s para re-render relativo + helper `fmtAgo(iso)` + header "ÚLTIMA / PRÓXIMA SYNC" con timestamp dinámico. |
| `erp/modules/dashboard.jsx` | ~140-160 | `RecentActivity` ahora es array de buttons con onClick que navega `goTo(typeToMod[n.type])` y hover state (legacy v1.0 path). |
| `nuevo/modules/dashboard.jsx` | ~206, ~322-365 | Override del Dashboard (cargado después): `RecentActivityWidget` recibe `goTo`, mapea por type a módulo, button clickeable con hover y transición. |
| `erp/modules/mailing-logs.jsx` | ~5-60 | Suscribe a `window.DTDData.emailsSent` del bridge, mergea logs reales con seed mock, formato "recién" / "hace N min" según `sentAt`, status `'sent' → 'entregado'`. |
| `DTD Studio · ERP.html` | ~107, ~287 | Script tag `nuevo/modules/wiring.jsx` + `<window.DTDWiring.MountHost />` montado junto al QuickEmailModal. |

---

## Otros archivos tocados hoy (meta)

| Path | Cambio |
|---|---|
| `nuevo/CHANGELOG.md` | 4 entries nuevas al tope (v1.4 + v1.4.1 + v1.5 + v1.6) + resumen del día consolidado en tabla. |
| `PROMPT-proxima-sesion.md` | Reescrito completo · contexto v1.6 + 19 pendientes priorizados en 4 buckets (lógica real / pulido / visuales nuevas / backend). |

---

## Archivos NO incluidos en el bundle (intencional)

Scripts compartidos NO modificados — el repo Next.js ya los tiene:
- `erp/tokens.css`
- `erp/icons.jsx`
- `erp/components.jsx`
- `erp/tweaks-panel.jsx`

Módulos v1.0 que NO se tocaron hoy ni en Despacho legacy — el repo los tiene a su versión:
- `erp/modules/shipments.jsx`
- `erp/modules/quotes.jsx`
- `erp/modules/tracking.jsx`
- `erp/modules/calendar.jsx`
- `erp/modules/ve.jsx` (Almacén VE)
- `erp/modules/seniat.jsx`
- `erp/modules/tms.jsx`
- `erp/modules/suppliers.jsx`
- `erp/modules/invoices.jsx`
- `erp/modules/leads.jsx`
- `erp/modules/reports.jsx`
- `erp/modules/costing.jsx`
- `erp/modules/rates.jsx`
- `erp/modules/vault.jsx`
- `erp/modules/users.jsx`
- `erp/modules/comments.jsx`
- `erp/modules/quick-email.jsx`
- `erp/modules/mailing.jsx` (orquestador)
- `erp/modules/mailing-templates.jsx`
- `erp/modules/mailing-signatures.jsx`
- `erp/modules/mailing-rules.jsx`
- `erp/modules/audit-log.jsx`
- `erp/modules/qr-queue.jsx` *(el `nuevo/modules/qr-queue.jsx` SÍ se incluye porque se modificó hoy)*
- `erp/modules/conciliacion.jsx` (nuevo SDD futuro)
- `erp/modules/contabilidad.jsx` (nuevo SDD futuro)
- `erp/modules/contabilidad-data.jsx` (nuevo SDD futuro)
- `erp/modules/feature-flags.jsx`
- `erp/modules/rates.jsx`

Si Claude Code necesita alguno de estos para entender contexto, lo pide aparte.

---

## Cuenta total

- **Archivos nuevos (no existen en v1.0 del repo):** 12
- **Archivos modificados:** 16 (incluyendo `cn.jsx`, `admin.jsx`, `data.jsx`, `shell.jsx`, `dashboard.jsx`, `clients.jsx`, `documents.jsx`, `mailing-compose.jsx`, `mailing-config.jsx`, `mailing-logs.jsx`, `data-bridge.jsx`, `qr-queue.jsx` del módulo nuevo, `registro.jsx`, `DTD Studio · ERP.html`, `CHANGELOG.md`, `PROMPT-proxima-sesion.md`)
- **HTMLs standalone solo para preview:** 5 (no van al repo)
