# REV-SGE-039 · Muestreo operativo R3

| Control | Valor |
|---|---|
| Fecha | 2026-07-31 |
| Fuente normativa | LB-SGE-104 / REV-SGE-029 |
| Módulos | Almacén VE, Naviera, TMS, Despacho, Reclamos, Inspecciones |
| Método | Read-only, una acción representativa por módulo |
| Mutaciones de producto | Ninguna |

## Alcance

El muestreo recorrió UI, Server Action, validación, tablas/RPC, evidencia y
tests de una acción R3 por módulo. No promueve ningún módulo completo a `VA` y
no generaliza hallazgos a acciones que no fueron leídas.

## Matriz de acciones

| Módulo | Acción | Evidencia | Clasificación |
|---|---|---|---|
| Almacén VE | Marcar entregado | El modal admite receptor POD opcional; `transitionStatus` lee estado, hace `UPDATE` sin precondición concurrente, inserta timeline best-effort y no usa `moduleEditDenial` (`VeRowActions.tsx:99-158`; `actions.ts:24-76,124-145`). | no conformidad |
| Naviera | Autorizar consolidación | `ActionButton` ejecuta en un clic. La action valida módulo, tenant y estado y actualiza con `status=solicitada`, pero quema correlativo antes, no comprueba fila afectada y no deja AUD-01 (`NavieraClient.tsx:738-758`; `actions.ts:568-635`). | no conformidad con controles parciales |
| TMS | Completar ruta | No se localizó consumidor UI. La Server Action exportada actualiza ruta sin estado esperado y luego libera vehículo/conductor, mueve shipment e inserta timeline ignorando los cuatro errores (`actions.ts:298-356`). | no conformidad; UI no verificable |
| Despacho | Cancelar OD | Drawer y validator exigen motivo; la DB bloquea salida de terminales. La action no fija estado esperado, actor ni AUD-01; RLS permite `UPDATE` por tenant sin capability (`CancelOdDrawer.tsx:1-91`; `actions.ts:252-282`; `0024_dispatch_core.sql:641-720`). | no conformidad con controles parciales |
| Reclamos | Marcar indemnización pagada | Action y trigger DB restringen a accounting/admin y revisan cierre contable. La nota es opcional, el `UPDATE` no fija estado esperado y el asiento corre best-effort después del pago (`ReclamosClient.tsx:695-748`; `actions.ts:219-299`; `0156_client_claims_financials.sql:1-67`). | no conformidad crítica |
| Inspecciones | Eliminar reporte | Confirmación inline de dos clics y gate de módulo; soft-delete sin motivo, actor, estado esperado, AUD-01 ni comprobación de fila afectada (`InspeccionesClient.tsx:488-539`; `actions.ts:220-240`). | no conformidad |

## Políticas

| Política | Resultado del muestreo |
|---|---|
| SGE-00 | no conformidad: VE, TMS y Reclamos pueden divergir después del éxito visible |
| MP-01 | no conformidad: gates en actions no cierran el bypass PostgREST de varias tablas |
| BTN-01 | cumplimiento parcial: pending existe; Naviera y Reclamos ejecutan R3 desde el primer clic |
| HTD-01 | no conformidad en las acciones irreversible/financieras observadas |
| AUD-01 | no conformidad: falta actor+motivo+resultado atómico por decisión |
| ERR-01 | no conformidad: varios errores secundarios se ignoran y otros exponen DB cruda |
| FRM-01 | cumplimiento acotado en cancelación de OD; nota de pago y borrados no son obligatorios |
| LOD-01 | cumplimiento parcial en consumidores con `ActionButton`/transition pending |
| UPL-01 | excepción: evidencia/fotos existen, pero Storage no se auditó en este muestreo |
| A11Y-01 | no verificable sin navegador autenticado |

## Evidencia automatizada

- 29/29 tests existentes pasaron entre autorización/rechazo de Naviera y tipos
  de Reclamos.
- Los siete tests de Naviera prueban gate, tenant, estado y payload; no prueban
  carrera de cero filas, correlativo quemado, DB role ni AUD-01.
- Los tests de Reclamos son puros; no ejercitan pago + asiento ni fallos
  parciales.
- No se localizaron tests focales de las acciones seleccionadas de VE, TMS,
  Despacho o eliminación de Inspecciones.

## Orden de slices mínimos

1. **Reclamos · pago de indemnización.** RPC transaccional con estado esperado,
   motivo, request ref, journal entry y AUD-01; `ConfirmDialog` R3.
2. **TMS · completar ruta.** Ruta, recursos, shipment, timeline y auditoría en
   una transacción; decidir primero si la acción debe exponerse en UI.
3. **Almacén VE · entrega.** Unificar con POD sellado y evitar timeline
   best-effort; no duplicar la liberación SENIAT ya gobernada por SDD-0228.
4. **Naviera · autorización.** Correlativo + transición + auditoría atómicos,
   con replay y confirmación.
5. **Inspecciones · retiro de reporte.** Motivo, actor, confirmación canonical y
   política explícita para fotos.
6. **Despacho · cancelación.** Conservar el motivo existente y mover capability,
   estado esperado y AUD-01 a DB.

## Allowlist propuesta para el siguiente slice

- `docs/specs/<siguiente>-reclamos-pago-indemnizacion-gobernado/spec.md`
- `app/studio/(app)/reclamos/actions.ts`
- `app/studio/(app)/reclamos/_components/ReclamosClient.tsx`
- `lib/studio/reclamos/claims-types.ts`
- helper/query y tests focales dentro de `lib/studio/reclamos/`;
- una migración nueva y su contrato SQL;
- mapa/índices documentales y recibo de implementación.

## Bloqueos

Ninguno para diseñar y validar localmente el slice de Reclamos. Aplicar una
migración, usar Cloud/Producción, integrar a `main` o ejecutar navegador con una
sesión autenticada conservan gates separados.
