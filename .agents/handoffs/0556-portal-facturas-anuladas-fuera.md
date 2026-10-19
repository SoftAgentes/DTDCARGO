# Handoff · SDD-0556 · El portal dice la verdad: las facturas anuladas no son deuda

| Campo | Valor |
|---|---|
| Fecha | 2026-10-18 en Caracas (UTC 2026-10-19, hasta las 03:45 aprox.) |
| Task ID / owner | `contabilidad-2026-10-18` / sesión Worker «Contabilidad» del worktree `quizzical-lehmann-d70032`; escrito por su subagente de la 0556 |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\quizzical-lehmann-d70032` |
| Rama | `claude/sdd-0556-portal-dice-la-verdad`, base `a7a51ad7` (la reserva, sobre `origin/main` `77035907`); `origin/main` `cb9c62ae` fusionado en `d9038877` |
| SDD | [0556](../../docs/specs/0556-portal-facturas-anuladas-fuera/spec.md), `in-progress`. Se conserva el slug de la reserva |
| Commits | Primera vuelta: `e249396d` (definición única de deuda y pantallas), `f61bf702` (lectura completa, Inicio y PDF del estado de cuenta), `41159273` (aviso al cliente), `0b19e9b3` (spec, índice y handoff) y el merge `d9038877`. Correcciones de la revisión: `08f1b8db` (C1), `87e40774` (C5), `4df4b09d` (PDF de la anulada), `99ef144d` (C2, C3, C4, C6, C7), `b91b1b7e` (contrato exacto) y el commit de docs con esta actualización |
| Estado | implementado, revisado dos veces y corregido; lista para PR en borrador |
| Permisos | Sam autorizó la fase 1 completa: commits selectivos, push de la rama propia y PR en borrador contra `main`, sin fusionar. Sin producción ni base de datos. `pnpm verify` necesita turno del Director. El 2026-10-18 Sam aprobó además la excepción de marca del estado de cuenta (ver «Decisiones de Sam») |

## OBJETIVO ORIGINAL

Tarea 1.2 de la fase 1 del plan contable (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`), hallazgo **B14**: el portal mostraba las facturas anuladas como deuda, recortaba la lista a 100, el PDF del estado de cuenta salía sin el emisor correcto y el cliente no se enteraba cuando el equipo resolvía su reporte de pago. Decisiones D1–D14 de la Worker sobre el plan del diseñador y su crítica; después, correcciones C1–C10 sobre la revisión adversaria.

## COMPLETADO

- **Una sola definición de deuda** (`lib/portal/saldo-de-cuenta.ts`), usada por Inicio, Facturas, Finanzas, `?saldo=1`, el detalle, el comprobante y el ledger. Reemplaza tres copias que no coincidían.
- **La anulada se ve y no suma**: badge «Anulada» y monto tachado en la lista y las cards; fila «Factura F-… · anulada» en 0 en el estado de cuenta (pantalla y PDF); fuera de los KPIs, de `?saldo=1`, del saldo del detalle, del comprobante (pill «Anulada») y del PDF de la factura (saldo 0, aviso «Factura anulada: no hay saldo por pagar.» y sin «Datos para el pago»).
- **Lo pagado en una anulada no desaparece y no se descuenta**: una sola nota (`notaPagosEnAnuladas`) en Facturas, Finanzas, la tabla del estado de cuenta y su PDF, con los pagos de **todas** las monedas, cada uno con la suya (D2). `mixedCurrencies` cuenta sólo monedas con facturas vigentes.
- **La anulada que nunca se emitió** queda fuera del portal, como un borrador (D1).
- **Lectura completa o «no sé»**: `listMyInvoicesForPrincipal` con `fetchAllPaged` y orden estable hasta `id`; `PortalInvoicesUnavailableError` ante error o lectura incompleta. Facturas y Finanzas caen en `error.tsx`; el PDF responde 503 privado; **Inicio no se cae** (D5): `invoicesAvailable: false` y «No disponible» en la portada.
- **PDF del estado de cuenta**: principal una sola vez, emisor con `getCompanyDataForTenant(admin, principal.tenantId)` después de probar el principal; razón social y RIF **apagados** con un comentario en la ruta y una prueba que fija que hoy no se pasan (D4).
- **Aviso al cliente** (D6): correo best-effort programado con `after()` sólo tras un recibo ok que no es replay; lee el reporte con la sesión, construye el admin sólo después; motivo escapado; sin saldo; no lee `invoices`.
- **Prueba de consumidores reescrita** (D7): el comando corre con la sesión; el aviso queda programado sin admin; el admin aparece recién al correr lo programado; un replay no programa otro.
- **Conteo de lecturas** (D11): la frontera pasa de 2 a 3 lecturas por la página vacía de `fetchAllPaged`; explicado en la prueba y en la spec. Los otros dobles que encadenan `from("invoices")` (`dashboard.test.ts`, `invoices.test.ts`) ganaron `range` por offset; ninguno contaba lecturas.
- **Merge y entorno** (C10, reemplaza el pendiente del merge): `origin/main` `cb9c62ae` (0554 y 0555) fusionado en `d9038877`; índice regenerado, «índice sincronizado con 543 specs»; el inventario de `scripts/__tests__/invoice-read-boundary.test.mjs` pasa sobre el árbol fusionado (42 llamadas, 18 archivos, `portal-queries.ts` con 2).

