# Conexiones cross-module · sesión 2026-05-25 + Despacho

> Mapa exhaustivo de TODAS las dependencias internas entre actores, módulos y archivos. Cubre Despacho legacy + extensiones de hoy.

---

## 1 · Pipeline Despacho · 3 actores

```
┌───────────────────────────────────────────────────────────────┐
│                     ALMACÉN CN (Yiwu)                          │
│                                                                │
│  Operario CN escanea caja → ReceptionForm con descripción     │
│    → mutación a window.ERPData.WAREHOUSE_CN (seed)            │
│                                                                │
│  Admin / sistema libera el paquete:                           │
│    cn.jsx · liberarADespacho(rec)                             │
│    → window.DTDData.cnInbox.write([item, ...prev])            │
└─────────────────────────┬──────────────────────────────────────┘
                          │ storage event + 'dtd-dtd-cn-inbox-changed'
                          ↓
┌───────────────────────────────────────────────────────────────┐
│                  OFICINA · ERP · Vista 1                       │
│                  (erp/modules/despacho.jsx)                    │
│                                                                │
│  ① subscribe cnInbox → merge nuevos a la cola                 │
│  ② lee rules (window.DTDData.rules.read())                    │
│     → scorePkg() → ordena cola desc                           │
│  ③ lee routes (window.DTDData.routes.read())                  │
│     → popula filtros + modal asignación                       │
│  ④ admin "Crear OD" → DTDBridge.publish({                     │
│       id, status:'creada', truckId, driverId, routeId, ... }) │
│  ⑤ subscribe DTDBridge → panel "Órdenes activas hoy"          │
│  ⑥ "Cancelar OD" → DTDBridge.cancel(id, motivo)               │
└─────────────────────────┬──────────────────────────────────────┘
                          │ storage + 'dtd-dtd-ods-changed' + poll 1.5s
                          ↓
┌───────────────────────────────────────────────────────────────┐
│         BODEGUERO VE · mobile · Vista 3                        │
│         (operario/bodeguero-despacho.jsx)                      │
│                                                                │
│  ① subscribe DTDBridge → banner "OD recibida desde admin"     │
│  ② DTDBridge.forHub(currentHub)                               │
│  ③ escáner mock 2.4s → packing list local                     │
│  ④ P2 split → DTDBridge.publish({ parentOdId, status:'creada' })│
│  ⑤ "Cerrar carga" → DTDBridge.advance(odId, 'lista')          │
└─────────────────────────┬──────────────────────────────────────┘
                          │ storage + 'dtd-dtd-ods-changed'
                          ↓
┌───────────────────────────────────────────────────────────────┐
│         TRANSPORTISTA VE · mobile                              │
│             (operario/camionero.jsx)                           │
│                                                                │
│  ① subscribe DTDBridge → banner "OD recibida desde bodeguero" │
│  ② DTDBridge.forDriver(currentDriverId) · status='lista'      │
│  ③ lee window.DTDData.clients → matchea MARKBOX → foto fachada│
│  ④ GPS toggle → mock coords cada 30s                          │
│  ⑤ Modal POD (foto+firma) · última entrega:                   │
│       → DTDBridge.advance(odId, 'entregada',                  │
│                          { completedAt, progress: 100 })      │
└─────────────────────────┬──────────────────────────────────────┘
                          │ vuelve a Vista 1 (subscribe)
                          ↓
       Admin ve la OD pasar a 'entregada' en vivo
       Manual "Cerrar día" → DTDBridge.advance(id, 'cerrada')   (terminal)
```

---

## 2 · Mapa exhaustivo · "X escribe → Y lee"

### Pipeline despacho

| Writer | Store | Reader | Cuándo lee |
|---|---|---|---|
| `cn.jsx` (liberarADespacho) | `dtd-cn-inbox` | `despacho.jsx` (Vista 1) | mount + subscribe |
| `despacho.jsx` (Crear OD) | `dtd-ods` | `bodeguero-despacho.jsx` | mount + subscribe |
| `despacho.jsx` (Cancelar OD) | `dtd-ods` | TODOS los suscritos | tiempo real |
| `bodeguero-despacho.jsx` (Cerrar carga) | `dtd-ods` advance 'lista' | `camionero.jsx` | mount + subscribe |
| `bodeguero-despacho.jsx` (P2 split) | `dtd-ods` publish nueva | `despacho.jsx` (Vista 1 panel) | mount + subscribe |
| `camionero.jsx` (POD final) | `dtd-ods` advance 'entregada' | `despacho.jsx` (Vista 1) | mount + subscribe |
| `despacho-rules.jsx` (Vista 2 Guardar) | `dtd-rules` | `despacho.jsx` scoring | mount + memo recompute |
| `admin-routes.jsx` (CRUD ruta) | `dtd-routes` | `despacho.jsx` filtros + modal | mount |
| `admin-routes.jsx` (CRUD ciudad) | `dtd-cities` | `admin-routes.jsx` CityPicker + `despacho.jsx` filtro barrio | mount |

