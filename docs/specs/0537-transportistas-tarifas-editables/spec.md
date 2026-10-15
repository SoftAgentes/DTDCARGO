---
sdd: "0537"
title: "Tarifario de transportistas editable por ciudad, con rutas y auditoría"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-10-15
updated: 2026-10-15
supersedes: null
superseded_by: null
related: ["0236", "0237", "0498", "0174"]
confidencialidad: interno
---

# SDD-0537 · Tarifario de transportistas editable por ciudad

## Pedido

Sam, 2026-10-15, literal: «En la parte de la calculadora hay una sección que se
llama transportistas. Tienen un precio o cotización, pero parece que los precios
cambiaron, entonces quiero poder editar las ciudades de ese transportista en
específico. Necesito que reestructures cómo está hecho y me permita editar los
precios. Por ejemplo, el costo de ese transporte es 80 y nosotros lo vendemos en
123, pero cambiaron algunas rutas y también algunos precios, así que necesito la
opción de poder editarlo.»

Ubicación: Studio › Administración › PRO › Calculadora pública › Transportistas.

Prioridad (Sam, 2026-10-15, vía coordinador): «Autorizo para que avancemos con
esta edición de la calculadora y darle preferencia, ya que acaban de cambiar los
precios y hay clientes cotizando en ella». Entrega por fases: la fase 1 primero.

## Estado medido antes del cambio

- `TransportistasPanel.tsx` pinta el tarifario **de solo lectura**: sólo usa
  `setDefaultCarrierAction`.
- `carrier-actions.ts` ya tiene `saveTariffAction` y `deleteTariffAction` con el
  gate `tenantAdminGate` (SDD-0498), pero ninguna pantalla las llama.
- `saveTariffAction` en modo edición hace `update(...).eq("id", id)` sin
  `.select()`: si la RLS o un borrado previo deja cero filas, devuelve `ok` sin
  haber guardado nada. Lo mismo `deleteTariffAction`.
- `carrier_tariffs` (0330) **no tiene auditoría**. Sus vecinas de la misma
  sección, `calculator_settings` y `calculator_cities`, sí la tienen desde 0293
  (`audit_d5_residual_change`, dominio `configuration`).

## Decisión

### Fase 1 — editar, agregar y quitar (prioridad)

1. **Editar por ciudad.** Cada fila del tarifario del transportista
   seleccionado se abre en un panel lateral (mismo patrón que la pestaña
   Ciudades) con: costo /m³, venta /m³ y el **margen en vivo** (resta), cada
   cuántos días sale, días/frecuencia literal, tránsito, mínimo por despacho,
   venta en ft³ de referencia, condiciones y vigencia. Guardar refresca la
   tabla y `/tarifas` sin deploy (`revalidarTodo`).
2. **Agregar una ciudad** que el transportista no tiene: se escoge de
   `calculator_cities` (sólo las que todavía no tienen tarifa viva con él),
   nunca se escribe un slug. El servidor vuelve a comprobar que la ciudad existe
   y está viva.
3. **Quitar una ruta** con `ConfirmDialog`: borrado en blando (`deleted_at`),
   igual que la acción existente. La web deja de cotizar esa ciudad con este
   transportista y deriva al asesor.
4. **Escrituras honestas.** Editar y quitar exigen que la fila exista, sea del
   transportista indicado y esté viva; si el `update` toca cero filas, la acción
   lo dice en vez de devolver `ok`.

### Fase 2 — cambio en lote (si no retrasa la fase 1)

Seleccionar varias ciudades y poner **un valor absoluto nuevo** de costo y/o de
venta, con una vista previa antes/después (y el margen resultante) antes de
guardar. Un solo `UPDATE` con `in(id)`: o cambian todas o ninguna. **No hay
multiplicador automático de la venta sobre el costo** (SDD-0236).

### Lo que NO cambia

- La venta no se deriva del costo; el margen es una resta (SDD-0236).
- La RLS de 0330 (lectura por tenant, escritura sólo admin vivo) y el gate de
  aplicación `tenantAdminGate` (SDD-0498) se reutilizan tal cual.
- La RPC anon `public_carrier_tariffs` no cambia: sigue sin exponer costo ni
  identidad del transportista.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| AUD-01 | **no conformidad** en el estado actual → se corrige con 0490 | §2 (`aud-01.md:27`): «cambios de permisos, roles, acceso, **configuración sensible** y credenciales» son eventos obligatorios. §1 (`aud-01.md:15`): mutación y evento son una sola operación. §7 (`aud-01.md:115-116`): cada flujo nuevo o modificado vuelve a pasar el contrato. El precedente de la misma sección (`0293:48-49`, `0293:511`) clasifica `calculator_settings`/`calculator_city` como `configuration` y las audita. `carrier_tariffs` fija el precio que cotiza la web pública y no tiene trigger de auditoría. |