### Correcciones de la revisión adversaria (C1–C10)

- **C1 · Sin duplicados.** `listMyInvoicesForPrincipal` deduplica por `id` y conserva la primera aparición: una factura emitida entre la página con datos y la siguiente ya no repite la última fila ni infla el saldo. La nueva puede faltar hasta la próxima carga (comentario en el código). Prueba en la frontera con un transporte que emite entre páginas: 3 lecturas, ningún `id` repetido, saldo 300 y no 400.
- **C2 · La moneda dominante lleva la deuda.** `monedaDominante` elige primero, entre las monedas con saldo por pagar, la de mayor saldo; sólo si nada se debe, la de mayor facturado. USD 400/100 más VES 2000/2000 da USD y 300 por pagar en `resumenDeCuenta`, en `getDashboardKpis`, en el libro y en la portada (sin «al día»). `PortalDashboardNorte` no usa «al día» ni el tono de éxito si `pendingInvoiceCount > 0`. Pruebas de dominancia ajustadas: «gana la de mayor total» pasa a «gana la de mayor saldo por pagar» con el mismo resultado (todo sin pagar), y se explica en cada una; se agregó el caso sin deuda, donde decide el facturado y la anulada no pesa.
- **C3 · Sobrepagos reconciliables.** `resumenDeCuenta` y `buildStatementLedger` devuelven `sobrepagos`. El contrato fija `ledger.balance === porPagar − sobrepagos` (con `toBe`) y `sobrepagos` iguales. Con `sobrepagos > 0`, la tabla del estado de cuenta y su PDF llevan `notaSobrepagos`: «Incluye USD 20.00 pagados de más en facturas ya pagadas; tu asesor los aplica o te los devuelve.». La spec ya no dice que la diferencia «ya pasaba»: para Facturas y Finanzas es nueva.
- **C4 · La guarda de la portada.** La prueba «no disponible» usa `outstandingBalance: 600` y `pendingInvoiceCount: 1` y comprueba que no salen «1 factura por pagar», «USD 600.00» ni «al día». Mutante M60 (sin `facturasOk &&` en la guarda de `SaldoCard`): muerto.
- **C5 · Facturas y Finanzas dejan subir el error.** Un caso por página con `listMyInvoices` rechazando con `PortalInvoicesUnavailableError`: la página rechaza con ese mismo error. Mutantes M61 y M62 (`.catch(() => [])`): muertos.
- **C6 · El comprobante de una anulada.** Prueba de render nueva (`comprobante/page.test.tsx`): pill «Anulada», la nota de lo pagado, ningún saldo pendiente; y una viva con «Pendiente» y su saldo. Reversión R12 y mutante M63 de la nota: muertos.
- **C7 · Una sola indicación.** `indicacionPagosEnAnuladas` (con `singular` e `inicioDeFrase`) es la única fuente de «escríbele a tu asesor para aplicarlos a otra factura o pedir su devolución». La usan `notaPagosEnAnuladas` (Facturas, Finanzas, el libro, el PDF), el detalle y el comprobante. Una prueba barre `app/portal`, `lib/portal` y `lib/studio/pdf` y exige que la frase sólo esté en `saldo-de-cuenta.ts`. Pregunta 2 de la spec corregida.
- **C8 · Los dobles.** La spec dice ahora «todos cortan `range` por offset; solo el transporte de la frontera aplica los filtros, y es donde se prueban».
- **C9 · Mutantes al día.** Corrida completa sobre `b91b1b7e`; la última línea del log es «Todos los mutantes murieron.» (78 de 78). Detalle abajo.
- **C10 · Merge y entorno.** Ver «Merge y entorno» arriba; el inventario se volvió a correr al final.
- **Fuera de las correcciones, hecho**: el PDF de una anulada ya no imprime «Datos para el pago» (una línea en `factura-pdf.tsx`, con prueba y mutante M66).

