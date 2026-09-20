# Handoff — SDD-0498 · cinco puertas del Studio que se saltaban `disabled_at`

Fecha: 2026-09-20. Task ID: `rbac-gates-disabled-at-0498`.
Owner / sesión escritora: `claude-modest-chaplygin-c2cdee` (Worker Claude Code).
Sin subagentes. Director activo: la sesión que reparte los turnos de `verify`
(cuatro encargos en paralelo; a mí me tocó el turno 2 de 4).

Estado: **implementación completa; `verify` completo corrido y sin fallos en lo
medido; falta abrir la PR.** No fusionado. Sin migración.

- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/modest-chaplygin-c2cdee`.
  Ya existía y es un linked worktree válido: `harness-worktree.mjs guard` PASÓ,
  así que no creé otro. `claim --owner claude-modest-chaplygin-c2cdee` tomado, y
  `guard --owner` revalidado antes de los commits.
- **Rama:** `claude/modest-chaplygin-c2cdee`, desde `main` `07831a5d`. Sin
  publicar todavía.
- **SDD:** `docs/specs/0498-rbac-gates-disabled-at/spec.md`, en `in-progress`.
  Reservada con `corepack pnpm sdd:next --reserve rbac-gates-disabled-at` → ref
  local `codex/sdd-reserve-0498-rbac-gates-disabled-at` (`523d60ca`), sin push.
  El inventario dio 0498 libre; las ADVISORY de colisión que imprimió son
  históricas y no me tocan.

## OBJETIVO ORIGINAL

Cinco server actions del Studio resolvían el rol leyendo `user_tenants` a mano,
sin el filtro `disabled_at` del endurecimiento 0200, así que un usuario
suspendido seguía pudiendo actuar. Sustituirlas por el guard central —
extendiéndolo si hacía falta — para que no queden dos formas de resolver el
rol. Prueba por puerta: rol correcto + `disabled_at` no nulo → denegación,
escrita primero y roja contra `main`. Mutantes. Sin migración.

## COMPLETADO

### Las cinco puertas, verificadas una por una antes de tocarlas

El encargo pedía no confiar en el barrido de origen. Verifiqué, y aparecieron
dos precisiones:

- en `fiscal/actions.ts`, las otras tres actions (`voidFiscalBook`,
  `createWithholding`, `voidWithholding`) llaman a `moduleEditDenial` **antes**
  de `resolveFiscalGate`, así que ya cortaban. La única expuesta era
  `postFiscalBookAction:229`, tal como decía el encargo;
- `saveFiscalSettingsAction:128` tenía una **tercera** lectura a mano, también
  sin el filtro, que el barrido no listó. No era explotable (había un
  `moduleEditDenial` delante), pero era la segunda forma de resolver el rol.
  La migré igual.

### El arreglo: taparle el hueco al helper, no sólo cambiar los call sites

`moduleEditDenial` devuelve sólo el mensaje. Una action que además necesita
`tenant_id` para escribir no tenía de dónde sacarlo → releía `user_tenants` →
al reescribir la consulta se perdía el filtro. **Eso es lo que había que
arreglar**, o el próximo autor vuelve a copiar.

En `lib/studio/rbac-guard.ts`:

- `getStudioAccess` devuelve además `tenantId` y `userId`, de la MISMA fila que
  resolvió el rol;
- `moduleEditGate(supabase, moduleId, messages?)` — el predicado de
  `moduleEditDenial` más el contexto;
- `tenantAdminGate(supabase, messages?)` — admin-only con el mismo contexto;
- el predicado de edición se extrajo a `editDenial()`, compartido por
  `moduleEditDenial` y `moduleEditGate`. Una prueba recorre roles × suspendido
  y exige que los dos decidan igual — si fueran dos copias, estaríamos
  repitiendo el error que la tarea vino a borrar.

**Dos gates y no uno, a propósito.** Cuatro de las cinco son admin-only por
regla de producto, no por la fila del módulo en la matriz: el cierre contable
(SDD-0080) es admin-only aunque `accounting` admite al rol `accounting`; la
config fiscal igual; transportistas/notificaciones/noticias viven bajo módulos
con otra fila. Expresarlas con `moduleEditGate("accounting")` o
`("noticias-web")` las habría **ampliado** a `accounting`, `commercial` y
`marketing` de refilón, dentro de una tarea de seguridad.

**Discriminante `ok`, no `denied`.** Con un único `denied: string | null`
TypeScript no estrecha la unión (`string` no es tipo unidad) y el call site
termina con un `tenantId` posiblemente indefinido dentro de un `insert`. Lo
descubrí al typecheckear: 12 errores en 5 archivos. Con `ok` el compilador
obliga a pasar por el gate.

### Qué tan grave era cada una — esto corrige el parte del encargo

El encargo decía «a un usuario que suspendiste le siguen funcionando esas
operaciones». Medido contra los **archivos de migración del repo**, eso es
cierto en **una** de las cinco:

| Puerta | Respaldo en DB | ¿Escribía un suspendido? |
|---|---|---|
| cierre contable | `0133_period_close.sql:49-75` | No |
| asentar libro fiscal | RPC `0165_fiscal_books.sql:307-315` | No |
| transportistas y tarifario | `0330_freight_carriers_tariffs.sql:157-236` | No |
| notificaciones | `0289_audit_d1_access_configuration.sql:145-156` | No |
| **noticias del sitio público** | `0055_news_posts.sql:82-110` y `0053_seo_drafts.sql:73-111` **no miran `disabled_at`** | **Sí** |

Las cuatro primeras eran defensa en profundidad perdida. No es poca cosa — un
gate que aprueba a quien la DB rechaza miente en el review — pero no había
puerta abierta. **Noticias-web sí**, y doble:

1. un admin suspendido publicaba en el sitio público (`publishPost`,
   `saveDraft`);
2. las ocho actions de generación llaman a Anthropic **sin tocar la DB**:
   ninguna RLS las cubre. Quemaba la API key.

### Pruebas

Seis archivos nuevos, todos escritos **antes** del arreglo y comprobados en
rojo contra `main`:

| Prueba | Rojo contra `main` |
|---|---|
| `lib/studio/__tests__/rbac-guard-gates-con-tenant.test.ts` | 13 casos nuevos |
| `.../contabilidad/__tests__/cierre-contable-usuario-suspendido.test.ts` | 2 de 5 |
| `.../fiscal/__tests__/asentar-libro-usuario-suspendido.test.ts` | 2 de 4 |
| `.../admin/__tests__/carrier-actions-usuario-suspendido.test.ts` | 5 de 8 |
| `.../admin/notificaciones/__tests__/notificaciones-usuario-suspendido.test.ts` | 4 de 6 |
| `.../marketing/noticias-web/__tests__/noticias-web-usuario-suspendido.test.ts` | 5 de 7 |

**El doble de PostgREST tuvo que ser nuevo.** Los del repo hacen
`is: () => query`: devuelven la fila pase lo que pase, así que **no pueden
distinguir un gate que filtra `disabled_at` de uno que no** — los dos leen la
misma fila. `lib/studio/__tests__/user-tenants-double.ts` guarda cada
`.eq()`/`.is()` y aplica el filtro al resolver. Devuelve copias (si entregara
los objetos vivos del store, una escritura posterior cambiaría «lo ya leído»).

Se prueba **por el lado negativo**: no el mensaje, sino que al suspendido no se
le escriba una fila ni se le llame a Anthropic.

El rojo de `publishPost` contra `main` no es una aserción de mensaje: la action
llegaba hasta `revalidatePath("/noticias")` (línea 1205), o sea **después del
INSERT**. Es el agujero reproducido.

### Mutantes

| Mutante | Resultado |
|---|---|
| quitar `.is("disabled_at", null)` de `getStudioAccess` | mueren **19** casos en los 6 archivos nuevos; los **26 archivos** de test que tocan `rbac-guard` (349 casos) siguen **verdes** |
| quitar `.eq("user_id", user.id)` | mueren los 4 casos de «la membresía de OTRO usuario no habilita al de la sesión» y nada más |

Un solo renglón cambiado por mutante, en `rbac-guard.ts`, restaurado desde
copia después de cada corrida.

### Anti-drift

`lib/studio/rbac-actions-guard.test.ts` exigía el nombre `moduleEditDenial`.
Ahora acepta cualquiera de los guards de `rbac-guard` (`moduleEditDenial`,
`moduleEditGate`, `tenantAdminGate`, `capabilityDenial`), y
`admin/notificaciones/actions.ts` y `marketing/noticias-web/actions.ts` **salen
de la ALLOWLIST**.

## POR QUÉ EXISTÍAN LOS GATES ARTESANALES

El Director pidió esto de más, y no dio lo mismo en las cinco:

- **Cuatro por el `tenant_id`.** La evidencia más fuerte es `fiscal/actions.ts`:
  ese archivo **importa y usa `moduleEditDenial` en tres actions** y aun así su
  autor escribió `resolveFiscalGate` a mano. Conocía el helper; necesitaba el
  tenant. En noticias-web está escrito literal: `requireAdminWithTenant` se
  documenta como «Variante que también devuelve el tenant_id (necesario para
  INSERTs)».
- **Dos eran excepciones deliberadas sobre el predicado.**
  `carrier-actions.ts` declara «Gate: `admin`» en su cabecera; notificaciones
  tenía su excepción argumentada por escrito en la ALLOWLIST. Querían admin-only
  duro, no la matriz. Esa intención se conserva con `tenantAdminGate`.
- **Una fue desconocimiento del helper.** El `requireAdmin` de noticias-web no
  necesita tenant y se documenta como «patrón compartido con
  `mailing/page.tsx`»: copiaron un gate de una *page* a server actions, donde
  la page ya no había gateado nada. Es el único sin excepción que preservar, y
  el que peor quedó.

## LO QUE CAMBIA DE COMPORTAMIENTO (y lo que no)

- **Ningún rol gana permisos.** Cada gate conserva su predicado y su copia es-VE
  (`messages` existe para eso). Lo único que cambia: el suspendido deja de
  pasar, y en notificaciones y noticias la consulta queda acotada al usuario de
  la sesión.
- **Orden en `saveFiscalSettingsAction`**: el candado de admin corre ahora ANTES
  de validar el formulario. Antes un no-admin con datos inválidos recibía
  `fieldErrors`; ahora la denegación. Es el orden correcto para un gate.
- **Mensaje en un borde**: donde el gate artesanal decía «No se pudo resolver el
  tenant del usuario» por falta de membresía, ahora responde la denegación por
  permiso. No se le informa a un desconocido si existe o no una membresía.

## CIERRE: `corepack pnpm verify`

Corrido con el turno 2 de 4 que dio el Director, sobre `1490d8ce`, el
2026-09-20 de **23:18:24Z a 23:34:46Z (16 min 22 s)**. Referencia de la sesión
1 en la misma máquina ese día: 17 min 56 s → sin contención.

Lanzado en segundo plano a propósito: la herramienta de shell corta a los 10
minutos y un `timeout` que mata el build a medias sale con exit 143 y deja
`tsconfig.json` apuntando a `.next-verify`.

**Exit 0, pero el cierre es INCOMPLETO**, y el propio script lo dice: «CRÍTICOS
SIN MEDIR: migrations-applied … exit 0 NO equivale a cierre verde completo».
16 de 17 pasos corrieron de verdad, sin fallos en lo medido.

| # | Paso | Veredicto |
|---|---|---|
| 1 | harness | PASÓ |
| 2 | lint | PASÓ — 15 problemas, **0 errores**, 15 warnings |
| 3 | rsc-boundary | PASÓ |
| 4 | typecheck | PASÓ |
| 5 | edge-functions | PASÓ — 4 funciones compilan |
| 6 | test | PASÓ — **633 archivos, 8225 pruebas, 1 skip** |
| 7 | docs:check | PASÓ |
| 8 | numbering | PASÓ |
| 9 | feature-constants | PASÓ — 5 banderas |
| 10 | components:check | PASÓ |
| 11 | governance:check | PASÓ |
| 12 | migrations-applied | **NO EJECUTADO** — SKIP sin `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. Estructural de todo worktree (no se copian secretos), no dice nada de este cambio |
| 13 | pending-migration-symbols | PASÓ — **0 ROJO · 0 AMARILLO** |
| 14 | sql-tests | PASÓ |
| 15 | schema-rebuild | PASÓ |
| 16 | e2e | PASÓ — 167 pasaron, 1 flaky, 18 skipped |
| 17 | build | PASÓ — `tsconfig.json` restaurado |
| — | `spec-migration-refs` | **NO APLICA** — no hay migración |