| AUD-02 | no aplica | No cambia quién consulta, retiene ni exporta la bitácora. |
| MP-01 | cumplimiento | Quitar ruta = borrado en blando reversible (se puede volver a agregar la ciudad); confirmación explícita; evento `carrier_tariff_deleted` con motivo fijo, igual que `calculator_city_deleted` en 0293. |
| BTN-01 | cumplimiento | Una acción primaria por superficie (Guardar en el panel), destructiva separada y con confirmación. |
| SGE-00 | cumplimiento | Permiso en servidor y en la base; el cliente nunca ve el costo. |
| FRM-01 / ERR-01 | cumplimiento | Errores por campo del validador existente; error general en `role="alert"`. |
| NUM-01 | ver evidencia de implementación | Montos con coma o punto (`parseMonto`). |
| A11Y-01 | cumplimiento | Panel con foco y nombre accesible; checkboxes con etiqueta por ciudad. |
| CMP-01 | cumplimiento | `DrawerShell`, `ConfirmDialog`, `Badge`, `EmptyState` existentes; ningún `deprecated`. |
| Resto (BUS, CRT, DND, CAL, DAT, PRG, WIZ, UPL, IA, LNK, HTD, VIS-02, MOT, LOD, TBL, ICO, PLG) | no aplica / sin cambio | Sin búsqueda predictiva, arrastre, fechas operativas, archivos, IA ni flujos por pasos nuevos. |

### Migración 0490 — NO APLICADA

`supabase/migrations/0490_carrier_tariffs_auditoria.sql` agrega el tipo de
entidad `carrier_tariff` y un trigger `AFTER INSERT OR UPDATE` sobre
`carrier_tariffs` que llama al writer AUD-01 real (`append_audit_event`, 0294)
en la misma transacción, con actor `auth.uid()`, antes/después de costo, venta,
ft³, mínimo, frecuencia, tránsito, condiciones y vigencia. No toca filas, no
cambia la RLS, no modifica `audit_d5_residual_change` (función propia).

- **Orden:** migrate-first compatible. El trigger audita igual las escrituras
  del código desplegado hoy, así que se puede aplicar antes del merge.
- **Aplicar exige OK nominal de Sam** nombrando `0490_carrier_tariffs_auditoria`
  y el runbook `docs/runbooks/aplicar-migraciones-prod.md`. Fusionar la PR no
  autoriza aplicarla.

## Allowlist

- `app/studio/(app)/admin/_components/calculator/TransportistasPanel.tsx`
- `app/studio/(app)/admin/_components/calculator/TariffDrawer.tsx` (nuevo)
- `app/studio/(app)/admin/_components/calculator/CalculatorSection.tsx`
- `app/studio/(app)/admin/_components/calculator/__tests__/TransportistasPanel.test.tsx` (nuevo)
- `app/studio/(app)/admin/page.tsx` (sólo `?tab=transportistas`)
- `app/studio/(app)/admin/carrier-actions.ts`
- `app/studio/(app)/admin/__tests__/carrier-tariff-actions.test.ts` (nuevo)
- `lib/studio/freight-carriers/types.ts`
- `lib/studio/__tests__/freight-carriers-types.test.ts`
- `supabase/migrations/0490_carrier_tariffs_auditoria.sql` (nuevo, NO APLICADA)
- `supabase/tests/0490_carrier_tariffs_auditoria.test.sql` (nuevo)
- `lib/studio/__tests__/carrier-tariffs-auditoria.migration.test.ts` (nuevo)
- `supabase/migrations-baseline.json` (espera declarada de 0490)
- `docs/specs/0537-transportistas-tarifas-editables/spec.md`, `docs/specs/README.md`
- `.agents/handoffs/0537-transportistas-tarifas-editables.md`

## Aceptación

1. Un admin edita costo y venta de una ciudad y ve el margen recalculado antes
   de guardar; al guardar, la tabla y `/tarifas` muestran el valor nuevo.
2. Un admin agrega una ciudad eligiéndola de una lista; no aparecen las que ya
   tienen tarifa viva con ese transportista.
3. Un admin quita una ruta sólo después de confirmar; la fila desaparece.
4. Editar o quitar una tarifa inexistente, borrada o de otro transportista
   devuelve error y no `ok`.
5. Con 0490 aplicada, cada alta, edición y retiro deja un evento AUD-01 con
   antes, después y actor; si el writer falla, la escritura se revierte.
