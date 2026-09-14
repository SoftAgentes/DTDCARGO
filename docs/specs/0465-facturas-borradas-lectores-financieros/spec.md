---
sdd: "0465"
title: "Facturas borradas fuera de los lectores financieros"
status: done
author: "Claude"
created: 2026-09-14
updated: 2026-09-14
supersedes: null
superseded_by: null
related: ["0021", "0041", "0053", "0114", "0137", "0306", "0353", "0358"]
confidencialidad: interno
---

# SDD-0465 — Facturas borradas fuera de los lectores financieros

> Una factura con `deleted_at` no cuenta, no se cobra y no recibe recordatorios en Studio;
> y el borrado lógico sólo acepta borradores. Sin migración: la RLS dejó ese filtro en la
> capa de aplicación a propósito (0230).

## Contexto

- `0077_invoices.sql` creó `invoices` con `deleted_at` (línea 47) y una policy FOR ALL que
  filtraba `deleted_at is null` (línea 117). `0230_fix_rls_soft_delete_blocked` quitó ese
  filtro del USING porque bloqueaba el propio soft delete para cualquier usuario, y dejó
  escrito que «el filtro de "no mostrar borrados" ya lo hace la capa de aplicación en
  cada query (`.is("deleted_at", null)` en `lib/studio/*-queries.ts`)». Para facturas eso
  era cierto en Fiscal, Reportes, Rendiciones, `duplicateInvoice` y el Portal, pero no en
  los lectores que suman, cobran y escriben.
- Hallazgo preexistente registrado en `.agents/handoffs/c-l07-fidelizacion-conversations.md`
  (líneas 1204-1208): `listInvoices`, `getInvoiceByCode`, `invoiceKpis`, `receivablesQueue`,
  `financeInvoiceKpis`, `revenueByShipment` y `applicableInvoicesForReferrer` leían
  facturas borradas, y `softDeleteInvoice` no restringía el estado, así que una factura
  emitida y borrada podía seguir contando o recibir recordatorios. 0414 conserva esa
  lectura para `accounting` y `admin`.
- La UI sólo expone «Eliminar» en el drawer de edición, que se abre cuando
  `isEditable(status)` (`lib/studio/invoice-types.ts:275`, sólo `borrador`). La action
  acepta cualquier id y no comprobaba nada: la regla no existía en el servidor.
- No existe vista de papelera ni acción de restaurar para facturas (medido con grep sobre
  `app/studio` y `lib/studio`).

## Alcance

Allowlist exacta:

| Archivo | Cambio |
|---|---|
| `lib/studio/invoice-queries.ts` | `listInvoices`, `getInvoiceByCode`, `invoiceKpis` piden `deleted_at is null` |
| `lib/studio/payment-queries.ts` | `receivablesQueue` pide `deleted_at is null` |
| `lib/studio/dashboard/dashboard-kpi-queries.ts` | `financeInvoiceKpis` pide `deleted_at is null` |
| `lib/studio/costing/queries.ts` | `revenueByShipment` pide `deleted_at is null` |
| `lib/studio/fidelizacion/referral-credit-queries.ts` | `applicableInvoicesForReferrer` pide `deleted_at is null` |
| `app/studio/(app)/facturacion/actions.ts` | `softDeleteInvoice` sólo acepta `borrador`, con mensaje y guardas de carrera |
| `scripts/__tests__/invoice-read-boundary.test.mjs` | el inventario de callers de `invoices` (SDD-0357) suma la lectura previa de `softDeleteInvoice`: 11 en `facturacion/actions.ts`, 46 en total. Fuera de la allowlist asignada; reparación necesaria de esta tarea, ver «Revisión del caller nuevo» |
| Tests de cada lector y de la action | un caso de regresión por lector con una factura borrada en el fixture |
| Esta spec, `docs/specs/README.md` y `.agents/handoffs/facturas-borradas-lectores-financieros.md` | documentación |

Fuera de alcance: RLS y migraciones (0230 y 0414 no se tocan; sin SQL nuevo); Portal y
`lib/portal`; la PR #21; `supabase/migrations-baseline.json`; la UI del drawer; los demás
lectores de `invoices` listados en «Riesgos y límites».

## Decisión

