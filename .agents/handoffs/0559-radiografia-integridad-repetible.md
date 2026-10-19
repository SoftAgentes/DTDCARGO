# Handoff · SDD-0559 · Radiografía de integridad contable repetible

| Campo | Valor |
|---|---|
| Fecha | 2026-10-19. La primera vuelta fue en Caracas de 05:00 a 05:55 aprox. (UTC 09:00 a 09:55). Las correcciones R1-R14 de la revisión adversaria, de 06:20 a 07:15 aprox. (UTC 10:20 a 11:15). La vuelta final S1-S9, de 07:15 a 07:50 aprox. (UTC 11:15 a 11:50) |
| Task ID / owner | `contabilidad-2026-10-18` / subagente escritor de la sesión Worker «Contabilidad» |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0559-radiografia-integridad` |
| Rama | `codex/sdd-0559-radiografia-integridad`, desde `origin/main` `7fba5711` (merge de la #282). La reserva entró por cherry-pick (`1b36a1ef`). `origin/main` avanzó con la #283 (SDD-0557) y se fusionó sin rebase (`5935b093`, sin conflictos: el driver resolvió el índice). Antes de cerrar las correcciones y otra vez antes de cerrar la vuelta final, `git fetch origin main` dejó `origin/main` en `bb6bb3e4` (`git ls-remote` lo confirma), el mismo del merge, así que no hubo un merge nuevo |
| SDD | [0559](../../docs/specs/0559-radiografia-integridad-repetible/spec.md), `in-progress` |
| Estado | commits locales, **sin push ni PR**. Falta el paso con Docker, que espera el turno de verify |
| Permisos | El encargo de la Worker autoriza commits selectivos en la rama propia. No incluye push, PR, producción ni base de datos. `pnpm verify` y `check-schema-rebuild` (Docker) necesitan turno del Director |

## OBJETIVO ORIGINAL

Es la tarea 1.1 del plan contable (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`, §8, fase 1): convertir la consulta con la que el Director midió producción el 2026-10-18 en un script versionado de solo lectura, probado, con las definiciones corregidas y las filas que faltaban, para correrlo antes de cada migración de reparación de la fase 2.

## COMPLETADO

- `scripts/qa/radiografia-integridad.sql`: la radiografía, con una sola tabla de salida (`orden · seccion · indicador · n · monto_usd`).
  - Por defecto, solo conteos. Con `-v montos=on`, monto en seis filas de documentos en USD/USDT y la marca `MONTOS-NO-VA-A-GIT · ` en cada sección (E4). La cabecera dice «seis filas», y la prueba deriva ese número del mismo mapa de montos que afirma.
  - Aplica las definiciones canónicas: asiento vivo, origen por `source` y vínculo en los dos sentidos, también para los créditos (`referral_id` o `applied_entry_id`).
  - 1.1.2 y 2.1.1 se comparan por tenant y cada tenant cae en uno de seis estados, con el orden de las decisiones 6 y 7 del Director (E1). En 1.1.2, el recibo vuelve «no comparable» al tenant solo si toca 1.1.2: con factura y, si se identificó, con su reclasificación viva (R2, S5).
  - Filas nuevas (E2):
    - VES/CNY con asiento;
    - documentos con más de un asiento vivo, por tipo;
    - recibos identificados sin reclasificación;
    - créditos de referido sin asiento y asientos de crédito sin crédito aplicado;
    - USDT sin tasa, informativa;
    - reporte «cancelado»;
    - 0 contra 0 y «sin movimiento en el mayor», cada una en su fila;
    - documentos abiertos en VES/CNY fuera de la suma.
  - De la revisión adversaria: la 47 (asientos de venta huérfanos), la 58 (recibos con vínculo viejo) y la 87 (facturas sin cobrado ni fuentes). Sobre el esquema vacío salen 63 filas fijas.
- `scripts/qa/radiografia-integridad.fixture.sql`:
  - aplica las 8 migraciones reales y las tres columnas de 0421 que lee el script;
  - siembra diecisiete tenants trampa (A-N, P, S y T) con CENTINELA en cada texto (E3, E9);
  - aborta si la base ya tiene objetos de aplicación.
- `scripts/__tests__/radiografia-integridad.test.ts`: 92 casos en PGlite (E5, E9). Los esperados y los mutantes viven en el archivo. Cada esperado se recalculó a mano contra la fixture, y cada fila lleva un comentario con los documentos que la producen. Los casos:
  - el esquema vacío (63 filas fijas en cero);
  - los 96 conteos;
  - cada tenant en un solo estado por cuenta;
  - cada factura en una sola fila del cobrado;
  - la privacidad de los conteos: cinco columnas exactas y ningún valor con forma de monto;
  - el modo montos;
  - **79 mutantes**, cada uno afirmado sobre todas las filas que cambia y solo sobre esas: 7 de la consulta del Director y 72 de las reglas nuevas;
  - los controles rojos de fuga (`client_name`), de máscara y de la sexta columna;
  - la revisión estática: identificadores prohibidos y palabras que escriben;
  - la forma psql: `begin;`, `commit;`, los controles de transacción en el medio (también detrás de un comentario) y las metaórdenes escondidas fallan;
  - la guarda de la fixture;
  - la guarda de Git sobre `docs/` y `.agents/`.
