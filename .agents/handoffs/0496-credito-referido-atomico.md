# Handoff 0496 · El crédito de referido se aplica y se revierte en una transacción

- Fecha: 2026-09-20 (Caracas; 2026-09-21 UTC). Estado de la tarea: **implementada y
  probada; falta traer la tarea 3 desde `main`, el `verify` con turno del Director y
  abrir la PR**.
- Owner/sesión: `worker-credito-referido-atomico-20260920` (Claude Opus 5, Worker).
  Director: sesión «Director notificación a workers».
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/credito-referido-atomico`,
  creado con `node scripts/harness-worktree.mjs start credito-referido-atomico`.
- Rama: `codex/credito-referido-atomico`, desde `origin/main` = `07831a5d`.
- SDD: [0496](../../docs/specs/0496-credito-referido-atomico/spec.md), reservada en
  local con `next-number.mjs --reserve` (rama `codex/sdd-reserve-0496-credito-referido-atomico`,
  commit `1a940272`, **sin push**).
- Aislamiento: el worktree que la app de Claude Code me dio ya tenía un claim de otra
  sesión (`claude-smokes-tesoreria-cobranzas-20260920`), así que **no lo tomé**: creé el
  mío con `start` y reclamé ahí. Antes de cada commit revalidé con `guard --owner`.
- Permisos del encargo: commits en esta rama; push y PR contra `main` tras reportarle al
  Director. **No merge. No producción.**

## OBJETIVO ORIGINAL

Punto 1 de «Fuera de alcance detectado» de la
[SDD-0490](../../docs/specs/0490-reversion-credito-referido/spec.md), autorizado por Sam
el 2026-09-20: llevar **la aplicación y la reversión** del crédito de referido a funciones
SQL con la factura tomada `FOR UPDATE`, como la 0467 hizo con los cobros, para cerrar las
dos ventanas en las que la reversión le baja a una factura un abono que nunca llegó.

## COMPLETADO

### `supabase/migrations/0471_credito_referido_atomico.sql` (NUEVA, **NO APLICADA**)

Aditiva: dos funciones nuevas, no reemplaza ni altera nada.

- `public.apply_referral_credit(uuid, uuid) → jsonb`
- `public.revert_referral_credits(uuid, uuid) → jsonb` (segundo argumento `null` = barre
  toda la factura; con un crédito, acota a ése — es la compensación de la aplicación)

Del molde de la 0467 se copió el patrón completo: gate de rol `accounting`/`admin` dentro
de la función, códigos de dominio con su `errcode`, `SECURITY INVOKER` + `search_path`
vacío + owner `postgres` + `EXECUTE` sólo para `authenticated`, y el recálculo de estado de
`void_collection_receipt`. **No** lleva lock consultivo por tenant: ése serializaba
`next_receipt_code` y acá no se numera nada.

**Orden de locks: FACTURA → CRÉDITO(S)**, el mismo en las dos. En la reversión los créditos
se leen y se toman *después* del lock de la factura, ordenados por `id`. La cadena completa
con la 0467 y la 0421 (recibo → factura → crédito) no tiene ciclos.

**Los asientos quedan afuera, best-effort**, con el porqué escrito en la cabecera y en la
spec, y con la ventana que eso deja declarada como asumida y recuperable.

### Cobertura

| Archivo | Qué mide | Resultado medido |
|---|---|---|
| `supabase/tests/0471_credito_referido_atomico.test.sql` | contrato de la 0471 con las migraciones reales | **96 aserciones** en `postgres:17` |
| `lib/studio/__tests__/credito-referido-atomico.migration.test.ts` | el mismo contrato en PGlite (única cobertura en el CI de calidad) | verde + **control rojo** + **10 mutantes**, todos muertos |
| `supabase/tests/0467_reversion_credito_carrera.test.sql` | carrera de tres sesiones con `dblink` | **19 aserciones** |
| `lib/studio/accounting/__tests__/referral-credit-revert.test.ts` | la reversión en TypeScript | 11 verdes |
| `app/studio/(app)/fidelizacion/__tests__/apply-referral-credit.test.ts` | la aplicación en TypeScript | 17 verdes |

**Los escenarios 5 y 6 de la carrera son las dos ventanas del encargo.** Sus fases ANTES
corren las sentencias de la SDD-0490 y reproducen la pérdida: factura con **220 pagados
contra un recibo vigente de 300**, y el crédito de vuelta en `acreditado` — los 80 se los
comió la factura. Las fases DESPUÉS corren contra la 0471: en el 5 la aplicación espera a
la anulación en la fila de la factura y sale `REFERRAL_CREDIT_INVOICE_STATE`; en el 6 la
transacción que muere se lleva el claim y el abono juntos. En los dos, 300 contra 300.

**Mutantes sobre la 0471 contra la carrera**, para que las fases DESPUÉS no sean verdes en
vacío: sin `FOR UPDATE` en la aplicación cae **sólo** el 5; sin `FOR UPDATE` en la
reversión cae **sólo** el 1. La migración se restauró después de cada uno y el
`git diff --stat` quedó vacío.

También re-apunté a las RPC las fases DESPUÉS de los escenarios **1 y 3**: describían el
UPDATE con guard y relectura que esta SDD retira, así que medían código que ya no existe.
Con el lock desaparece el contador de reintentos del 1. El **4 se conserva como está**, con
una nota en la cabecera: sus dos fases son de la generación 0490 y el 5 es ese mismo camino
contra el código vivo.

### La app

- `applyReferralCredit`: claim + UPDATE final → una llamada a la RPC. Las validaciones
  previas se conservan **para el mensaje**, no como autoridad. Traductor
  `applyReferralCreditError` de códigos a castellano; uno desconocido se muestra tal cual.
  Si el asiento falla, se compensa con la reversión atómica de ese crédito.
- `revertReferralCreditsForInvoice`: conserva el nombre y `{ ok, reverted, error? }`; suma
  el cliente del usuario adelante, un `referralId` opcional y un campo **`failure`**
  (`"revert"` = no se movió nada | `"entries"` = la plata volvió y falló el asiento).
  El campo existe porque `reverted` no alcanza: **hoy**, sin la migración, un `ok:false`
  con `reverted > 0` significa «unos créditos sí y otros no» —alcanzable ya con dos
  créditos en la misma factura— y con la 0471 ese caso desaparece. Sobrecargar el número
  lo habría hecho cambiar de sentido según la versión. Lo señaló el Director el
  2026-09-20. Exporta `REVERT_REFERRAL_CREDITS_ERROR` para que el aviso ancle sin copiar
  texto.
- **Trampa evitada** (aviso del Director): un módulo `"use server"` sólo exporta funciones
  async, y eso **no lo cazan `typecheck` ni `eslint`**, sólo el `build` dentro de `verify`.
  Comprobado: `REVERT_REFERRAL_CREDITS_ERROR` y los tipos viven en
  `lib/studio/accounting/referral-credit-posting.ts`, que **no** lleva `"use server"`; en
  los dos `actions.ts` tocados no quedó ningún `export const` (el traductor
  `applyReferralCreditError` es una función de módulo, sin exportar).
- `voidInvoice`: sólo pasa el cliente. `console.error` y `revalidatePath`, intactos.
- Se retiran `REVERT_PAID_MAX_ATTEMPTS`, `invoiceStatusAfterPaidDecrease` y
  `lowerInvoicePaidForRevert`: la regla de estado y la serialización viven en la 0471.

### Migrate-first

- `supabase/migrations-baseline.json › pendingBelowCutoff["0471_credito_referido_atomico"]`
  con la secuencia completa que fijó el Director: **(1)** PR abierta con la espera
  declarada → **(2)** OK nominal de Sam **nombrando `0471_credito_referido_atomico`** →
  **(3)** aplicación con preflight y postflight según el runbook → **(4)** recién entonces
  el merge. Con el porqué escrito: *si la PR entra antes que la migración, toda anulación
  de factura deja el crédito sin revertir*.
- `supabase/pending-migration-symbol-declarations.json`: las dos funciones declaradas con
  sus sitios y la evidencia de cómo degrada cada camino. El gate pasó de **2 ROJO** a
  **«0 ROJO · 1 AMARILLO declarado»**.

### Gates corridos (focales, sin turno de máquina)

| Paso | Resultado |
|---|---|
| `tsc --noEmit` | **PASÓ** (limpio) |
| `eslint` sobre los archivos tocados | **PASÓ** |
| `build-docs-index --check` | **PASÓ** — 482 specs sincronizadas |
| `check-numbering` | **PASÓ** — sin números repetidos |
| `check-pending-migration-symbols` | **PASÓ** — 0 ROJO · 1 AMARILLO declarado |
| `check-rsc-boundary` | **PASÓ** |
| `check-feature-constants` | **PASÓ** |
| `validate-component-registry` | **PASÓ** |
| `check-edge-functions` | **PASÓ** |
| `build-governance-capsule --check` | **PASÓ** — 28 políticas, cápsula vigente |
| **`run-sql-tests` (suite completa)** | **PASÓ** — **224 contratos**, un solo contenedor `postgres:17`, rollback total |
| `check-migrations-applied` | **NO EJECUTADO (SKIP)** — sin `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. **Ningún** worktree tiene `.env.local`, tampoco el checkout principal: es el estado normal del repo, no algo de esta rama. No consultó el ledger de producción, así que **no prueba** que nada esté aplicado |