### v1.5 nuevos

| Writer | Store | Reader | Cuándo lee |
|---|---|---|---|
| `portal/registro.jsx` (submit) | `dtd-clients` | `camionero.jsx` foto fachada · `despacho.jsx` resolver tier | mount |
| `portal/registro.jsx` (sendWelcomeEmail) | **`dtd-emails-sent`** | **`mailing-logs.jsx` (v1.6)** | mount + subscribe |
| `portal/registro.jsx` (audit log) | `dtd_audit_log_v1` | `audit-log.jsx` (v1.1) | mount |

### v1.5 quick wins · sin store

| Source | Trigger | Target |
|---|---|---|
| `clients.jsx` (drawer botón "Estado de cuenta") | onClick | `window.open('nuevo/pantallas/estado-cuenta.html?id=', '_blank')` |
| `clients.jsx` (drawer botón "Etiquetas") | onClick | `goTo('labels', markbox)` → activeMod cambia · `ModuleLabelGenerator` recibe `selectedId` |
| `nuevo/modules/qr-queue.jsx` (storage listener) | `window.storage` event | re-lee `dtd_qrqueue_v1` local · setOrders |

### v1.6 wiring

| Source (onClick) | Target |
|---|---|
| `mailing-compose.jsx` "Programar" | `DTDWiring.openScheduleModal({onSchedule})` |
| `mailing-compose.jsx` "Adjuntar" | `DTDWiring.openAttachModal({onSelect})` |
| `documents.jsx` "Generar BL" | `DTDWiring.openGenerateBLModal()` |
| `mailing-config.jsx` "Conectar Google/Microsoft" | `DTDWiring.openOAuthFlow(provider)` |
| `shell.jsx` user menu "Mi perfil" | `DTDWiring.openProfileModal({tab:'profile'})` |
| `shell.jsx` user menu "Cambiar contraseña" | `DTDWiring.openProfileModal({tab:'password'})` |
| `shell.jsx` user menu "Preferencias" | `DTDWiring.openProfileModal({tab:'prefs'})` |
| `shell.jsx` user menu "Atajos de teclado" | `DTDWiring.openShortcutsModal()` |
| `shell.jsx` user menu "Cerrar sesión" | `window.confirm` + `window.location.reload()` |
| `dashboard.jsx` (legacy) Activity item | `goTo(typeToMod[n.type])` |
| `nuevo/modules/dashboard.jsx` Activity item | `goTo(typeToMod[n.type])` |
| `admin.jsx` CodesSyncHeader "Refrescar ahora" | `setTimeout(1400) + localStorage.setItem('dtd_codes_lastsync_${source}', ISO)` |

### v1.6 read del bridge

| Reader | Store |
|---|---|
| `mailing-logs.jsx` (suscribe) | `dtd-emails-sent` (lo escribió v1.5) |
| `admin.jsx` CodesSyncHeader (state init) | `dtd_codes_lastsync_hscodes` y `dtd_codes_lastsync_aes` |

---

## 3 · Dependencias módulo por módulo

### `erp/modules/despacho.jsx`

| Lee de | Escribe a |
|---|---|
| `window.DTDData.cnInbox` (subscribe) | `dtd-ods` via DTDBridge |
| `window.DTDData.rules` (read) | — |
| `window.DTDData.routes` (read) | — |
| `window.DTDData.clients` (read · resolver tier) | — |
| `window.ERPData.CLIENTS` (fallback) | — |
| `window.ERPData.TRUCKS` (seed) | — |
| `window.ERPData.DRIVERS` (seed) | — |

### `erp/modules/despacho-rules.jsx`

| Lee de | Escribe a |
|---|---|
| `window.DTDData.rules` (read) | `dtd-rules` via `DTDData.rules.write()` |

### `erp/modules/admin-routes.jsx`

| Lee de | Escribe a |
|---|---|
| `window.DTDData.routes` (read) | `dtd-routes` |
| `window.DTDData.cities` (read) | `dtd-cities` |
| `window.VECatalog` (read) | — |

### `erp/modules/cn.jsx`