### Tercera vuelta: decisión de Sam y revisión del delta

La Worker revisó el delta de las correcciones con dos lentes y dos escépticos por hallazgo. No encontró defectos de cálculo y aplicó lo que valía la pena:

- **Excepción de marca encendida.** La ruta del PDF del estado de cuenta del portal pasa `legalName` y `rif` del tenant del principal. La prueba de la frontera fija los del tenant correcto. Las reglas de identidad (`docs/engineering/project-rules.md` y `docs/marketing/identidad.md`) nombran las dos excepciones de documentos.
- **Notas de sobrepagos según la cifra que acompañan.** `notaSobrepagos(monto, moneda, lugar)`:
  - en el libro y su PDF dice cuánto falta pagar de verdad (`porPagar` = neto + sobrepagos), para que el cliente no pague de menos;
  - bajo los KPIs de Facturas (fuera del estado de cuenta) y de Finanzas explica por qué facturado − pagado no da el saldo pendiente;
  - las dos terminan con la indicación única.
- **El contrato con el libro en céntimos enteros,** con fixtures de céntimos inexactos en coma flotante y un sobrepago en otra moneda, que ata la moneda en los dos lados.
- **Inicio con varias monedas:** «Facturado» dice «solo USD · hay otras monedas», no «moneda dominante». El comentario del tipo dice que la moneda de las cifras sigue a la deuda.
- **PDF de la factura anulada con abono:** el aviso agrega lo abonado y la indicación única, igual que el comprobante.

## DESVÍOS RESPECTO DEL PLAN Y LAS DECISIONES

1. **D1 extendido al detalle.** Además de `listMyInvoicesForPrincipal`, `getMyInvoiceForPrincipal` devuelve `null` para la anulada sin emitir: «se trata como un borrador: fuera del portal» implica el mismo 404 en detalle, PDF y comprobante. Con prueba en la frontera.
2. **`pagosEnAnuladas` es una lista, no un número** (D2 manda sobre el plan): `{code, reference, amount, currency}`. Por eso el ledger no tiene `totalVoidedPayments`: un total entre monedas no tiene sentido.
3. **`facturasPorPagar` cuenta en todas las monedas**, como ya hacía Inicio (el plan decía «todo sobre la moneda dominante»). Es un conteo; restringirlo habría bajado el «N facturas pendientes» de un cliente con dos monedas.
4. **El pill del comprobante pasó a `lib/portal/comprobante.ts`** (`estadoDelComprobante`) en vez de exportarse desde la página: Next no admite exports arbitrarios en un `page.tsx`.
5. **La nota no se repite en el estado de cuenta en pantalla**: con `?vista=cuenta` va sólo bajo el libro (`StatementLedgerTable`), no también bajo los KPIs.
6. **Hechos del plan corregidos al leer el código**: `PortalDashboardNorte` no tenía prueba propia (se creó); la cabecera de la ruta del PDF citaba `?vista=estado` y el parámetro real es `?vista=cuenta` (se corrigió el comentario); el control rojo del dashboard da 11299 de saldo (D14), y así quedó escrito.
7. **Una prueba agregada por un mutante que sobrevivía** (primera vuelta): M18 sobrevivió a la primera corrida; faltaba un caso de sobrepago en `dashboard.test.ts`. Se agregó y murió; la corrida completa de esta vuelta lo confirma.
8. **C3 · el ledger también lleva `sobrepagos`.** La corrección lo pedía en `resumenDeCuenta`; el PDF sólo recibe el ledger y «no recalcula nada», así que el ledger lo calcula con el mismo `sobrepago` y el contrato ata los dos.
9. **C7 · el comprobante cambió su primera frase.** Decía «lo que pagaste no se descuenta de otra factura»; con la indicación compartida («aplicarlo a otra factura») repetía «otra factura». Ahora dice «lo que pagaste en ella no se descuenta de tu saldo pendiente», como la nota.
10. **C2 · la guarda de `SaldoCard` sigue en `facturasOk && outstandingBalance > 0`.** Con la nueva dominancia, `outstandingBalance > 0` sí y sólo sí `pendingInvoiceCount > 0`; se dejó así para que el mutante de C4 sea el pedido. El «al día» y el tono sí miran el conteo (`debe`).
11. **El Studio hereda dos cosas sin tocar sus archivos** (D3 se cumple en archivos): su estado de cuenta usa `buildStatementLedger`, así que su moneda también sigue a la deuda (su prueba `clientes/__tests__/estado-de-cuenta.test.ts` sigue verde: con todo sin pagar el resultado no cambia), y su PDF lleva la nota de sobrepagos porque comparte `EstadoDeCuentaDocument`. Escrito en la spec.