- `scripts/check-schema-rebuild.mjs` (E6): después del contrato de aislamiento, la radiografía corre por stdin sobre el esquema completo, una sola vez y en modo conteos. El paso exige exit 0 y la forma de la salida. `SCHEMA_REBUILD_RADIOGRAFIA` permite el control rojo, y `LEDGER_ONLY` no cambió. Ni las correcciones ni la vuelta final lo tocaron.
- La spec, con:
  - las 14 correcciones de la consulta del Director, las 6 de la revisión y las 5 de la vuelta final (S1-S5), con su evidencia;
  - las definiciones canónicas y las decisiones 6 y 7, citadas literalmente como revisables por Sam;
  - los cinco escritores de `paid_amount` (E7);
  - dónde coincide con la SDD-0557 y dónde no, incluida la divergencia R2 y S5;
  - cómo se corre en producción, incluida la mención de `public.referrals`, ahora con `applied_entry_id`, para la próxima autorización;
  - la allowlist exacta, que no cambió, lo que queda fuera con su dueño (E8) y la gobernanza.

  El índice se regeneró y no cambió: el título es el mismo.

Commits (todos con `Co-Authored-By`):

| SHA | Commit |
|---|---|
| `0d9b0f13` | `feat(qa): SDD-0559 — radiografía de integridad contable repetible` |
| `ef93839b` | `feat(qa): SDD-0559 — check-schema-rebuild corre la radiografía sobre el esquema completo` |
| `9c45213b` | `docs(sdd): SDD-0559 — radiografía de integridad contable repetible` |
| `5935b093` | merge de `origin/main` (`bb6bb3e4`) |
| `3fd8cc5f` | `docs(handoff): SDD-0559 — radiografía de integridad contable repetible` |
| `ee97aaf3` | `feat(qa): SDD-0559 — la radiografía corrige lo que dejó la revisión adversaria` |
| `2fb59098` | `test(qa): SDD-0559 — la forma psql también rechaza metaórdenes escondidas` |
| `95736a00` | `docs(sdd): SDD-0559 — spec con las correcciones de la revisión adversaria` |
| `b74f04bb` | `docs(handoff): SDD-0559 — correcciones R1-R14, validación y pendientes para el Director` |
| `e50abf7b` | `docs(handoff): SDD-0559 — cuenta exacta de los mutantes que se conservaron` |
| `8ff66f19` | `feat(qa): SDD-0559 — vuelta final: el recibo que toca 1.1.2, trampas de la decisión 7 y la forma psql` |
| `29dd6da4` | `docs(sdd): SDD-0559 — spec con la vuelta final (S1-S9)` |

Este handoff va en el commit siguiente.

## VUELTA FINAL DEL REVISOR (S1-S9)

Base: `e50abf7b`. La pide `correcciones-0559-b.md` («listo con ajustes menores»). Siguen vigentes `decisiones-0559.md` y `correcciones-0559.md`.

