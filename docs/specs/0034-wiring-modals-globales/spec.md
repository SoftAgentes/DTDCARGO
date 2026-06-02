---
sdd: "0034"
title: "Wiring 9 conexiones rotas · modals globales (DTDWiring)"
status: done
author: "founder"
created: 2026-05-25
updated: 2026-06-02
supersedes: null
superseded_by: null
related: ["0007", "0026"]
---

# DTD-0034 — Wiring 9 conexiones rotas · modals globales

> **Fase 3d del bundle Claude Design v1.6** (release v1.6).
> Sistema centralizado de modals reusables expuestos vía hook
> `useDTDWiring()`. Wirea botones que existían visuales pero no
> hacían nada (Generar BL, Mi perfil, Cambiar contraseña, Atajos,
> OAuth SMTP). Patrón singleton: 1 modal activo a la vez.

---

## 1. Resumen en una línea

`<WiringProvider>` envuelve el layout del Studio, expone hook
`useDTDWiring()` con métodos `openProfileModal({tab})` ·
`openShortcutsModal()` · `openGenerateBLModal()` · `openOAuthFlow(provider)`.
Cualquier componente client del Studio dispara cualquiera. Mount host
renderiza solo el modal activo.

---

## 2. Scope

### Incluye

#### Componente central

- `app/studio/_components/wiring/WiringProvider.tsx`:
  - `<WiringProvider>` context provider + state activo + `<WiringHost>` inline.
  - Hook `useDTDWiring()` que devuelve los 4 `open*` + `close`.
  - Patrón singleton: state shape `{ kind: ModalKind | null, props?: any }`.
  - `openX` setea el state · `close` lo resetea.
  - Esc cierra automáticamente.

#### 4 modals

- `ProfileModal` · 3 tabs:
  - Datos personales (avatar + name + email + phone + "Guardar")
  - Contraseña (3 inputs · 12+ chars · validación inline · "Cambiar")
  - Preferencias (idioma + densidad + 3 checkboxes notifs)
  - Acepta prop `tab` para abrir en la pestaña correcta.
  - **V1**: solo UI · "Guardar" muestra toast verde sin persistir. SDD futuro
    cuando exista tabla `user_profiles`.
- `ShortcutsModal` · grid 2 cols con 5 grupos de atajos:
  - Navegación · Acciones · Embarques · Email · General
  - Cada combo en `<kbd>` con border-bottom 2px.
- `GenerateBLModal` · 2 pasos:
  - **Paso 1**: dropdown shipments activos + selector tipo (Original / Copy / SeaWayBill) + preview con Shipper/Consignee/Origin/Destination/Vessel/ETA.
  - **Paso 2**: card verde "BL generado" + código `DTDU{7}-{OR|CP|SW}` + botones Descargar PDF / Enviar al cliente.
  - **V1**: el "PDF" es mock alert. Generación real necesita library pdfmake o backend.
- `OAuthFlowModal` · 3 steps con setTimeout:
  - Step 1: "Vamos a redirigirte" + botón "Continuar con {provider}"
  - Step 2: spinner 1.8s "Autorizando…"
  - Step 3: check verde "Conectado correctamente"
  - **V1**: mock total · sin redirect real. SDD futuro con OAuth client.

#### Wiring en módulos existentes

- **`StudioTopbar` user menu**:
  - Agregar items: "Mi perfil", "Atajos de teclado", "Cambiar contraseña"
  - "Preferencias" (que ya existía como link a `/studio/ajustes`) lo dejo igual
  - Items wireados a los modals del DTDWiring.
- **`/studio/documentos`**:
  - Reemplazar EmptyState por server component con botón "Generar BL" en el header → `openGenerateBLModal`.
  - El resto del módulo Documentos queda como placeholder (SDD futuro).
- **Layout `app/studio/(app)/layout.tsx`**:
  - Envolver `<WiringProvider>` el children del layout para que el provider esté disponible en todo el Studio.

### Fuera de scope (deuda diferida)

- **AttachModal + ScheduleModal**: No hay módulo "mailing compose" en el repo · solo placeholder en `/studio/mailing`. Cuando se construya el compose (SDD futuro mailing v2), se agregan al DTDWiring.
- **Persistencia real del ProfileModal**: tabla `user_profiles` no existe. V1 toast verde sin guardar.
- **PDF real del BL**: mock V1. V2 con `pdfmake` o backend route.
- **OAuth real**: mock V1. V2 con OAuth client del provider.
- **RecentActivity clickeable en Dashboard**: cubierto por SDD-0035 (RecentActivity + CodesSync persistente) que es el último del bundle.
- **Wire de "Conectar SMTP" en `/studio/admin`**: el admin del Studio no tiene seguro la sección SMTP visible. Wire condicional · si existe la sección agregamos el botón, sino skip.

---

## 3. Decisiones

### D1 · Context provider, no window global

El mockup del bundle usa `window.DTDWiring.openX()`. Acá uso un React
context + hook `useDTDWiring()` porque:
- Type-safe (TypeScript no entiende `window.X`)
- Server components NO pueden tocar `window`
- Cualquier client component que necesite abrir un modal puede hacer
  `const { openProfileModal } = useDTDWiring()`

### D2 · Singleton MountHost en el layout

`<WiringHost />` se monta UNA VEZ dentro del Provider. Si se monta en
cada página el state se pierde al navegar. Layout del Studio es el
lugar correcto.

### D3 · 4 modals, no 6

Drop AttachModal + ScheduleModal porque sus consumidores (mailing
compose) no existen en el repo. Cuando exista, agregamos al provider
sin breaking change. Hoy: solo lo que se puede consumir realmente.

### D4 · Mocks intencionales en V1

ProfileModal · GenerateBLModal · OAuthFlowModal son **funcionalmente
mocks**. Razón: el bundle pide la UX completa con "Conectado", "BL
generado", "Guardado". El backend real llega después. Lo importante
es que el sistema esté wireado y no haya botones rotos.

---

## 4. Casos borde

| Caso | Comportamiento |
|---|---|
| Usuario abre 2 modals seguidos | El segundo reemplaza al primero (singleton) |
| Esc durante OAuth step 2 (spinner activo) | Modal cierra · setTimeout pendiente igual ejecuta setState sobre componente unmounted (warning React) |
| Profile.password con pw3 ≠ pw2 | Error rojo inline · botón "Cambiar" disabled |
| GenerateBL sin shipments activos | Dropdown vacío · botón "Generar" disabled · mensaje "No hay embarques activos" |
| useDTDWiring() llamado fuera del Provider | Throw con mensaje claro "Wrap your app with WiringProvider" |

---

## 5. Origen

- **Bundle:** `docs/design/studio/v1.6-claude-design/handoff/SDD-2026-05-25-sesion/`
- **Brief:** `BRIEFS/07-wiring-modals.md`
- **Source JSX:** `source/nuevo/modules/wiring.jsx` (~30 KB · 750 líneas)