## VALIDACIÓN

Todo en este worktree y esta rama. Sin `pnpm verify`, sin vitest sin filtro y sin Docker (otro Worker tenía el turno de máquina).

| Comprobación | Alcance | Resultado |
|---|---|---|
| `vitest run` de las 19 pruebas de la tarea (las del script de mutantes, `InvoiceRow`, `PortalTrackingEnConstruccion`, `invoices`, `clientes/__tests__/estado-de-cuenta.test.ts` y el comprobante nuevo) | puntual | PASÓ: `Test Files  19 passed (19)`, `Tests  271 passed (271)`, exit 0 |
| `vitest run` de los 68 archivos de prueba que importan los módulos tocados (lista de `git grep`, incluye `scripts/__tests__/invoice-read-boundary.test.mjs`) | consumidores | PASÓ: `Test Files  68 passed (68)`, `Tests  1146 passed (1146)`, exit 0 |
| Mutantes (`scratchpad/mutantes-0556.mjs`; uno por vez, restaura en `finally`) | 12 reversiones al estado de la base + 66 mutantes de una línea, sobre `b91b1b7e` (2026-10-19T03:31:06Z) | PASÓ: última línea del log «Todos los mutantes murieron.», 78 de 78 MUERTOS con exit 1 y línea `Tests … failed`. `git status` después: sólo la spec en edición |
| `corepack pnpm typecheck` | repo | PASÓ (exit 0, «[tipos-de-ruta] sanos — nada que podar») |
| `corepack pnpm exec eslint --max-warnings=0` | los 20 `.ts`/`.tsx` tocados en las correcciones | PASÓ (exit 0, sin salida) |
| `node scripts/build-docs-index.mjs` + `corepack pnpm docs:check` | índice | PASÓ: «índice regenerado en docs\specs\README.md — 543 specs, 13 huecos» y «✓ docs:check — índice sincronizado con 543 specs» |
| `corepack pnpm sdd:check` | numeración | PASÓ: «543 specs · 485 migraciones» y «numbering: sin números repetidos» (avisa los choques históricos ya conocidos) |
| `corepack pnpm governance:check` | cápsula | PASÓ: «Gobernanza: 28 política(s) aprobada(s) · cápsula vigente» |
| `corepack pnpm components:check` | CMP-01 | PASÓ: «CMP-01 válido: 5 fuente(s), agregado reproducible y cero rutas rotas» |
| `git diff --check a7a51ad7 HEAD` | diff | PASÓ (exit 0) |
| Inventario `invoice-read-boundary` | 42 llamadas / 18 archivos, sobre el árbol fusionado | PASÓ: `Tests  4 passed (4)` |
| Allowlist exacta | 39 archivos contra `cb9c62ae` | PASÓ: 39 filas, 39 archivos en el diff, ninguno sobra ni falta |
| `/ui-check` | portal (Facturas lista y estado de cuenta, Finanzas, detalle, comprobante, portada) en claro y oscuro | NO EJECUTADO: necesita navegador y datos; queda pendiente |
| Tercera vuelta · `vitest run lib/portal app/portal "app/studio/(app)/facturacion" "app/studio/(app)/clientes" lib/studio/pdf lib/studio/mail lib/studio/__tests__/payment-report-resolution-notify.test.ts scripts/__tests__/invoice-read-boundary.test.mjs` | todas las carpetas que toca la tarea | PASÓ: `Test Files  147 passed (147)`, `Tests  1694 passed (1694)` |
| Tercera vuelta · mutantes (`scratchpad/mutantes-0556-ajustes.mjs`, con `node` y sin `pnpm`) | 12 mutantes de los ajustes: la ruta sin razón social o sin RIF, el libro o el PDF con mal «lo que falta pagar», Facturas y Finanzas sin la nota, Facturas con la nota repetida en el estado de cuenta, la nota del libro sin el monto, sobrepagos de otra moneda en el libro, el rótulo viejo de Inicio, el PDF de la anulada callando lo abonado o hablando de abono sin él | PASÓ: «Todos los mutantes murieron.», 12 de 12 con exit 1 y línea `Tests … failed` |
| Tercera vuelta · `corepack pnpm typecheck` y `eslint --max-warnings=0` (17 archivos tocados) | repo y archivos tocados | PASÓ (exit 0) |
| `corepack pnpm verify` | completo | NO EJECUTADO: hay que pedirle el turno al Director |
| Comprobación en el navegador | — | NO EJECUTADA |