La suite SQL se corrió aparte y antes del turno, por indicación del Director (2026-09-20):
`run-sql-tests` con **un solo** contenedor no pide turno, a diferencia de `verify` completo,
`vitest` completo o varias suites Docker a la vez. Sirvió para llegar al turno con el paso
más largo y más frágil ya verificado aislado. Los dos archivos de esta tarea pasan dentro
de la suite completa, o sea que tampoco le dejan residuo a los que corren después.

**Falta por correr, y sólo con el turno:** `harness`, `test` (vitest completo),
`schema-rebuild`, `e2e` y `build`. El `build` es el único que caza la trampa de
`"use server"` (ver arriba).

## PENDIENTE DE ESTA TAREA

1. **Traer la tarea 3 («Avisar en el Studio cuando falla la reversión del crédito») desde
   `main` y adaptar yo la llamada.** Lo fijó el Director: yo adapto, no ella. Al cierre de
   este handoff su PR **no está abierta** y `origin/main` sigue en `07831a5d`.
   **Con MERGE, no rebase** — es la convención del repo, y el Director la repitió el
   2026-09-20. Si el merge toca `docs/specs/README.md`, va **con el driver y regenerando
   con `node scripts/build-docs-index.mjs`, nunca a mano** (ver la memoria del índice de
   specs). Lo que tiene que saber quien lo retome:
   - el punto de anclaje sigue siendo `if (!revert.ok)` en `voidInvoice`
     (`app/studio/(app)/facturacion/actions.ts:713`), con la misma forma de resultado;
   - la firma cambia a `(supabase, tenantId, invoiceId, referralId?)`: el conflicto es de
     una línea;
   - el aviso debería distinguir los dos fallos (ver arriba). Decir «no se revirtió» cuando
     `reverted > 0` sería falso: la plata ya volvió y lo que falta es anular el asiento;
   - `REVERT_REFERRAL_CREDITS_ERROR` está exportada para que el aviso ancle sin copiar
     texto.
