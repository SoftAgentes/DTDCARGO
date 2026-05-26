# CHANGELOG · sesión 2026-05-25

> Entries en formato sandbox · listas para pegar al tope de `nuevo/CHANGELOG.md` en el repo Next.js cuando se consolide el bundle.

---

## 🌅 Resumen del día (2026-05-25 · Claude Design)

En una sola sesión de diseño se cerraron **4 releases consecutivos** sobre el sandbox v1.3.1 → v1.6, más el primer empaquetado del **módulo Despacho legacy** (estable desde v1.0/v1.1).

| Release | Qué hace | Archivos tocados |
|---|---|---|
| **Despacho legacy** | Módulo completo de coordinación bodega VE → entrega · 3 vistas + dashboard + rutas + 2 apps móviles + bridge pipeline | 9 nuevos + 5 modificados |
| **v1.4** | Generador de etiquetas PDF bilingüe ES/中文 para suppliers CN | 1 nuevo + 2 wires |
| **v1.4.1** | Control "Etiquetas por caja" ×1–×4 para trazabilidad redundante | 1 extendido |
| **v1.5** | MARKBOX validation server-side + email bienvenida real + cross-links cliente + QR storage listener | 4 modificados (data-bridge, registro, clients, qr-queue) |
| **v1.6** | 9 conexiones rotas wireadas en módulo único `wiring.jsx` | 1 nuevo + 9 modificados |

---

## 2026-05-25 · vDespacho-legacy · empaque inicial módulo Despacho

> El módulo Despacho ya estaba estable en el sandbox desde v1.0/v1.1 (sesiones previas a mayo 2026). Esta entry documenta su primer empaquetado para portar al repo Next.js.

**Archivos nuevos en `erp/`:**
- `erp/modules/despacho.jsx` — Vista 1 admin · cola priorizada drag&drop + scoring 0-100 + modal asignación con capacity bar + panel órdenes activas + cancelar OD. ~1500 líneas.
- `erp/modules/despacho-rules.jsx` — Vista 2 reglas · cards plegables Stripe/Linear · "Pago primero" anclada · sliders puntos por regla · presets Equilibrado/FIFO. Persiste `dtd-rules`.
- `erp/modules/despacho-dashboard.jsx` — 5 KPIs + ranking rutas + top ciudades.
- `erp/modules/admin-routes.jsx` — CRUD rutas + catálogo ciudades per-tenant (Estado/Municipio/CP IPOSTEL).
- `erp/modules/venezuela-catalog.jsx` — 24 estados + ~85 municipios + ~95 ciudades + CP IPOSTEL. `window.VECatalog`.
- `erp/od-bridge.jsx` — pipeline ODs · API `publish/advance/cancel/reassign/subscribe/forHub/forDriver`. `window.DTDBridge`.
- `operario/bodeguero-despacho.jsx` — Vista 3 bodeguero · role picker + 2 sub-modos + escáner mock + carga fraccionada P1/P2.
- `operario/camionero.jsx` — Transportista · GPS + foto fachada + bloque SENIAT + POD bottom-sheet + advance al bridge.

**Archivos viejos modificados (línea + razón):**
- `erp/modules/cn.jsx` · ~73 + ~320 · agregada columna "Descripción mercancía" (truncado 2 líneas + tooltip) + campo obligatorio en `ReceptionForm` + helper `liberarADespacho(rec)` que publica al `cnInbox` del bridge + 7 mocks enriquecidos. SENIAT exige descripción de mercancía interna; pipeline CN → Despacho la necesita.
- `erp/modules/admin.jsx` · ~190 · agregada sub-sección "Administrar rutas" en nivel BÁSICO. Razón: entry point al módulo admin-routes desde el panel admin.
- `erp/modules/admin.jsx` · ~1095 · agregado feature toggle "Ubicación en bodega · pasillo · zona · estante" (default OFF). Razón: preparado para v2.
- `erp/data.jsx` · ~148-156 · `WAREHOUSE_CN` con campo `description` por entry. Razón: SENIAT + chofer.
- `erp/shell.jsx` · ~14-18 · 4 entries de sidebar (despacho · despacho-rules · despacho-dashboard · admin-routes) grupo OPERACIÓN.
- `DTD Studio · ERP.html` · ~85-94, ~192 · script tags + entries en `moduleMap` para los 5 módulos + 2 bridges + venezuela-catalog.