### Control rojo, mutante por mutante

Copiado del log de la corrida sobre `b91b1b7e`; entre paréntesis, los fallos.

Reversiones (archivo de producción al estado de `a7a51ad7`, contra las pruebas nuevas): R1 lectura y PDF de hoy (16), R2 ledger de hoy (7), R3 Mis facturas de hoy (4), R4 Finanzas de hoy (2), R5 InvoiceRow de hoy (2), R6 detalle de hoy (2), R7 PDF de factura de hoy (4), R8 PDF de estado de cuenta de hoy (4), R9 acción del Studio de hoy (4), R10 portada de hoy (2), R11 tabla del estado de cuenta de hoy (2), R12 comprobante de hoy (2). Todas MUERTAS.

Mutantes de una línea, todos MUERTOS:

- `saldo-de-cuenta`: M1 saldoPorPagar cuenta la anulada (7); M2 la dominancia pesa las anuladas (2); M3 «otras monedas» cuenta las anuladas (6); M4 facturado incluye anuladas (9); M5 pagado suma lo de anuladas (7); M6 pagos en anuladas sólo de la moneda dominante (4).
- ledger: M7 la anulada entra con su total (3); M8 la anulada vuelve a ser cargo + abono (4); M9 totalCargo cuenta las anuladas (9); M10 voidedPayments sólo de la moneda del libro (1).
- lectura e Inicio: M11 lectura incompleta pasa callada (1); M12 error de lectura devuelve [] (3); M13 la anulada sin emitir entra a la lista (1); M14 la anulada sin emitir abre el detalle (1); M15 Inicio se cae con la lectura de facturas (1); M16 Inicio dice «disponible» con la lectura caída (1); M17 la lista no termina el orden en id (1); M18 Inicio vuelve a su propio cálculo de saldo (1); M19 la portada ignora invoicesAvailable (1).
- ruta del PDF: M20 el PDF sale aunque la lectura falle (1); M21 el emisor se lee con la sesión (3); M22 la ruta pasa la razón social sin la excepción (1).
- pantallas: M23 ?saldo=1 vuelve a total − pagado (2); M24 vacío de «no tienes facturas» con ?saldo=1 (1); M25 la fila de la tabla no tacha la anulada (1); M26 Mis facturas sin la nota (2); M27 la nota se repite en el estado de cuenta (1); M28 Finanzas sin la nota (2); M29 InvoiceRow vuelve a total − pagado (3); M30 InvoiceRow no tacha la anulada (1); M31 InvoiceRow calla lo recibido (1); M32 detalle vuelve a total − pagado (1); M33 detalle sin el aviso de anulada (2); M34 tabla del estado de cuenta sin la nota (1).
- comprobante: M35 la anulada pagada es «pagada» (2); M36 el pill no dice «Anulada» (1); M37 el comprobante vuelve a total − pagado (2).
- PDFs: M38 PDF de factura: la anulada vuelve a tener saldo (2); M39 PDF de factura sin el aviso de anulada (1); M40 PDF de estado de cuenta sin emisorLines (2); M41 PDF de estado de cuenta sin la nota (1).
- acción: M42 el aviso sale también en un replay (1); M43 el aviso corre dentro de la acción (sin after) (3).
- aviso: M44 sin la guarda de estado (1); M45 sin escapeHtml en los valores (2); M46 sin la guarda de replay en el aviso (1); M47 sin la guarda de cancelación del reporte (1); M48 sin la guarda de la factura del reporte (1); M49 el admin se construye antes de leer el reporte (5); M50 el reporte no se acota a la factura del recibo (1); M51 la confirmación lleva el motivo (1).
- correcciones de la revisión: M52 la lista no deduplica por id (1); M53 la deuda no decide la moneda dominante (5); M54 la portada mira sólo el monto para decir «al día» (1); M55 resumenDeCuenta sin sobrepagos (5); M56 el ledger sin sobrepagos (5); M57 la tabla del estado de cuenta sin la nota de sobrepagos (1); M58 el PDF del estado de cuenta sin la nota de sobrepagos (1); M59 sobrepago cuenta la anulada (1); M60 la tarjeta de saldo ignora facturasOk (1); M61 Mis facturas traga el error de lectura (1); M62 Finanzas traga el error de lectura (1); M63 el comprobante de la anulada sin la nota (1); M64 el detalle escribe la indicación a mano (2); M65 el comprobante vuelve a su propia indicación (3); M66 el PDF de la anulada imprime «Datos para el pago» (1).

