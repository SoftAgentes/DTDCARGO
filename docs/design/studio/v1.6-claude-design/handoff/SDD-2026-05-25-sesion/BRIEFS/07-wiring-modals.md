# Brief · Wiring de 9 conexiones rotas (v1.6)

> Módulo `nuevo/modules/wiring.jsx` que expone modals globales en `window.DTDWiring`. Reemplaza 9 botones que existían visuales pero no funcionaban con onClick handlers reales.

---

## Problema y para quién

El HANDOFF.md de la sesión anterior listaba 9 "conexiones rotas": botones, links y triggers en el ERP que aparecen pero no hacen nada (placeholders visuales). Cada uno tenía su lista de subcasos en distintos módulos:

1. "Adjuntar archivo" en Compose Mailing
2. "Programar envío" en Compose Mailing
3. "Mi perfil" en menú usuario
4. "Cambiar contraseña" en menú usuario
5. "Atajos de teclado" en menú usuario
6. "Generar BL" en Documentos
7. "Conectar Google/Microsoft" en SMTP setup
8. "Sincronizar HS/AES" en Admin (solo animación, no persistía)
9. "Actividad reciente" en Dashboard (no clickeable)
10. **Bonus:** "Mailing Logs" no leía el bridge `emailsSent` que v1.5 dejó listo

**Resuelve:** crear modals reusables centralizados + wirearlos en cada botón.

### Roles servidos

| Rol | Beneficio |
|---|---|
| **Cualquier usuario del ERP** | Los botones que tocaba ahora hacen algo · UX deja de ser "fachada" |
| **QA / sales demos** | Demos funcionan end-to-end sin "esto no está implementado" |
| **Devs futuros** | API reusable `window.DTDWiring.openX(...)` para agregar más wires sin duplicar código |

---

## Flujo end-to-end

```
[1] Carga inicial:
    DTD Studio · ERP.html carga nuevo/modules/wiring.jsx
    → expone window.DTDWiring API
    → monta <window.DTDWiring.MountHost /> en <App>
       (singleton · un solo modal activo a la vez)

[2] Usuario click cualquier botón wireado:
    → onClick calls window.DTDWiring.openX(opts)
    → __setActive({ kind: 'X', props: opts })
    → MountHost renderea MODALS[kind] con props

[3] Cualquier action en el modal:
    → callback opts.onSelect / onSchedule / onSchedule(value)
    → onClose() · setActive(null) · modal desaparece

[4] Open multiple veces:
    → cada open sobreescribe al anterior (singleton)
    → no hay stacking de modales
```

---

## Reglas de negocio

### Singleton MountHost

Patrón intencional: un solo modal a la vez. Razón:
- Evita stacking confuso (modal sobre modal sobre modal).
- Simplifica el lifecycle (un único `setActive` controla todo).
- Coherente con el patrón "command bar" que usa el ERP (paleta de comandos también es singleton).

Excepción: el QuickEmailModal sigue siendo independiente (legacy v1.0) · se monta aparte y no compite con el singleton.

### Modal "Adjuntar archivo" (`openAttachModal({onSelect})`)

- **Dropzone**: `onDragOver={e=>preventDefault} onDrop` que lee `e.dataTransfer.files`.
- **File input** múltiple oculto · click en zona dropzone simula click en input.
- **Preview** de archivos seleccionados con icon doc + nombre + size + MIME · botón "Quitar" por file.
- **Confirm** llama `onSelect(files[])` con `{name, size, type, addedAt}[]`.
- Hoy `onSelect` es un `console.log` placeholder · al wirearlo real al draft del Compose va a aparecer la lista de adjuntos.

### Modal "Programar envío" (`openScheduleModal({onSchedule})`)

- Date input + Time input controlados.
- 3 presets como pills clickeables: "En 1 hora" · "Mañana 9:00" · "Lunes 9:00".
- Select de timezone (Caracas/Shanghai/NY/Madrid).
- Banner info: "Se enviará el {date} a las {time} ({tz}). Podés cancelar el envío desde Borradores hasta 5 min antes."
- **Confirm** llama `onSchedule({date, time, tz, iso})` · hoy es placeholder.