**HTMLs standalone** (solo para preview sandbox · NO van al repo):
- `Despacho · Vista 1.html` · `Despacho · Vista 2.html` · `Despacho · Vista 3.html` · `Admin · Rutas.html` · `Camionero.html`

**Notas:** ver `BRIEFS/01-despacho.md` para flujo completo · `DATA-MODEL.md` §4 para shapes de OrdenDespacho/PackageSplit/Incident/Route/CnInboxItem · `CONNECTIONS.md` §1 para diagrama 3-actor.

---

## 2026-05-25 · v1.4 · Generador de etiquetas PDF para suppliers CN

**Archivos nuevos en `nuevo/`:**
- `nuevo/modules/label-generator.jsx` — módulo `window.ModuleLabelGenerator`. Plancha PDF bilingüe ES / 中文 con MARKBOX + Box X/Y + QR mock procedural + 4 formatos (A4 8-up · A4 4-up · térmico 100×150 · térmico 100×100) + print stylesheet `@page` en mm reales + modal "Mensaje al supplier" con copy ES+CN y wire a `window.openQuickEmail`. ~700 líneas.

**Archivos viejos modificados (línea + razón):**
- `erp/shell.jsx` · línea ~15 · entry sidebar `{ id: 'labels', group: 'OPERACIÓN', label: 'Etiquetas CN', icon: 'tag' }` debajo de "Cola de QR".
- `DTD Studio · ERP.html` · líneas ~107, ~223 · `<script type="text/babel" src="nuevo/modules/label-generator.jsx">` + `labels: window.ModuleLabelGenerator` en moduleMap.

**Notas:**
- El QR mock es procedural (PRNG seedeada por hash djb2 con 3 finder patterns en esquinas) · visual no escaneable real. TODO: librería `qrcode-svg` o similar.
- Tipografía: `'Noto Sans SC'` cargada inline para 中文 · cae a `Archivo` si no está disponible.
- Print: el usuario elige "Guardar como PDF" en el diálogo del navegador · `@page { size: ${w}mm ${h}mm; margin: 0 }` controla el tamaño exacto.
- Mock data inlined: `WAREHOUSES_CN` con 3 hubs (YIW-A1 Yiwu · GZ-B2 Guangzhou · SZ-C1 Shenzhen) · TODO mover a `erp/data.jsx` al consolidar.

**TODOs pendientes:**
- QR escaneable real.
- Botón directo desde el drawer de Cliente para preselect (✅ hecho en v1.5).
- Exposición al portal cliente (autoservicio).

---

## 2026-05-25 · v1.4.1 · Etiquetas CN · copias por caja (1-4)

**Cambio único en `nuevo/modules/label-generator.jsx`** (~líneas 400-470):
- Agregado control segmentado `×1 / ×2 / ×3 / ×4` en card "CAJAS · BOX X/Y". Default ×2 (recomendado).
- El generador duplica la misma etiqueta N veces consecutivas. Las copias son **idénticas** (mismo MARKBOX, mismo Box X/Y, mismo QR) — no se marcan "copia 1 de 3" porque las cajas se descargan en orden arbitrario y se necesita trazabilidad redundante en distintas caras de la misma caja.
- Helper `boxesInRange` calculado aparte para mostrar el desglose "N cajas × M copias = X etiquetas".
- Resumen del preview muestra una segunda línea con "N cajas × M copias".
- Mensaje al supplier (modal ES/中文) menciona el conteo: "${totalLabels} etiquetas para ${totalBoxes} cajas (${copiesPerBox} etiquetas por caja, pegá una en cada cara…)".
- Fix técnico: la key del `.map` en Sheet ahora usa `${pageIndex}-${labelIndex}` en vez del boxIndex (que ya no es único). `totalBoxes` se pasa como prop a Sheet en vez de inferirse de `labels.length`.