| # | Qué se hizo | Trampa y mutante |
|---|---|---|
| S1 | `sinComentarios` lee el SQL como PostgreSQL: quita `--` y `/* … */` anidados sin tocar `'…'`, `E'…'`, `"…"` ni `$x$…$x$`. `formaPsql` quita los comentarios antes de partir el cuerpo. `CONTROL_DE_TRANSACCION` suma `set [local\|session] transaction`, `set [local\|session] session characteristics`, `set [local\|session] [default_]transaction_read_only` y `reset [default_]transaction_read_only` | Fallan `/* nota */ commit;`, `/* a /* b */ c */ commit;`, un comentario en dos líneas delante de `set local transaction_read_only = off`, y un `commit;` después de `'--'`, `'/*'`, `"/*"`, `$x$/*$x$` y `E'\'/*'`. Fallan los siete controles nuevos de la lista. En PGlite, `set local transaction_read_only = off`, `set local transaction read write` y `set session transaction read write` dejan escribir dentro de `begin transaction read only` (desvío 20) |
| S2 | B: RB2, recibo VES vivo con factura (FB3) y sin asiento, y OPB1, pago VES vivo y sin asiento, sobre BB4, una CxP VES pagada. B sigue cuadrando en las dos cuentas | Tres mutantes: el recibo sin `r.asientos > 0` ({91: 6, 93: 2}), el pago sin `p.asientos > 0` ({101: 3, 103: 0}) y la fila 24 sin `asientos > 0` ({24: 7}) |
| S3 | R21, identificado contra F2: su asiento de cobro AR21 (a 2.1.8) va por `receipt_id`, y su `journal_entry_id` apunta a su reclasificación viva AR21X, que no lleva `receipt_id`. Es sintético: lo dice la fixture y la spec, que lo declara defensivo (`collections-actions.ts:218` y `:317` solo guardan el id del cobro) | El vínculo vivo de cualquier origen ({58: 2}). Dos más para la reclasificación, que era una rama defensiva sin trampa: solo por el lado del asiento ({54: 4}) y solo por el del documento ({43: 0, 54: 5, 91: 4, 95: 4}) |
| S4 | F25, emitida en USD, con su asiento, cobrado 0, sin recibos y con el reporte confirmado P8. Va en la 80 y en la 85, no en la 87. En la 83, `or fuentes > 0` sobraba (con cobrado = fuentes es lo mismo que cobrado > 0) y se quitó | La 80 sin mirar las fuentes ({80: 12}); la partición 80+81+82+87 = 11 también falla con él |
| S5 | **Decisión: se exige `(not r.identificado or r.reclasificaciones > 0)`**, la recomendada. La trampa de la decisión 6 pasa a AFI2, un asiento de venta vivo y sin líneas de FI2, VES. RI1 sigue en I, en las filas 24 y 54 | K: RK2, identificado sin reclasificar, contra FK2 (VES pagada, sin asiento), y K cuadra. T: RT1, identificado y reclasificado, y T es no comparable. Tres mutantes: sin la condición (K, {91: 6, 93: 2}), sin los reclasificados (T, {91: 4, 95: 4}) y solo con los reclasificados (N, {91: 4, 95: 4, 96: 4}). El de la decisión 6 ahora mueve I por AFI2 ({90: 0, 91: 6}) |
| S6 | El párrafo del recibo sin factura salió de en medio de la tabla de estados y quedó debajo, con el del mayor vacío | — |
| S7 | El pendiente 1 dice ahora que la única columna nueva que se lee es `referrals.applied_entry_id` | — |
| S8 | Fila 91: «tenants no comparables (factura, o recibo con factura, en VES/CNY con asiento vivo)», en el SQL, en `ESPERADO` (de ahí sale `INDICADORES`) y en la tabla de salida de la spec | Control en el lugar: la etiqueta vieja falla el vocabulario |
| S9 | Esperados recalculados a mano, fila por fila, y los 79 mutantes corridos. Sin merge: `main` no avanzó | Ver «VALIDACIÓN» |

## CORRECCIONES DE LA REVISIÓN ADVERSARIA (R1-R14)

Base: `3fd8cc5f`. Las pide `correcciones-0559.md`, con el contexto de `impl-0559.json` (`revision`).

| # | Qué se hizo | Trampa y mutante |
|---|---|---|
| R1 | Fila 47: asientos `invoice` vivos sin una factura no borrada por `invoice_id`, incluido el `invoice_id` nulo | P: AFP1 (FP1 emitida y borrada) y AFP2 (sin `invoice_id`). Dos mutantes: sin las borradas y sin las nulas |
| R2 | El recibo de «no comparable» en 1.1.2 exige `invoice_id` no nulo (`con_factura`) | K ahora cuadra (su pago VES sin referencia va a 2.1.8). N es no comparable solo por un recibo VES con factura. I tiene un recibo identificado. Mutantes: con los recibos sin referencia y sin los recibos |
| R3 | `cred_asiento` une por `j.referral_id = c.id or j.id = c.applied_entry_id`. `cred` lee `applied_entry_id`. `applied_invoice_id` queda solo para el cobrado | Q1 unido solo por `applied_entry_id`; AQ5, colgado sin `referral_id` en F15, la factura de Q2 sin asiento. Mutantes: el respaldo viejo por factura ({46: 1, 57: 0}: se tapan) y sin el lado del documento ({46: 3, 57: 2}) |
| R4 | Las filas 80 y 83 exigen `paid_amount > 0 or fuentes > 0`. La fila 87 cuenta las facturas sin cobrado ni fuentes | 22 facturas en la 87. Mutantes: 80 y 83 vuelven a contar el 0 ({80: 31} y {83: 35}), y la 87 sin mirar las fuentes ({87: 24}). Más una prueba de partición: 80+81+82+87 = 83+84+85+87 = fila 11 |
| R5 | Fila 58: recibos vivos con asiento de cobro vivo y `con_vinculo` cuyo vínculo no apunta a un asiento `receipt` vivo (`vinculo_vivo`) | R14 (vínculo a AR14V anulado) y R15 (a AR15V borrado), cada uno con su asiento vivo por `receipt_id`. Mutantes: solo el anulado ({58: 1}) y sin exigir el asiento vivo ({58: 6}) |
| R6 | Corregido el desvío 3 y la spec: la CxP se asienta convertida solo con tasa > 0. **Decisión: la CxP anulada sin tasa queda como «mayor por encima»** (señal de B1, fila 44), como en la SDD-0557, que salta las anuladas (`subdiario.ts:157`) | P: BP1, CNY, anulada, sin tasa, con asiento vivo. P queda en la 104. El mutante «2.1.1 no comparable con las CxP anuladas» ahora mueve G y P ({101: 4, 104: 1}) |
| R7 | `violaciones` exige las columnas exactas `[orden, seccion, indicador, n, monto_usd]` y, en conteos, ningún valor con forma de monto | Control rojo nuevo: `monto as monto_crudo` da `["columnas fuera de la forma", "valor con forma de monto"]`. La cabecera de la fixture ya no promete una búsqueda que no existía |
| R8 | — (el SQL ya era correcto) | M: sin asientos vivos, con un borrador, una anulada sin asiento, una pagada con total = cobrado, una CxP anulada y otra pagada. Da 92 y 102. Cuatro mutantes, uno por cada condición de `abiertos` |
| R9 | — | S: un recibo VES anulado (RS1) y un pago VES anulado (OPS1), cada uno con su asiento vivo. S sigue comparable (95 y 105) y la 24 no los cuenta. Tres mutantes: `r.vivo`, `p.vivo` y el `vivo` de la 24 |
| R10 | **Decisión: la 52 cuenta solo el vínculo a un asiento con `status = 'anulado'`.** El vínculo a uno borrado o en borrador queda solo en la 51 | R16 (vínculo a AR16, borrado) y R17 (a AR17, en borrador). Mutante: «vínculo a cualquier asiento» ({52: 4}) |
| R11 | Spec: la reclasificación unida por `journal_entry_id` es una rama defensiva (ese vínculo solo lo escribe el cobro) | R18, cuyo asiento no lleva `receipt_id` ({51: 6}). Los manuales MBA1 con `bill_id` y MOP1 con `supplier_payment_id` ({62: 2} y {63: 2}) |
| R12 | — | R19, único recibo de F5 y anulado ({41: 3}). R20, anulado, del mismo monto que P1 en F10 ({73: 2}). F23, borrador CNY sin tasa con fecha ({21: 4} y {120: 37}). B con FB2 anulada, FB3 pagada y BB3 pagada, en VES y CNY ({96: 4} dos veces y {106: 2}). ME2, con líneas en 1.1.2/1.1.2.1 y 4.5/4.5.1 ({97: 5} y {130: 28}) |
| R13 | `formaPsql` parte el cuerpo en sentencias y rechaza cualquier control de transacción entre la primera y el `rollback;` final. `ESCRITURA` ya no exige la forma completa | Controles: cada uno de los once controles en el medio; el mutante de la revisión (`commit;` + `update … as i set` + `start transaction read only;`); `update only … i set` y `delete from "invoices"` |
| R14 | El comentario del mutante de la regla del prototipo dice ahora «G y J salen por encima». La cabecera de montos se deriva de `Object.keys(MONTOS_ESPERADOS).length` | Control en el lugar: la cabecera con «siete filas» falla |

