# Handoff 0496 · El crédito de referido se aplica y se revierte en una transacción

- Fecha: 2026-09-20 → 2026-09-21 (Caracas). Estado de la tarea: **CERRADA de punta a punta.**
  Migración aplicada y verificada 17:03:38Z · PR [#184](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/184)
  fusionada 17:18:47Z (merge `6e3140b8040e89dba37b19748fbc97a47eb0bc66`, head
  `1b0eb4b9af530234c4b4fd9f277030d560b8aafd`) · despliegue **success** 17:21:06Z, sitio sano.
  Queda la PR de limpieza que retira la espera (rama `codex/retirar-espera-0471`).
- Owner/sesión: `worker-credito-referido-atomico-20260920` (Claude Opus 5, Worker).
  Director: sesión «Director notificación a workers».
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/credito-referido-atomico`,
  creado con `node scripts/harness-worktree.mjs start credito-referido-atomico`.
- Rama: `codex/credito-referido-atomico`, desde `origin/main` = `07831a5d`. Después se trajo
  `main` `d9adbabf` **con merge, no rebase** (commit `fe6d2b74`), con el driver de main para
  `docs/specs/README.md` y regenerando el índice con el script.
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

### El cruce con la SDD-0495 (el aviso de reversión fallida)

Tres archivos tocados por las dos ramas. **Git resolvió dos y el tercero no lo podía ver.**

1. **`scripts/__tests__/invoice-read-boundary.test.mjs`** — único conflicto, y del tipo
   fácil. Main iba de 44 a 45 llamadas (la 0495 sumó `strandedReferralCredits`) y esta rama
   de 44 a 41. Comprobado que **no se solapan**: la lectura que sumó la 0495 está en
   `lib/studio/fidelizacion/referral-credit-queries.ts` y las tres que quité son de
   `fidelizacion/actions.ts` y `accounting/referral-credit-posting.ts` —otro archivo, con
   nombre parecido—. Resultado **18 archivos / 42 llamadas, RECALCULADO** corriendo el
   contrato sobre el árbol fusionado, no deducido de la aritmética.
2. **`docs/specs/README.md`** — lo resolvió el driver de main y se regeneró con el script.
   485 specs, `docs:check` sincronizado.
3. **`app/studio/(app)/facturacion/actions.ts` — el que importaba, y git lo fusionó limpio
   dejándolo MINTIENDO.** La 0495 elegía entre dos textos de aviso con `revert.reverted`,
   porque la reversión recorría los créditos de a uno y `ok:false` con `reverted > 0`
   significaba «uno se liberó y otro no». La 0471 mató ese caso —una transacción, todos o
   ninguno— y ese mismo par de valores pasó a significar **lo contrario**: la plata volvió
   entera y lo único colgado es el asiento. Con el criterio viejo, el banner habría dicho
   «parte de los créditos siguen marcados como usados» **justo cuando no queda ninguno
   varado**.

   **El aviso no se deshizo: sobrevive y gana su caso.** Ahora se elige por `failure`. Se
   retiró el texto parcial —ya inalcanzable— y entró `VOID_REFERRAL_REVERT_ENTRY_WARNING`,
   que dice que el crédito volvió y que lo que falta es anular el asiento, y que manda a
   **contabilidad, no a Fidelización**: ahí no hay crédito varado, así que esa pantalla
   —con razón— no lo lista, y mandar para allá sería mandar a mirar una pantalla vacía.

   Las pruebas de la 0495 se **adaptaron, no se borraron**: el bloque «falló a medias» pasó
   a ser «la plata volvió pero el asiento quedó sin anular», con un centinela que cae si
   alguien vuelve a atar el aviso al conteo. 253 pruebas verdes en los cuatro directorios
   afectados.

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

1. ~~Traer la tarea 3 y adaptar la llamada~~ **HECHO** (merge `fe6d2b74` + commit
   `f1ea2790`). Ver «El cruce con la SDD-0495» más abajo.
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
7. **El `else` de `voidReferralRevertTitle` es atrapa-todo.** Hoy es correcto y su prueba
   lo fija, pero no distingue «título desconocido» de «es el del crédito sin liberar»: un
   tercer valor de `failure` saldría con el título del crédito varado **sin que nada
   falle**. Lo señaló el Director al revisar (2026-09-21) y decidimos **no cambiarlo ahora**
   —hoy no hay tercer caso—, sino anotarlo donde se va a leer: en el propio `else` y en la
   definición de `ReferralCreditRevertFailure`, que es donde alguien agregaría la variante.
8. **`applicableInvoicesForReferrer` (el picker) no revalida bajo lock**, y ahora la RPC sí.
   No es un defecto —el picker sólo sugiere—, pero sus criterios y los de la 0471 son dos
   copias de la misma regla en lenguajes distintos: si una cambia sin la otra, el picker
   ofrecería facturas que la función rechaza. Hoy coinciden; no hay prueba que lo fije.


## CIERRE (2026-09-21)

### El orden migrate-first se cumplió, y en el orden correcto

| Hito | Hora (UTC) |
|---|---|
| 0471 aplicada a producción por el Director, con el OK nominal de Sam | **17:03:38** |
| PR #184 fusionada a `main` | **17:18:47** |
| Despliegue de Vercel en success, sitio sano (`/` 200, `/studio` y `/portal` 307) | **17:21:06** |

**Quince minutos en los que la base ya tenía las dos funciones y la app todavía no las
llamaba.** Ésa es exactamente la ventana segura que la espera pedía; al revés habría dejado
cada anulación de factura con un crédito pegado.

### Quién escribió en producción

**La aplicó el Director**, no este Worker. Sam le dio el OK nominal a los dos por separado
—con el archivo nombrado en los dos casos—, y precisamente por eso hizo falta que actuara
uno solo: dos sesiones aplicando la misma migración es la carrera que el encargo evita
poniendo la aplicación de un lado. Este Worker avisó antes de tocar nada, el Director ya
estaba en el preflight, y se detuvo. **La metadata del commit no guarda quién aplicó**, por
eso queda escrito acá.

La verificación sí la hicieron **las dos sesiones por separado**, y coincidieron: identidad
por md5, postflight del catálogo y cuerpos vivos.

### Lo que hay que llevarse de esta tarea

**1. «Fusionó limpio» y «sigue siendo cierto» son dos preguntas distintas, y sólo la segunda
la contesta una persona.** El mejor hallazgo de la tarea no lo encontró ningún gate: el
merge de `main` salió **sin conflicto** en `facturacion/actions.ts` y dejó el aviso de la
SDD-0495 eligiendo su texto con `revert.reverted` — un valor cuyo significado esta SDD
**invirtió**. El banner habría dicho «parte de los créditos siguen marcados como usados»
justo cuando no queda ninguno varado. Git no tenía cómo verlo: las dos ramas cambiaron
cosas distintas del mismo archivo y encajaron. Lo que cambió fue el **significado** de un
dato que la otra tarea leía. Lo encontró leer el merge con desconfianza.

**2. El candado se vuelve su propio modo de fallo, y ése es el precio del arreglo.** El
`FOR UPDATE` hace esperar. El rol `authenticated` —con el que corren las RPC, que son
INVOKER— corta a los **8 s** (`statement_timeout`, medido en producción, no supuesto). Si
la factura está tomada más que eso, la reversión falla con **57014** y sale
`failure: "revert"`. **Buscar 57014, no 55P03:** el `lock_timeout` del clúster es 0, así que
la espera por el lock no vence nunca; lo que corta es el timeout de sentencia, y corta la
sentencia entera. Los 8 s cubren la RPC completa, no sólo la espera.

Antes el defecto corrompía **en silencio**; ahora falla **a la vista** y enciende el aviso
de la 0495. Cambiar corrupción silenciosa por fallo visible es el negocio que queríamos
hacer — pero sólo sirve si está escrito, porque si no, el próximo ve `failure: "revert"` y
sale a buscar un permiso roto cuando lo que hubo fue contención.

**3. Un vigilante miente de tres formas, y la tercera es la peor.** El de esta sesión
quedó **mudo** 30 minutos mientras el CI pasaba, porque `gh pr checks` sale con código ≠ 0
mientras hay pendientes y estaba tapado con `|| echo '[]'`. Se le agregó un latido… y **el
segundo tampoco medía**: usaba `jq`, que **no existe como binario en esta máquina** (sólo
el que `gh` trae embebido en `--jq`). **Ruidoso**: el latido probaba que el bucle vivía, no
que midiera. El del Director cayó en lo mismo y lo delató el ruido en vez del silencio.

El tercero apareció en la PR de limpieza, ya con las dos lecciones anteriores aplicadas.
Reportó `[expirado] agotó sus 55 vueltas sin que el CI se asentara` — que suena a un CI
lento. **Medido: el run había arrancado a las 17:32:31Z y eran las 17:34:25Z.** Dos
minutos, no los 27 que implican 55 × 30 s. Y la causa **no era el entorno**: comprobé que
`sleep` sí duerme acá (`sleep 5` → 5 s) antes de acusarlo. Era mi bucle: los `sleep 30`
estaban **sólo dentro de las dos ramas de error**, y la rama normal —la única que corre
cuando todo va bien— caía al `done` sin esperar.

Esa tercera forma es peor que el silencio porque **trae su propia explicación**: una
expiración se lee como lentitud ajena y desalienta comprobar. La regla que queda: **para
esperar un run de Actions no escribas el bucle** — `gh run watch <run-id> --exit-status`
espera dentro de `gh` y da una sola notificación con su código. Si igual escribes uno, la
espera va **al final del cuerpo**, no dentro de los `continue`, y el mensaje de expiración
**imprime el tiempo transcurrido**: una expiración que no dice cuánto esperó no se puede
auditar. En los tres casos lo que resolvió fue ir a leer el estado directo.

### Lo que NO se tocó, y por qué

- **La cabecera del `.sql`, que sigue diciendo «⚠️ NO APLICADA A PRODUCCIÓN».** Se queda tal
  cual. El ledger guardó el texto exacto que se aplicó y editarlo rompería la identidad por
  md5 que las dos sesiones probaron. **El estado vive en el ledger y en el baseline, no en
  el comentario.**
- **El `cutoff` 238.** La propia declaración lo prohíbe y no hace falta.
- **Las esperas de la 0422 y la 0423.** Siguen pendientes de verdad.
- **`docs/runbooks/knowledge-graphify-obsidian.md:3`, que dice `SDD: 0471`.** **No es esta
  migración**: son dos numeraciones distintas —specs y migraciones— que comparten el espacio
  de cuatro dígitos. Toda limpieza de migración empieza con un `grep` del número, así que
  esto va a volver a aparecer. No se toca.

### La limpieza (rama `codex/retirar-espera-0471`)

Sale la entrada `0471_credito_referido_atomico` de `pendingBelowCutoff` y su declaración de
símbolos: el gate pasa de **0 ROJO · 1 AMARILLO** a **0 ROJO · 0 AMARILLO**. Una espera que
ya no describe la realidad es peor que ninguna — el gate seguiría marcando amarillo por algo
que está en producción, y quien lo lea va a creer que falta aplicarla. Es el mecanismo por
el que este repo perdió la 0228 y la 0169.

Entran además los dos comentarios que citaban «la 0471 sin aplicar» como caso vivo. **No se
pasaron a pasado —eso sería un dato muerto— sino que se reescribieron para nombrar las
causas que SÍ quedan vivas** de `failure: "revert"`, que es lo que le sirve al próximo que
lo vea en producción. El escenario de prueba pasó de montar la causa histórica (`PGRST202`)
a montar las cuatro vivas.