| Lee de | Escribe a |
|---|---|
| `window.ERPData.WAREHOUSE_CN` | `dtd-cn-inbox` via `DTDData.cnInbox.write()` (helper liberarADespacho) |

### `operario/bodeguero-despacho.jsx`

| Lee de | Escribe a |
|---|---|
| `DTDBridge.forHub(hub)` (subscribe) | `DTDBridge.advance(id, status)` |
| `DTDBridge.find(odId)` | `DTDBridge.publish(p2Od)` (split P2) |

### `operario/camionero.jsx`

| Lee de | Escribe a |
|---|---|
| `DTDBridge.forDriver(id)` (subscribe) | `DTDBridge.advance(id, 'entregada')` |
| `window.DTDData.clients` (foto fachada) | — |

### `portal/registro.jsx` (v1.5)

| Lee de | Escribe a |
|---|---|
| `window.DTDData.clients` (validación unicidad) | `dtd-clients` |
| `window.DTDData.nextMarkbox()` (gen secuencial) | `dtd-emails-sent` (via sendWelcomeEmail) |
| `window.ERPData.MAIL_TEMPLATES` (template m-05) | `dtd_audit_log_v1` (auto entry) |
| `window.VECatalog` (Step 2 dirección VE) | — |

### `erp/modules/clients.jsx` (v1.5)

| Lee de | Escribe a |
|---|---|
| `window.ERPData.CLIENTS` (seed) | — |
| `window.DTDData.clients` (en futuro · hoy no) | — (read-only en este módulo) |

### `nuevo/modules/qr-queue.jsx` (v1.5)

| Lee de | Escribe a |
|---|---|
| `localStorage['dtd_qrqueue_v1']` (mount + storage event) | `localStorage['dtd_qrqueue_v1']` (useEffect) |

### `nuevo/modules/label-generator.jsx` (v1.4)

| Lee de | Escribe a |
|---|---|
| `window.ERPData.CLIENTS` (selector) | — (read-only) |
| `window.ERPData.SUPPLIERS` (selector) | — |
| `window.openQuickEmail` (modal mensaje supplier) | — |

### `nuevo/modules/wiring.jsx` (v1.6)

| Lee de | Escribe a |
|---|---|
| `window.__currentUser` (ProfileModal) | — |
| `window.ERPData.USERS` (ProfileModal fallback) | — |
| `window.ERPData.SHIPMENTS` (GenerateBLModal) | — |
| `window.openQuickEmail` (BL modal · OAuth flow callback futuro) | — |

### `erp/modules/admin.jsx` (v1.6 CodesSyncHeader)

| Lee de | Escribe a |
|---|---|
| `localStorage['dtd_codes_lastsync_${source}']` (state init) | `localStorage['dtd_codes_lastsync_${source}']` (refresh button) |

### `erp/modules/mailing-logs.jsx` (v1.6)

| Lee de | Escribe a |
|---|---|
| `window.DTDData.emailsSent` (subscribe) | — |
| Seed mock inline (hardcoded) | — |

### `nuevo/modules/dashboard.jsx` (v1.6 RecentActivity)

| Lee de | Escribe a |
|---|---|
| `window.ERPData.NOTIFS` (seed) | — |
| `goTo` prop (navega) | — |

---

## 4 · Eventos cross-tab

Todos los stores del bridge emiten 2 eventos al cambiar:

1. `CustomEvent('dtd-${storeKey}-changed')` · mismo tab.
2. Browser `storage` event · otros tabs del mismo origen (no en el tab que escribió).

Polling de **1.5 s** como fallback (en `od-bridge.jsx` también).

### Listeners explícitos (no-bridge)

| Listener | Trigger |
|---|---|
| `nuevo/modules/qr-queue.jsx` useEffect | `window.storage` event con `e.key === 'dtd_qrqueue_v1'` |

---

## 5 · Dependencias con módulos NO portados (TODOs stub)

Cuando Claude Code todavía no tiene estos módulos en el repo Next.js, hacer **stubs no-op**:

| Módulo asumido | Por qué | Stub sugerido |
|---|---|---|
| `audit-log.jsx` (v1.1) | `sendWelcomeEmail` escribe entry · `clients.jsx` también podría | `auditLog.push = (e) => console.log('[audit]', e)` |
| `mailing-templates.jsx` (v1.0 · portado) | `sendWelcomeEmail` lee `MAIL_TEMPLATES.find(t => t.id === 'm-05')` | Asegurar que el seed `MAIL_TEMPLATES` está portado |
| `quick-email.jsx` (v1.0 · portado) | `label-generator` modal mensaje supplier + GenerateBL modal · ambos llaman `window.openQuickEmail` | Si no está · stub `window.openQuickEmail = () => alert('Compose no portado')` |
| Vault (v1.0 · portado) | `camionero.jsx` futuro (credenciales naviera) · NO actualmente | N/A |
| Contabilidad (v1.2 sandbox · no portado) | OD entregada → asiento (futuro) | `accounting.createDispatchEntry = noop` |
| Conciliación (v1.2 sandbox · no portado) | Match pago → OD (futuro) | `reconciliation.matchOdToPayment = noop` |
| Push notifications (no implementado) | Camionero GPS off · admin recibe push | `pushService.send = noop` |