## Desvíos respecto del plan y del prototipo

Todos están verificados contra el código o las migraciones reales:

1. **La numeración de las filas cambió.** Ahora va de la 10 a la 131, con una sección nueva, la 5 (más de un asiento vivo). La revisión sumó la 47, la 58 y la 87. La prueba es la fuente de verdad.
2. **Recibos anulados con asiento vivo, en dos filas.** La 42 cuenta solo el origen `receipt`, como la SDD-0557 (`libro-control.ts`, `ORIGEN_POR_TIPO`). La 43 cuenta la reclasificación. El prototipo las juntaba.
3. **2.1.1 «no comparable»** lo vuelve una CxP no anulada o un pago vivo, fuera de USD/USDT, con su asiento vivo. La CxP anulada no lo vuelve, con tasa o sin ella. `bill-posting.ts:58-72` asienta convertido **solo con tasa > 0**; sin tasa asienta el monto tal cual, al nominal. Aun así queda como diferencia («mayor por encima»), que es la señal de B1 (fila 44), igual que en la SDD-0557. La factura, en cambio, se asienta siempre al nominal (B2). Las trampas son BG2 (con tasa) y BP1 (sin tasa).
4. **La regla de «no comparable» de la factura no filtra `borrador`.** La SDD-0557 los excluye porque no los lee. No difieren porque el asiento de venta nace al emitir (`facturacion/actions.ts:396`, `:565`). Esto es INFERIDO. Por la misma razón, la fila 23 dice «facturas en VES/CNY con asiento de venta vivo», sin «no borrador».
5. **Crédito ↔ asiento.** El vínculo es `journal_entries.referral_id` o `referrals.applied_entry_id`, que es el lado del documento que usa la reversión (`referral-credit-posting.ts:462-464`). La primera vuelta usaba la factura como respaldo; R3 lo cambió. Por eso el script lee también `referrals.id` y `applied_entry_id`, que E9 no listaba.
6. **0421 no se aplica en la fixture.** Su preflight pide auditoría, identidad y el bucket. La fixture agrega sus tres columnas y el CHECK de cancelación (`0421_payment_report_commands.sql:41-50`), que hacen falta para el estado «cancelado» (E2). El esquema completo lo cubre `check-schema-rebuild`.
7. **La fixture tiene dieciséis tenants, no seis.** C ganó una factura con asiento: con la decisión 6, sin movimiento en 1.1.2 habría dejado de dar la diferencia que cancela la de D. La revisión agregó M, N, P y S.
8. **69 mutantes, no 12.**
   - El del prototipo «4.5 contra '4.50'» se reemplazó por mutantes de subcuentas reales: la fixture asienta en 1.1.2.1, 2.1.1.1, 4.5.1 y 2.1.5.1.
   - «Abierta» es una sola definición, compartida por B3 y el cuadre. Por eso «sin vencida» mueve las dos.
   - El mutante «1.1.2 abiertas solo emitida/parcial» quedó cubierto por ese y por la tasa cero.