M1 y M59 nombran la línea siguiente a `if (esAnulada(inv)) return 0;`, que ahora está en `saldoPorPagar` y en `sobrepago`; M2 incluye la línea nueva de la deuda. Las corridas parciales y la anterior (sobre `99ef144d`, mismos 78 resultados) quedan en el scratchpad de la sesión.

## Revisión de datos personales del correo nuevo

Revisión acotada al flujo nuevo con el procedimiento de `.claude/skills/revisar-datos-ve/SKILL.md` (no es la auditoría completa del repo):

- CORRECTO — el destinatario es el titular de la ficha del Shipping Mark del reporte, en el tenant del reporte: `lib/studio/payment-report-resolution-notify.ts:176` (`emailDelShippingMark`, que no le escribe a una ficha eliminada sin fusión).
- CORRECTO — el correo lleva sólo datos del propio reporte (factura, monto, método, fecha y, en el rechazo, el motivo); no lleva saldo ni datos de otras facturas: `payment-report-resolution-notify.ts:75-122`.
- CORRECTO — todo valor del HTML pasa por `escapeHtml`: `:96`, `:98`, `:106-107`, `:117`.
- CORRECTO — los registros (`console.warn`/`console.error`) llevan sólo el código de factura, nunca el correo ni el monto: `:178`, `:204`, `:206`; con prueba.
- CORRECTO — `test_mode` y lista negra del tenant los aplica `sendEmail`: `lib/studio/mail/send-email.ts:85` y `:130`.
- NO VERIFICABLE — retención de `mail_logs` (guarda destinatario y metadata, como todo correo del ERP): no hay política escrita en el repo para este caso.
- NO VERIFICABLE — que los clientes reales esperen o hayan aceptado este aviso: es un correo transaccional sobre su propio pago, pero el texto de consentimiento del portal no se revisó.

Las correcciones no cambian este flujo.

## Impacto documental y conocimiento

- Canónicos actualizados: la spec 0556 (decisión, sobrepagos, allowlist exacta de 39 archivos, criterios 12–15, pruebas, límites y preguntas) y `docs/specs/README.md` (índice regenerado; esta vuelta no lo cambió).
- No hay cambios de esquema, RBAC ni rutas nuevas: Graphify y Archify no cambian de forma. Obsidian: sin cambios. `knowledge:status` no se corrió en esta sesión (lo corre el Director al cerrar).