**El paso `test` no es un verde falso**: imprimió el conteo y ejecutó 8225
pruebas. Se comprobó a propósito, porque un reporter mal elegido sale 0 sin
correr nada.

**Los 15 warnings de lint son preexistentes** y los había listado el Director
antes de la corrida, archivo por archivo: `NewPurchaseWizard.test.tsx`,
`PurchaseStepDetalle.test.tsx`, `KommoBoardView.tsx:124`, `KommoClient.tsx:553`,
`DocumentCalculator.tsx` ×4 y `scripts/lib/knowledge-vault.mjs`. Coinciden
exactamente. Ninguno de esta tarea.

**El único flaky no es de este cambio.** `e2e/calculadora-semantic-colors.spec.ts:58`,
en `/tarifas/embed`: `pressSequentially("mara", { delay: 10 })` seguido de
`toHaveValue("mara")` — carrera de tecleo; falló una vez y pasó en el reintento.
El diff son 17 archivos y **ninguno lo renderiza esa página**. Lo único que roza
`/tarifas` es el `revalidatePath("/tarifas")` que `carrier-actions.ts` ya tenía
antes y que no cambia lo que ve un visitante anónimo.

No apareció el aviso del worker de WebKit a los 300 s en esta corrida.

Antes del verify, y ya en verde: `tsc --noEmit` del repo completo, `eslint`
sobre los archivos tocados, vitest focal de los 6 archivos nuevos (98 casos) y
de los 26 que tocan `rbac-guard` (349 casos), `docs:check` tras `docs:index`
(482 specs) y `sdd:check`.

