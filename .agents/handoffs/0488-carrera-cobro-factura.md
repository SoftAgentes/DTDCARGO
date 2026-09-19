# Handoff 0488 — Registro atómico de cobros en facturas

- Fecha: 2026-09-18, Caracas (2026-09-19 UTC). Estado de la tarea: **lista para
  revisión**, sin publicar. El reporte va al Director antes de publicar la rama
  y abrir la PR. La 0467 **no está aplicada**, y la SDD sigue en `in-progress`
  hasta que se aplique y se integre.
- Owner / sesión: `worker-carrera-cobro-factura-opus5-20260918` (Claude Opus 5,
  Worker, sesión «Hacer atómico el registro de cobros en facturas»).
  Director: `dtdcargo-18`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/carrera-cobro-factura`.
- Rama: `codex/carrera-cobro-factura`, desde `origin/main` = `1b64bdae`. El
  2026-09-19 a las 00:57 UTC se trajo `origin/main` = `26983062` (#150, SDD-0484
  con la 0464) en el merge `d9855875`, sin conflictos. A las 01:27 UTC se trajo
  `a90c242b` (#152, SDD-0477: sólo una prueba SQL de la 0460 y docs, sin
  solaparse) en el merge `6aabc096`, también sin conflictos. El driver
  `dtd-generated-records` dejó 0464 y 0467 en `pendingBelowCutoff`.
- Aislamiento: `harness-worktree start carrera-cobro-factura`, `guard` → `Guard OK`
  y claim adquirido antes de editar.
- SDD: [0488](../../docs/specs/0488-carrera-cobro-factura/spec.md), `in-progress`.
  La reservó el Director en `codex/sdd-reserve-0488-carrera-cobro-factura`
  (`764a6049`, traído por cherry-pick como `49b896a6`). Migración asignada:
  **0467** (la 0466 es de la SDD-0487).
- Permisos del encargo: commits en esta rama; reportar al Director antes de abrir
  la PR. **No merge.** Producción: sólo lectura de catálogo, nunca filas de
  negocio. Ninguna migración se aplica sin OK nominal de Sam; la aplica el
  Director con `docs/runbooks/aplicar-migraciones-prod.md`. Turno de máquina del
  Director antes de Docker, verify completo o suite completa de Vitest. De
  producción **sólo se leyó catálogo**, una vez, con el conector Supabase que
  apareció en la sesión (ver «Catálogo de producción»). Ninguna escritura,
  ninguna fila de negocio.

## Objetivo

Reproducir con dos sesiones reales la pérdida de actualización de
`invoices.paid_amount` al registrar cobros (`lib/studio/collections-actions.ts`).
Si se confirmaba, llevar la operación a una RPC que tome la factura `for update`,
valide el saldo, inserte o anule el cobro y actualice `paid_amount` y `status` en
una sola transacción. Con control rojo y un mutante sin `for update`, y con una
regla de saldo coherente con la 0464 (SDD-0484) que decide Sam.

## Decisiones del Director

- Alcance (2026-09-18): **incluye `voidReceiptFor`**, por ser el mismo
  invariante. Probar también con dos sesiones una anulación concurrente con un
  cobro y con una confirmación de reporte.
- Regla de saldo: la decide Sam; su respuesta literal va en la spec.
- Orden de release (2026-09-18): **(A) migrate-first**, con la 0467 declarada en
  `pendingBelowCutoff`. El rojo de «Código contra migraciones pendientes» es el
  candado que impide integrar el código antes que la migración. Secuencia:
  1. PR con la espera declarada.
  2. Revisión del Director.
  3. OK nominal de Sam con la identidad del archivo.
  4. El Director aplica la 0467.
  5. Commit final que la saca de la espera; la cabecera del `.sql` no se toca.
  6. CI verde, integración y smoke de Sam: cobrar, identificar y anular.

  La opción (B), un fallback al camino viejo, queda descartada.
- Docker: ventana de 15 minutos, con un contenedor, fsync off y sin verify. Se
  usó de 00:52:40 a 00:55:13 UTC y se devolvió enseguida.
- Correcciones dentro del alcance, aprobadas con condiciones:
  - Lock consultivo por tenant para el código R-, sin tocar `next_receipt_code`.
    Se prueba con dos cobros simultáneos en facturas distintas del mismo tenant
    (escenario 8).
  - No revivir una factura `anulada` al anular un recibo. Es un bug: se documenta
    el camino que lo alcanza (`void_invoice_with_audit_reason` sobre una
    `parcial`) y se agrega un caso al contrato.
  - Rol accounting o admin en las tres RPC, como la 0421. La spec deja escrito
    que la RLS de `payment_receipts` sólo filtra por tenant: el hueco por
    PostgREST sigue abierto hasta otra tarea.
- «La 0467 va después de la 0464», que ya está en main y se aplica antes. La 0467
  no depende de ella. Los escenarios 12 y 13 prueban que las dos reglas de saldo
  coinciden y se serializan.

## Decisión de Sam

2026-09-18, por AskUserQuestion en esta sesión. Pregunta: «Hoy el cobro y la
identificación de pagos en Studio aceptan hasta 0,01 por encima del saldo de la
factura. La confirmación de reportes de pago de la 0464 (SDD-0484) rechaza
cualquier excedente y cualquier factura ya pagada. ¿Qué regla aplico en la nueva
RPC de cobros?». Opción elegida, literal: **«Estricta, como la 0464
(Recomendado)»**. Las otras dos opciones eran «Tolerancia 0,01 solo en Studio» y
«Saldo a favor (no existe hoy)».

## OBJETIVO ORIGINAL

Reproducir y corregir la carrera al registrar cobros en facturas: una RPC con la
factura `for update`, validación del saldo, cobro y `paid_amount`/`status` en una
transacción, control rojo y mutante sin `for update`. Además, reglas de saldo
coherentes con la 0464.

## COMPLETADO

- **Carrera CONFIRMADA** con dos sesiones reales en `postgres:17`: 11 de 11
  escenarios en la primera corrida y 13 de 13 en la segunda, con la 0464 (tablas
  abajo). Aparecieron tres defectos más en el mismo flujo, que
  el Director aprobó incluir:
  - el código R- repetido (`next_receipt_code` hace max+1 sin lock);
  - la factura anulada que revive al anular su recibo;
  - la doble identificación de un mismo pago sin referencia.
- **Migración 0467** (`0467_cobro_factura_atomico.sql`, sin aplicar):
  - agrega `register_collection_receipt`, `identify_collection_receipt` y
    `void_collection_receipt`;
  - las tres son SECURITY INVOKER, con `search_path` vacío, owner `postgres` y
    EXECUTE sólo para `authenticated`;
  - exigen rol accounting/admin, toman recibo y factura `FOR UPDATE`, aplican la
    regla estricta con los códigos de la 0464 y serializan el código R- con el
    lock consultivo `(488, hashtext(tenant))`;
  - escriben recibo, `paid_amount` y `status` juntos, y la factura anulada no
    revive;
  - preflight de columnas, CHECK y los cuerpos de `next_receipt_code` (0079) y
    `void_payment_receipt_with_audit_reason` (0294); postflight de seguridad y
    ACL; aditiva.
- **Contrato** `supabase/tests/0467_cobro_factura_atomico.test.sql`: 112
  aserciones sobre las migraciones reales 0077, 0078, 0079, 0122, 0230, 0258,
  0261, 0267, 0290, 0294 y 0407. Cubre:
  - catálogo y ACL;
  - que la 0467 no toca policies, ACL, triggers, funciones ni filas previas;
  - el centinela de `FOR UPDATE` y el lock 488;
  - efectos, D2 con motivo, reglas, roles, tenant y membresía doble;
  - la factura anulada que no revive.
- **PGlite** `lib/studio/__tests__/cobro-factura-atomico.migration.test.ts`:
  contrato, control rojo y 5 mutantes (tolerancia 0,01, factura que revive, sin
  regla de pagada, sin `FOR UPDATE`, sin lock consultivo), cada uno muerto en su
  aserción.
- **App.** `collections-actions.ts` llama a las RPC y traduce los códigos sin
  texto crudo. `payment-types.ts` aplica la regla estricta. Pruebas unitarias
  reescritas, y la frontera de lecturas pasa de 46 a 42.
- **Carrera real** `scripts/qa/cobro-factura-race.mjs` + `.seed.sql`: esquema
  completo reconstruido, sesiones sincronizadas con advisory lock y
  `pg_stat_activity`, sin sleeps, y `--mutantes`. Después del merge se agregaron
  los escenarios 12 y 13, de coherencia con la 0464.
- **Espera** de la 0467 en `supabase/migrations-baseline.json › pendingBelowCutoff`,
  con las instrucciones para el operador.
- **Spec** 0488 e índice regenerado.

### Carrera real — primera corrida (2026-09-19 00:52 UTC, sobre `592cba6f`)

Esquema: 440 migraciones hasta la 0466, reconstruidas en 21 s. PASS, exit 0.
Cada cifra es el estado de la factura como pagado/total, «rec» es la suma de
recibos vigentes y «rep» la de reportes confirmados.

| # | Escenario | ANTES (app vieja) | DESPUÉS (0467) |
|---|---|---|---|
| 1 | cobro 300 → cobro 200 | 300/1000, rec 500: **se perdió 200** | 500/1000, rec 500; S2 esperó |
| 2 | cobro 600 → cobro 600 | 600/1000, rec 1200: **pérdida y sobrecobro** | 600/1000; S2 `PAYMENT_EXCEEDS_BALANCE` |
| 3 | cobro 300 → confirmación 200 | 300/1000, rec 300 + rep 200: **se perdió el reporte** | 500/1000; S2 esperó |
| 4 | confirmación 200 → cobro 300 | 300/1000, rec 300 + rep 200: **se perdió el reporte** | 500/1000; S2 esperó |
| 5 | anulación de 400 → cobro 300 | emitida 0/1000, rec 300: **se perdió el cobro** | parcial 300/1000 |
| 6 | anulación de 400 → confirmación 200 | emitida 0/1000, rep 200: **se perdió el reporte** | parcial 200/1000 |
| 7 | identificación 800 → misma a otra factura | 800 en las dos facturas, recibo sólo en una: **doble acreditación** | la 2ª `PAYMENT_RECEIPT_APPLIED`; 800 sólo en una |
| 8 | cobros en dos facturas del tenant | S1 muere: `duplicate key … receipt_code_key` | R-2026-0007 y R-2026-0008 |
| 9 | cobro 300 → identificación 800 | 300/2000, rec 1100: **se perdió 800** | 1100/2000 |
| 10 | identificación 800 → anulación | 800/1000 con el recibo anulado: **saldo fantasma** | emitida 0/1000 |
| 11 | cobro 300 → anulación de 400 | 700/1000, rec 300: **se perdió la anulación** | 300/1000 |

Mutantes de 0467 (cada uno sin un `FOR UPDATE`): **7/7 MUEREN**.

- M1, registrar: en 1 queda 200/1000 con rec 500; en 2, 600 con rec 1200; en 4,
  300 con rec 300 + rep 200.
- M2, identificar el recibo: en 7 queda 800 en una factura sin recibo.
- M3, identificar la factura: en 9 queda 800/2000 con rec 1100.
- M4, anular el recibo: en 10 queda 800/1000 con el recibo anulado.
- M5, anular la factura: en 11 queda emitida 0 con rec 300.

En todos, S2 esperó un lock: la sincronización ejerció la carrera.

### Carrera real — segunda corrida (2026-09-19 01:19 UTC, sobre `15689de6`)

La base es el merge con main `26983062`, que trae la 0464 en el esquema: 441
migraciones reconstruidas en 20 s. PASS, exit 0. Resultado: **antes 13/13
reproducidos, después 13/13 correctos y mutantes 8/8 muertos**. Los escenarios 1
a 11 dieron lo mismo que en la primera corrida. Los nuevos:

| # | Escenario | ANTES (app vieja + 0464) | DESPUÉS (0467 + 0464) |
|---|---|---|---|
| 12 | cobro 900 → confirmación 200 | 900/1000, rec 900 + rep 200: **se perdió el reporte y hubo sobrecobro** | la confirmación espera y sale `PAYMENT_EXCEEDS_BALANCE`; 900/1000 |
| 13 | confirmación 200 → cobro 900 | 900/1000, rec 900 + rep 200: ídem | el cobro espera y sale `PAYMENT_EXCEEDS_BALANCE`; 200/1000 |

M1 (sin el `FOR UPDATE` del cobro) también cae en el 13: queda en 900/1000 con
rec 900 + rep 200. El Docker se usó de 01:19:52 a 01:22:52 UTC y se devolvió
enseguida.

### Identidad del archivo a aplicar

`0467_cobro_factura_atomico.sql`:

- md5 `e40de959683625eed6368ad5ea05d791`;
- 23443 bytes;
- LF, con 0 bytes CR; termina en LF y no tiene BOM (empieza con `-- `);
- blob git `dc93a397ef96961957eab4a07c742cda9a6351b7`.

Se verificó sobre el blob de HEAD `15689de6` con `git show HEAD:<ruta>`, y el
disco es idéntico. El último commit que lo toca es `2c2761ee`.

`md5(prosrc)` después de aplicar, medido en PGlite:

- `register_collection_receipt` `914de5ae5032ef17cd79597867ecf219`
- `identify_collection_receipt` `c573efe588db4b7894a772f31d6a8f5d`
- `void_collection_receipt` `5e4607a56849461da3d6cd73b2532010`

El preflight exige, leyéndolo en producción antes de aplicar:

- `next_receipt_code(uuid)`: md5 `7e23723a20335395cd7fc0e872646ce7`, o sin
  espacios `10f0a5df996f2efb720d31afaec68e0f`;
- `void_payment_receipt_with_audit_reason(uuid,text)`: md5
  `84882604a0e14fc16d9e76a956d6a63d`, o sin espacios
  `344ff401342529ad131edd35a19b1eca`;
- `get_user_tenant_id()`: md5 `5ff0c51c26a49419c34abc78f1d95c37`, o sin espacios
  `4ce5acd04a577f91ca77b74ebc622c49` (0453).

**Locks de la 0467**, medidos en PGlite hasta el COMMIT: sólo el catálogo y los
objetos de las tres funciones nuevas (AccessExclusive, ShareUpdateExclusive y
AccessShare) más `pg_authid` en AccessShare. **Ninguno sobre `invoices`,
`payment_receipts` ni ninguna tabla.**

### Catálogo de producción (sólo lectura, 2026-09-19 ~01:03 UTC)

Leído con el conector Supabase de la sesión, proyecto `xpfuzqombmjmxvprjgmi`
(«DTD Cargo», PG 17.6). Fue una sola consulta `select` sobre `pg_proc`,
`pg_attribute`, `pg_constraint` y `pg_policies`, sin filas de negocio ni
escritura. El preflight de la 0467 pasaría hoy:

- `void_payment_receipt_with_audit_reason(uuid,text)`: md5 exacto
  `84882604a0e14fc16d9e76a956d6a63d`, igual que la 0294. Es INVOKER, con
  `search_path=""`, owner `postgres` y EXECUTE para authenticated, no para anon.
- `next_receipt_code(uuid)`: el md5 exacto es `81cf4a64c0ad4337c1e6a2dd22993481`
  y **no coincide** con el del repo (`7e23723a…`), pero el md5 sin espacios
  `10f0a5df996f2efb720d31afaec68e0f` sí. El cuerpo difiere del repo sólo en
  espacios, y el preflight lo acepta por la rama normalizada. Es DEFINER, con
  `search_path=public` y EXECUTE para authenticated, no para anon.
- No falta ninguna columna de las que exige el preflight. Los 4 CHECK de 0122
  están validados.
- Policies:
  - `invoices`: `invoices_accounting_select`, `invoices portal self read`,
    `invoices_accounting_insert` e `invoices_accounting_update` (0407 y 0414
    aplicadas);
  - `payment_receipts`: sólo `payment_receipts by tenant`, FOR ALL.
- Las tres funciones de la 0467 **no existen**: no está aplicada.
- `payment_private.run_report_command`: md5 `c3aab7fcb10e3bf5de0fa40cc562a45d`,
  que es el postflight de la 0464. **La 0464 ya está aplicada.**
- `get_user_tenant_id()`: md5 exacto `5ff0c51c…`, el de la 0453.

### Cruce con la 0466 (SDD-0487, `dtdcargo-74`), por pedido del Director

- La 0466 agrega a invoices columnas nullable de titular y un trigger BEFORE
  INSERT/UPDATE. Sella al emitir, con INSERT `emitida` o UPDATE de `borrador` a
  `emitida`, y después rechaza sólo cambios de las columnas de titular y de
  `bill_to_kind`.
- Las RPC de la 0467 sólo escriben `paid_amount`, `status` y `last_payment_at`,
  y el preflight de la 0467 no mira triggers. Ninguna rompe a la otra, en
  cualquier orden.
- Advertí que `void_collection_receipt` pone `emitida` desde `parcial` o
  `pagada`. `dtdcargo-74` confirmó que su condición de UPDATE es
  `OLD.status = 'borrador' AND NEW.status = 'emitida'`, así que nunca re-sella.
- La semilla de la carrera no cambia: sin cliente vivo, el trigger deja lo que
  trae NEW.
- Su contrato de la 0466 va a recorrer las tres RPC sobre una factura emitida
  cuando la 0467 esté en main.

## VALIDACIÓN

La CPU estuvo saturada por otras sesiones: sólo pruebas focales, con un worker.

| Comprobación | Base | Resultado |
|---|---|---|
| `node scripts/qa/cobro-factura-race.mjs --mutantes` (postgres:17, 2 sesiones) | `592cba6f` | **PASÓ**: antes 11/11 reproducidos, después 11/11 correctos y mutantes 7/7 muertos |
| Ídem, con los escenarios 12 y 13 de la 0464 | `15689de6` (merge `d9855875` + docs) | **PASÓ**: antes 13/13 reproducidos, después 13/13 correctos y mutantes 8/8 muertos |
| Contrato 0467 en PGlite (`vitest … cobro-factura-atomico.migration.test.ts`) | `592cba6f` y `d9855875` | **PASÓ** 7/7: contrato con 112 aserciones, control rojo y 5 mutantes |
| Control rojo del contrato (`apply_fix=false`) | ídem | **PASÓ** (falla donde debe): `TEST 0467: existe public.register_collection_receipt(…)` |
| `vitest collections-identify.test.ts` / `payment.test.ts` | ídem | **PASÓ** 22/22 y 44/44 |
| Control rojo de las unitarias contra `collections-actions.ts` y `payment-types.ts` anteriores | `1b64bdae` | **PASÓ** (falla donde debe): 10 de collections y 1 de payment fallan; archivos restaurados |
| `vitest scripts/__tests__/invoice-read-boundary.test.mjs` | ídem | **PASÓ** 3/3 (46 → 42) |
| `vitest scripts/check-migrations-applied.test.mjs scripts/check-pending-migration-symbols.test.mjs` | `592cba6f` | **PASÓ** 42/42 |
| `pnpm typecheck` | `592cba6f` y `d9855875` | **PASÓ** |
| eslint de los 7 archivos TS/MJS tocados | `7dee18e7` | **PASÓ** |
| `pnpm docs:index` / `docs:check` / `sdd:check` / `governance:check` | `d9855875` | **PASÓ** (471 specs) |
| `node scripts/check-pending-migration-symbols.mjs` | `d9855875` | **ROJO por diseño**: los 3 símbolos de la 0467 en `collections-actions.ts:184, :425, :487`. Es el candado migrate-first |
| Después del merge `6aabc096` (`a90c242b`): `docs:index` (sin cambios), `docs:check`, `sdd:check`, `governance:check` | `6aabc096` | **PASÓ**. La #152 no toca TS ni migraciones: no hace falta repetir typecheck ni unitarias |
| `node scripts/run-sql-tests.mjs` (contrato 0467 con psql real) | — | **NO EJECUTADO**: es Docker y va en el verify del turno de integración |
| `pnpm verify` | — | **NO EJECUTADO**: requiere turno de máquina; lo pide el Director |
| `migrations-applied` | — | **NO EJECUTADO**: da SKIP sin credenciales, y la 0467 está declarada como espera |

## COMMITS

Sobre `1b64bdae`, en este orden:

- `49b896a6`: reserva SDD-0488, cherry-pick de `764a6049` del Director.
- `2c2761ee` `feat(studio)`: migración 0467, contrato SQL, prueba PGlite y la
  espera en `migrations-baseline.json`.
- `592cba6f` `feat(studio)`: `collections-actions.ts` por las RPC, la regla
  estricta, las pruebas unitarias y la frontera de lecturas.
- `7dee18e7` `test(studio)`: la carrera real y su semilla.
- `ff6612ff` `docs(SDD-0488)`: la spec y el índice.
- `d9855875`: merge de `origin/main` (`26983062`).
- `15689de6` `docs(SDD-0488)`: la espera nombra `get_user_tenant_id` y el
  catálogo de producción leído; la spec suma la primera corrida.
- `e5f49186` `test(studio)`: los escenarios 12 y 13, de coherencia con la 0464.
- `08bae316` `docs(SDD-0488)`: la segunda corrida en la spec.
- `e2afd77b` `docs(handoff)`: el cierre antes de publicar.
- `6aabc096`: merge de `origin/main` (`a90c242b`).
- El commit que contiene este documento: `docs(handoff)`, con el segundo merge.

## PR / BRANCH

Rama `codex/carrera-cobro-factura`, local y **sin publicar**. Se reporta al
Director antes de abrir la PR. La PR sale con el rojo por diseño de
`check-pending-migration-symbols` hasta que se aplique la 0467.

## PENDIENTES DE ESTA TAREA

- Reporte al Director y, con su visto bueno, publicar la rama y abrir la PR. La
  primera línea de la descripción avisa del ROJO por diseño.
- `pnpm verify` completo y `run-sql-tests`: van en el turno de máquina que
  asigne el Director, antes o después del push según su orden.
- Release, que es del Director: OK nominal de Sam → aplicar la 0467 → commit que
  la saca de la espera → CI verde → integración → smoke de Sam.
- Cuando se aplique la 0467, la SDD pasa a `done` en ese mismo commit final.

## FUERA DE ALCANCE DETECTADO

1. **La RLS de `payment_receipts` sólo filtra por tenant** (0079:145-149, 0230).
   Cualquier miembro del tenant hace INSERT, UPDATE o DELETE directo por
   PostgREST, y `void_payment_receipt_with_audit_reason` no exige rol. Lo anotó
   el Director.
2. **`app/studio/(app)/cn/actions.ts:154`** llama a `next_receipt_code` para las
   recepciones de bodega China. Desde 0079 esa función genera códigos R- de
   cobros, no WR-.
3. **Tesorería** (`lib/studio/treasury/treasury-actions.ts:270-324`, `:410-421`)
   repite la carrera sobre `supplier_bills.paid_amount`. Su
   `validatePaymentInput` (`lib/studio/treasury/types.ts:464`) conserva la
   tolerancia de 0,01.
4. **`revertReferralCreditsForInvoice`** (`lib/studio/accounting/referral-credit-posting.ts:352-364`)
   escribe `paid_amount` absoluto con el cliente admin, sin guard.
5. **El pago sin referencia** (`registerUnidentifiedPaymentFor`) sigue
   generando el código R- sin el lock consultivo. Si choca con un cobro
   simultáneo, falla limpio: no deja estado parcial.
6. **La carrera no corre sola.** `scripts/qa/cobro-factura-race.mjs` es un script
   de QA, como el de la 0484. La SDD-0478 automatizó la suya como contrato
   `dblink` en `supabase/tests` (paso `sql-tests` de verify). Llevar esta carrera
   a ese patrón queda como propuesta; necesita el esquema completo, no un
   fixture.
7. **El inliner psql→PGlite está duplicado** entre
   `lib/portal/__tests__/payment-report-paid-invoice.migration.test.ts` (0484) y
   `lib/studio/__tests__/cobro-factura-atomico.migration.test.ts`. Convendría un
   helper compartido.

## HANDOFF AL DIRECTOR

- Revisar la spec, con el orden de release y la gobernanza, y el diff completo.
  Cambios compartidos: `supabase/migrations-baseline.json` (driver de merge) y
  `docs/specs/README.md` (generado).
- La 0467 no depende de la 0464 y se aplica después de ella. Nada de la 0467
  toca `payment_reports` ni `run_report_command`.
- **Para el OK nominal de Sam:**
  - archivo `0467_cobro_factura_atomico.sql`: md5 `e40de959683625eed6368ad5ea05d791`,
    23443 bytes, LF;
  - `name` = `0467_cobro_factura_atomico`;
  - la espera en `pendingBelowCutoff › 0467_cobro_factura_atomico` dice
    MIGRATE-FIRST: se aplica antes de integrar la PR, y es aditiva e invisible
    para la app desplegada;
  - antes de aplicar, leer las huellas de las tres dependencias;
  - después, un commit retira la espera sin tocar la cabecera del `.sql`, y
    siguen CI verde, integración y smoke de cobrar, identificar y anular.
- **Primera línea de la PR:** avisa que el gate de símbolos nace en ROJO por
  diseño, porque la 0467 está declarada como espera.
- Sesiones consumidoras: ninguna fuera de esta. La 0466 (`dtdcargo-74`) va a
  recorrer las RPC en su contrato cuando la 0467 esté en main.
- Ownership: el claim `worker-carrera-cobro-factura-opus5-20260918` se libera
  después de publicar, cuando termina la escritura. Si hay que corregir algo por
  la revisión o por el commit posterior a la aplicación, se vuelve a reclamar.

## Impacto documental y conocimiento

- **Canónicos:** la spec 0488 (antes stub de reserva) y `docs/specs/README.md`,
  regenerado por script. En código, la documentación está en la cabecera de la
  0467, los `comment on function`, la cabecera de `collections-actions.ts` y la
  espera en `migrations-baseline.json`.
- **No aplica:**
  - `BRAND.md`, `docs/design/**` y `/ui-check`: no hay UI; los mensajes nuevos
    son texto de error del servidor.
  - `docs/marketing/**`.
  - `docs/governance/**`: la clasificación va en la spec, sin política nueva.
  - Los handoffs históricos no se editaron.
- **`knowledge:status`** (revisión `592cba6f`, Graphify 0.9.61): el estado
  estructural es INVALID porque el worktree es nuevo y no tiene `graphify-out`.
  `graphify update .` no se ejecutó por la carga de CPU: queda para el refresco
  del Director desde main después de integrar.
- **Semántica:** ninguna fuente de `semanticPilot` está en el diff, así que esta
  tarea no debe recibo.
- **Archify:** no aplica, porque sus fuentes no cambiaron.
- **Obsidian:** la preview no se generó, porque depende del grafo estructural.