### Modal "Mi perfil" (`openProfileModal({tab})`)

3 tabs:

- **Datos personales**: avatar + name + email + phone + button "Cambiar avatar" + "Guardar cambios" con toast verde.
- **Contraseña**: warning de 12+ chars · 3 inputs (actual / nueva / confirmar) · validación inline · botón disabled hasta cumplir reglas · toast verde al cambiar.
- **Preferencias**: idioma (es/en/zh) · densidad (compact/comfortable) · 3 checkboxes (email diario / push browser / sonido).

Acepta `tab` prop (`'profile' | 'password' | 'prefs'`) para abrir en la pestaña correcta. Desde el user menu de la topbar:
- "Mi perfil" → tab `profile`
- "Cambiar contraseña" → tab `password`
- "Preferencias" → tab `prefs`

### Modal "Atajos de teclado" (`openShortcutsModal()`)

Grid 2 columnas con 5 grupos:
- Navegación (⌘K paleta, G+D Dashboard, etc.)
- Acciones (N nuevo, E editar, /, ?)
- Embarques (T toggle tabla/kanban, F filtros, ↑↓, Enter)
- Email/Compose (⌘Enter, ⌘S, ⌘⇧S)
- General (⌘. toggle theme, ⌘, profile, ⌘⇧L logout)

Cada combo en un `<kbd>` con border-bottom 2px (look de tecla física).

### Modal "Generar BL" (`openGenerateBLModal()`)

2 pasos:

1. **Selección**: dropdown embarques activos (filtra `D.SHIPMENTS` con status ≠ 'entregado') + dropdown tipo BL (Original / Copy / SeaWayBill) + preview del embarque seleccionado.
2. **Generado**: card verde "BL generado" + número auto `DTDU{7-dígitos}-{OR|CP|SW}` (siguiendo convención DTDU-XXXXXXX) + preview BL con Shipper/Consignee/Origin/Destination/Vessel/ETA · botones Descargar PDF · Enviar al cliente (wire a `openQuickEmail`).

**Mock:** el BL no genera PDF real · es preview HTML. En prod usaría `pdfmake` o llamada al backend.

### Modal "OAuth Google/Microsoft" (`openOAuthFlow(provider)`)

3 pasos con `setTimeout` para simular callback:

1. Card "Vamos a redirigirte" + botón "Continuar con Google/Microsoft" (color real del provider).
2. Spinner 1.8s "Autorizando…"
3. Check verde "Conectado correctamente" + botón Listo.

**Mock:** no abre popup OAuth real. En prod usaría `window.open` al endpoint del provider + redirect URI handling.

### CodesSyncHeader timestamp persistente (admin.jsx)

No es un modal · es una mejora del header dark de Admin → Códigos HS/AES:

- Antes: `setSyncing(true); setTimeout(() => setSyncing(false), 1400)` · sin persistencia.
- Ahora: persiste `lastSync` ISO string en `localStorage` (key `dtd_codes_lastsync_${source}`) + state local + `setInterval` 30s para re-render relativo + helper `fmtAgo(iso)` que devuelve "recién" / "hace N min" / "hace N h" / "hace N d".
- Header muestra "ÚLTIMA / PRÓXIMA SYNC" con timestamp dinámico.

### Actividad reciente Dashboard clickeable

`RecentActivityWidget` (override en `nuevo/modules/dashboard.jsx`) ahora recibe `goTo` prop · cada notification es un `<button>` con `onClick={() => goTo(typeToMod[n.type])}` + hover state. Mapping por type:

| `n.type` | Module destino |
|---|---|
| tracking | tracking |
| sales | quotes |
| finance | invoices |
| alert | tracking |
| crm | leads |
| warehouse | cn |

### Mailing Logs lee bridge

`erp/modules/mailing-logs.jsx` ahora hace:
1. `useEffect` que suscribe a `window.DTDData.emailsSent.subscribe(cb)` y trigger re-render con `setBridgeTick`.
2. `useMemo` que toma `emailsSent.read()` y lo transforma al shape `seedLogs` (con `fmtAgo` para el time).
3. Render hace `allLogs = [...bridgeLogs, ...seedLogs]` (bridge al tope).

