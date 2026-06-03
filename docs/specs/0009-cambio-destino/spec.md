---
sdd: "0009"
title: "DoorTuDoor — Cambio de destino (feature en Tracking)"
status: done
author: "founder"
created: 2026-05-24
updated: 2026-06-02
supersedes: null
superseded_by: null
related: ["0005", "0006", "0008"]
confidencialidad: interno
---

# DTD-0009 — Cambio de destino en envíos activos

> **Primera integración real Tarifas (SDD-0008) ↔ Tracking.** Permite que el
> operador cambie el destino de un envío en curso, registre el fee del cambio
> y deje audit en el timeline. Modela el negocio real DTD: si el cliente mueve
> oficina entre Yiwu y Caracas, el envío se reroutea pero el costo extra se cobra.

---

## 1. Resumen en una línea

Modal "Cambiar destino" en el detalle del envío con: nuevo destino + GPS
opcional + fee a cobrar (sugerido si existe rate para la nueva ruta) + motivo
obligatorio. Actualiza `shipments.destination`/`destination_gps`, crea un
`shipment_event` con nota estructurada y deja constancia para la facturación
futura.

---

## 2. Scope

### Incluye

#### Helpers
- `lib/studio/destination-change.ts`:
  - `findRateForDestination(supabase, service, destination)` — busca rate
    activa para `(service, destination)` con `valid_until >= today`. Retorna
    `Rate | null`.
  - `formatChangeNote({ from, to, fee, reason })` — string estructurado para
    el `note` del shipment_event:
    `[Cambio de destino · fee $80.00] Valencia → Maracaibo · Cliente movió oficina`

#### Server action
- `changeDestination(shipmentId, input)` en
  `app/studio/(app)/tracking/[id]/actions.ts`:
  - Valida que el envío no esté en estado terminal (`delivered` o `cancelled`).
  - Update `shipments` con `destination = new, destination_gps = new || existing`.
  - Insert `shipment_events` con:
    - `status = shipment.current_status` (mantiene el estado actual)
    - `note = formatChangeNote(...)` (parseable después)
    - `occurred_at = now()`
    - `created_by = current user`
  - `revalidatePath` del detalle + lista.

#### Cliente
- `_components/ChangeDestinationModal.tsx`:
  - Modal centrado (no drawer) — la acción es puntual, no merece sidebar
  - Form: nuevo destino (text), nuevo GPS (opcional, igual UX que el form
    de creación de envíos), fee (number USD), motivo (textarea ≥5 chars)
  - **Sugerencia automática del fee:** al typear el nuevo destino (debounced
    400ms), busca rate matching y muestra hint: "Tarifa para esta ruta: $X /
    diferencia con la actual: $Y" o "Sin tarifa registrada — fee manual"
  - Confirmación inline antes de submit: chip resumen "Valencia → Maracaibo · fee $80"
  - Cierre con Esc o backdrop

#### UI
- Botón **"Cambiar destino"** en `ShipmentDataPanel.tsx`, al lado del
  campo destino. Visible solo si `status` NO es terminal. Texto inline,
  estilo ghost sm, no agresivo.
  - Tooltip: "Cambia el destino del envío y registra el cobro en el timeline."

### NO incluye (queda para SDDs futuros)

- **Tabla `destination_changes`** dedicada — todo va a `shipment_events` con
  nota parseable. Si Facturación (SDD-0020) necesita query directo de fees,
  se escala a tabla aparte sin breaking change (parsing → migration que lee
  las notas y popula la tabla).
- **Update automático de facturación** — solo se registra. Facturación leerá
  el timeline cuando exista.
- **Reporte "Total fees por cambios este mes"** — sin tabla dedicada,
  requeriría parsear notas. Se difiere a SDD-0020+.
- **Histórico de destinos** en el campo `destination` — se pisa con el nuevo.
  El histórico vive en el timeline (lectura).
- **Sugerencia de GPS automática** desde el nuevo destino — el operador lo
  pide al cliente por WhatsApp. UX no cambia.
- **Multi-step wizard** — un solo modal con form. UX simple, no asistente.

---

## 3. Archivos a crear / editar

### Nuevos

```
docs/specs/0009-cambio-destino/
└── spec.md                                              ← este

lib/studio/
└── destination-change.ts                                ← helpers de fee + nota

app/studio/(app)/tracking/[id]/_components/
└── ChangeDestinationModal.tsx                           ← modal centrado
```

### Editados

```
app/studio/(app)/tracking/[id]/actions.ts                ← + changeDestination()
app/studio/(app)/tracking/[id]/_components/ShipmentDataPanel.tsx
                                                          ← + botón "Cambiar destino"
docs/design/v1-studio/module-map.md                      ← 1.2 ✅, próximo ⭐ 1.3
```

---

## 4. Formato del `note` (estructurado para parsing futuro)

```
[Cambio de destino · fee $80.00] Valencia → Maracaibo · Cliente movió oficina
```