## PENDIENTE DE ESTA TAREA

1. **Abrir la PR.** Autorizada por el encargo («abre la PR y yo integro»).
   Pendiente de que el Director diga si se abre ya o después de integrar la
   sesión 1: el ruleset exige el check verde sobre el commit que se fusiona, así
   que abrir antes de traer main obliga a una segunda corrida de CI.
2. **Traer `main` con merge** (no rebase) cuando integre la sesión 1,
   resolviendo `docs/specs/README.md` con el driver `dtd-generated-records` y
   regenerando con el script. El driver ya está configurado en este worktree
   (`merge.dtd-generated-records.driver` y `.gitattributes:32`). Al cierre del
   verify `origin/main` seguía en `07831a5d`, o sea la propia base de esta rama:
   no había nada que mergear todavía.
3. **No fusionar.** Integra el Director.
4. Poner la spec en `done` al cerrar.

## FUERA DE ALCANCE DETECTADO

### Seis puertas más con el mismo defecto (barrido propio, no del encargo)

Salieron de recorrer las 167 lecturas de `user_tenants` del repo y quedarme con
las 51 que además leen `role`. **No arreglé ninguna**: ampliar el encargo
habría doblado la PR y `tarifas/actions.ts` y `crm/actions.ts` son terreno de la
sesión 1. De ninguna verifiqué si la RLS de destino repite el candado.