9. **Fila del comentario de la invariante:** `scripts/qa/cobro-factura-race.mjs:20-22`, no 21-22.
10. **«Sin movimiento»** se mide como debe = 0 y haber = 0 sumados, igual que `subdiario.ts` (`estadoDe`), y no como «ninguna línea». Solo difiere con líneas en cero.
11. `je_vivo` es `not materialized`, para que cada subconsulta use los índices por `invoice_id`, `receipt_id`, `bill_id` y `supplier_payment_id`.
12. **R2: «o ya identificados» no lleva un disyunto propio.** El CHECK `payment_receipts_sinref_invoice_check` de 0122 ata `recibido_sin_ref` a `invoice_id` nulo, y la identificación le escribe la factura (`0467_cobro_factura_atomico.sql:312-313`, con FK `on delete restrict` en 0079). Un recibo identificado siempre tiene `invoice_id`, así que `r.identificado` sería una rama equivalente con un mutante sobreviviente. La regla es `con_factura`. **La vuelta final (S5) la acota:** el identificado cuenta solo con su reclasificación viva, porque su asiento de cobro va a 2.1.8.
13. **R12: el borrador sin tasa va en CNY, no en VES.** `lib/studio/invoice-types.ts:421-425` rechaza una VES sin tasa, también en borrador; la CNY sí se acepta. Para la fila 21 da lo mismo, porque cuenta VES y CNY juntas. El borrador con fecha de emisión es sintético: los escritores la dejan nula (`facturacion/actions.ts:378`). El filtro de la 120 es defensivo, pero tiene su trampa.
14. **R12: la 41 y la 73 son dos casos.** La factura anulada con asiento vivo y un único recibo anulado prueba la 41 (R19 en F5). La 73 necesita un reporte confirmado cuya factura tenga solo un recibo anulado del mismo monto (R20 en F10, igual que P1).
15. **R12 y R11, cobertura de más:** tres mutantes que la revisión nombró y la corrección no listaba. El borrador de la 22 (F24), el `distinct` de la 131 (ME3) y el filtro de origen del pago (MOP1).
16. **R13, endurecimiento de más:** la forma psql también rechaza `set session characteristics`, una metaorden con sangría (`  \! …`) y una al final de una sentencia (`… \gexec`). La revisión de seguridad los nombró en el mismo hallazgo.
17. **R1: la fila es defensiva.** El motivo de la corrección dice que el asistente de borrado de la SDD-0560 borra facturas. Lo que borra son borradores sin asiento vivo (spec 0560, matriz: «`invoices` en borrador, sin asiento vivo»). Desde la SDD-0465, `softDeleteInvoice` solo acepta `borrador`. La fila cubre los borrados de antes de la 0465 y la escritura directa (B16).
18. **R6: la trampa fija el estado, no discrimina la tasa.** La regla no mira la tasa: un control en el lugar con BP1 con tasa 7.18 sigue en verde («Tests  82 passed (82)»). Lo que mueve a P es el mutante «con las CxP anuladas».
19. **ME2 vive en E, no en D.** En D, la línea en 1.1.2 habría dejado a D con movimiento bajo el mutante «1.1.2 sin subcuentas», y D dejaría de probar el 0 contra 0. E es no comparable en las dos cuentas, así que ahí el `distinct` no toca ningún estado.

De la vuelta final (S1-S9):