2. **`corepack pnpm verify`** completo — tengo el **turno 4 de 4** y el Director avisa
   cuándo. Si el paso `test` sale rojo, mandarle el veredicto literal antes de tocar nada,
   distinguiendo una aserción que falla de un worker de vitest que no arranca por RAM.
3. **Abrir la PR** contra `main` (autorizado por el encargo) y reportarle al Director.
4. **La migración la pide el Director**, con el runbook y el OK nominal de Sam nombrando el
   archivo. Yo no la aplico.

## FUERA DE ALCANCE DETECTADO

1. **El preflight por md5 no se contrastó contra producción.** La huella de
   `get_user_tenant_id()` es la que los preflights de la 0467 y la 0468 verificaron al
   aplicarse (2026-09-18 y 2026-09-19); en esta tarea **no se leyó producción**. Si el
   cuerpo cambió desde entonces, la 0471 aborta sin tocar nada —que es lo querido—, pero
   conviene releerlo en el paso de aplicación.
2. **La ventana del asiento.** Entre el COMMIT de `apply_referral_credit` y el asiento, el
   crédito está aplicado y el asiento no existe todavía. Es recuperable y está documentada.
   Cerrarla del todo significa llevar el asiento adentro de la transacción, que es una
   tarea propia: hay que portar la búsqueda de cuentas por código, `next_entry_code` y la
   inserción de líneas a plpgsql, y decidir qué pasa con el *skip graceful* cuando al
   tenant le falta una cuenta del plan.
