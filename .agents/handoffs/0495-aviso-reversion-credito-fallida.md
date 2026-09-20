# Handoff 0495 · una reversión de crédito que falla deja de ser invisible

- Fecha: 2026-09-20. Estado de la tarea: **implementada y probada; falta el turno de `verify`**.
  Con el `verify` en verde queda lista para PR. El Director revisa e integra.
- Owner/sesión: Claude Opus 5 (Worker), sesión de escritorio `keen-swirles-62b904`.
  Director: la sesión «Director notificación a workers», que asignó la tarea porque
  Sam la autorizó el 2026-09-20.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/keen-swirles-62b904`.
  Aislamiento comprobado antes de editar: worktree propio registrado en `git worktree list`,
  rama propia, árbol limpio, y `419d2598` es ancestro de la base (`07831a5d`, merge de #179).
  **No se creó un worktree nuevo con `harness-worktree start`**: el que provee la app ya cumple
  «una tarea, una rama, un worktree, una sesión escritora», y el entorno pide no salir de él.
- Rama: `claude/sad-mendeleev-cd9692`, sin publicar todavía.
- SDD: [0495](../../docs/specs/0495-aviso-reversion-credito-fallida/spec.md). Reservada en local
  con `corepack pnpm sdd:next --reserve aviso-reversion-credito-fallida` → rama
  `codex/sdd-reserve-0495-aviso-reversion-credito-fallida` (`fa9f0cfc`), **sin push**. La spec
  completa va en el commit de esta rama, como en las reservas anteriores.
- Permisos del encargo: commits en esta rama; abrir la PR está autorizado por el encargo.
  **No merge. No producción. Sin migración. No se escribió en producción ni se leyó ninguna fila
  de negocio.**

## OBJETIVO ORIGINAL

Punto 2 del «Fuera de alcance detectado» de la SDD-0490: `voidInvoice`
(`app/studio/(app)/facturacion/actions.ts`) sólo registraba en el log un fallo de la reversión
del crédito de referido. Devolvía `{ ok: true }` y quien anulaba veía un éxito limpio, mientras
el crédito quedaba `aplicado` colgando de una factura anulada. Había que (1) mostrarlo en el
momento, (2) dejarlo visible después, y (3) respetar los gates de módulo.

## COMPLETADO

### 1 · El aviso sube con el `ok`, y distingue dos fallos

`voidInvoice` devuelve `{ ok?: boolean; error?: string; warning?: string }`. La anulación **sigue
siendo exitosa** y la reversión sigue sin bloquearla. No lleva el texto crudo del error (el detalle
técnico sigue en el `console.error` con el código de factura). En el fallo se revalida además
`/studio/fidelizacion`.

**El aviso lo elige `reverted`, no sólo `ok`**: si se liberó alguno y otros no, decir «no se pudo
liberar» sería falso. Los textos y sus títulos viven en
`lib/studio/fidelizacion/referral-revert-notice.ts` —un módulo neutro, **no** `"use server"`— y los
consumen la action y el banner. Detalle y el porqué, en la sección de la sesión 4.

`InvoiceDetailClient` guarda el aviso en `voidWarning` y lo pinta en un banner `--warning`, calcado
del banner `legalAck` del mismo archivo (SDD-0054). No pasa por `setError`: no falló la anulación.

### 2 · Dos superficies durables, y por qué son dos

La decisión no salió de una preferencia: salió de medir `lib/studio/rbac.ts`. `invoices:
["accounting"]` y `fidelizacion: ["commercial", "support"]` (más `admin`). **Los roles no se
solapan**: quien anula la factura no puede abrir Fidelización, y quien lleva el programa de
referidos no puede abrir la factura. Con una sola pantalla, un rol queda ciego, y cuál queda ciego
depende de cuál se elija.

| Pantalla | Rol | Muestra | **No** muestra |
|---|---|---|---|
| Factura anulada (`facturacion/[code]/page.tsx`) | `accounting` (+admin) | `referral_code`, monto | referidor, referido |
| Fidelización (banner arriba de los tabs) | `commercial`/`support` (+admin) | `referral_code`, referidor, referido, monto | **código e id de factura** |

El handle común es el `referral_code`: es lo que los dos lados necesitan para nombrar el mismo caso
cuando se hablen. El código de factura es dato del módulo de dinero (`listApplicableInvoices` ya lo
gatea con `moduleEditDenial(supabase, "accounting")` aunque viva en Fidelización), así que **no
cruza el tipo** de la query de Fidelización — no es que la pantalla lo descarte.

### 3 · Sin migración, y por qué

El estado inconsistente es consultable tal cual: fila de `referrals` con `status = 'aplicado'`,
`deleted_at is null`, cuyo `applied_invoice_id` apunta a una factura con `status = 'anulada'`.
Derivarlo en cada carga, en vez de persistir una bandera: no hay segunda verdad que se
desincronice, no hay que escribir nada justo cuando algo ya está fallando, y **alcanza a los casos
anteriores a este cambio**. **No se agregó ninguna entrada a
`supabase/migrations-baseline.json › pendingBelowCutoff`** porque no hizo falta ninguna migración.

Las dos queries nuevas (`lib/studio/fidelizacion/referral-credit-queries.ts`) caen sobre índices que
ya existen: `referrals (tenant_id, status) where deleted_at is null` (migr 0098) y `referrals
(applied_invoice_id)` (migr 0237).

### 4 · Los candados, mirados a propósito

**No se agregó ninguna server action.** Las dos superficies son lecturas de páginas que ya existen,
así que el candado que les toca es el `requireModuleView` que esas páginas ya tienen; se verificó
que exista en las dos:

- `app/studio/(app)/facturacion/layout.tsx` → `requireModuleView("invoices")`, y cubre `[code]`.
- `app/studio/(app)/fidelizacion/page.tsx` → `requireModuleView("fidelizacion")`.

Además: la RLS de `referrals` es **sólo por tenant, sin condición de rol** (`using (tenant_id =
public.get_user_tenant_id() and deleted_at is null)`, migr 0098, única policy sobre la tabla en
todo `supabase/migrations/`). O sea que el candado real acá es el de la aplicación, no el de la
base — por eso la decisión se tomó con la matriz en la mano y no por intuición.

## VALIDACIÓN

Todo en este worktree, 2026-09-20.

| Comprobación | Resultado |
|---|---|
| `corepack pnpm typecheck` | **PASÓ** (exit 0) |
| `corepack pnpm lint` | **PASÓ** (exit 0): 0 errores, 15 warnings, **todos preexistentes** en archivos fuera de la allowlist (`components/document-import/*`, `scripts/lib/knowledge-vault.mjs`) |
| `corepack pnpm docs:index` + `docs:check` | **PASÓ** (482 specs, índice sincronizado) |
| `corepack pnpm sdd:check` | **PASÓ** (sin números repetidos) |
| `corepack pnpm governance:check` | **PASÓ** (28 políticas, cápsula vigente) |
| Pruebas nuevas (vitest) | **PASÓ**: 54 de 54 ✓ (18 de `voidInvoice`, 16 de las queries, 20 del copy) |
| Vecindario (19 archivos: fidelizacion, accounting, facturacion) | **PASÓ**: 235 de 235 ✓, con `--pool=threads` |
| `corepack pnpm verify` | **NO EJECUTADO** — turno 3 de 4, a la espera del aviso del Director |
| `/ui-check` | corrido; dos hallazgos propios aplicados antes del commit (abajo) |
| Producción Supabase | **NO APLICA** — la tarea no escribe ni lee filas de negocio |

### Mutantes: 17 de 18 caen

Con los fuentes restituidos después de cada corrida. Script en el scratchpad de la sesión.

| # | Lo que se quita | Resultado |
|---|---|---|
| M1 | `voidInvoice` vuelve a `return { ok: true }` (**el defecto original**) | MUERTO |
| M2 | la revalidación de Fidelización en el fallo | MUERTO |
| M3 | el filtro `status = 'aplicado'` | MUERTO |
| M4 | el filtro `deleted_at is null` | MUERTO |
| M5 | la exigencia de que la factura esté `anulada` | MUERTO |
| M6 | `&& voidedComplete` | **VIVO** |
| M7 | la agrupación deja de devolver dos créditos de una misma factura | MUERTO |
| M8 | la proyección de Fidelización filtra el id de factura | MUERTO |
| M9 | `strandedCreditsForInvoice` deja de filtrar los ya liberados | MUERTO |
| M10 | el `select` de `strandedCreditsForInvoice` se ensancha | MUERTO |
| M11 | `voidInvoice` ignora `reverted` y manda siempre el aviso total | MUERTO |
| M12 | el selector apaga la distinción parcial/total | MUERTO |
| M13 | el corte se corre a `reverted > 1` (con 1 liberado, miente) | MUERTO |
| M14 | el título deja de seguir al cuerpo | MUERTO |
| M15 | el copy se escribe en voseo (`coordinálo`) | MUERTO |
| M16 | el copy filtra el nombre de una tabla | MUERTO |
| M17 | el copy deja de decir que no se arregla desde la pantalla | MUERTO |
| M18 | un voseo (`revisá`) que la aserción positiva NO vería | MUERTO |

**M6 sobrevive y está diagnosticado: sobra el código, no falta la prueba.** `fetchAllByIds` parte
los ids en lotes de 500 y pagina de a 1.000 filas, así que un lote no puede devolver más de 500
filas y la segunda lectura **no puede** quedarse corta. Ningún fixture lo distingue: `opts` va a las
dos lecturas y la de facturas nunca tiene más filas que la de referidos, de modo que si truncara la
segunda ya truncó la primera. Se **conserva** igual porque `fetchAllByIds` devuelve el campo y
tirarlo al piso es exactamente el error que `lib/db/paginate.ts` describe en su cabecera. Queda
anotado en el código y en la spec para que no se re-derive.

**Y una que me pasó a mí y vale como advertencia.** El control de voseo del copy estaba **muerto en
silencio** en su primera versión, por dos motivos a la vez: el patrón escrito en NFD contra texto
normalizado a NFC, y un `\b` después de vocal acentuada —que nunca matchea, porque `\b` es frontera
ASCII y `á` no es carácter de palabra para el motor—. Es la misma trampa de `[aá]` en `git grep -E`
con otra cara: el patrón no falla, deja de encontrar. Lo destapó que yo mismo escribí «sacrificá»
en este handoff y el chequeo no lo vio. Ahora el patrón se prueba contra una frase de control y hay
un mutante (M18) que mete un voseo que la aserción positiva no vería.

### `/ui-check`

Dos hallazgos, los dos **míos y ya aplicados** antes del commit:

1. ⭐ [alta] El banner durable de la factura anulada no tenía icono. La política de estados del
   founder (BRAND, 2026-09-05) pide que el estado se entienda **por texto e icono, nunca sólo por
   color**. Se agregó `Icon.warn(16)` (el módulo de iconos no es client-only y ya se usa en otros
   server components, p. ej. `clientes/[markbox]/page.tsx`).
2. [media] Los tres banners usaban px crudos para padding/margin/gap, así que no respondían a los
   modificadores de densidad. Pasados a `var(--s-*)`.

Lo que ya estaba bien: sólo tokens `var(--*)`, cero hex inventados, cero AI slop (sin gradientes de
color, glassmorphism ni emojis), tuteo venezolano sin voseo, `role="alert"` en los tres banners, y
el dorado sólo en icono y borde —que necesitan 3:1— con el cuerpo en tinta neutra, porque
`--warning` mide 3.14:1 y BRAND lo prohíbe como texto chico.

No se usó el primitivo `Badge` para los chips de código: `Badge` es un estado de altura fija y
`whiteSpace: nowrap` con `StatusIcon`, y acá el chip es una línea de datos que en Fidelización tiene
que poder envolver. El registro generado de componentes no tiene primitiva canónica de banner
(sólo `action-menu`, `confirm-dialog`, `numeric-input`, `segmented-control`), así que se siguió el
patrón local ya existente.

## COMMITS

- `dfc7b6fd` — `feat(studio): SDD-0495 — una reversión de crédito que falla deja de ser invisible`
  (10 archivos, +1437 −4). Exactamente la allowlist de la spec; nada de `git add -A`.

## PR / BRANCH

- Rama `claude/sad-mendeleev-cd9692`, **sin publicar** al momento de escribir esto.
- La PR se abre después del `verify` en verde. **No se fusiona**: integra el Director.

## PARA QUIEN MUEVA LA REVERSIÓN A SQL (sesión 4 de la fila)

Lo pidió el Director, y el 2026-09-20 me pasó el contrato al que va la sesión 4. Escrito ya sabiendo
eso: **lo único que tiene que adaptar es la firma.**

**El punto de instrumentación no se mueve.** Uno solo:
`app/studio/(app)/facturacion/actions.ts`, dentro de `voidInvoice`, justo después de la RPC
`void_invoice_with_audit_reason`. La función conserva nombre y forma `{ ok, reverted, error? }`, así
que el `if (!revert.ok)` sigue siendo el sitio exacto.

**Lo único que cambia: la firma.** Pasa a
`(supabase, tenantId, invoiceId, referralId?)` porque la RPC es INVOKER y el cliente del usuario va
primero. La línea de llamada en `voidInvoice` es hoy
`revertReferralCreditsForInvoice(current.tenant_id, current.id)`. **No la adapté**: quedamos con el
Director en que se adapta la sesión 4 al rebasar, y el conflicto es de una línea.

**Qué campos consume el aviso, exactamente:**

- `revert.ok: boolean` → decide **si** hay aviso. `false` ⇒ `warning`.
- `revert.reverted: number` → decide **cuál** de los dos avisos, y si se revalida
  `/studio/fidelizacion` en el camino feliz.
- `revert.error` → **no entra al aviso**, sólo al `console.error`. Si el error pasa a venir de
  Postgres cambia el texto del log y nada más. Hay una prueba que afirma que el crudo no se filtra.

**Los dos fallos ya están distinguidos** (era el punto que el Director marcó, y tenía razón — el
diseño anterior mentía):

| Retorno | Aviso | Por qué |
|---|---|---|
| `ok:false`, `reverted:0` | `VOID_REFERRAL_REVERT_WARNING` | No se liberó nada. |
| `ok:false`, `reverted:>0` | `VOID_REFERRAL_REVERT_PARTIAL_WARNING` | Parte sí se liberó. Decir «no se pudo» sería falso y mandaría a arreglar algo que ya está bien. |

**Y ese segundo caso ya es alcanzable HOY**, sin la migración: la reversión actual recorre los
créditos de a uno y suma a `reverted` los que salen bien, así que con dos créditos en la misma
factura uno puede liberarse y el otro no. O sea que no es sólo preparación para el contrato que
viene: era un defecto del aviso tal como lo había escrito. Corregido, con prueba y mutante (M13
mueve el corte a `reverted > 1` y muere).

**Dónde anclar.** El copy vive en `lib/studio/fidelizacion/referral-revert-notice.ts` (módulo
neutro, **no** `"use server"`; ver abajo). Exporta las dos constantes, los dos títulos y los
selectores `voidReferralRevertWarning(reverted)` / `voidReferralRevertTitle(warning)`. Las pruebas
anclan en las constantes, no en el texto. Si la sesión 4 exporta
`REVERT_REFERRAL_CREDITS_ERROR`, el lugar natural para consumirla es el `console.error`, no el
aviso.

**Trampa que me costó y conviene que sepas:** un módulo `"use server"` **sólo puede exportar
funciones async**. Tenía el texto como `export const` dentro de `actions.ts` y eso rompe
`next build` — no lo ven ni `typecheck` ni `eslint`, sólo el build de `verify`. Medido: los 40 y
pico de `actions.ts` del Studio exportan únicamente tipos e interfaces, que se borran al compilar;
no hay un solo `export const`. Si vas a agregar constantes al lado de una action, van en un módulo
aparte.

**Lo que NO hay que tocar, pase lo que pase con el contrato.** Las dos superficies durables y sus
queries (`strandedReferralCredits` y `strandedCreditsForInvoice`) **no dependen del retorno de la
reversión**: derivan el estado de las tablas. Aunque la reversión se mude entera a SQL siguen
funcionando sin cambios, y cubren los casos que la instrumentación del momento se pierde (un proceso
que muere entre medio, un fallo anterior a este cambio, o alguien que no estaba mirando). Ese es el
punto 2 del encargo y es el que de verdad cierra el agujero: **si hay que sacrificar algo en la
migración a SQL, sacrifica el aviso del momento, no el durable.** Tampoco pueden mentir en el caso
parcial: listan sólo los que quedaron varados.

**Si la reversión pasa a correr DENTRO de `void_invoice_with_audit_reason`** (mismo `FOR UPDATE`),
su fallo probablemente aborte la anulación entera. Eso cambia una **decisión de producto**, no sólo
el código: hoy la anulación es exitosa aunque la reversión falle, a propósito (SDD-0137 §3.6). Si
pasa a ser atómica, el `warning` deja de tener sentido y lo que corresponde es un `error`. Es
decisión de Sam, no consecuencia técnica.

**Ventana real.** Como la migración de la sesión 4 es migrate-first —se aplica a producción antes de
que el Director fusione su PR—, entre el despliegue de este aviso y ese momento, cualquier anulación
que falle se va a ver con este aviso. No es preparación para un futuro hipotético.

## PENDIENTES DE ESTA TAREA

1. **`corepack pnpm verify`** — turno 3 de 4. A la espera del aviso del Director. Si el paso `test`
   sale rojo, se le manda el veredicto literal antes de tocar nada, distinguiendo una aserción que
   falla de un worker de vitest que no arranca por falta de RAM.
2. **Publicar la rama y abrir la PR**, autorizado por el encargo, después del `verify` verde y
   avisando al Director antes (él serializa la integración).
3. **Borrar la reserva `codex/sdd-reserve-0495-aviso-reversion-credito-fallida`** una vez que la
   spec esté en `main`. Rechaza `branch -d` porque el stub nunca se fusionó; el `-D` se pide aparte.
4. **Smoke manual no ejecutado.** El camino que dispara el aviso del momento exige que la reversión
   falle de verdad (conflicto persistente en `paid_amount` a través de tres reintentos), que no se
   puede provocar desde la UI sin tocar datos. Las superficies durables sí se pueden ver sembrando
   un `referrals` en `aplicado` contra una factura `anulada` — **en local, nunca en producción**.
   Queda anotado para el guion de smokes si el Director lo quiere
   (`.agents/handoffs/smokes-app-l14-0454-0472-guion.md` es el guion vigente: extenderlo, no
   escribir uno nuevo).

## FUERA DE ALCANCE DETECTADO

1. **Reintentar la reversión desde la UI.** Hoy no hay camino: `voidInvoice` no se repite sobre una
   factura ya anulada, y `updateReferralStatus` **no sirve como atajo** — mueve el estado pero deja
   `applied_invoice_id`, `applied_entry_id`, `applied_at`, el `paid_amount` inflado y el asiento
   vivo, o sea que dejaría el dato **peor** que como está. Un botón «reintentar liberación» mueve
   plata: necesita gate de `accounting`, SDD propia y decisión de Sam. **Importante para quien lo
   tome: el aviso que se acaba de escribir dice explícitamente que no se arregla desde la pantalla.
   Si aparece el botón, hay que cambiar los tres textos.**
2. **La no conformidad de fondo**: llevar aplicación y reversión a funciones SQL con la factura
   `FOR UPDATE` (punto 1 del «Fuera de alcance» de la 0490). Exige migración. **Ya asignada a la
   sesión 4**; ver la sección de adaptación de arriba.
3. **Promover un `AdvisoryBanner` canónico** al registro de componentes. El patrón de banner de
   aviso está copiado en varios módulos (`legalAck` en `InvoiceDetailClient` y los dos de esta
   tarea, al menos). Una promoción CMP no la aprueba un script.
4. **`listReferrals` lee con `.limit(500)` sin paginar** (`lib/studio/fidelizacion/queries.ts:171`;
   `referralsByReferrer` igual, `:204`). La pestaña «Referidos» y `programStats` pueden estar
   truncando en silencio — justo el modo de falla que `lib/db/paginate.ts` describe en su cabecera,
   y `programStats` **agrega en JS** sobre ese resultado (`creditsIssued`, `convRate`), que es el
   caso que esa cabecera llama «un número equivocado con cara de verdad». No se tocó: está fuera de
   la allowlist y cambia KPIs. El aviso de esta SDD **no** hereda el problema: usa su propia lectura
   paginada.

## IMPACTO DOCUMENTAL

- **Creado**: `docs/specs/0495-aviso-reversion-credito-fallida/spec.md`.
- **Regenerado**: `docs/specs/README.md` (481 → 482 specs; el diff es sólo el conteo y la fila
  nueva).
- **Sin cambios**: `AGENTS.md`, `CLAUDE.md`, `BRAND.md`, runbooks. Nada de esta tarea es regla
  estable nueva; es una spec de producto.
- **Conocimiento nuevo que propongo al Director** (no lo convierto en regla por mi cuenta): *«los
  roles de `invoices` y `fidelizacion` no se solapan en la matriz por defecto»* es un hecho
  verificado que decide dónde va cualquier aviso que cruce dinero y programa de referidos, y no está
  escrito en ningún lado fuera de esta spec. Destino sugerido:
  `docs/engineering/project-rules.md` o el runbook de RBAC, a criterio del Director.

## HANDOFF AL DIRECTOR

Implementación cerrada y probada; **falta sólo el turno de `verify`**. La superficie durable —que
es lo que de verdad cierra el agujero— está hecha y no depende del retorno de la reversión, así que
sobrevive a la migración a SQL de la sesión 4. Las notas de adaptación para esa sesión están arriba,
en su propia sección.

Autorizaciones que pido al cerrar, agrupadas:

1. **El turno de `verify`** (turno 3 de 4).
2. **Publicar la rama y abrir la PR** después del verde (el encargo ya lo autoriza; aviso igual
   porque el Director serializa).
3. **`git branch -D codex/sdd-reserve-0495-aviso-reversion-credito-fallida`** una vez que la spec
   esté en `main`.

Lo que **no** pido y queda con gate humano: merge a `main`, despliegue, cualquier escritura en
producción y cualquier migración.