20. **S1, un hueco más que la lista del revisor.** En PGlite, `set local transaction read write` y `set session transaction read write` también vuelven de escritura la transacción después de los `set local` de la cabecera, igual que `set local transaction_read_only = off`, y el patrón viejo (`set\s+transaction`) no los veía. El patrón nuevo acepta `local` o `session` delante de `transaction`, de `session characteristics` y de `[default_]transaction_read_only`. `reset transaction_read_only` da error en PostgreSQL («cannot be reset»), pero va en la lista porque la pide el revisor y no cuesta nada.
21. **S1, el quitacomentarios respeta las cadenas.** Con un quitacomentarios ingenuo, `select $x$/*$x$; commit; select $x$*/$x$;` o `select E'\'/*'; commit; …` esconden el `commit`. Hay un control por cada forma de cadena. El caso `E'\'…'` también da «metaorden dentro de una sentencia», por la barra: es un falso positivo que falla cerrado, y el script no tiene barras.
22. **S2, el pago va sobre una CxP VES (BB4).** La orden hereda la moneda de su CxP (`0468_pago_proveedor_atomico.sql:213-219`). OPL1 y OPS1, de las vueltas anteriores, son VES sobre CxP en USD. No cambia ningún conteo, porque la radiografía no cruza la moneda del pago con la de su CxP, pero no son datos que hoy produzca la app.
23. **S3, sembrado y declarado defensivo a la vez.** El esquema lo permite (solo hay una FK), así que la rama se prueba. Como ningún escritor lo produce, la spec lo declara defensivo. R21 también cubre la reclasificación unida por el lado del documento, que era la otra rama defensiva sin trampa, y suma sus dos mutantes de lado.
24. **S4, la 83 se simplificó.** Con cobrado = fuentes, `cobrado > 0 or fuentes > 0` es lo mismo que `cobrado > 0`: el mutante sin el disyunto era equivalente y no podía morir. Se quitó el disyunto: el mutante sobrevivía porque sobraba código, no porque faltara una prueba.
25. **S5, tres mutantes en vez de uno, y un tenant nuevo.** La condición tiene dos ramas y cada una necesita su trampa: K (identificado sin reclasificar) para la condición entera, T (identificado y reclasificado) para `r.reclasificaciones > 0` y N (aplicado al cobrar) para `not r.identificado`. Sin T, «sin los reclasificados» sobrevivía.
26. **S5, la trampa de la decisión 6 es un asiento sin líneas.** Con la regla nueva, un documento «no comparable» casi siempre deja movimiento en 1.1.2, salvo que su asiento vivo no tenga líneas en la cuenta. AFI2 es eso: un asiento de venta vivo sin líneas, que deja `invoice-posting.ts:173-177` si fallan las líneas y también el borrado de compensación, cuyo error no se mira. Cuenta también en la 111 y saca a FI2 de la 50. Fuera de ese caso no encontré otro que produzca la app: es INFERIDO, porque recorrí `invoice-posting.ts` y `receipt-posting.ts` y no todos los escritores.
27. **S8: `INDICADORES` sale de `ESPERADO`**, así que cambiar la etiqueta en `ESPERADO` basta para el vocabulario.

## VALIDACIÓN

Todo corrió en este worktree y en la rama de la tarea. La primera vuelta se repitió después del merge de `origin/main`. Las correcciones corrieron sobre `ee97aaf3`, `2fb59098` y `95736a00`, y la vuelta final sobre `8ff66f19` y `29dd6da4`, siempre con `origin/main` en `bb6bb3e4`.

| Comprobación | Alcance | Resultado |
|---|---|---|
| `corepack pnpm exec vitest run scripts/__tests__/radiografia-integridad.test.ts` | la prueba, después de S1-S9 | PASÓ: `Test Files  1 passed (1)`, `Tests  92 passed (92)`, exit 0 (13 casos + 79 mutantes). Después de R1-R14: `Tests  82 passed (82)`; en la primera vuelta: `Tests 49 passed (49)` |
| Esperados | los 96 conteos y los 6 montos | recalculados a mano, fila por fila, contra la fixture antes de correr; la primera corrida coincidió entera. Cambiaron 32 conteos y dos montos (71 y 85) |
| Mutantes | 79, dentro de la prueba: los 69 de R1-R14, 34 con su mapa recalculado a mano, y 10 nuevos (S2: 3, S3: 3, S4: 1, S5: 3) | los 79 MUERTOS, cada uno con su diferencia exacta de filas |
| Controles rojos en el lugar (`scratchpad/w0559/control-rojo-3.mjs`; restaura en `finally` y compara sha256) | ver la primera tabla siguiente | 10 de 10 en ROJO, todos con «restaurado: true» |
| `corepack pnpm exec eslint --max-warnings=0` | `scripts/__tests__/radiografia-integridad.test.ts` y `scripts/check-schema-rebuild.mjs` | PASÓ (exit 0, sin salida) |
| `node --check scripts/check-schema-rebuild.mjs` | sintaxis | PASÓ |
| `corepack pnpm typecheck` | repo completo | PASÓ (exit 0): «[tipos-de-ruta] sanos — nada que podar» |
| `node scripts/build-docs-index.mjs` y `corepack pnpm docs:check` | índice | PASÓ: «índice regenerado en docs\specs\README.md — 547 specs, 14 huecos»; «docs:check — índice sincronizado con 547 specs». El índice no cambió |
| `corepack pnpm sdd:check` | numeración | PASÓ: «numbering: sin números repetidos»; avisa los choques históricos ya conocidos (0342, 0394) |
| `corepack pnpm governance:check` | cápsula | PASÓ: «Gobernanza: 28 política(s) aprobada(s) · cápsula vigente» |
| `corepack pnpm components:check` | registro CMP | PASÓ: «CMP-01 válido: 5 fuente(s), agregado reproducible y cero rutas rotas» |
| `node scripts/migrations-lock.mjs verificar` | candado | PASÓ: «migrations-lock: 483 selladas (la mayor: 0491) · 2 espera(s) sin sellar (0422_payment_report_command_boundary, 0423_payment_report_historical_identity) · 0 nueva(s) sin sellar · historia comparada contra bb6bb3e465d3» |
| `git diff --check bb6bb3e4..HEAD` | diff de la rama | PASÓ |
| `node scripts/check-schema-rebuild.mjs` (Docker), con el paso nuevo y su control rojo con `SCHEMA_REBUILD_RADIOGRAFIA` | esquema completo | **NO EJECUTADO**: necesita Docker y el turno de verify que da el Director |
| `corepack pnpm verify` | completo | **NO EJECUTADO**: fuera del encargo, que pide turno del Director |
| `/ui-check`, `revisar-datos-ve` | — | NO APLICA: no hay UI; solo agregados, sin captura ni movimiento de datos personales (ver «Gobernanza» en la spec) |