| Archivo:línea | Qué gatea | Omite |
|---|---|---|
| `app/studio/(app)/admin/calculator-actions.ts:63` y `:127` | calculador público (parámetros y ciudades) | `disabled_at` |
| `app/studio/(app)/tarifas/actions.ts:297` | publicar/archivar tarifas — **copia literal** del `resolveTenantAdmin` que arreglé | `disabled_at` |
| `lib/http/studio-session.ts:50` | `requireStudioSession`, usado por 4 route handlers (`bugs/[id]`, exports comercial y operativo, `shipments`) | `user_id` **y** `disabled_at` |
| `lib/studio/renditions/actions-helpers.ts:58` | emitir/anular rendiciones (dinero + `SUPERADMIN_ONLY`) | `user_id` **y** `disabled_at` |
| `app/studio/(app)/crm/actions.ts:123`, `:213`, `:272` | mapa de etapas de Kommo — **es de la sesión 1**, ya le avisé | `user_id` **y** `disabled_at` |
| `app/api/studio/searates/probe/route.ts:41` · `app/api/studio/legal/evidence/[code]/route.ts:56` | admin-only (`legal` es `SUPERADMIN_ONLY`) | `user_id` **y** `disabled_at` |

No son gate de permiso y los descarté a propósito: `bugs/actions.ts:267` (rol
para etiquetar autor), `dashboard/actions.ts:44` (config propia, filtra con
`canAccessModule` después) y las lecturas que sólo piden `tenant_id`.