### Los lectores filtran en la consulta, no en memoria

Cada lector agrega `.is("deleted_at", null)` a su query sobre `invoices`. Es la misma forma
que ya usan `lib/studio/fiscal/queries.ts:220`, `lib/studio/reports/queries.ts:233` y
`lib/studio/renditions/queries.ts:126`, y es la que 0230 dio por hecha. Filtrar en la base
y no después del `fetchAllPaged` mantiene el tope de lectura sobre filas vivas.

| Lector | Qué alimenta | Efecto de una factura borrada, ahora |
|---|---|---|
| `listInvoices` | listado de Facturación, estado de cuenta del cliente, export comercial, búsqueda global | no se lista en ninguna pestaña |
| `getInvoiceByCode` | detalle `/studio/facturacion/[code]` y su PDF | `null` → `notFound()` / 404 |
| `invoiceKpis` | 3 KPI cards de Facturación; Reportes (0052) los reusa | no suma a facturado, por cobrar ni vencido |
| `receivablesQueue` | cola de Cobranzas, `collectionKpis`, aging de Reportes, export operativo, recordatorios | ver la sección siguiente |
| `financeInvoiceKpis` | bundle de finanzas del tablero (0114) | no suma al mes, no cuenta como vencida, no es saldo ni ticket |
| `revenueByShipment` | costeo y margen por embarque (0053) | no es ingreso del embarque |
| `applicableInvoicesForReferrer` | picker del crédito de referido (0137) | no se ofrece aunque tenga saldo |

### Efecto en Cobranzas y en los recordatorios (contrato compartido)

`receivablesQueue` es la única fuente de `previewRecordatorios` y `enviarRecordatorios`
(`app/studio/(app)/cobranzas/actions.ts:258` y `:309`, SDD-0306). Con el filtro:

- una factura borrada no entra a la cola, así que no cuenta en `collectionKpis`, no sale en
  el export operativo ni en el aging de Reportes;
- no entra a `seleccionarParaRecordatorio`: no es destinataria y **tampoco aparece como
  omitida**, porque para el criterio no existe;
- `intersectarPedido` la descarta aunque el navegador mande su código; el servidor sólo
  acota sobre la cola viva;
- `contextoDeEnvio` (SDD-0353) recibe la cola ya filtrada, así que la RPC
  `collections_mail_context` sólo se consulta por ids de facturas vivas. No cambia la RPC,
  ni 0410 ni 0415 (SDD-0358).

Esto cambia a quién se le escribe: sólo a clientes con facturas vivas con saldo vencido.
Es el resultado buscado y está probado en `lib/studio/__tests__/receivables-queue.test.ts`.

### Regla de borrado lógico: sólo `borrador`

`softDeleteInvoice` lee la factura, rechaza con mensaje cuando no procede y, si procede,
escribe `deleted_at` con las mismas condiciones en el UPDATE (`status = 'borrador'` y
`deleted_at is null`): si la factura se emitió entre la lectura y la escritura, el UPDATE
no matchea y no se borra una emitida.

| Estado leído | Respuesta |
|---|---|
| `borrador` | `deleted_at = now()`; revalida el listado y el detalle |
| `emitida`, `parcial`, `pagada`, `vencida` | «Solo las facturas en borrador pueden eliminarse. Esta está *estado*: si no corresponde, anúlala con un motivo y queda registrada.» Sin escribir. |
| `anulada` | «Esta factura ya está anulada y se conserva como registro; no se elimina.» Sin escribir. |
| ya con `deleted_at` | «Esta factura ya está eliminada.» Sin escribir. |
| no encontrada (o fuera del tenant por RLS) | «Factura no encontrada.» |
| el UPDATE condicionado no matchea | «La factura cambió de estado mientras se eliminaba; recarga y revisa antes de intentarlo otra vez.» Sin revalidar. |

Evidencia de la regla:

1. **MP-01 v1.1** (`docs/governance/policies/mp-01.md`). §2: P2 «Marca `deleted_at`,
   conserva identidad y referencias. Requiere política de restauración y no puede
   reutilizar identificadores», y «`deleted_at` no demuestra por sí solo que P2 esté bien
   aplicado. Un registro financiero puede tener esa columna y aun así necesitar P3 cuando
   ya fue emitido o asentado». §4: evidencia contable o registro que ya produjo documentos
   o movimientos → P3; borrador no emitido y sin dependencias → P2. §5, familia
   «Facturación y contabilidad»: «Borrador: P2/R2. Emitido o asentado: P3/R3».