Convención:
- Prefijo `[Cambio de destino · fee $X.XX]` — parseable con regex
- Body `<from> → <to> · <reason>`
- Si fee = 0 (cambio sin costo, ej corrección de typo): `[Cambio de destino · sin costo]`
- Si reason vacío (no debería pero defensa): `[Cambio de destino · fee $X.XX] <from> → <to>`

### Regex de parsing (referencia para futuro SDD)

```js
/^\[Cambio de destino · (?:fee \$([\d.]+)|sin costo)\] (.+?) → (.+?)(?: · (.+))?$/
```

---

## 5. Decisiones de diseño

### 5.1 Sin tabla nueva — usar `shipment_events`

**Por qué:** la info que necesitamos (cambio + fee + motivo + timestamp + autor)
ya cabe en una fila de `shipment_events` con nota estructurada. No vale crear
tabla nueva para 1 caso de uso del Tracking sin un reporte explícito que la
requiera.

**Trade-off:** queries agregadas (total fees por mes) requieren parsear notas
con regex. Cuando Facturación lo necesite, se hace migration de promotion a
tabla dedicada — el formato `note` ya está diseñado para ser parseable.

### 5.2 Sugerencia automática del fee

El input del fee tiene placeholder + helper text. Al typear el nuevo
destino (debounced 400ms), se llama un endpoint o helper:

- Si existe rate `(service, new_dest)` activa: helper muestra
  `Tarifa registrada: $480/CBM (LCL Yiwu→Caracas). Sugerencia fee: $120 (diferencia con $480 → $600)`
- Si no existe: helper muestra `Sin tarifa registrada para esta ruta. Definí
  el fee manualmente.`

El operador SIEMPRE puede sobrescribir el fee. La sugerencia es solo guidance.

### 5.3 Fee mínimo = 0 (permitido)

Caso de uso real: typo en la dirección original. Operador corrige a sin costo
(`fee = 0`). Nota dirá `[Cambio de destino · sin costo]`.

### 5.4 Motivo obligatorio (≥5 chars)

Forzar trazabilidad. "ok" o "x" no sirve. 5 chars permite "typo" o "cliente"
pero rechaza basura.

### 5.5 No multi-step wizard

UX simple — un modal con form. La acción es operativa, no merece wizard.

### 5.6 Estado del envío NO cambia

El cambio de destino NO transiciona el estado. El envío sigue en el status
que tenía (`in_warehouse`, `shipped`, etc.). Solo se actualiza `destination`
y se inserta evento informativo.

### 5.7 Visible solo en estados no terminales

Botón oculto si `status in (delivered, cancelled)`. Un envío entregado no
puede re-rutearse. Si hubo error post-entrega, es retorno (otro feature).

### 5.8 Confirmación inline antes de submit

Al click "Cambiar destino" del modal, NO submitea directamente. Muestra
chip resumen:
> Vas a cambiar **Valencia → Maracaibo** y cobrar **$80.00**.
> Motivo: _Cliente movió oficina_
>
> [Confirmar] [Volver]

Evita clicks accidentales. Patrón ya usado en FooterActions (cancel/delete).

---

## 6. Criterios de aceptación

### Funcional
- [ ] Botón "Cambiar destino" visible en detalle del envío SI no es terminal
- [ ] Botón oculto si `status in (delivered, cancelled)`
- [ ] Modal abre con destino actual pre-cargado en read-only context
- [ ] Al typear el nuevo destino, sugerencia automática del fee (debounced)
- [ ] Submit con motivo < 5 chars muestra error de campo
- [ ] Submit con fee negativo muestra error
- [ ] Confirmación inline obligatoria antes de hacer el cambio real
- [ ] Después del submit, el detalle muestra el nuevo destino
- [ ] El timeline muestra evento con nota estructurada
- [ ] El modal se cierra y revalidatePath refresca la vista

### Sistema
- [ ] `pnpm typecheck` pasa
- [ ] Cero hex literales nuevos
- [ ] Light + dark theme funcionan
- [ ] No regresión en otros campos editables del envío

---

## 7. Out of scope / open questions

- **¿Notificación al cliente del cambio?** No automática. El operador
  contacta por WhatsApp como hoy. Si llega Portal Cliente (SDD-0034), ahí
  notificamos.
- **¿Aprobación del cliente requerida?** No. Se asume que el operador ya
  habló con el cliente y este SDD solo registra el cambio operativo. Si el
  negocio quiere flow de aprobación, SDD futuro.
- **¿Múltiples cambios en cascada?** Sí, permitido. Cada cambio es un evento
  independiente. El timeline muestra el orden completo. El total de fees es
  la suma de todos los eventos parseando notas.
- **¿Edición de un cambio ya registrado?** No. Los eventos del timeline son
  inmutables (audit log). Si se equivocó el fee, agregar otro evento con
  nota de corrección.