---

## 6 · Gaps que NO existen pero deberían (TODOs)

Estos son gaps de la sesión de hoy (más allá de Despacho legacy):

1. **OD → TMS feedback** · al asignar OD el camión debería pasar a `cargando` · NO se hace.
2. **OD → Audit log** · cada publish/advance/cancel debería dejar entry · NO se hace.
3. **OD entregada → Mailing automático** · template m-04 POD firmado · NO se dispara.
4. **OD entregada → Facturación** · línea automática · NO se hace.
5. **OD entregada → Contabilidad** · asiento Db CxC / Cr Ingreso · NO se hace.
6. **OD cancelada → cnInbox rollback** · cajas vuelven al inbox · NO se hace (se pierden).
7. **`onSelect` AttachModal → Compose draft** · hoy es `console.log` placeholder.
8. **`onSchedule` ScheduleModal → cola de programados** · hoy no persiste.
9. **ProfileModal Guardar → mutation real** · hoy solo toast.
10. **OAuth completar → update `provider.account`** · hoy no actualiza nada.
11. **AttachModal carpetas** · drag carpeta no funciona (FileSystem API necesaria).
12. **Email status webhooks** · hoy todo se crea como `'sent'` · futuro: bounce/open via webhook.
13. **i18n del template** · hoy hardcoded ES · TODO usar `client.lang`.
14. **Adjuntar guía MARKBOX** · template m-05 menciona "guía adjunta" pero no se adjunta nada.

---

## 7 · Diagrama de dependencias declarativo (text-only)

```
PROVIDERS                                  CONSUMERS
─────────                                  ─────────

cn.jsx                                     despacho.jsx
  → cnInbox                                  ← lee subscribe

despacho.jsx (Vista 1)                     bodeguero-despacho.jsx
  → ODs publish                              ← lee subscribe forHub
                                           camionero.jsx
                                             ← lee subscribe forDriver
                                           despacho.jsx (panel propio)
                                             ← lee subscribe
                                           despacho-dashboard.jsx
                                             ← read-only

despacho-rules.jsx (Vista 2)               despacho.jsx
  → rules write                              ← lee scoring

admin-routes.jsx                           despacho.jsx
  → routes write                             ← lee filtros + modal
  → cities write                           admin-routes.jsx (CityPicker)
                                             ← lee
                                           despacho.jsx filtro barrio
                                             ← lee

bodeguero-despacho.jsx                     camionero.jsx
  → ODs advance 'lista'                      ← lee subscribe
  → ODs publish P2                         despacho.jsx (panel)
                                             ← lee subscribe

camionero.jsx                              despacho.jsx
  → ODs advance 'entregada'                  ← lee subscribe

portal/registro.jsx                        camionero.jsx (foto fachada)
  → clients write                          despacho.jsx (resolver tier)
  → emailsSent (sendWelcomeEmail)          mailing-logs.jsx (v1.6)
  → audit log entry                        audit-log.jsx (v1.1)

clients.jsx (drawer botones · v1.5)        label-generator.jsx
  → goTo('labels', markbox)                  ← lee selectedId

label-generator.jsx (v1.4)                 quick-email.jsx
  → openQuickEmail (mensaje supplier)        ← recibe

wiring.jsx · openOAuthFlow                 mailing-config.jsx
  → setTimeout simula callback               ← (TODO: provider.account update)

wiring.jsx · openGenerateBLModal           quick-email.jsx
  → openQuickEmail (Enviar al cliente)       ← recibe

admin.jsx · CodesSyncHeader (v1.6)         admin.jsx · CodesSyncHeader (re-render)
  → localStorage[dtd_codes_lastsync_...]      ← lee state init + interval 30s

nuevo/modules/qr-queue.jsx (v1.5)          nuevo/modules/qr-queue.jsx (otras tabs)
  → localStorage[dtd_qrqueue_v1]             ← storage event listener
operario/app.jsx (Operario CN)               ← idem
  → localStorage[dtd_qrqueue_v1]
```