---

## State machine

Por modal:

| Modal | Estados |
|---|---|
| Attach | files=[] → files=[...] → confirm/cancel |
| Schedule | date/time/tz → confirm/cancel |
| Profile | tab=profile/password/prefs · cada tab tiene su sub-state independiente |
| Shortcuts | display-only · no state |
| GenerateBL | selecting → generated · forward-only (cancelar cierra) |
| OAuth | step=1→2→3 con setTimeout(1800) automático del 2 al 3 |

---

## Permisos por rol

Hoy: cualquier usuario con acceso al ERP puede usar todos los modals.

En prod:
- "Generar BL" debería restringirse a roles `Admin / Operaciones`.
- "OAuth Google/Microsoft" solo `Admin / SuperAdmin`.
- "Cambiar contraseña" cualquier rol (es su propia password).
- "Atajos de teclado" universal.

---

## Casos borde

| Modal | Caso | Comportamiento |
|---|---|---|
| Attach | Sin archivos seleccionados | Botón "Adjuntar" disabled |
| Attach | Drag-and-drop de carpeta | Las carpetas no se desempaquetan · falla silenciosa (FileSystem API necesario · TODO) |
| Schedule | Fecha pasada | No hay validación · TODO: prevent submit si `iso < now` |
| Profile · password | pw3 ≠ pw2 | Error rojo "Las contraseñas no coinciden" |
| GenerateBL | Sin embarques activos | `shipments[]` vacío · selector sin opciones · "Generar" disabled |
| OAuth | Cancelar mid-flow | step=2 con setTimeout pending · al cerrar el modal el timer queda flotando (no causa crash porque setStep solo afecta state que ya fue unmounted) |

---

## Dependencias

- **Componentes ERP usados:** `U.Modal` · `U.Btn` · `U.Input` · `U.Select` · `U.Avatar` · `U.Tabs` · `U.Card`
- **Iconos usados:** `I.upload` · `I.doc` · `I.check` · `I.clock` · `I.info` · `I.shield` · `I.link` · `I.mail` · `I.refresh`
- **Bridge:** ningún modal escribe al bridge hoy. Cuando se wireen los callbacks (TODO), `onSchedule` debería pushear a un store nuevo `dtd-scheduled-emails`.
- **Native APIs:** `navigator.clipboard.writeText` (en Despacho copy supplier message · ya estaba) · `window.open` (BL Compose · ya estaba)

### Cuando se wireen los callbacks reales

1. **`onSelect` de AttachModal** → state local de Compose para mostrar lista de adjuntos en el draft. Schema sugerido: `attachments: { name, size, type, blob? }[]`.
2. **`onSchedule` de ScheduleModal** → push a nuevo store `dtd-scheduled-emails` con `{ iso, draft, status: 'queued' }` + tab nueva "Programados" en Mailing → Logs.
3. **Profile · Guardar** → mutation API + update `window.__currentUser` + re-render del shell topbar.
4. **OAuth · Listo** → update `provider.account` en `SMTP_PROVIDERS` con el email del usuario que autorizó.

---

## Archivos

| Archivo | Líneas |
|---|---|
| `nuevo/modules/wiring.jsx` | ~750 (nuevo) |
| `erp/modules/mailing-compose.jsx` | 2 onClick |
| `erp/modules/documents.jsx` | 1 onClick |
| `erp/modules/mailing-config.jsx` | 1 onClick |
| `erp/shell.jsx` | user menu array + cerrar sesión |
| `erp/modules/admin.jsx` | ~1226-1240 CodesSyncHeader |
| `erp/modules/dashboard.jsx` | ~140-160 RecentActivity legacy |
| `nuevo/modules/dashboard.jsx` | ~206 + ~322-365 RecentActivityWidget override |
| `erp/modules/mailing-logs.jsx` | ~5-60 bridge subscribe |
| `DTD Studio · ERP.html` | script tag + MountHost |