## PENDIENTES DE ESTA TAREA

1. `/ui-check` del portal en claro y oscuro: el gris del monto tachado (`text-grey-500`), las notas nuevas (pagos en anuladas y sobrepagos) y la nota del comprobante no se midieron en el portal oscuro; la tarjeta «No disponible» de la portada en móvil.
2. `corepack pnpm verify` con turno del Director.
3. Si `main` avanza antes de integrar: recalcular el inventario de `invoice-read-boundary` y regenerar el índice.
4. Preguntas para Sam que siguen abiertas (también en la spec): el texto de la indicación sobre lo pagado en anuladas (una sola función, siete lugares) y las dos versiones de la nota de sobrepagos. La excepción de marca ya está decidida.

## Decisiones de Sam

- **2026-10-18, excepción de marca del estado de cuenta.** A la pregunta «En el PDF del estado de cuenta que el cliente descarga del portal, ¿pongo la razón social y el RIF de DTD bajo el logo, como ya los lleva la factura?», Sam eligió «Sí, como la factura (Recomendado)».

## FUERA DE ALCANCE DETECTADO

1. **H3 de B13 en el Studio** (D3): el estado de cuenta del Studio sigue filtrando las anuladas en `filasParaLedger`, así que una anulada con abono **desaparece** ahí, mientras el portal ya la informa. Además, su pantalla no muestra la nota de sobrepagos (su PDF sí, por el documento compartido), y el comentario de `app/studio/(app)/clientes/__tests__/estado-de-cuenta.test.ts` dice que el ledger «se queda con la de mayor total facturado»: ahora sigue a la deuda (en su fixture da lo mismo). Va a la SDD-0558 o a la fase 5; la 0558 debería usar `resumenDeCuenta`, `pagosEnAnuladas` y `notaSobrepagos` para no volver a dos definiciones de saldo.
2. **Reportes pendientes sobre una anulada quedan atascados** (D12): `0464_reporte_pago_factura_pagada.sql` rechaza con `PAYMENT_STATE` toda operación (crear, cancelar, confirmar y rechazar) si la factura está anulada. Ese reporte no se puede cerrar, el aviso nunca sale y el portal lo muestra en revisión para siempre. Pide migración.
3. `getCompanyData` resuelve el tenant con `user_tenants` `limit(1)` sin filtro (`lib/studio/company-queries.ts`): cualquier otro consumidor con sesión híbrida puede recibir los datos de otro tenant. Hay que inventariar sus llamadores.
4. **Otros topes silenciosos del portal**: `listMyShipments` corta en `.limit(100)` (`lib/portal/portal-queries.ts`) y alimenta «Envíos activos» y «Entregados» de Inicio. `listPendingAcceptanceInvoices` lee los borradores por aceptar con `.limit(100)` (`lib/portal/portal-legal-queries.ts:143`) y devuelve `[]` ante un error (`:145`, y `lib/portal/pending-acceptance.ts:53-60` atrapa todo): el conteo y el total «por aceptar» de Mis facturas pueden salir cortos o desaparecer sin decir «no disponible».
5. `invoiceKpis` del Studio descarta el `paid` de las anuladas sin mostrarlo (`lib/studio/invoice-queries.ts`, archivo de la 0555).
6. **Paginación por offset en `lib/db/paginate.ts`**: la deduplicación de C1 cubre la emisión entre páginas en el portal; con más de 1000 filas, una que salga del conjunto entre páginas hace que la siguiente se salte una fila, en el portal y en los demás usuarios de `fetchAllPaged` (también el estado de cuenta del Studio). Pide paginación por keyset.
7. Si el primer intento de resolver queda incierto y el reintento es replay, no sale correo (límite aceptado en la spec). Se podría deduplicar por `mail_logs.metadata` (`report_id` + `status`) sin migración.
8. **Moneda dominante por monto nominal**: entre dos monedas con deuda gana la de mayor número, sin tasa. Nunca deja la deuda afuera, pero convertir con `fx_rate` o mostrar un saldo por moneda es una decisión de producto para Sam. Hoy no ocurre: todas las facturas de producción están en USD según la radiografía del plan contable.
