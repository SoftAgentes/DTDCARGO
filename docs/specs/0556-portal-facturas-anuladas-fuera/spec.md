---
sdd: "0556"
title: "El portal dice la verdad: las facturas anuladas no son deuda"
status: in-progress
author: "founder"
created: 2026-10-18
updated: 2026-10-18
supersedes: null
superseded_by: null
related: ["0042", "0177", "0281", "0287", "0297", "0365", "0462", "0488", "0511", "0552"]
confidencialidad: interno
---

# SDD-0556 — El portal dice la verdad: las facturas anuladas no son deuda

> El cliente ve en su portal lo que de verdad debe: una factura anulada sigue a la vista, pero no suma en ninguna cifra; lo que pagó en ella no desaparece; la lista se lee completa o dice que no pudo; y se entera por correo cuando el equipo confirma o rechaza su reporte de pago.

## Contexto

Es la tarea 1.2 de la fase 1 del plan contable (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`) y cierra el hallazgo **B14** («El portal muestra las facturas anuladas como deuda»). Sam autorizó la fase 1 completa; lo que necesita una decisión suya queda preparado pero apagado (ver «Preguntas para Sam»).

Lo que se verificó en el código antes de cambiarlo:

- `listMyInvoices` sólo excluía borradores: las anuladas llegaban a todos lados. Cortaba en `.limit(100)` sin avisar y, ante un error de lectura, devolvía `[]`: el cliente veía «saldo 0, al día».
- Había **tres copias** del cálculo de KPIs (Inicio en `getDashboardKpis`, `facturas/page.tsx` y `finanzas/page.tsx`) y no coincidían: dos sumaban `total − pagado` sin recortar a 0 por factura y la tercera sí. Las tres contaban las anuladas como deuda, y el filtro `?saldo=1` también.
- El estado de cuenta (`buildStatementLedger`) metía la anulada como cargo completo y su pago como abono. Una anulada grande en otra moneda podía decidir la moneda dominante.
- El detalle, el comprobante (pill «Vencida»/«Pendiente»), la card `InvoiceRow` y el PDF de la factura (compartido con el Studio) mostraban «Saldo pendiente» en una anulada con abono parcial.
- El PDF del estado de cuenta resolvía el principal dos veces y leía el emisor con `getCompanyData(sesión)`, que resuelve el tenant por `user_tenants`: un cliente de portal puro salía sin emisor y una sesión híbrida tomaba el tenant de equipo.
- Confirmar o rechazar un reporte de pago desde el Studio no le avisaba nada al cliente.
- La anulación (`void_invoice_with_audit_reason`, 0294) sólo cambia el estado: no toca `paid_amount` ni los recibos. Una factura con abono parcial se puede anular, y ese dinero sigue registrado en ella.

## Decisión

### Una sola definición de deuda

Módulo puro nuevo, `lib/portal/saldo-de-cuenta.ts`. Lo usan Inicio, Facturas, Finanzas, el filtro `?saldo=1`, el detalle, el comprobante y el ledger:

- `esAnulada`, `saldoPorPagar` (0 si está anulada; si no, `max(0, total − pagado)`), `monedaDominante` (pesa sólo las no anuladas; a igual peso gana la que tiene vigentes y después la primera de la lista; `mixed` cuenta sólo monedas con facturas vigentes), `pagosEnAnuladas`, `notaPagosEnAnuladas` y `resumenDeCuenta`.
- `resumenDeCuenta`: `facturado` y `pagado` suman las no anuladas de la moneda dominante; `porPagar` suma `saldoPorPagar` (recorte por factura, lo que ya hacía Inicio); `facturasPorPagar` cuenta las no anuladas con algo por pagar **en todas las monedas** (es un conteo, mismo criterio que tenía Inicio); `pagosEnAnuladas` reúne los pagos en anuladas **de todas las monedas**, cada uno con la suya.
- Una prueba de contrato ata `resumenDeCuenta` al ledger: `facturado = totalCargo`, `pagado = totalAbono`, la misma moneda, el mismo aviso de monedas y los mismos pagos en anuladas.

### La anulada se ve y no suma

- En la lista (Mis facturas, Finanzas y las cards móviles) sigue con su badge «Anulada» y el **monto tachado**; sin «Saldo». Si se le pagó algo, la card dice «Recibido …».
- En el estado de cuenta es una fila «Factura F-… · anulada» con **cargo 0** y sin abono. Sólo entran al libro las de la moneda dominante, como cualquier factura.
- No suma en los KPIs de Inicio, Facturas ni Finanzas, ni en `?saldo=1`, ni en el saldo del detalle, del comprobante o del PDF de la factura.
- **La anulada que nunca se emitió** (`status = 'anulada'` e `issued_at` vacío) era un borrador anulado: el cliente nunca la recibió. Se trata como un borrador, fuera del portal: se filtra en código después de leer, en `listMyInvoicesForPrincipal` y también en `getMyInvoiceForPrincipal` (el detalle, el PDF y el comprobante responden el mismo 404 que un borrador).

### Lo pagado en una anulada no desaparece, y no se descuenta

Sam eligió la regla «estricta» el 2026-09-18 y «hoy no hay saldo a favor del cliente» (`docs/specs/0488-carrera-cobro-factura/spec.md`). No hay nota de crédito para aplicar ese pago (fase 3). Restarlo le diría al cliente que pague menos de lo que el ERP mantiene abierto. Por eso se **informa aparte**, con un solo texto (`notaPagosEnAnuladas`) que usan los KPIs de Facturas y Finanzas, la tabla del estado de cuenta y su PDF:

> Recibimos USD 300.00 en pagos de facturas que después se anularon (F-…). No se descuentan de tu saldo pendiente: escríbele a tu asesor para aplicarlos a otra factura o pedir su devolución.

Los montos se agrupan por moneda y nunca se suman entre monedas. No se usa «saldo a favor». En el estado de cuenta en pantalla la nota va bajo el libro y no se repite bajo los KPIs. El detalle y el comprobante de la anulada dicen lo suyo con su propio texto.

### Lectura completa, o «no sé»

- `listMyInvoicesForPrincipal(supabase, principal)` lee con `fetchAllPaged` (orden `issued_at desc nulls last, created_at desc, id asc`, `.range()`). Si la lectura falla o queda incompleta lanza `PortalInvoicesUnavailableError` (mensaje fijo, sin nada de la base). `listMyInvoices` delega y sin principal sigue devolviendo `[]` sin consultar. El inventario de `.from("invoices")` (SDD-0357) no cambia: `portal-queries.ts` sigue con 2.
- Facturas y Finanzas dejan subir el error a `app/portal/(app)/error.tsx`.
- **Inicio no se cae entero**: `getDashboardKpis` atrapa ese error y devuelve `invoicesAvailable: false`. La portada dice «No disponible · intenta más tarde» en Facturado y Saldo pendiente, oculta la tarjeta de saldo, y el saludo dice «facturas no disponibles por ahora». Nunca un 0 «al día». Envíos, perfil y actividad siguen.
- El PDF del estado de cuenta responde **503** «Estado de cuenta no disponible. Intenta más tarde.» con `Cache-Control: private, no-store` y no renderiza.

### PDF del estado de cuenta del portal

La ruta resuelve el principal **una vez**, lee las facturas con `listMyInvoicesForPrincipal` y, sólo después, el emisor con `getCompanyDataForTenant(createAdminClient(), principal.tenantId)`: el patrón de `facturas/[code]/pdf/route.ts` (SDD-0462). Sin principal responde 404 sin leer facturas ni construir el admin.

**Razón social y RIF: apagados.** La regla de marca deja la razón social y el RIF sólo en el schema, nunca en texto visible (`docs/engineering/project-rules.md`, «Identidad pública, founder y trato»), y la excepción de SDD-0297 cubre sólo la factura. La ruta pasa `tradeName`, `email`, `phone` y `website`, no `legalName` ni `rif`. `EstadoDeCuentaEmisor` gana `legalName?` y `rif?` opcionales y el documento ya los imprime bajo el membrete con `lineasDeEmisor` si llegan (nunca los inventa). Encenderlo es agregar las dos líneas en la ruta (hay un comentario que lo dice) y cambiar la prueba que hoy fija que no se pasan. No hay bandera nueva.

### PDF de la factura anulada

`calcularTotales` da saldo 0 si la factura está anulada, el papel no imprime «Saldo pendiente» y muestra el aviso «Factura anulada: no hay saldo por pagar.». Lo comparten el portal y el Studio. Lo abonado se sigue imprimiendo.

### Aviso al cliente al resolver su reporte de pago

- Módulo nuevo `lib/studio/payment-report-resolution-notify.ts`. Correo best-effort con `sendEmail` (subject + html crudos, sin plantilla ni migración, como `payment-report-notify.ts`); respeta `test_mode` y la lista negra.
- `resolvePaymentReport` lo **programa con `after()`** de `next/server` sólo si el comando dio un recibo ok que **no es replay**. Nunca cambia el resultado: si `after()` lanza (fuera de un request) se ignora.
- El aviso lee el reporte con la **sesión del asesor** (RLS accounting/admin), por el id y la factura del recibo, y corta si no está, si su estado no es el del recibo, si fue cancelado o si su factura no es la del recibo. Recién entonces construye el admin: el destinatario sale de `emailDelShippingMark` (ficha vigente, sigue la fusión, nada si se eliminó sin fusión; SDD-0511), ahora exportada sin cambiar su lógica, con el tenant de la fila del reporte.
- Confirmación: «Confirmamos tu pago · F-…», con factura, monto, método y fecha; «Registramos tu pago…», sin motivo y sin prometer recibo. Rechazo: «No pudimos confirmar tu pago · F-…», con el motivo escapado y «Escríbele a tu asesor o repórtalo de nuevo desde tu portal.». Sin saldo de la factura, con enlace a `/portal/facturas/{code}`. Tuteo, sentence case, `EMAIL_FONT_STACK.brand`.
- **No lee `invoices`**: el inventario de `scripts/__tests__/invoice-read-boundary.test.mjs` no cambia.
- La frontera de SDD-0365 se conserva con su intención: el comando corre sólo con la sesión, y el admin se construye sólo dentro del aviso, que se programa después de un recibo ok que no es replay. `payment-report-consumers.test.ts` lo dice así (antes decía «nunca se construye el admin»).

## Alcance

**Dentro:** todo lo anterior, sin migración y sin leer ni escribir producción.

**Fuera (decidido):**

- **El Studio no se toca** (D3). Su estado de cuenta (`app/studio/(app)/clientes/**`) es terreno de la SDD-0558 y sigue filtrando las anuladas en `filasParaLedger`. El hueco H3 de B13 (una anulada con abono desaparece en el Studio) queda para la 0558 o la fase 5. El PDF del estado de cuenta del Studio no cambia: no le llegan anuladas y su emisor no trae razón social ni RIF.
- Archivos vedados por colisión con otras SDD: `lib/studio/invoice-queries.ts`, `lib/studio/invoice-types.ts` (SDD-0555), `lib/studio/borrado/`, `app/studio/(app)/embarques/` y `app/studio/(app)/clientes/**` (SDD-0558).
- Fechar los abonos por el recibo real (fase 5, decisión del 2026-07-29), notas de crédito y saldo a favor (fase 3), recibo R- al confirmar (B4, fase 3), el tope de 100 envíos de `listMyShipments`, avisos en la bandeja del portal o una regla de Mailing (piden migración).

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `lib/portal/saldo-de-cuenta.ts` | nuevo: la definición única de deuda, la moneda dominante y la nota de pagos en anuladas |
| `lib/portal/statement-ledger.ts` | anulada en 0 sin abono; `voidedPayments`; totales sin anuladas; moneda de `monedaDominante` |
| `lib/portal/portal-queries.ts` | `PortalInvoicesUnavailableError`, `listMyInvoicesForPrincipal` paginada, anulada sin emitir fuera de lista y detalle, `getDashboardKpis` con `resumenDeCuenta` e `invoicesAvailable` |
| `lib/portal/portal-types.ts` | `PortalDashboardKpis.invoicesAvailable` y comentarios |
| `lib/portal/comprobante.ts` | `isVoided`, `paidOnVoided`, saldo con `saldoPorPagar`; `estadoDelComprobante` (el pill, antes privado en la página) |
| `app/portal/(app)/_components/PortalDashboardNorte.tsx` | «No disponible» con `invoicesAvailable: false` |
| `app/portal/(app)/facturas/page.tsx` | KPIs con `resumenDeCuenta`, nota, `?saldo=1` con `saldoPorPagar`, «N facturas sin saldo ocultas», vacío «No tienes facturas por pagar», monto tachado |
| `app/portal/(app)/finanzas/page.tsx` | KPIs con `resumenDeCuenta` y nota |
| `app/portal/_components/InvoiceRow.tsx` | sin «Saldo» en la anulada, total tachado, «Recibido» |
| `app/portal/(app)/facturas/_components/StatementLedgerTable.tsx` | nota de pagos en anuladas bajo el libro |
| `app/portal/(app)/facturas/estado-de-cuenta/pdf/route.ts` | principal único, lectura completa, 503, emisor del tenant con admin, sin razón social ni RIF |
| `app/portal/(app)/facturas/[code]/page.tsx` | saldo con `saldoPorPagar` y aviso de anulada |
| `app/portal/(app)/facturas/[code]/comprobante/page.tsx` | pill desde `estadoDelComprobante` y nota de lo pagado en la anulada |
| `lib/studio/pdf/factura-pdf.tsx` | saldo 0 y aviso en la anulada (`facturaAnulada`); `lineasDeEmisor` acepta `Pick<…, "legalName" \| "rif">` |
| `lib/studio/pdf/estado-de-cuenta-pdf.tsx` | `legalName?`/`rif?` opcionales con `lineasDeEmisor`; nota de pagos en anuladas |
| `lib/studio/mail/mail-rule-engine.ts` | `emailDelShippingMark` exportada, sin cambio de lógica |
| `lib/studio/payment-report-resolution-notify.ts` | nuevo: el correo al cliente |
| `app/studio/(app)/facturacion/payment-report-actions.ts` | programa el aviso con `after()` tras un recibo ok que no es replay |
| `lib/portal/__tests__/saldo-de-cuenta.test.ts` | nuevo |
| `lib/portal/statement-ledger.test.ts` | casos de anuladas e invariante sin anuladas |
| `lib/portal/__tests__/dashboard.test.ts` | doble con `range` por offset; anuladas; facturas no disponibles; recorte por factura |
| `lib/portal/__tests__/invoices.test.ts` | doble con `range` por offset |
| `lib/portal/__tests__/portal-invoices-tenant-boundary.test.ts` | `range`, fallas, orden; 150 facturas; anulada sin emitir; PDF del estado de cuenta (principal, emisor, híbrida, 404, 503, anulada) |
| `lib/portal/__tests__/comprobante.test.ts` | anuladas y `estadoDelComprobante` |
| `lib/portal/__tests__/payment-report-consumers.test.ts` | `after()` capturado; aviso programado sólo tras recibo ok no replay |
| `lib/studio/__tests__/payment-report-resolution-notify.test.ts` | nuevo |
| `lib/studio/pdf/__tests__/factura-pdf.test.ts` | saldo y aviso de la anulada |
| `lib/studio/pdf/__tests__/estado-de-cuenta-pdf.test.ts` | membrete y nota |
| `app/portal/(app)/facturas/page.test.tsx` | KPIs, nota, `?saldo=1`, vacío, tachado |
| `app/portal/(app)/finanzas/page.test.tsx` | nuevo |
| `app/portal/(app)/facturas/[code]/page.test.tsx` | detalle de una anulada |
| `app/portal/(app)/facturas/_components/StatementLedgerTable.test.tsx` | nuevo |
| `app/portal/(app)/_components/PortalDashboardNorte.test.tsx` | nuevo |
| `app/portal/_components/__tests__/InvoiceRow.test.tsx` | nuevo |
| `app/portal/_components/__tests__/PortalTrackingEnConstruccion.test.tsx` | el fixture de KPIs gana `invoicesAvailable: true` (plomería del tipo) |
| `docs/specs/0556-portal-facturas-anuladas-fuera/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0556-portal-facturas-anuladas-fuera.md` | handoff |

La portada (`app/portal/(app)/page.tsx`) no cambia: ya le pasa `kpis` a la tarjeta, y lo que cambia es `getDashboardKpis` y `PortalDashboardNorte`.

## Criterios de aceptación

1. Una anulada sigue visible en Mis facturas, Finanzas y las cards móviles, con el badge «Anulada» y el monto tachado, sin «Saldo». En el estado de cuenta del portal (pantalla y PDF) sale como «Factura F-… · anulada» con cargo 0.
2. Ninguna cifra de deuda cuenta una anulada: KPIs de Inicio, Facturas y Finanzas, `?saldo=1`, saldo del detalle, pill y saldo del comprobante, PDF de la factura.
3. Lo pagado en una anulada se informa con monto, moneda y código, en Facturas, Finanzas, el estado de cuenta y su PDF; no se resta del saldo y no se dice «saldo a favor». Una anulada en una moneda no dominante también se informa.
4. Una anulada no decide la moneda dominante ni dispara el aviso de «otras monedas».
5. Las cifras salen de `resumenDeCuenta` y una prueba de contrato las ata al ledger.
6. La lista se lee completa (150 facturas en la prueba, más que el viejo tope de 100), con orden estable hasta `id`. Un error o una lectura incompleta lanzan `PortalInvoicesUnavailableError`: Facturas y Finanzas caen en `error.tsx`, el PDF responde 503 privado e Inicio dice «No disponible», nunca 0.
7. Una anulada que nunca se emitió no aparece en la lista ni abre el detalle.
8. Con `?saldo=1` y nada por pagar, la página dice «No tienes facturas por pagar.» y conserva KPIs y nota.
9. El PDF del estado de cuenta resuelve el principal una vez, antes de leer facturas, y construye el admin sólo después; el emisor sale del tenant del principal (también en una sesión híbrida); sin principal, 404 sin leer facturas ni construir admin; hoy no lleva razón social ni RIF.
10. Confirmar o rechazar un reporte desde el Studio programa un solo correo, best-effort, al correo vigente de la ficha; un replay, un resultado incierto o un rechazo de permisos no programan nada; el aviso nunca cambia el resultado; el motivo sale escapado; el aviso no lee `invoices`.
11. Sin migración. El inventario de lecturas de `invoices` queda en 42 llamadas y 18 archivos.

## Pruebas y control rojo

Las pruebas de la allowlist corren con dobles que aplican los filtros y cortan `range` por offset (uno que devolviera siempre las mismas filas haría que la lectura nunca terminara). `portal-invoices-tenant-boundary.test.ts` pasa de 2 a 3 lecturas de `invoices` en «lista y detalle filtran explícito»: `fetchAllPaged` sólo da por terminada la lectura al recibir una página vacía (`lib/db/paginate.ts`), así que son la página con datos, la vacía y el detalle, todas con los mismos filtros. No es una prueba más floja; otra prueba nueva fija que cada página lleva los filtros del principal y el orden hasta `id`.

El control rojo se hizo con un script de mutantes, uno por vez y restaurando en `finally`: reversiones de cada archivo de producción al estado de la base (`a7a51ad7`) y mutantes de una línea que quitan cada regla. Un mutante cuenta como muerto sólo con exit 1 y la línea `Tests … failed`. El resultado, mutante por mutante, está en el handoff.

## Límites conocidos

- **El primer intento incierto no avisa.** Si el SQL confirma pero la respuesta se pierde, la acción devuelve «PAGO-RESULTADO-INCIERTO»; el reintento con el mismo intento vuelve como replay y no programa correo. Aceptado: deduplicar por `mail_logs` es otra tarea.
- **El aviso depende de la RLS del reporte.** Lo lee la sesión del asesor (`payment_reports_accounting_select`: accounting/admin). Si otro rol pudiera resolver, el aviso no saldría; hoy `resolvePaymentReport` exige permiso de edición de facturas.
- **Preview comparte Supabase con producción**: resolver un reporte en Preview le escribe al cliente real (salvo `test_mode`).
- La fecha del abono en el estado de cuenta sigue siendo la del vencimiento (decisión del 2026-07-29).
- Con un sobrepago en una factura viva, el KPI recorta a 0 y el ledger da el neto: es la semántica que ya existía.
- No se leyó producción: no se puede afirmar cuántas anuladas con abono o sin emitir existen hoy.

## Preguntas para Sam

1. ¿Concedes para el estado de cuenta en PDF la misma excepción de marca que diste a la factura el 2026-08-25 (razón social y RIF bajo el membrete)? Hoy queda apagado; encenderlo son dos líneas en la ruta y una prueba.
2. ¿Te sirve el texto de la nota («escríbele a tu asesor para aplicarlos a otra factura o pedir su devolución») mientras siga la regla estricta? Vive en una sola función.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento del portal y del Studio | cumplimiento | esta spec con allowlist exacta |
| ERR-01 | cumplimiento | error de lectura visible: `error.tsx` en Facturas y Finanzas, 503 privado en el PDF, «No disponible» en Inicio; ningún mensaje lleva detalle de la base |
| VIS-01 | cumplimiento | la anulada pierde énfasis (tachado y gris) y conserva su badge; las notas van en texto secundario |
| A11Y-01 | cumplimiento, pendiente de medir | el estado no depende sólo del tachado: el badge «Anulada» y el concepto «· anulada» lo dicen en texto. El contraste del gris en tema oscuro queda para `/ui-check` |
| AUD-01 | no aplica | no cambia qué se audita; el comando de resolución sigue igual y el correo queda en `mail_logs` |
| LOD-01, FRM-01, BTN-01 | no aplica | no cambian formularios, cargas ni botones |
| Datos personales (`revisar-datos-ve`) | cumplimiento | el correo va al titular de la ficha, sólo con datos de su propio reporte; los registros no llevan correo ni monto; ver el handoff |

## Validación

Ver el handoff `.agents/handoffs/0556-portal-facturas-anuladas-fuera.md`.
