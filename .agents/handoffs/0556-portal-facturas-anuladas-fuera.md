# Handoff · SDD-0556 · El portal dice la verdad: las facturas anuladas no son deuda

| Campo | Valor |
|---|---|
| Fecha | 2026-10-18 en Caracas (UTC 2026-10-19, hasta las 02:40 aprox.) |
| Task ID / owner | `contabilidad-2026-10-18` / sesión Worker «Contabilidad» del worktree `quizzical-lehmann-d70032`; escrito por su subagente de la 0556 |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\quizzical-lehmann-d70032` |
| Rama | `claude/sdd-0556-portal-dice-la-verdad`, base `a7a51ad7` (la reserva, sobre `origin/main` `77035907`) |
| SDD | [0556](../../docs/specs/0556-portal-facturas-anuladas-fuera/spec.md), `in-progress`. Se conserva el slug de la reserva |
| Commits | `e249396d` (definición única de deuda y pantallas), `f61bf702` (lectura completa, Inicio y PDF del estado de cuenta), `41159273` (aviso al cliente) y el commit de docs con esta spec, el índice y este handoff |
| Estado | implementado y probado en el worktree; **sin push** |
| Permisos | Sam autorizó la fase 1 completa. Este encargo no incluye push, PR, merge, producción ni base de datos. `pnpm verify` necesita turno del Director |

## OBJETIVO ORIGINAL

Tarea 1.2 de la fase 1 del plan contable (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`), hallazgo **B14**: el portal mostraba las facturas anuladas como deuda, recortaba la lista a 100, el PDF del estado de cuenta salía sin el emisor correcto y el cliente no se enteraba cuando el equipo resolvía su reporte de pago. Decisiones D1–D14 de la Worker sobre el plan del diseñador y su crítica.

## COMPLETADO

- **Una sola definición de deuda** (`lib/portal/saldo-de-cuenta.ts`), usada por Inicio, Facturas, Finanzas, `?saldo=1`, el detalle, el comprobante y el ledger. Reemplaza tres copias que no coincidían.
- **La anulada se ve y no suma**: badge «Anulada» y monto tachado en la lista y las cards; fila «Factura F-… · anulada» en 0 en el estado de cuenta (pantalla y PDF); fuera de los KPIs, de `?saldo=1`, del saldo del detalle, del comprobante (pill «Anulada») y del PDF de la factura (saldo 0 y aviso «Factura anulada: no hay saldo por pagar.»).
- **Lo pagado en una anulada no desaparece y no se descuenta**: una sola nota (`notaPagosEnAnuladas`) en Facturas, Finanzas, la tabla del estado de cuenta y su PDF, con los pagos de **todas** las monedas, cada uno con la suya (D2). `mixedCurrencies` cuenta sólo monedas con facturas vigentes.
- **La anulada que nunca se emitió** queda fuera del portal, como un borrador (D1).
- **Lectura completa o «no sé»**: `listMyInvoicesForPrincipal` con `fetchAllPaged` y orden estable hasta `id`; `PortalInvoicesUnavailableError` ante error o lectura incompleta. Facturas y Finanzas caen en `error.tsx`; el PDF responde 503 privado; **Inicio no se cae** (D5): `invoicesAvailable: false` y «No disponible» en la portada.
- **PDF del estado de cuenta**: principal una sola vez, emisor con `getCompanyDataForTenant(admin, principal.tenantId)` después de probar el principal; razón social y RIF **apagados** con un comentario en la ruta y una prueba que fija que hoy no se pasan (D4).
- **Aviso al cliente** (D6): correo best-effort programado con `after()` sólo tras un recibo ok que no es replay; lee el reporte con la sesión, construye el admin sólo después; motivo escapado; sin saldo; no lee `invoices`.
- **Prueba de consumidores reescrita** (D7): el comando corre con la sesión; el aviso queda programado sin admin; el admin aparece recién al correr lo programado; un replay no programa otro.
- **Conteo de lecturas** (D11): la frontera pasa de 2 a 3 lecturas por la página vacía de `fetchAllPaged`; explicado en la prueba y en la spec. Los otros dobles que encadenan `from("invoices")` (`dashboard.test.ts`, `invoices.test.ts`) ganaron `range` por offset; ninguno contaba lecturas.