Controles rojos de la vuelta final, con la prueba oficial y el sobreviviente de cada hallazgo aplicado en el lugar (salida literal de la línea `Tests`):

| Control | Resultado |
|---|---|
| esperado alterado (fila 80 = 12) | `exit 1 · Tests  80 failed \| 12 passed (92)` |
| S1 · `/* nota */ commit;` en el SQL | `exit 1 · Tests  1 failed \| 91 passed (92)`: la forma psql |
| S1 · `set local transaction_read_only = off;` en el SQL | `exit 1 · Tests  1 failed \| 91 passed (92)`: la forma psql |
| S2 · no comparable sin exigir el asiento del recibo | `exit 1 · Tests  79 failed \| 13 passed (92)` |
| S2 · no comparable sin exigir el asiento del pago | `exit 1 · Tests  80 failed \| 12 passed (92)` |
| S2 · fila 24 sin `asientos > 0` | `exit 1 · Tests  81 failed \| 11 passed (92)` |
| S3 · vínculo vivo de cualquier origen | `exit 1 · Tests  79 failed \| 13 passed (92)` |
| S4 · fila 80 sin `or fuentes > 0` | `exit 1 · Tests  82 failed \| 10 passed (92)`: también cae la partición del cobrado |
| S5 · sin exigir la reclasificación del identificado (la regla de antes) | `exit 1 · Tests  78 failed \| 14 passed (92)` |
| S8 · la etiqueta vieja de la fila 91 | `exit 1 · Tests  4 failed \| 88 passed (92)`: el vocabulario de los conteos, el modo montos y los dos controles de privacidad |

Después de los controles, `git status --short` mostró solo los tres archivos de la tarea, con los cambios propios todavía sin commit.

Controles rojos de R1-R14 (historia, sobre `ee97aaf3`):

| Control | Resultado |
|---|---|
| esperado alterado (fila 47 = 3) | `exit 1 · Tests  69 failed \| 13 passed (82)` |
| R7 · sexta columna `monto_crudo` en el SQL | `exit 1 · Tests  4 failed \| 78 passed (82)`: caen la privacidad de los conteos, el modo montos y los dos controles de privacidad, que ya no dan su lista exacta |
| R13 · `commit;` + `update … as i set` + `start transaction read only;` en el SQL | `exit 1 · Tests  2 failed \| 80 passed (82)`: la revisión estática y la forma psql |
| R8 · `abiertos` de 1.1.2 = cualquier factura (sobreviviente de la revisión) | `exit 1 · Tests  70 failed \| 12 passed (82)` |
| R8 · `abiertos` de 2.1.1 = cualquier CxP (sobreviviente de la revisión) | `exit 1 · Tests  70 failed \| 12 passed (82)` |
| R2 · el recibo sin referencia vuelve a contar | `exit 1 · Tests  71 failed \| 11 passed (82)` |
| R12 · fila 97 sin `distinct` | `exit 1 · Tests  70 failed \| 12 passed (82)` |
| R14 · la cabecera dice «siete filas» | `exit 1 · Tests  1 failed \| 81 passed (82)` |
| R6 · BP1 con tasa en la fixture | `exit 0 · Tests  82 passed (82)`, esperado (desvío 18) |

## Impacto documental y conocimiento

- **Documentos canónicos:** la spec 0559, con las definiciones canónicas que ya cita la spec 0557 de `main`, y `docs/specs/README.md`.
- **Pendiente de adopción:** la SDD-0558 (saldo único del cliente) tiene que adoptar las definiciones para el lado «facturas». La spec lo dice; lo coordina el Director.
- **Cambió una definición canónica que la 0557 ya adoptó:** el recibo de «no comparable» (R2, y S5 la acota más). Ver el pendiente 4.
- **Graphify y Archify:** la tarea no cambia esquema, RBAC ni rutas.
- **`knowledge:status`:** salió con exit 0 en la primera vuelta. En el worktree marca `structural` y `semantic` como INVALID porque aquí no están los derivados de Graphify. Lo revisa y publica el Director desde `main` integrado. No se volvió a correr en las correcciones.
- **Obsidian:** sin cambios.

## PENDIENTES DE ESTA TAREA