**Archivos viejos modificados:** ninguno.

**Razón operativa:** durante la descarga del contenedor en VE, una sola etiqueta por caja se puede tapar con otra caja, romperse al manipular o mancharse. Pegando 2-4 copias en distintas caras se garantiza la trazabilidad.

---

## 2026-05-25 · v1.5 · Críticos + quick wins · conexiones reparadas

Cuatro mejoras de wiring en una sola pasada.

### 1 · MARKBOX validation server-side (crítico)

**Cambios en `erp/data-bridge.jsx`** (~líneas 58-110):
- `MARKBOX_REGEX = /^DTD-\d{4,5}$/` — formato oficial (4 o 5 dígitos).
- `validateMarkboxFormat(code)` — boolean.
- `allKnownMarkboxes()` — Set con codes del bridge + seed `ERPData.CLIENTS`.
- `isMarkboxUnique(code)` — boolean (formato + no existe).
- `nextMarkbox()` — secuencial defensivo: encuentra max, prueba +1 con retry de hasta 10 candidatos si colisiona. Fallback a `max+1` solo en caso extremo.

**Wireado en `portal/registro.jsx`** (línea ~52): `submit()` reemplaza el código inline por `window.DTDData.nextMarkbox()` con doble check de formato. Fallback al random si bridge no disponible.

### 2 · Email de bienvenida real (crítico)

**Cambios en `erp/data-bridge.jsx`** (~líneas 112-160):
- Store `emailsSent` (key `dtd-emails-sent`).
- `renderTemplate(body, vars)` — substituye `{{var}}` por valores.
- `sendWelcomeEmail(client)`:
  - Lee template **m-05 'Bienvenida MARKBOX'** de `window.ERPData.MAIL_TEMPLATES`.
  - Substituye `{{client_name}}`, `{{markbox}}`, `{{portal_link}}`.
  - Pushea entrada al log + entrada `auto` al audit log (`dtd_audit_log_v1`).
  - Cap del log a 500 entradas.

**Wireado en `portal/registro.jsx`** (`submit()`): después de persistir el cliente, llama `window.DTDData.sendWelcomeEmail(newClient)`. Setea `emailSent` state.

**UI en `StepSuccess`**: la card de "te enviamos un email" ahora cambia visualmente según `emailSent`:
- Éxito → fondo verde, border `var(--success)`, icon check, texto "Email enviado a {email} … Revisá la bandeja de entrada o spam."
- Pendiente → fondo neutro, icon mail, texto "Te enviaremos un email a …"

Sacado el emoji 📨 (brand-check: prohibido emoji decorativo en UI).

### 3 · Drawer Cliente · cross-links (quick win #11+#12)

**Cambios en `erp/modules/clients.jsx`** (~línea 131, `actions` del drawer detalle):
- Botón ghost "Estado de cuenta" → `window.open('nuevo/pantallas/estado-cuenta.html?id=' + markbox, '_blank')`.
- Botón ghost "Etiquetas" → `goTo('labels', markbox)` (`ModuleLabelGenerator` lee `selectedId` y preselecciona).

### 4 · Cola QR · listener real-time (quick win #10)

**Cambios en `nuevo/modules/qr-queue.jsx`** (~líneas 34-50): segundo `useEffect` en `useQrOrders` con `storage` event listener. Cuando otro tab (app Operario CN) escribe al key `dtd_qrqueue_v1`, el ERP detecta y re-lee state automáticamente · sin refresh manual.

### Archivos viejos modificados