## DESVÍOS RESPECTO DEL PLAN Y LAS DECISIONES

1. **D1 extendido al detalle.** Además de `listMyInvoicesForPrincipal`, `getMyInvoiceForPrincipal` devuelve `null` para la anulada sin emitir: «se trata como un borrador: fuera del portal» implica el mismo 404 en detalle, PDF y comprobante. Con prueba en la frontera.
2. **`pagosEnAnuladas` es una lista, no un número** (D2 manda sobre el plan): `{code, reference, amount, currency}`. Por eso el ledger no tiene `totalVoidedPayments`: un total entre monedas no tiene sentido.
3. **`facturasPorPagar` cuenta en todas las monedas**, como ya hacía Inicio (el plan decía «todo sobre la moneda dominante»). Es un conteo; restringirlo habría bajado el «N facturas pendientes» de un cliente con dos monedas.
4. **El pill del comprobante pasó a `lib/portal/comprobante.ts`** (`estadoDelComprobante`) en vez de exportarse desde la página: Next no admite exports arbitrarios en un `page.tsx`.
5. **La nota no se repite en el estado de cuenta en pantalla**: con `?vista=cuenta` va sólo bajo el libro (`StatementLedgerTable`), no también bajo los KPIs.
6. **Hechos del plan corregidos al leer el código**: `PortalDashboardNorte` no tenía prueba propia (se creó); la cabecera de la ruta del PDF citaba `?vista=estado` y el parámetro real es `?vista=cuenta` (se corrigió el comentario); el control rojo del dashboard da 11299 de saldo (D14), y así quedó escrito.
7. **Una prueba agregada por un mutante que sobrevivía**: M18 (Inicio con su propio cálculo de saldo, sin recorte por factura) sobrevivió a la primera corrida; faltaba un caso de sobrepago en `dashboard.test.ts`. Se agregó y murió.

## VALIDACIÓN

Todo en este worktree y esta rama. Sin `pnpm verify`, sin vitest sin filtro y sin Docker (otro Worker tenía el turno de máquina).

| Comprobación | Alcance | Resultado |
|---|---|---|
| `vitest run` de las 18 pruebas de la tarea (las nuevas, las modificadas y `clientes/__tests__/estado-de-cuenta.test.ts`, que no se tocó) | puntual | PASÓ: `Test Files 18 passed (18)`, `Tests 237 passed (237)`, exit 0 |
| `vitest run lib/portal app/portal "app/studio/(app)/facturacion" "app/studio/(app)/clientes" lib/studio/pdf lib/studio/mail lib/studio/__tests__/payment-report-resolution-notify.test.ts scripts/__tests__/invoice-read-boundary.test.mjs` | carpetas vecinas, con el inventario SDD-0357 | PASÓ: `Test Files 140 passed (140)`, `Tests 1633 passed (1633)`, exit 0 |
| Mutantes (`scratchpad/mutantes-0556.mjs`; uno por vez, restaura en `finally`) | 11 reversiones al estado de la base + 51 mutantes de una línea | 62 de 62 MUERTOS con exit 1 y línea `Tests … failed`, tras agregar la prueba que mató a M18. Detalle abajo. `git status` después: sólo los cambios de la tarea |
| `corepack pnpm typecheck` | repo | PASÓ (exit 0) |
| `corepack pnpm exec eslint --max-warnings=0` | los 35 `.ts`/`.tsx` tocados | PASÓ (exit 0, sin salida) |
| `node scripts/build-docs-index.mjs` + `corepack pnpm docs:check` | índice | PASÓ: «índice sincronizado con 541 specs» |
| `corepack pnpm sdd:check` | numeración | PASÓ: «numbering: sin números repetidos» (avisa los choques históricos ya conocidos) |
| `corepack pnpm governance:check` | cápsula | PASÓ: «28 política(s) aprobada(s) · cápsula vigente» |
| `corepack pnpm components:check` | CMP-01 | PASÓ |
| `git diff --check` | diff | PASÓ |
| Inventario `invoice-read-boundary` | 42 llamadas / 18 archivos | PASÓ sobre la base de esta rama; **recalcular sobre main** (ver pendientes) |
| `/ui-check` | portal (Facturas lista y estado de cuenta, Finanzas, detalle, comprobante, portada) en claro y oscuro | NO EJECUTADO: necesita navegador y datos; queda pendiente |
| `corepack pnpm verify` | completo | NO EJECUTADO: sin turno del Director |
| Comprobación en el navegador | — | NO EJECUTADA |

