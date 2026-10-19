---
sdd: "0558"
title: "Saldo único por cliente y cabecera del perfil v1"
status: in-progress
author: "founder"
created: 2026-10-18
updated: 2026-10-19
supersedes: null
superseded_by: null
related: ["0041", "0246", "0252", "0256", "0258", "0281", "0287", "0297", "0355", "0465", "0511", "0556", "0557", "0561"]
confidencialidad: interno
---

# SDD-0558 — Saldo único por cliente y cabecera del perfil v1

> Una sola definición SQL del saldo de un cliente, `public.client_outstanding(uuid[])` (migración 0492), que usan la ficha, Conversaciones y el job de Kommo; Cobranzas adopta la misma regla. La ficha estrena una cabecera con saldo abierto, vencido, último pago y embarques en curso, que ve todo el que ve clientes. El estado de cuenta del Studio pasa a ser igual al del portal.

## Contexto

Es la tarea 1.3 de la fase 1 del plan contable (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`, tabla de la fase 1, fila 1.3) y responde a los hallazgos **B13** («El perfil del cliente no es un perfil contable ni "360"») y **B15** («Hay dos definiciones distintas de "saldo del cliente"»). Sam autorizó la fase 1 completa.

Antes de esta SDD había varias definiciones del saldo de un cliente y la ficha no mostraba ninguna. Las tres que esta SDD reemplaza por la 0492 eran:

- **Cobranzas** (`lib/studio/payment-queries.ts`, `receivablesQueue` y `buildReceivablesQueue`): `status <> anulada`, así que un BORRADOR con total > 0 entraba a la cola, a los KPI, al export operativo y a los recordatorios; «hoy» se calculaba en UTC, y entre las 20:00 y las 24:00 de Caracas una factura que vencía ese día ya salía vencida.
- **Conversaciones** (`0412_conversation_outstanding_facade.sql:19-91`): solo la moneda DOMINANTE, por el código vigente con igualdad exacta.
- **Kommo** (`lib/studio/kommo-contact-status.ts`, `computeEstadoComercial`): Σ(total − pagado) SIN piso por factura y con las monedas mezcladas, leyendo `invoices` con el cliente admin.

## Decisiones de Sam y del Director

Citadas literalmente; mandan sobre el plan.

- **Decisión 14 de Sam, 2026-10-18 (sesión «Contabilidad»).** A la pregunta «En la ficha del cliente del Studio, ¿quién puede ver cuánto debe, cuánto tiene vencido y la fecha de su último pago?», Sam eligió «Todo el que ve clientes (Recomendado)», con la descripción «También comercial, operaciones y soporte, para cobrar a tiempo. El detalle de facturas y recibos sigue solo para finanzas». Es la recomendación ⭐ de la decisión 14 del plan («Saldo abierto y vencido visibles para todo rol con acceso a clientes; detalle de facturas y recibos bajo el permiso de facturación»).
- **Excepción de marca del estado de cuenta, Sam, 2026-10-18 (SDD-0556).** A la pregunta «En el PDF del estado de cuenta que el cliente descarga del portal, ¿pongo la razón social y el RIF de DTD bajo el logo, como ya los lleva la factura?», Sam eligió «Sí, como la factura (Recomendado)». Esta SDD la aplica también al PDF del estado de cuenta del Studio (F18).
- **Director, 2026-10-19.** La migración es la **0492**: su espera va en `supabase/migrations-baseline.json › pendingBelowCutoff` con motivo, orden MIGRATE-FIRST y «Requiere OK nominal de Sam»; lleva su `*.migration.test.ts` en PGlite; no se aplica desde la sesión Worker, la aplica el Director con `infra/ops/migraciones/`; y «la 0492 NO se fusiona sin aplicar», porque una migración en `main` que no está en el ledger retiene todas las publicaciones.
- **Decisiones 6 y 7 del Director (2026-10-19, revisables por Sam), adoptadas por la SDD-0557 y la SDD-0559.** «**6. Sí:** el mayor vacío también gana en el subdiario de clientes (regla E1 de la 0559)» y «**7. Sí:** "no comparable" cuenta solo las facturas VES o CNY **con asiento vivo**, porque esas son las que distorsionan 4.5 (B2)». La 0492 no lee asientos: de esas reglas toma la definición canónica de **facturas abiertas** («emitidas, parciales, pagadas o vencidas, sin borradores ni anuladas»; `vencida` por defensa) y la de documento vivo (`deleted_at` nulo). Por eso el saldo de la ficha y la radiografía cuentan las mismas facturas.

## Decisión

### Una sola definición SQL del saldo por cliente

`public.client_outstanding(p_client_ids uuid[])` devuelve una fila por cliente pedido y por moneda, sin convertir ni mezclar monedas:

`client_id`, `markboxes` (códigos del cliente, el vigente primero), `currency`, `open_amount`, `overdue_amount`, `open_invoices`, `overdue_invoices`, `oldest_overdue_due_date`, `last_payment_on` y `as_of`.

- **Facturas que cuentan:** emitida, parcial, pagada y vencida, vivas. Borrador y anulada no son deuda.
- **Abierto por factura:** `greatest(0, total − pagado)`. Un sobrepago no compensa otra factura.
- **Vencido:** abierto > 0 y `due_date` < fecha de Caracas (`as_of`). Sin `due_date` nunca vence. `as_of` viaja en la fila para que la app no recalcule «hoy».
- **Códigos del cliente:** el vigente, su historial (0367) y el código e historial de toda ficha cuya cadena `merged_into_client_id` llega a él (0341; hasta 10 saltos, como `resolve_markbox`). `merge_clients` no mueve facturas (0361): sin esto, la deuda de una ficha fusionada se perdía. La comparación con `invoices.client_markbox` es con `upper(btrim())` en los dos lados, como `resolve_markbox` (0367:100 y :108). No hay índice funcional: el índice `(tenant_id, client_markbox)` de 0077 sirve solo para el tenant. A esta escala es aceptable (INFERIDO, no medido).
- **Último pago:** la fecha más reciente entre los recibos vivos y los reportes `confirmado` vivos de CUALQUIER factura viva del conjunto de códigos, en cualquier estado (también la anulada con abono). Si una factura con pagado > 0 no tiene ninguno, su `last_payment_at` en fecha de Caracas sirve de respaldo, por factura. Solo la fecha, nunca el monto.
- **Fila semilla:** un cliente sin facturas que cuenten ni pagos recibe una fila con `currency` null y ceros, para que viajen sus códigos. Una ficha borrada o de otro tenant no devuelve fila.
- **Solo agregados:** ni ids, ni códigos, ni montos por factura.

### Quién la puede llamar (decisión 14)

- `authenticated`, con tenant (`get_user_tenant_id()`) y rol (`current_studio_role()`) activos: rol `admin` o `accounting`, **o** `public.document_entity_authorized('client', tenant, 'view')`, el autorizador de 0444 que reutiliza 0456: roles, defaults, overrides por tenant y membresía. No hay una lista de roles propia en la 0492.
- `service_role` (el job de Kommo), detectado por el principal de la solicitud: `(select auth.role()) = 'service_role'`, como 0311 y 0435.
- Cualquier otro caso: 42501 `CLIENT_OUTSTANDING_FORBIDDEN`. Más de 1000 ids: 22023 `CLIENT_OUTSTANDING_TOO_MANY`.
- No hay rama «conversaciones»: con los defaults, conversaciones ⊂ clients (`lib/studio/rbac.ts`). Quien solo tiene Conversaciones sigue con la fachada de 0412, que esta SDD no toca.

En TypeScript, el mismo criterio es `puedeVerSaldoCliente(role, overrides)` (`lib/studio/client-account.ts`): admin, accounting o la vista de `clients` con overrides. Una prueba anti-deriva lo compara con la 0492 en PGlite, rol por rol, sin override, con `clients` concedido y con `clients` revocado. El botón «Estado de cuenta» usa `puedeVerEstadoDeCuenta(role)` = `canAccessModule(role, 'invoices')`: el detalle de facturas sigue solo para finanzas.

### Los consumidores

- **Lectura única:** `listClientOutstanding` (`lib/studio/client-queries.ts`) es el ÚNICO sitio que nombra la 0492. Va en lotes de 200 ids (200 × 4 monedas = 800 filas, bajo el tope de 1000) y lanza `SaldoClienteError` con el código del error. Las filas se validan con `coerceClientOutstandingRows`, que falla cerrado. Los mensajes de error dicen «saldo: …», nunca el nombre de la función.
- **Ficha del cliente:** la cabecera v1 (`ClientAccountHeader`) con cuatro `KpiCard`. Ver «Cabecera v1».
- **Conversaciones:** `getClientContext(supabase, clientId, conversationId)` pide el saldo del cliente del hilo (`conv.client_id`, ya leído bajo RLS por la ruta). Si la 0492 responde 42501, cae a la fachada de 0412 con el hilo: un rol no financiero ve exactamente lo de hoy, sin ampliar nada. Si falla por otra razón, el contexto sale con el saldo en null («No se pudo calcular el saldo. Ábrelo en la ficha.»), nunca en 0. El panel lista todas las monedas con algo abierto y enlaza a la ficha, ya no a Cobranzas (que solo abre finanzas). La 0412 no se toca.
- **Kommo:** «Tiene saldo pendiente» = alguna moneda con algo abierto (`tieneSaldoAbierto`); «Carga en tránsito» cuenta los embarques vivos de TODOS los códigos del cliente. Sigue siendo Sí/No, sin montos (decisión del 2026-08-14). Ya no lee `invoices`. Si el saldo falla, el job queda inerte y no escribe «No». `soloLecturaKommo` (en `lib/studio/kommo-contact-status.ts`, porque una ruta de Next no puede exportar helpers) reemplaza al `dryAdmin` del cron: `dry=1` solo neutraliza la RPC de encolado; antes neutralizaba TODA RPC y, con el saldo por RPC, habría dicho «sin saldo» para todos.
- **Cobranzas:** no llama a la 0492, porque trabaja por factura (gestiones, promesas, recordatorios). Adopta la MISMA regla: `.in('status', ESTADOS_FACTURA_CON_SALDO)` en la base y `cuentaParaSaldo` en `buildReceivablesQueue`, y `todayCaracasISO()` como «hoy» por defecto (`daysOverdue`, `derivedStage`, `buildReceivablesQueue`, `receivablesQueue`, `collectionKpis`). La pantalla (`cobranzas/page.tsx`) y los recordatorios (`cobranzas/actions.ts`) pasan la fecha de Caracas. **La tarjeta de separación de fondos de la misma pantalla también pasa a la fecha de Caracas**: su período (del 1 del mes a hoy) sale del mismo `today`. Los borradores dejan de entrar a la cola, a los KPI, al export operativo (que usa el default) y a los recordatorios. Una prueba de propiedad en PGlite fija la paridad con la 0492.
- **«Embarques en curso»** reutiliza `INACTIVE_STATUSES` de `lib/studio/shipment-queries.ts` (draft, delivered, cancelled), que ahora se exporta: es la lista del tracking operativo y la de Kommo, sin una tercera constante.
- **Fecha de Caracas:** se usa `todayCaracasISO` (`lib/studio/bitacora/dates.ts`). El helper duplicado `hoyCaracas` (`lib/studio/rate-types.ts:89`) queda anotado como FUERA DE ALCANCE.

### Cabecera v1

Componente de servidor `ClientAccountHeader`, entre el encabezado de la ficha y la grilla, con cuatro tarjetas en `repeat(auto-fit, minmax(260px, 1fr))`. Los 260 px salen de MEDIR con la Sora real (900 30px, tabular-nums, −0.02em): «12,345,678.90» mide 220 px y, con los 40 px de relleno de `KpiCard` (que corta con `overflow: hidden`), es el ancho en que la cifra más larga de un saldo en bolívares cabe sola en su renglón.

- **Saldo abierto:** la primera moneda con algo abierto (orden USD, VES, USDT, CNY) en el valor; las demás en el sub («Además VES 900.00») y «N facturas por cobrar». Sin saldo: «Al día», «Sin facturas por cobrar», sin el borde vino.
- **Vencido:** por moneda, igual que el saldo. Valor en `var(--danger)`; el tramo es el del vencimiento más antiguo ENTRE monedas, con su moneda («Más antiguo: 31–60 días, en USD · 2 facturas vencidas», con los tramos de `AGING_BUCKETS`). Sin vencido: «Al día», «Nada vencido al 19 oct 2026», sin el borde vino.
- **Último pago:** fecha corta sin `Date` («15 oct 2026», `fechaCorta`) y «Recibos y reportes confirmados». Sin pagos: «Sin pagos».
- **Embarques en curso:** el número, o «—» si no se pudo contar; «Sin entregar, cancelar ni en borrador» y, con más de un código, «En todos sus códigos».
- **Notas:** con más de un código, «Incluye los códigos anteriores o fusionados: …»; la fecha de corte («Saldo al …, con la fecha de Caracas»); y la nota de diferencia con el estado de cuenta (ver «Criterios»).
- **Montos:** un solo formato para la cabecera y el panel de Conversaciones: `formatInvoiceAmount` (`lib/portal/portal-types.ts`, «USD 1,250.00»). La frontera de eslint lo permite: el Studio ya importa de `lib/portal` en la misma ficha.

### Estado de cuenta del Studio igual que el del portal (F18)

- `filasParaLedger` (`app/studio/(app)/clientes/[markbox]/estado-de-cuenta/page.tsx`) deja de descartar las anuladas emitidas: el ledger compartido (`lib/portal/statement-ledger.ts`) las pone en 0 y saca lo pagado a `voidedPayments`. Descarta, como el portal (`lib/portal/portal-queries.ts`, `esAnuladaSinEmitir`), los borradores y las anuladas que nunca se emitieron.
- La pantalla muestra `notaPagosEnAnuladas` y `notaSobrepagos` con `donde: "libro"` (`lib/portal/saldo-de-cuenta.ts`), bajo el rótulo «Lo que el cliente ve en su portal y en el PDF».
- El PDF del Studio pasa `legalName` y `rif` del emisor (excepción de marca del 2026-10-18).
- La prueba del mapeo pasa a «conserva las anuladas y el ledger no las cuenta como deuda», con el caso «anulada con abono no desaparece». No es debilitarla: la regla pasó al ledger compartido en la SDD-0556. Se corrige su comentario de «mayor total facturado»: la moneda sigue a la deuda.

### Las definiciones del saldo que quedan, con su destino

El criterio «una sola definición SQL» se limita al **saldo por cliente**. Las demás cifras miran otra cosa y tienen su propio dueño:

| Definición | Regla | Destino |
|---|---|---|
| `client_outstanding` (0492) | por cliente y moneda; piso por factura; emitida/parcial/pagada/vencida; Caracas; códigos vigente, historial y fusionadas | **esta SDD**: ficha, Conversaciones y Kommo |
| Cola de Cobranzas (`payment-queries.ts`) | por factura; mismos estados; piso (solo saldo > 0); Caracas | **esta SDD**: misma regla, paridad probada. El KPI «Vencido» excluye las promesas vigentes por diseño de SDD-0041 (FUERA DE ALCANCE) |
| Fachada de 0412 (`conversation_client_outstanding`) | moneda dominante; código vigente; piso | queda solo como respaldo ante 42501; se retira en otra SDD con su propia migración |
| Estado de cuenta, pantalla y PDF (`buildStatementLedger`) | moneda dominante que sigue a la deuda (SDD-0556); código vigente; neto sin piso con la nota de sobrepagos; `listInvoices` con tope 200 | divergencia conocida hasta la fase 5.2 (ver «Criterios») |
| `invoiceKpis` (`lib/studio/invoice-queries.ts:175`) | piso por factura; sin borrador ni anulada; mezcla monedas; `isOverdue` con «hoy» en UTC | SDD-0557 o fase 5 |
| `financeInvoiceKpis` (`lib/studio/dashboard/dashboard-kpi-queries.ts:55`) | misma regla que `invoiceKpis` | SDD-0557 o fase 5 |
| KPI del portal (`resumenDeCuenta`, `lib/portal/saldo-de-cuenta.ts`) | moneda dominante; piso; anuladas fuera | SDD-0556 (integrada) |
| Subdiario de clientes contra 1.1.2 (`lib/studio/accounting/libro-control.ts`, SDD-0557) | Σ(total − pagado) CON signo, en USD, para comparar con el mayor | correcta por diseño: compara contra el libro, no es un saldo de cliente |

### Migración y orden

`supabase/migrations/0492_client_outstanding.sql`, solo la función, aditiva. No reescribe la 0412. Su preflight aborta sin cambiar nada si falta una tabla, un tipo, un valor de enum o una columna con su tipo, si faltan `auth.uid()` o `auth.role()`, si la función ya existe, o si los cuerpos que reutiliza no son los esperados (md5 del `prosrc` con CRLF→LF, o sin espacios donde ya se midió así), con su seguridad, volatilidad y `search_path`:

| Función | Origen | md5 | md5 sin espacios |
|---|---|---|---|
| `get_user_tenant_id()` | 0453 | `5ff0c51c26a49419c34abc78f1d95c37` | `4ce5acd04a577f91ca77b74ebc622c49` |
| `current_studio_role()` | 0200 | `b7157932457d04df4e8cf7621d212965` | `df8ba5229960ba06888dec61fbec2bc5` |
| `document_entity_authorized(text,uuid,text)` | 0444 | `4eb9fd08721e8f754087dddc5cb88953` | — |
| `document_entity_module_contract(text)` | 0444 | `9c78c98fb29c311926f93a1c28ce1c32` | — |

Las huellas se tomaron del árbol (`supabase/migrations`) y coinciden con las que 0470 leyó de producción el 2026-09-19 (las dos primeras) y con las que el preflight de 0456 verificó al aplicarse (las de 0444). Una prueba las recalcula del árbol. **El Director debe releerlas en producción antes de aplicar.** El postflight exige DEFINER, STABLE, la forma exacta del resultado, `search_path` vacío, owner postgres y EXECUTE solo para `authenticated` y `service_role`.

**MIGRATE-FIRST.** La PR queda en borrador con la espera declarada y no se fusiona sin aplicar la 0492. Si se fusionara antes, la ficha mostraría «No se pudo calcular el saldo», el panel de Conversaciones quedaría sin saldo y Kommo inerte (degradaciones declaradas en `supabase/pending-migration-symbol-declarations.json`). No se toca `supabase/migrations.lock.json`: el Director sella la 0492 con `retirar-espera.mjs --md5` al aplicarla.

## Alcance

- La migración 0492, su contrato SQL y su prueba en PGlite.
- Las reglas puras del saldo (`lib/studio/client-account.ts`) y su lectura (`lib/studio/client-queries.ts`).
- Ficha del cliente: cabecera v1 y botón «Estado de cuenta» por rol.
- Conversaciones, Kommo y Cobranzas con la misma definición.
- Estado de cuenta del Studio igual al del portal, con razón social y RIF en su PDF.
- Espera, declaración de símbolos e inventario de lecturas de facturas.

Fuera de alcance: el estado de cuenta multimoneda y por todos los códigos (fase 5.2), el saldo a favor y la nota de crédito (fase 2.8), el equivalente en USD o Bs (fase 2.1), la FK `client_id` en facturas y embarques (fase 3.3), el recibo al confirmar un reporte del portal (B4, fase 2) y retirar la 0412.

## Allowlist exacta

Migración y pruebas de base de datos:

- `supabase/migrations/0492_client_outstanding.sql` (nuevo)
- `supabase/tests/0492_client_outstanding.test.sql` (nuevo)
- `supabase/tests/_0492_client_outstanding_schema.sql` (nuevo)
- `lib/studio/__tests__/client-outstanding.migration.test.ts` (nuevo)
- `supabase/migrations-baseline.json`
- `supabase/pending-migration-symbol-declarations.json`

Reglas y lectura del saldo:

- `lib/studio/client-account.ts` (nuevo)
- `lib/studio/__tests__/client-account.test.ts` (nuevo)
- `lib/studio/client-queries.ts`
- `lib/studio/shipment-queries.ts`

Cobranzas:

- `lib/studio/payment-queries.ts`
- `app/studio/(app)/cobranzas/page.tsx`
- `app/studio/(app)/cobranzas/actions.ts`
- `app/studio/(app)/cobranzas/__tests__/hoy-caracas.test.ts` (nuevo)
- `lib/studio/__tests__/payment.test.ts`
- `lib/studio/__tests__/receivables-queue.test.ts`

Kommo:

- `lib/studio/kommo-contact-status.ts`
- `app/api/cron/kommo-contact-status/route.ts`
- `lib/studio/__tests__/kommo-contact-status.test.ts`
- `lib/studio/__tests__/avisos-sin-eliminados.test.ts`
- `scripts/__tests__/invoice-read-boundary.test.mjs`

Conversaciones:

- `lib/studio/conversaciones/conversations-queries.ts`
- `lib/studio/conversaciones/conversations-types.ts`
- `lib/studio/conversaciones/__tests__/client-context.test.ts`
- `app/api/studio/conversaciones/[id]/route.ts`
- `app/api/studio/__tests__/route-auth.test.ts`
- `app/studio/(app)/conversaciones/_components/ConversationThread.tsx`
- `app/studio/(app)/conversaciones/_components/SaldoPendienteContexto.tsx` (nuevo)
- `app/studio/(app)/conversaciones/_components/SaldoPendienteContexto.test.tsx` (nuevo)

Ficha del cliente:

- `app/studio/(app)/clientes/[markbox]/page.tsx`
- `app/studio/(app)/clientes/_components/ClientAccountHeader.tsx` (nuevo)
- `app/studio/(app)/clientes/_components/ClientAccountHeader.test.tsx` (nuevo)
- `app/studio/(app)/clientes/_components/ClientDetailClient.tsx`
- `app/studio/(app)/clientes/_components/ClientDetailClient.estado-de-cuenta.test.tsx` (nuevo)

Estado de cuenta:

- `app/studio/(app)/clientes/[markbox]/estado-de-cuenta/page.tsx`
- `app/studio/(app)/clientes/[markbox]/estado-de-cuenta/pdf/route.ts`
- `lib/studio/pdf/estado-de-cuenta-pdf.tsx` (solo el comentario de cabecera)
- `app/studio/(app)/clientes/__tests__/estado-de-cuenta.test.ts`
- `app/studio/(app)/clientes/__tests__/estado-de-cuenta-page.test.tsx` (nuevo)
- `app/studio/(app)/clientes/__tests__/estado-de-cuenta-pdf-route.test.ts` (nuevo)

Documentación:

- `docs/specs/0558-saldo-unico-cliente-cabecera/spec.md`
- `docs/specs/README.md` (regenerado con `node scripts/build-docs-index.mjs`)
- `.agents/handoffs/0558-saldo-unico-cliente-cabecera.md` (nuevo)

## Criterios de aceptación

1. Existe una sola definición SQL del saldo por cliente (0492). La ficha, Conversaciones y Kommo no calculan saldo en TypeScript: `git grep -n "total_amount" -- lib/studio/kommo-contact-status.ts lib/studio/conversaciones/conversations-queries.ts` sale vacío.
2. La cabecera de `/studio/clientes/[markbox]` muestra «Saldo abierto», «Vencido», «Último pago» y «Embarques en curso» por moneda, sin mezclar; incluye las facturas y embarques de los códigos anteriores y de las fichas fusionadas, y lo dice cuando hay más de un código.
3. La ven comercial, operaciones, soporte, contabilidad y admin (decisión 14). Sin permiso para el saldo, solo «Embarques en curso», sin llamar a la 0492 ni pintar dinero. Si el cálculo falla, «No se pudo calcular el saldo» con una referencia.
4. Para el mismo cliente y moneda, la suma de la cola de Cobranzas por los códigos del cliente es igual a `open_amount` y `overdue_amount` (prueba de propiedad en PGlite).
5. Vencido = `due_date` < fecha de Caracas, en SQL y en Cobranzas (pantalla, KPI, recordatorios y separación de fondos).
6. Cobranzas ya no lista, cuenta ni recuerda borradores.
7. El botón «Estado de cuenta» no aparece para roles sin el módulo `invoices`; para contabilidad y admin sigue igual.
8. Kommo sigue escribiendo solo Sí/No; si el saldo falla queda inerte y no escribe «No»; `dry=1` sigue leyendo saldos reales.
9. El estado de cuenta del Studio conserva las anuladas emitidas en el libro con cargo 0, informa lo pagado en ellas sin descontarlo, muestra las notas del portal, y su PDF lleva razón social y RIF.
10. **Divergencia conocida:** en la misma ficha, el estado de cuenta usa la moneda dominante, el código vigente, el neto sin piso y el tope de 200 facturas; la cabecera, todas las monedas por separado, todos los códigos y el piso por factura. Para un cliente fusionado, con códigos anteriores, multimoneda o con sobrepago, las cifras pueden diferir hasta la fase 5.2. La cabecera lo dice («El estado de cuenta muestra solo el código vigente y una moneda, así que su saldo puede no coincidir con este.») cuando hay más de un código o más de una moneda, y solo a quien puede abrir el estado de cuenta.
11. La 0492 está declarada en `pendingBelowCutoff` (MIGRATE-FIRST, «Requiere OK nominal de Sam») y en las declaraciones de símbolos; `node scripts/check-pending-migration-symbols.mjs` sale «0 ROJO · 1 AMARILLO declarado(s)».
12. La 0492 no se aplica desde la sesión Worker; la fusión de la PR espera su aplicación autorizada.

## Pruebas y control rojo

- **Contrato SQL** (`supabase/tests/0492_client_outstanding.test.sql`, 35 aserciones), también en PGlite: control rojo sin la 0492 y 18 mutantes de la función, cada uno muerto en la aserción de su regla.
- **Anti-deriva:** la lista de estados de la 0492 es `ESTADOS_FACTURA_CON_SALDO` (y coinciden `SALE_STATUSES` y `ESTADOS_DE_INGRESO`); `puedeVerSaldoCliente` responde lo mismo que la 0492 para cada rol y override; cada huella del preflight es el md5 del cuerpo que el árbol define por última vez.
- **Paridad (propiedad):** cuatro semillas fijas × 70 facturas al azar (todos los estados, monedas, códigos, fechas, borradas y otro tenant), en su propia instancia de PGlite.
- **TypeScript:** las pruebas de la allowlist. 34 mutantes del código TS, uno por vez, todos muertos (ver el handoff).
- **Casos movidos al contrato SQL** (la regla vive en la 0492): borrador, anulada y factura eliminada de Kommo y de `avisos-sin-eliminados`; el «anticipo de otro cliente» pasó a «un sobrepago no compensa otra factura». El caso del centavo de Kommo se **retira**: el cálculo pasa a `numeric(14,2)` y ese defecto ya no existe.

## Límites conocidos

- «Embarques en curso» cuenta con `.in('client_markbox', códigos)` por igualdad exacta del texto guardado (btrim de cada código). Un embarque con el código en otra caja o con espacios no se cuenta. El historial de envíos de la ficha sigue por el código vigente, así que «Embarques en curso» puede ser mayor que la lista de abajo.
- Sin permiso para el saldo (no debería pasar: el layout de clientes ya exige la vista de `clients`), los embarques se cuentan con el código vigente y el historial, sin las fichas fusionadas.
- El respaldo `last_payment_at` cuenta también un crédito de referido aplicado (0471 lo escribe) si la factura no tiene recibo ni reporte confirmado.
- Comercial, operaciones y soporte pasan a ver saldo, vencido, último pago y códigos anteriores de CUALQUIER cliente del tenant, no solo de los que tienen hilo en Conversaciones (0412). Es la decisión 14 de Sam.
- PGlite no es PostgreSQL 17: el contrato corre también con Docker en `pnpm verify`, con turno del Director.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento del Studio | cumplimiento | esta spec con allowlist exacta |
| ERR-01 | cumplimiento | nivel **Sistema**: la cabecera muestra «No se pudo calcular el saldo.» con una referencia de 8 caracteres que queda en el log (`[saldo-cliente] ref=…`) y dice qué hacer («Recarga la página en unos minutos. Si sigue igual, avísale a soporte con la referencia …»); el panel de Conversaciones dice «No se pudo calcular el saldo. Ábrelo en la ficha.». Nivel **Seguridad**: ante 42501 o sin permiso, la cabecera no pinta ningún dato de dinero ni un aviso que revele que lo hay. Ningún mensaje lleva SQL ni detalle de la base |
| VIS-01 | cumplimiento | el énfasis va al riesgo: el vencido en `var(--danger)` con su texto; «Al día» sin el borde vino; las notas en texto secundario. Ver el `/ui-check` del handoff |
| A11Y-01 | cumplimiento | contraste medido (handoff): todo el texto nuevo pasa 4.5:1 salvo el valor del vencido en tema oscuro sobre el tope del degradado de la tarjeta (4.47:1), que es texto grande (30 px, 900) y pasa el 3:1; el vencido no depende del color (rótulo «Vencido» y monto); la cabecera es una `section` con nombre accesible; el aviso de error es `role="status"` |
| BTN-01 | cumplimiento | no hay botones nuevos. «Estado de cuenta» sigue siendo un enlace terciario (`studio-btn-ghost`) y ahora solo se pinta si el rol puede abrirlo: ya no lleva a un rebote. «Ver en la ficha →» es un enlace de navegación |
| AUD-01 | no aplica | la función solo lee; no cambia qué se audita |
| LOD-01, FRM-01 | no aplica | no cambian formularios ni estados de carga del Studio |
| CMP-01 | no aplica | `ClientAccountHeader` y `SaldoPendienteContexto` son componentes de la pantalla, no del sistema; reutilizan `KpiCard`. `pnpm components:check` en verde |
| Datos personales (`revisar-datos-ve`) | cumplimiento, con la ampliación declarada | la 0492 devuelve solo agregados; la ampliación a comercial, operaciones y soporte es la decisión 14; el payload a Kommo no cambia (Sí/No); ver el handoff |

## Validación

Ver el handoff `.agents/handoffs/0558-saldo-unico-cliente-cabecera.md`.