- `erp/data-bridge.jsx` · ~58-160 · MARKBOX helpers + sendWelcomeEmail + store emailsSent.
- `portal/registro.jsx` · ~42, ~52, ~110, ~410 · nextMarkbox + sendWelcomeEmail + state emailSent + UI feedback.
- `erp/modules/clients.jsx` · ~131 · 2 botones cross-link.
- `nuevo/modules/qr-queue.jsx` · ~34 · storage event listener.

### Quick win descartado

**Bell de notificaciones** estaba marcado como "no clickeable" en HANDOFF.md, pero verificado en `erp/shell.jsx` línea ~317 ya tiene `onClick` con dropdown completo. Sin trabajo necesario.

### TODOs pendientes

- Mostrar `emailsSent` en módulo Mailing → Logs (✅ hecho en v1.6).
- Validar MARKBOX format en el form mismo si en algún momento el admin asigna manual.
- Mover seed `WAREHOUSES_CN` de `label-generator.jsx` a `erp/data.jsx` al consolidar.

---

## 2026-05-25 · v1.6 · Conexiones rotas reparadas (sprint quick)

Sprint de 9 conexiones rotas que existían visuales pero no funcionales.

### Archivos nuevos en `nuevo/`

- **`nuevo/modules/wiring.jsx`** — Módulo único que expone modals globales en `window.DTDWiring`:
  - `openAttachModal({ onSelect })` — drag-and-drop + file input multi-file con preview, soporte PDF/DOCX/XLSX/imágenes hasta 25 MB.
  - `openScheduleModal({ onSchedule })` — date/time picker con 3 atajos + zona horaria + nota explicativa.
  - `openProfileModal({ tab })` — modal de "Mi perfil" con 3 tabs (Datos personales · Contraseña · Preferencias).
  - `openShortcutsModal()` — 2-col grid con 5 grupos de atajos.
  - `openGenerateBLModal()` — flow de generación BL: selección embarque + tipo → preview con número `DTDU{7}-{OR|CP|SW}` + acciones Descargar/Enviar.
  - `openOAuthFlow(provider)` — mock 3 pasos (redirect → autorizando spinner → conectado) para gmail/outlook.
  - Singleton: un solo `<MountHost />` en `<App>`.

### Archivos viejos modificados

- `DTD Studio · ERP.html` · línea ~107 · `<script type="text/babel" src="nuevo/modules/wiring.jsx">` · línea ~287 · `<window.DTDWiring.MountHost />` junto a QuickEmailModal.
- `erp/modules/mailing-compose.jsx` · línea ~141-142 · wireados onClick de "Programar" → `openScheduleModal` y "Adjuntar" → `openAttachModal`.
- `erp/modules/documents.jsx` · línea ~62 · wireado onClick de "Generar BL" → `openGenerateBLModal`.
- `erp/modules/mailing-config.jsx` · línea ~148 · wireado onClick de "Conectar con Google/Microsoft" → `openOAuthFlow(p.id)`.
- `erp/shell.jsx` · línea ~400 · user menu reemplazado de array strings a array de objetos con `action` para Mi perfil/Cambiar contraseña/Preferencias/Atajos. Línea ~436 · "Cerrar sesión" con confirm + reload.
- `erp/modules/admin.jsx` · líneas ~1226-1240 · `CodesSyncHeader` persiste `lastSync` en localStorage (key `dtd_codes_lastsync_${source}`) + state local + interval 30s + helper `fmtAgo(iso)` · muestra "ÚLTIMA / PRÓXIMA SYNC" con timestamp dinámico.
- `erp/modules/dashboard.jsx` (legacy v1.0) + `nuevo/modules/dashboard.jsx` (override) · `RecentActivity` recibe `goTo` · cada notif clickeable navega al módulo según type (tracking/sales/finance/alert/crm/warehouse → tracking/quotes/invoices/tracking/leads/cn) con hover state.
- `erp/modules/mailing-logs.jsx` · línea ~5 · suscribe al store `window.DTDData.emailsSent` del bridge y mergea con seed mock. Emails de bienvenida disparados desde registro.jsx aparecen al tope con "recién" / "hace N min".