### Control rojo, mutante por mutante

Reversiones (archivo de producción al estado de `a7a51ad7`, contra las pruebas nuevas): R1 lectura y PDF (14 fallos), R2 ledger (4), R3 Mis facturas (4), R4 Finanzas (2), R5 InvoiceRow (2), R6 detalle (2), R7 PDF de factura (3), R8 PDF de estado de cuenta (3), R9 acción del Studio (4), R10 portada (1), R11 tabla del estado de cuenta (1). Todas MUERTAS.

Mutantes de una línea, todos MUERTOS (entre paréntesis, los fallos):

- `saldo-de-cuenta`: M1 `saldoPorPagar` cuenta la anulada (7); M2 la dominancia pesa las anuladas (5); M3 «otras monedas» cuenta las anuladas (5); M4 lo facturado incluye anuladas (8); M5 lo pagado suma lo de anuladas (6); M6 pagos en anuladas sólo de la moneda dominante (4).
- ledger: M7 la anulada entra con su total (3); M8 vuelve a ser cargo + abono (4); M9 `totalCargo` cuenta anuladas (8); M10 `voidedPayments` sólo de la moneda del libro (1).
- lectura e Inicio: M11 lectura incompleta callada (1); M12 error devuelve `[]` (3); M13 anulada sin emitir en la lista (1); M14 anulada sin emitir abre el detalle (1); M15 Inicio se cae (1); M16 Inicio «disponible» con la lectura caída (1); M17 sin orden por `id` (1); M18 Inicio sin recorte por factura (1, tras agregar el caso de sobrepago); M19 la portada ignora `invoicesAvailable` (1).
- ruta del PDF: M20 sale 200 con la lectura caída (1); M21 emisor leído con la sesión (3); M22 pasa la razón social sin la excepción (1).
- pantallas: M23 `?saldo=1` con total − pagado (2); M24 vacío equivocado con `?saldo=1` (1); M25 tabla sin tachado (1); M26 Mis facturas sin nota (2); M27 nota repetida en el estado de cuenta (1); M28 Finanzas sin nota (2); M29 `InvoiceRow` con total − pagado (3); M30 sin tachado (1); M31 sin «Recibido» (1); M32 detalle con total − pagado (1); M33 detalle sin aviso (2); M34 tabla sin nota (1).
- comprobante: M35 anulada pagada como «pagada» (2); M36 pill sin «Anulada» (1); M37 saldo con total − pagado (2).
- PDFs: M38 anulada con saldo (2); M39 sin aviso (1); M40 estado de cuenta sin `emisorLines` (2); M41 sin nota (1).
- acción: M42 aviso también en replay (1); M43 aviso dentro de la acción, sin `after()` (3).
- aviso: M44 sin guarda de estado (1); M45 sin `escapeHtml` (2); M46 sin guarda de replay (1); M47 sin guarda de cancelación (1); M48 sin guarda de la factura (1); M49 admin antes de leer el reporte (5); M50 reporte sin acotar a la factura del recibo (1); M51 la confirmación lleva el motivo (1).

## Revisión de datos personales del correo nuevo

Revisión acotada al flujo nuevo con el procedimiento de `.claude/skills/revisar-datos-ve/SKILL.md` (no es la auditoría completa del repo):