### Dos justificaciones obsoletas en la ALLOWLIST del anti-drift

No las toqué para no pisar a la sesión 1, que va a editar ese mismo archivo:

- **`admin/feature-flags/actions.ts`** dice «toggleFeatureFlag valida
  `role==='admin'` inline». **Ya no**: usa `platformAdminDenial` desde
  SDD-0355. La entrada sobra.
- **`admin/alertas-telegram/actions.ts`** dice que su `requireAdmin()` es «MÁS
  estricto que `moduleEditDenial('admin')`, que resuelve por la matriz y
  **admite overrides por rol**». **Medido, es falso**: `"admin"` está en
  `ADMIN_ONLY_MODULES ⊂ LOCKED_MODULES`, y tanto `canEditModule` como
  `canAccessModule` saltan los overrides para módulos LOCKED (`rbac.ts:325` y
  `:346`). No abre nada —ese gate usa `getStudioRole`, que sí es fail-closed—
  pero la razón escrita no se sostiene, y es la clase de razón que en el próximo
  review alguien acepta sin medir.

### El hueco del escáner

`rbac-actions-guard.test.ts` abre **sólo** archivos llamados exactamente
`actions.ts`. Toda la familia `<algo>-actions.ts` —carrier, calculator,
calendar, company, exchange-rates, portal-backfill, change-request— queda fuera
del barrido: ahí se coló este defecto. Y el contrato es **por archivo, no por
action**, así que `contabilidad/actions.ts` y `fiscal/actions.ts` pasaban en
verde con una puerta abierta adentro.

Ampliarlo pondría en rojo a una docena de archivos de una vez, así que lo dejé
anotado en la cabecera del contrato en vez de hacerlo acá.

### Doble resolución barata que dejé

`voidFiscalBookAction`, `createWithholdingAction` y `voidWithholdingAction`
llaman a `moduleEditDenial` y después a `resolveFiscalGate`, que hoy también
resuelve. Son dos viajes a la DB, **no dos criterios** — los dos preguntan por
`getStudioAccess`. Unificarlas les cambiaría el mensaje a tres actions que no
son el defecto, así que no las toqué.

## COORDINACIÓN

- Mis cinco archivos no se solapan con la sesión 1 (tracking, financiero-china,
  cobranzas, conversaciones, crm, admin/rutas). Confirmado con el Director.
- **Sí toqué un archivo compartido**: `lib/studio/rbac-actions-guard.test.ts`.
  Si la sesión 1 agrega guards a sus `actions.ts` va a editar la misma
  ALLOWLIST → conflicto textual probable al integrar. Trivial de resolver; el
  Director ya está avisado.
- No leí producción ni pedí autorización para hacerlo. Toda la evidencia de DB
  de este handoff sale de los **archivos de migración del repo**; una policy
  puede haberla reescrito un `do $$` posterior que no la nombra. Para
  `news_posts` / `seo_drafts` revisé las 14 migraciones que las mencionan y
  ninguna redefine sus policies, pero eso sigue siendo evidencia de archivo.