2. **Una emitida ya produjo hechos.** Emitir asienta la venta
   (`postInvoiceJournalEntry`, SDD-0040, desde `emitInvoice` y `createInvoice` con
   emisión); cobrar crea recibos y asientos (SDD-0041/0068) y sube `paid_amount`; un
   crédito de referido aplicado (SDD-0137) baja la CxC; el libro de ventas (SDD-0073) lee
   `SALE_STATUSES = emitida | parcial | pagada | vencida`. Ocultarla con `deleted_at`
   dejaría el mayor, los recibos y el libro apuntando a una factura que ningún lector
   muestra.
3. **El camino P3 ya existe.** `voidInvoice` usa `void_invoice_with_audit_reason`
   (`0294_audit_d2_human_reasons.sql:143-170`): exige motivo de 4 a 1000 caracteres, sólo
   pasa de un estado distinto de `pagada`/`anulada`, conserva el original y la action
   revierte los créditos de referido. Una `anulada` es ese resultado: se conserva visible.
4. **Identificadores.** `next_invoice_code` (`0077_invoices.sql:63-82`) toma el máximo
   sobre todas las filas del tenant sin mirar `deleted_at`: el código de un borrador
   eliminado no se reutiliza. Un borrador nunca entró al libro de ventas, así que su hueco
   en el correlativo no es un hueco fiscal.
5. **Auditoría.** El UPDATE de `deleted_at` pasa por el trigger de dominio D2
   (SDD-0174) como cualquier mutación de `invoices`; no se agrega un evento manual.

### Revisión del caller nuevo (inventario SDD-0357)

`scripts/__tests__/invoice-read-boundary.test.mjs` congela cuántas veces cada archivo de
producción llama `.from("invoices")` y exige que un caller nuevo se revise por guard y
tenant. La lectura previa de `softDeleteInvoice` es ese caller:

- **Guard:** corre después de `moduleEditDenial(supabase, "invoices")`, el mismo gate de
  edición que ya protegía el UPDATE; sin permiso no se lee nada (probado).
- **Tenant:** usa el cliente de sesión (`createClient`), bajo la RLS de equipo de
  `invoices`; con 0414 aplicada, la policy `invoices_accounting_select`. Una factura de otro
  tenant responde «Factura no encontrada.».
- **Columnas:** `id, status, invoice_code, deleted_at`. Sin montos ni datos del cliente.
- **Propósito:** decidir el mensaje antes del UPDATE condicionado. No es un lector de
  negocio ni una vía nueva de lectura para otro rol.

El inventario pasa de 10 a 11 en `facturacion/actions.ts` y de 45 a 46 en total. Ningún
otro archivo cambia su conteo: los lectores de esta SDD agregan un filtro, no una llamada.

### Lo que esta SDD no resuelve

- **Restauración.** MP-01 exige política de restauración para P2 y hoy no hay papelera ni
  acción de restaurar facturas. Un borrador eliminado sólo vuelve por SQL. Queda registrado
  como deuda en el handoff; no se inventa una papelera en esta tarea.
- **Filas ya borradas con estado distinto de `borrador`.** Si existen en producción (no se
  leyó ninguna fila), desde este cambio dejan de contar, cobrarse y recordarse, que es el
  objetivo. Si el equipo necesitara rescatar alguna, aplica el punto anterior.

## Validación

Un test de regresión por lector, con una factura borrada en el fixture. Los dobles de
Supabase **aplican** `is("deleted_at", null)` sobre las filas, como PostgREST: si alguien
quita el filtro del lector, la borrada vuelve a entrar y la prueba cae. Donde el fixture
lo permite hay un control del propio doble (la misma fila con `deleted_at: null` sí entra).