- CORRECTO — el destinatario es el titular de la ficha del Shipping Mark del reporte, en el tenant del reporte: `lib/studio/payment-report-resolution-notify.ts:176` (`emailDelShippingMark`, que no le escribe a una ficha eliminada sin fusión).
- CORRECTO — el correo lleva sólo datos del propio reporte (factura, monto, método, fecha y, en el rechazo, el motivo); no lleva saldo ni datos de otras facturas: `payment-report-resolution-notify.ts:75-122`.
- CORRECTO — todo valor del HTML pasa por `escapeHtml`: `:96`, `:98`, `:106-107`, `:117`.
- CORRECTO — los registros (`console.warn`/`console.error`) llevan sólo el código de factura, nunca el correo ni el monto: `:178`, `:204`, `:206`; con prueba.
- CORRECTO — `test_mode` y lista negra del tenant los aplica `sendEmail`: `lib/studio/mail/send-email.ts:85` y `:130`.
- NO VERIFICABLE — retención de `mail_logs` (guarda destinatario y metadata, como todo correo del ERP): no hay política escrita en el repo para este caso.
- NO VERIFICABLE — que los clientes reales esperen o hayan aceptado este aviso: es un correo transaccional sobre su propio pago, pero el texto de consentimiento del portal no se revisó.

## Impacto documental y conocimiento

- Canónicos actualizados: la spec 0556 (completa, con allowlist exacta) y `docs/specs/README.md` (índice regenerado).
- No hay cambios de esquema, RBAC ni rutas nuevas: Graphify y Archify no cambian de forma. Obsidian: sin cambios. `knowledge:status` no se corrió en esta sesión (lo corre el Director al cerrar).

## PENDIENTES DE ESTA TAREA

1. **`origin/main` avanzó** a `cb9c62ae` (entraron la 0554 y la 0555). No toca archivos de esta rama salvo `docs/specs/README.md` (índice: resolver con el driver y regenerar). **Recalcular sobre el árbol fusionado** el inventario de `invoice-read-boundary` (la 0555 tocó `invoice-queries.ts`).
2. `/ui-check` del portal en claro y oscuro: el gris del monto tachado (`text-grey-500`) y las notas nuevas no se midieron en el portal oscuro; la tarjeta «No disponible» de la portada en móvil.
3. `corepack pnpm verify` con turno del Director.
4. Push de la rama y PR: no autorizados en este encargo.
5. Preguntas para Sam (también en la spec): la excepción de marca para el estado de cuenta (hoy apagada) y el texto de la nota de pagos en anuladas.

## FUERA DE ALCANCE DETECTADO

1. **H3 de B13 en el Studio** (D3): el estado de cuenta del Studio sigue filtrando las anuladas en `filasParaLedger`, así que una anulada con abono **desaparece** ahí, mientras el portal ya la informa. Va a la SDD-0558 o a la fase 5; la 0558 debería usar `resumenDeCuenta`/`pagosEnAnuladas` para no volver a dos definiciones de saldo.
2. **Reportes pendientes sobre una anulada quedan atascados** (D12): `0464_reporte_pago_factura_pagada.sql` rechaza con `PAYMENT_STATE` toda operación (crear, cancelar, confirmar y rechazar) si la factura está anulada. Ese reporte no se puede cerrar, el aviso nunca sale y el portal lo muestra en revisión para siempre. Pide migración.
3. `getCompanyData` resuelve el tenant con `user_tenants` `limit(1)` sin filtro (`lib/studio/company-queries.ts`): cualquier otro consumidor con sesión híbrida puede recibir los datos de otro tenant. Hay que inventariar sus llamadores.
4. `listMyShipments` corta en `.limit(100)` (`lib/portal/portal-queries.ts`) y alimenta «Envíos activos» y «Entregados» de Inicio: otro tope silencioso.
5. `invoiceKpis` del Studio descarta el `paid` de las anuladas sin mostrarlo (`lib/studio/invoice-queries.ts`, archivo de la 0555).
6. El PDF de una factura anulada sigue imprimiendo «Datos para el pago» (las cuentas del emisor) junto al aviso de que no hay saldo. Menor; decidirlo con la próxima tarea del PDF.
7. Si el primer intento de resolver queda incierto y el reintento es replay, no sale correo (límite aceptado en la spec). Se podría deduplicar por `mail_logs.metadata` (`report_id` + `status`) sin migración.