3. **`journal_entries` se sigue escribiendo con el admin client.** Ahora es lo único del
   crédito de referido que no corre bajo la RLS del usuario. No lo toqué: cambiarlo exige
   revisar los grants y las policies de `journal_entries` y `journal_lines`, y afecta a
   `expense-posting` y `claim-posting`, que comparten el molde.
4. **El escenario 4 de la carrera quedó como registro histórico, ETIQUETADO.** Sus dos
   fases modelan el UPDATE de la generación 0490, que esta SDD retira; el 5 lo reemplaza
   contra el código vivo. Por decisión del Director (2026-09-20) **no se borra y no se
   deja callado**: lleva la etiqueta en tres sitios —la cabecera del archivo, un bloque
   sobre el propio `when 4 then` y el nombre que se imprime cuando falla— diciendo que es
   de la generación 0490, que **no cuenta como cobertura del código actual** y que su
   sucesor es el 5. El motivo: una prueba que pasa por la razón equivocada es un verde que
   alguien va a interpretar mal. Si algún día se quiere el archivo sin fases históricas,
   es una limpieza aparte y con criterio del Director.
5. **El monto que se revierte se lee AL REVERTIR, no se congela al aplicar.**
   `revert_referral_credits` baja `round(coalesce(r.reward_usd, 0), 2)` leído en ese
   momento — igual que hacía el TypeScript, así que no es una regresión. Si alguien editara
   `reward_usd` de un crédito ya `aplicado`, la reversión bajaría un monto distinto del que
   se abonó. **Hoy no es alcanzable desde la app**: el único escritor de `reward_usd` sobre
   una fila viva es el trigger de la 0197, que sólo matchea `registrado` y
   `primer-embarque`; ningún camino de producto lo toca en `aplicado` (comprobado por
   `grep` sobre `.ts`/`.tsx`). Pero nada en la base lo impide. Congelarlo pide una columna
   nueva (`applied_amount`) y su migración.
6. **El link del asiento se escribe sin guard de estado.** El paso 5 de
   `applyReferralCredit` hace `.update({ applied_entry_id }).eq("id", referralId)` sin
   `.eq("status", "aplicado")`. Si entre el COMMIT de la RPC y ese UPDATE alguien revierte
   el crédito, el UPDATE viola el CHECK `referrals_credit_applied_coherent` (23514) y el
   código no mira ese error. **No es una regresión** —la línea viene tal cual de la
   SDD-0137— y el daño es nulo: el link no se escribe, que es exactamente lo que la
   reversión ya tolera (barre por `referral_id`, el hueco B). Cerrarlo es una línea más su
   prueba; lo dejo fuera por disciplina de alcance, no por dudarlo.
7. **`applicableInvoicesForReferrer` (el picker) no revalida bajo lock**, y ahora la RPC sí.
   No es un defecto —el picker sólo sugiere—, pero sus criterios y los de la 0471 son dos
   copias de la misma regla en lenguajes distintos: si una cambia sin la otra, el picker
   ofrecería facturas que la función rechaza. Hoy coinciden; no hay prueba que lo fije.