| Archivo | Casos |
|---|---|
| `lib/studio/__tests__/invoice-queries.test.ts` | `listInvoices` no la lista en `all` ni en `overdue` y pide el filtro; `getInvoiceByCode` devuelve `null`; `invoiceKpis` no la suma |
| `lib/studio/__tests__/receivables-queue.test.ts` (nuevo) | la cola la excluye aunque esté más vencida; pide `deleted_at is null` y `status ≠ anulada`; no lee sus gestiones; `collectionKpis` no la cuenta; el recordatorio no sale ni la lista como omitida; `intersectarPedido` la descarta; control del doble |
| `lib/studio/dashboard/__tests__/dashboard-kpi-queries.test.ts` (nuevo) | no suma al mes, no cuenta vencida, no es saldo ni ticket; sola → «sin facturas»; control del doble |
| `lib/studio/costing/__tests__/queries.test.ts` | no es ingreso del embarque; un embarque cuya única factura está borrada queda sin ingreso |
| `lib/studio/fidelizacion/__tests__/referral-credit-queries.test.ts` | no se ofrece aunque tenga saldo y el filtro va a la base |
| `app/studio/(app)/facturacion/__tests__/soft-delete-invoice.test.ts` (nuevo) | borrador: escribe, guardas en el UPDATE, revalida; sin match → error; error de base; `emitida/parcial/pagada/vencida` → mensaje y sin escribir; `anulada` → mensaje propio; ya eliminada; no encontrada; error de lectura; rechazo RBAC sin leer |

Ningún test existente cambia de aserción: los dobles ganan `is()` (y `eq`/`maybeSingle`
donde hacía falta) para seguir siendo compatibles con la cadena real.

Comandos y veredictos por paso están en el handoff de la tarea:
`corepack pnpm exec vitest run` focal y completo, `corepack pnpm exec eslint` focal,
`corepack pnpm typecheck`, `corepack pnpm docs:check`, `corepack pnpm sdd:check` y
`E2E_PORT=3101 corepack pnpm verify`.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| MP-01 | cumplimiento | P2 sólo para borradores; emitidas y asentadas van por P3 (`voidInvoice`); el correlativo no reutiliza identificadores. Restauración P2 pendiente, declarada arriba. |
| SGE-00 | cumplimiento | «Eliminar» conserva un solo significado (borrador); cuando no procede, responde con el motivo y no escribe; nada se pierde en silencio. |
| AUD-01 | cumplimiento | La mutación sigue auditada por el trigger de dominio D2 (SDD-0174); el rechazo no muta nada. |
| BTN-01 | no aplica | No cambia botones, etiquetas ni confirmaciones. |
| AUD-02 | no aplica | No hay consulta ni exportación nueva de logs. |

## Riesgos y límites

- Lectores de `invoices` fuera de esta allowlist que siguen sin filtrar `deleted_at`
  (medidos con grep, no modificados): `lib/studio/collections-actions.ts:106`, `:379` y
  `:525` (registrar/identificar/anular cobro, lookup por id); `app/studio/(app)/cobranzas/actions.ts:164`
  (`logActivity`, lookup por id); `app/studio/(app)/cobranzas/recibo/[code]/page.tsx:119`
  (factura del recibo); `app/studio/(app)/fidelizacion/actions.ts:388` (`applyReferralCredit`,
  lookup por id); `lib/studio/accounting/referral-credit-posting.ts:354` (reversión por id,
  cliente admin); `lib/studio/kommo-contact-status.ts:215` (estado de contacto, cliente admin);
  `lib/studio/costing/queries.ts:510` (`latestVesFxRate`); `lib/studio/renditions/queries.ts:308`
  y `:479` (resolver códigos por id). Los lookups por id sólo reciben ids que salen de
  lectores ya filtrados o de recibos existentes; ninguno agrega, cobra ni escribe correo
  por sí solo. Se registran como FUERA DE ALCANCE en el handoff.
- `app/studio/(app)/facturacion/_components/InvoiceDrawer.tsx:766` sólo actúa sobre
  `result.ok`: si el servidor rechaza el borrado, el drawer no muestra `result.error`. La
  UI sólo llega ahí con borradores, así que el caso real es una carrera (emitida en otra
  pestaña). Es UI no asignada; se registra como hallazgo.
- Este cambio no toca RLS: un cliente PostgREST directo con rol `accounting` sigue viendo
  filas borradas, como desde 0230. Cerrarlo en SQL sería otra SDD con migración.