1. **El turno de verify con Docker.** Hay que correr `node scripts/check-schema-rebuild.mjs` (o el paso `schema-rebuild` de `pnpm verify`) y anotar la línea «radiografía de integridad verificada sobre el esquema completo (N filas, conteos)». Después va el control rojo:
   - copiar el script a `C:\tmp\radiografia-mutante.sql` cambiando `je.receipt_id` por `je.recibo_id`;
   - correr `node -e "process.env.SCHEMA_REBUILD_RADIOGRAFIA='C:/tmp/radiografia-mutante.sql';import('./scripts/check-schema-rebuild.mjs')"`;
   - tiene que salir 1, con «la radiografía de integridad no corre sobre el esquema completo» y el ERROR de columna inexistente.

   Desde la primera vuelta, la única columna nueva que se lee sobre el esquema completo es `referrals.applied_entry_id` (R3); `payment_receipts.invoice_id` ya se leía. La vuelta final no suma ninguna. Este paso la comprueba.
2. **Push de la rama y PR en borrador**, cuando el encargo lo autorice.
3. **La próxima corrida en producción** la hace el Director, con autorización escrita de Sam que nombre la radiografía SDD-0559, diga si es con montos y nombre la migración que dimensiona. Tiene que mencionar que ahora lee `public.referrals` en `id`, `status`, `reward_usd`, `applied_invoice_id`, `applied_entry_id` y `deleted_at`. En Git solo va la salida de conteos.
4. **Para el Director · divergencia R2 y S5 con la SDD-0557.** El K10 de la 0557 (`lib/studio/accounting/libro-control-queries.ts:341-347`, `recibosNoUsdConAsiento`) cuenta cualquier recibo vivo VES/CNY con asiento `receipt` vivo. La radiografía cuenta solo los que tocan 1.1.2: con factura y, si se identificaron, con su `receipt_reclass` vivo. Difieren en dos casos: un pago VES sin referencia asentado y un recibo VES identificado sin reclasificar (los dos en el tenant K). En los dos, la 0557 dice «no comparable» y la radiografía compara. Hay que decidir: alinear la 0557 en una SDD de seguimiento (`d.vivo && moneda && con factura && (!identificado || reclasificado)`) o aceptar la diferencia y anotarla en las dos specs. Hasta entonces, la regla «con un mismo dato, los tres lugares cuentan igual» no se cumple en esos casos. Hoy no tiene efecto: el §0 mide 0 asientos vivos.
5. **Para el Director · anulados sin tasa.** Con la decisión R6, la CxP anulada sin tasa queda como diferencia. Los recibos y pagos anulados fuera de USD/USDT, sin tasa y con asiento vivo, están en el mismo caso: quedan al nominal (`receipt-posting.ts:81-84`, `supplier-payment-posting.ts:70-72`). Si se quiere que vuelvan «no comparable», hay que decidirlo para la 0557, la 0558 y la 0559 a la vez.

## FUERA DE ALCANCE DETECTADO

Es material para la SDD 2.2 (asientos sin fallos silenciosos), salvo donde se indica:

1. **`lib/studio/accounting/invoice-posting.ts:62-71`** da por existente cualquier asiento no borrado con `invoice_id`, incluidos el anulado y el de `referral_credit`. Esa factura nunca se vuelve a asentar.
2. **`lib/studio/accounting/receipt-posting.ts:203-211`** tiene el mismo defecto por `receipt_id`. Es el caso del recibo de producción que apunta a un asiento anulado. La reclasificación (`receipt-posting.ts:464-473`) lo repite por `receipt_id` y `receipt_reclass`.
3. **`lib/studio/collections-actions.ts:215-219`** no guarda `journal_entry_id` cuando el asiento ya existía. Cuando la 2.2 «asiente pendientes», tiene que volver a apuntar el documento al asiento nuevo; si no, el recibo queda en la fila 58 (vínculo viejo).
4. **`scripts/qa/cobro-factura-race.mjs:20-22`**: el comentario de la invariante (`paid_amount` = recibos + reportes) no incluye los créditos de referido aplicados (0471).
5. **Gastos vivos sin asiento `expense`**: es el quinto documento best-effort (`expense-posting.ts:1-20`) y la radiografía no lo mide (E8).
6. **`infra/ops/migraciones/aplicar.sh:114-117`** exige a una lectura previa la misma forma débil que tenía esta prueba: primera sentencia y última línea, sin mirar el medio. El endurecimiento de R13 y de S1 (comentarios quitados como PostgreSQL, `set [local|session] transaction read write` y `transaction_read_only`) le serviría, pero está fuera de esta allowlist. Dueño: el Director (runbook de migraciones).
7. **El borrado de compensación de los postings no mira su error.** Si fallan las líneas, ocho postings, en nueve lugares, borran la cabecera sin comprobar el resultado: `invoice-posting.ts:175-176`, `receipt-posting.ts:287-288` y `:368`, `bill-posting.ts:205-206`, `supplier-payment-posting.ts:210-211`, `expense-posting.ts:202-203`, `claim-posting.ts:191-192`, `depreciation-posting.ts:281-282` y `settlement-posting.ts:159-160`. Si ese borrado también falla, queda un asiento `asentado` sin líneas (fila 111), y la idempotencia por documento (`invoice-posting.ts:62-71`, `receipt-posting.ts:203-211`) ya no lo vuelve a asentar. Es la trampa AFI2 de la fixture.
