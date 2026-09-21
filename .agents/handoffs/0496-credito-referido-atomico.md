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

### `pnpm verify` completo — turno 4 de 4, concedido a las 23:57:28Z

Corrido **dos veces**. Log en el scratchpad de la sesión.

**1ª corrida (20:03:45 → 20:26:33, 22 min 48 s): `VERIFY_EXIT=1`.** Un solo paso rojo,
`pending-migration-symbols`, y era mío: las declaraciones citaban
`referral-credit-posting.ts:364` y `:372`, pero al agregar el bloque del tipo
`ReferralCreditRevertFailure` esas líneas se corrieron a **:389** y **:398**. Lo que la
declaración describe estaba bien; lo que quedó viejo fue la referencia. Lo dejé pasar
porque **leí el exit del gate a través de una tubería** (`| tail -2`), así que el 0 que vi
era el de `tail`, no el del script — el mismo error que la memoria
`vitest4-reporter-basic-verde-falso` ya tenía anotado para `tsc | head`.

**2ª corrida (20:28:15 → 20:41:46, 13 min 31 s): `VERIFY_EXIT=0`**, con el aviso de cierre
incompleto. **16 de 17 pasos corrieron de verdad; 0 fallos, 0 cobertura parcial.**

| Paso | Resultado |
|---|---|
| `harness` | **PASÓ** |
| `lint` | **PASÓ** — 15 warnings preexistentes, 0 errores (los que listó el Director) |
| `rsc-boundary` | **PASÓ** |
| `typecheck` | **PASÓ** |
| `edge-functions` | **PASÓ** |
| `test` (vitest completo) | **PASÓ** — 628 archivos, **8.204 pruebas**, 1 saltada, 152,91 s |
| `docs:check` · `numbering` · `feature-constants` · `components:check` · `governance:check` | **PASÓ** |
| `migrations-applied` | **NO EJECUTADO (SKIP)** — sin `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` |
| `pending-migration-symbols` | **PASÓ** — **0 ROJO · 1 AMARILLO declarado** (la espera de la 0471) |
| `sql-tests` | **PASÓ** — **224 contratos**, `postgres:17`, rollback total |
| `schema-rebuild` | **PASÓ** |
| `e2e` | **PASÓ** — **168 pruebas**, 3,4 min, sin flaky |
| `build` | **PASÓ** — compiló en 15,7 s (es el único paso que cazaría la trampa de `"use server"`) |

**El veredicto literal, y no es «verde» a secas:**

> `[AVISO] verify: CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied. No hubo`
> `fallos en lo medido (16/17); exit 0 NO equivale a cierre verde completo.`

Es el estado terminal **esperado** en este worktree, no una anomalía: sin fallos y con un
crítico sin medir, `buildVerifyVerdict` devuelve `exitCode 0` con tono de aviso
(`scripts/verify-step-policy.mjs:226`). O sea que el harness sale en cero **a propósito** y
deja dicho que el cero tiene un hueco. Lo que **no** se comprobó es si la 0471 está aplicada
en producción: ese paso no consultó el ledger. Cualquier afirmación sobre el estado de la
migración va etiquetada **NO VERIFICADO** hasta que el Director la compruebe contra
producción.

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
2. ~~`corepack pnpm verify`~~ **HECHO** — ver el registro por paso más arriba. Cerró con
   `VERIFY_EXIT=0` y el aviso de CIERRE INCOMPLETO por `migrations-applied`.
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
5. **El monto que se revierte se lee AL REVERTIR, no se congela al aplicar.** ← *el Director
   se lo lleva a Sam como decisión (2026-09-20); no se toma en esta tarea porque congelarlo
   pide columna nueva y migración, y ampliar sobre la marcha una tarea con migrate-first es
   cómo se cuelan los errores.*

   `revert_referral_credits` baja `round(coalesce(r.reward_usd, 0), 2)` leído **en ese
   momento** — igual que hacía el TypeScript, así que no es una regresión. Si alguien
   editara `reward_usd` de un crédito ya `aplicado`, la reversión bajaría **una cifra
   distinta de la abonada**.

   **Hoy no es alcanzable desde la app.** El único escritor de `reward_usd` sobre una fila
   viva es el trigger `accredit_referral_on_first_invoice` de la 0197, y sólo matchea
   `status in ('registrado', 'primer-embarque')` (`0197_referral_auto_accredit.sql:86-89`);
   ningún camino de producto lo toca en `aplicado`. Comprobado con:

   ```bash
   git grep -nE 'reward_usd' -- '*.ts' '*.tsx'
   ```

   que sólo devuelve lecturas, fixtures de prueba y el alta en `invitado` con `reward_usd: 0`
   (`lib/portal/referral-invite.ts:128`, `lib/portal/referral-link.ts:145`).

   **Pero la base no lo impide.** Es la misma forma que el resto de lo que apareció hoy: un
   invariante sostenido sólo por la capa de aplicación. Congelarlo pide una columna nueva
   (`applied_amount`, escrita por `apply_referral_credit` y leída por
   `revert_referral_credits`) y su propia migración.
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