### Notas

- El icon set no tiene `download`/`mail` extras — usé los existentes (`upload`/`mail`/`doc`/`clock`/`link`/`shield`/`check`/`info`/`refresh`).
- OAuthFlow usa `setTimeout(1.8s)` para simular callback. En prod va a ser popup `window.open` al endpoint del proveedor con redirect URI.
- BL generado tiene formato `DTDU{7-dígitos}-{tipo}` siguiendo convención `DTDU-XXXXXXX`. Mock — el PDF real necesita generador server-side.
- ProfileModal está auto-contenido — "Cambiar avatar" y demás controles son placeholders sin persistencia.
- `lastSync` de HS/AES se persiste por separado (key incluye `source`) para que el contador no se mezcle entre tab HS y tab AES.

### TODOs pendientes

- Wirear el `onSelect` del AttachModal en mailing-compose para mostrar la lista de adjuntos en el draft.
- Wirear el `onSchedule` para que el envío programado quede en una cola visible en Mailing → Logs (hoy solo cierra modal + setSentOk).
- ProfileModal: persistir cambios al user (hoy solo muestra "Guardado" toast).
- OAuthFlow: actualizar el `provider.account` del `SMTP_PROVIDERS` al completar.

---

## Stubs no-op sugeridos para Claude Code

Cuando estos módulos NO estén portados todavía al repo Next.js:

```typescript
// Si nuevo/modules/audit-log.jsx no portado
window.auditLog = { push: (e) => console.log('[audit stub]', e) };

// Si nuevo/modules/contabilidad.jsx no portado
window.accountingService = {
  createDispatchEntry: () => console.log('[accounting stub] OD entry'),
};

// Si nuevo/modules/conciliacion.jsx no portado
window.reconciliation = {
  matchOdToPayment: () => null,
};

// Si push service no implementado
window.pushService = { send: () => {} };
```

---

## Compatibilidad con flow operario existente del repo

Si el repo Next.js ya tiene los flows del bodeguero (4 steps) y del chofer (6 steps), **NO los rehagas**. Lo que es **NUEVO** en este bundle vs lo que ya existe:

**NUEVO en bodeguero (Vista 3):**
- Role picker al login
- Home post-cierre con resumen + 2 sub-modos
- Demo escáner mock con animación scan + detección 2.4s
- Carga fraccionada P1/P2 con modal split + motivos
- Bloque SENIAT (HS+AES+descripción) en card de paquete actual
- Banner verde "OD recibida desde admin"
- Botón "Cerrar carga · entregar al transportista"

**NUEVO en chofer (Transportista):**
- Banner ruta del día con timeline + GPS toggle
- Push notification overlay si GPS se apaga
- Card de entrega actual con foto fachada del registro
- Bloque SENIAT visible para alcabalas
- Modal POD bottom-sheet con foto + firma
- Botones Llamar (tel:) + WhatsApp (wa.me) + Push
- Banner verde "OD recibida desde bodeguero"
- Advance al bridge cuando se cierra última entrega

Los **4 steps bodeguero / 6 steps chofer originales del repo** son la base UX — agregarles las cosas de arriba sin reescribir.

---

## Archivos NO incluidos en este bundle (intencional · ver INVENTORY.md §3)

Scripts compartidos NO modificados — el repo Next.js ya los tiene:
- `erp/tokens.css` · `erp/icons.jsx` · `erp/components.jsx` · `erp/tweaks-panel.jsx`

Módulos v1.0 que NO se tocaron hoy ni en Despacho legacy — el repo los tiene a su versión correspondiente. Si Claude Code necesita alguno para entender contexto, lo pide aparte.
