# Handoff — SDD-0497 · Gates de RBAC en ocho server actions

**Rama:** `claude/vigorous-taussig-177fe6` · **Base:** `main` `07831a5d`
**Worktree:** `.claude/worktrees/jovial-lovelace-6d8291` (claim
`claude-jovial-lovelace-6d8291`)
**Fecha:** 2026-09-20 · **Spec:** `docs/specs/0497-gates-lectura-acciones-servidor/spec.md`

## Qué se hizo

Se confirmaron los **ocho** huecos del encargo y se les puso candado:
`moduleViewDenial` a lo que expone sin mutar, `moduleEditDenial` a lo que muta,
**antes** de tocar datos y devolviendo el motivo. Molde: `tesoreria/actions.ts`
(SDD-0494).

| # | Acción | Gate |
|---|---|---|
| 1 | `deleteShipment` + su fallo mudo | `moduleEditDenial("tracking")` |
| 2 | `getSupplierFinance` | `moduleViewDenial("financiero-china")` |
| 3 | `getStatementDetail` | `moduleViewDenial("financiero-china")` |
| 4 | `getReceivableHistory` | `moduleViewDenial("collections")` |
| 5 | `sendReplyAction` | `moduleEditDenial("conversaciones")` |
| 6 | `exportRecoverySmsCsvAction` | `moduleViewDenial("kommo")` |
| 7 | `searchKommoContactsAction` | `moduleViewDenial("kommo")` |
| 8 | `seedTenantCitiesFromVeCatalogAction` | `moduleEditDenial("admin-rutas")` |
| +1 | `convertLeadToClientAction` (no venía en el encargo) | `moduleEditDenial("kommo")` |

**Sin migración.** No se tocó `supabase/migrations-baseline.json` ni se declaró
ninguna espera en `pendingBelowCutoff`. Ninguno de los ocho lo exigía.

Cuatro pantallas pasan a mostrar el motivo en vez de una lista vacía o un botón
mudo: el drawer de cobranza, el de conversión del CRM, el modal de borrado de
Tracking y el seed de ciudades.

## Estado de las comprobaciones

| Comprobación | Estado |
|---|---|
| `pnpm exec tsc --noEmit` | **PASÓ** — exit 0, sin salida |
| `eslint` sobre los archivos del diff | **PASÓ** — exit 0, sin salida |
| Pruebas de gates (6 archivos, 84 casos) | **PASÓ** |
| Pruebas de pantalla · criterio 7 (1 archivo, 9 casos) | **PASÓ** — tres corridas seguidas |
| Suites de los módulos tocados + RBAC (11 archivos, 226 casos) | **PASÓ** |
| Mutantes de gate (10) | **PASÓ** — los 10 mueren, ajenas verdes en los 10 |
| Mutantes de pantalla (4) | **PASÓ** — los 4 mueren, cada uno mata sólo su caso |
| `pnpm verify` | **PASÓ CON CIERRE INCOMPLETO** — exit 0, **16 de 17**; el único sin medir es `migrations-applied` |
| Lectura de catálogo de producción | **NO DISPONIBLE** — esta tarea no tiene esa autorización; ver «Lo que NO verifiqué» |

### El veredicto de `verify`, literal

Corrida 22:58:26 → 23:16:22 UTC (17 min 56 s) sobre `b821c479`, con el turno 1
de 4 concedido por el Director. Última línea del script:

> `[AVISO] verify: CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied. No hubo fallos en lo medido (16/17); exit 0 NO equivale a cierre verde completo.`

- `migrations-applied`: **NO EJECUTADO**, `[SKIP] sin NEXT_PUBLIC_SUPABASE_URL /
  SUPABASE_SERVICE_ROLE_KEY`. Es estructural —da SKIP en todo worktree— y este
  cambio no lleva migración. El que sí mide algo relevante,
  `pending-migration-symbols`, dio **0 ROJO · 0 AMARILLO**.
- `lint`: 15 warnings, **0 errores**, todos en archivos ajenos al diff
  (`KommoBoardView.tsx:124`, `KommoClient.tsx:553`, `DocumentCalculator.tsx` ×4,
  dos tests del portal y `scripts/lib/knowledge-vault.mjs`).
- `e2e`: `[OK] (con aviso)` — 168 pasaron, 18 omitidos, ninguno falló. El exit ≠0
  es el worker de WebKit que no cierra en Windows, que el propio script reconoce.
- `test`: 8266 pasaron, 1 omitida, 633 archivos.
- Al terminar: árbol limpio y `tsconfig.json` **sin** residuo de `.next-verify`.

## Correcciones al encargo

Dos, ambas menores y ninguna cambia el arreglo:

1. **El sweep de la RPC del seed fue la 0209, no la 0211.** Y no la revocó: le
   quitó `EXECUTE` a `public` y `anon` y se lo **conservó a `authenticated`**
   (`0209:112-113`). La 0211 es el sweep de `authenticated` y esa función no
   figura en él. El efecto es el que decía el encargo —el candado falta— pero por
   la migración de al lado.
2. **`getStatementDetail` estaba en `:643`**, como decía el encargo, pero la
   acción empieza ahí y el `resolveTenant` sin gate está en `:656`. Sin
   consecuencia.

## Por qué el anti-drift no los vio — y por qué va a volver a pasar

`lib/studio/rbac-actions-guard.test.ts` estaba **verde** con los ocho huecos
abiertos. La razón es estructural y conviene que quede clara:

- **Mira el ARCHIVO, no la acción.** Su aserción es `src.includes("moduleEditDenial")`
  sobre el `actions.ts` entero. Un archivo con siete acciones gateadas y una
  abierta lo pasa. Los seis archivos de esta tarea ya nombraban el guard en otra
  de sus acciones.
- **Sólo escanea archivos llamados exactamente `actions.ts`.** Los **19**
  `*-actions.ts` del Studio nunca se miran.
- Lo mismo vale para `crm/__tests__/stage-control.test.ts:74`, que lee
  `crm/actions.ts` como texto y afirma que contiene el gate de `kommo`: sobreviven
  otras cuatro apariciones, así que tampoco habría detectado el hueco.

## FUERA DE ALCANCE DETECTADO

Nada de esto se tocó. Va en orden de valor.

### 1. Arreglar el anti-drift para que mire por ACCIÓN (alto valor)

Es el arreglo de fondo: el que evita la próxima tanda. Hay que (a) parsear las
`export async function` de cada archivo y exigir el gate por acción, y (b)
extender `findActions` a los `*-actions.ts`. **No se hizo acá porque ponerlo
estricto lo deja rojo sobre decenas de acciones ajenas a esta tarea**, cada una
con su propia decisión de a qué módulo pertenece y si corresponde vista o
edición. Es una tarea propia, con su SDD.

### 2. `tracking/[id]/document-actions.ts` — dos mutaciones sin ningún gate

Mismo defecto, archivo que el barrido del encargo no cubría (no se llama
`actions.ts`, así que el anti-drift tampoco lo mira):

- `uploadShipmentDocumentAction:29` — sesión + tenant, sin rol.
- `deleteShipmentDocumentAction:95` — **ni siquiera resuelve el tenant**: lee el
  documento, le pone `deleted_at` y **borra el objeto del bucket**
  (`supabase.storage.from(SHIPMENT_DOCS_BUCKET).remove(...)`). Eso último no es
  soft delete: el archivo se va.

El módulo `tracking` admite `commercial/operations/accounting/warehouse` y
`support` read-only, así que hoy un `support` puede borrar el BL de un envío.
**No lo toqué** porque está fuera de los ocho del encargo.

### 3. `admin/carrier-actions.ts` — revisado y NO es un hueco

Lo miro porque aparece en la lista de la sesión 2 y porque el anti-drift no lo
escanea. **Sí tiene gate**: `resolveTenantAdmin(supabase)` al tope de cada
mutación. No usa `moduleEditDenial`, por eso no lo encuentra un grep por ese
nombre. **No lo toqué y no hay nada que arreglar ahí.** Dato para la sesión 2.

### 4. La exposición por PostgREST (deuda deliberada, decisión de Sam)

Gatear las acciones **no cierra la exposición**. Ninguna de las ocho tablas
alcanzadas tiene predicado de rol en su policy de lectura (la tabla está en la
spec), así que cualquier miembro del tenant las lee directo por PostgREST. Está
documentado como deuda desde `0407_invoices_write_rbac.sql:16-19` y SDD-0492;
cerrarlo exige RPC minimizadas antes.

**Ojo con la palabra:** «tenant-wide» acá significa que la policy no mira el rol,
**no que cruce tenants**. Con un solo tenant en producción esta exposición sigue
siendo igual de real, porque es entre roles del mismo tenant.

### 5. ¿Exportar en masa merece una capability propia?

Lo dejó abierto la skill de datos personales. Hoy `exportRecoverySmsCsvAction`
hereda el permiso de **ver** la pantalla del CRM. Quien ve la pantalla ya ve
teléfonos, así que el delta del archivo es volumen (5000 contra 300 por carga) y
portabilidad (sale del ERP hacia un proveedor de SMS). Si eso merece
`CAPABILITIES.export_personal_data` (SDD-0139) es decisión de Sam, no de una
tarea de gates.

## Lo que NO verifiqué

- **El catálogo de producción.** Esta tarea no tiene esa autorización. Lo que
  verifiqué es el estado vivo de las policies **según los archivos y los
  preflights del repo**: el `create policy` original más todas las migraciones
  posteriores que la tocan, incluidas las que la tocan **sin nombrarla** (el
  `do $$` de la 0230). Para `conversation_messages` hay evidencia más fuerte que
  leer el archivo: el preflight de `0433:25-34` enumera las policies esperadas y
  aborta si hay drift, así que su aplicación es una aserción ejecutada.
  Donde cito lectura de catálogo es la del Director del 2026-09-20 registrada en
  SDD-0494, **a su nombre**.
- **El smoke con un usuario real.** Las cuatro pantallas tienen cobertura de
  render (`pantallas-muestran-la-denegacion.test.tsx`: la action devuelve la
  denegación y el texto llega al DOM), pero **nadie abrió el drawer con un rol
  `warehouse` de verdad en Preview**. Si el Director quiere smoke, el guion son
  los cuatro puntos del criterio 7 con ese usuario. Lo que sí está probado —y es
  el vector real— es la invocación directa de las nueve acciones.

## Cómo reproducir los mutantes

El script está en el scratchpad de esta sesión (`mutantes.cjs`) y **no se
commitea**: es una herramienta de verificación, no producto. Hace replace exacto
de la cadena del gate, corre la suite propia y el conjunto «ajenas», y restaura
desde copia en un `finally`.

Dos cosas que hay que conservar si alguien lo rehace:

- **Contar los del diff, no los del archivo.** `moduleEditDenial(supabase,
  "kommo")` aparece **cinco** veces en `crm/actions.ts` y
  `moduleEditDenial(supabase, "admin-rutas")` **ocho** veces en
  `admin/rutas/actions.ts`, casi todas preexistentes. El script aborta con «ANCLA
  NO ÚNICA» en vez de mutar; las anclas se alargaron con el contexto siguiente
  hasta ser únicas. Un `sed` ciego habría mutado código de otra tarea.
- **El conjunto «ajenas» incluye las otras cinco pruebas nuevas**, no sólo las
  preexistentes: un mutante que tumbe la prueba de otro gate sería un gate mal
  aislado.

Hay un segundo script, `mutantes-pantallas.cjs`, para los cuatro del criterio 7.
Mismo método; el `seedState?.error` se neutraliza con `{false && ...}` en vez de
borrar el bloque, para no mover el resto del JSX.

## Una trampa del fixture que conviene no repetir

El caso «cuando borra de verdad no inventa ningún error» modelaba el camino feliz
con `new Promise(() => {})` —una que no resuelve jamás, porque `redirect()` lanza
y la action no devuelve—. **El precio lo pagaba otro bloque**: la transición de
React quedaba abierta y los dos casos de «Admin · Rutas», 150 líneas más abajo,
fallaban porque su `useActionState` no llegaba a pintar. En aislamiento los tres
pasaban; juntos, dos rojos lejos de su causa.

Tardé cuatro corridas en ubicarlo porque busqué la causa donde estaba el
síntoma. Lo que lo resolvió fue bisecar por bloques (`-t` con dos `describe` a la
vez) hasta ver que Tracking + Rutas fallaba y Cobranzas + Rutas no. Ahora la
promesa se cierra en un `finally`, y la suite corrió tres veces seguidas en verde
— un rojo intermitente y uno real no se distinguen por el color.

## Nota sobre el diff de `FooterActions.tsx`

Era el **único blob con CRLF** bajo `app/studio/(app)/tracking` y contradecía
`* text=auto eol=lf` del `.gitattributes`, así que cualquier cambio en él daba un
diff de 730 líneas. La normalización va en **un commit aparte**
(`f9dafd14 chore(tracking): normaliza a LF…`), verificada byte a byte: idéntico
salvo los 364 CRLF→LF y un CR suelto al final de la línea 19. El commit de la
spec queda en 6 líneas para ese archivo.

## Pendientes de esta tarea

Ninguno del alcance. `verify` corrió con su turno y el veredicto se le pasó al
Director; la spec quedó en `done`; la PR queda abierta para que **el Director
integre** — esta sesión no fusiona a `main`.

Lo único que queda a criterio suyo es el **smoke con un usuario `warehouse` real
en Preview** (ver «Lo que NO verifiqué»), que no es requisito de cierre porque el
vector real —la invocación directa— sí está cubierto.

## Coordinación

- Turno 1 de 4 para `verify`, asignado por el Director el 2026-09-20.
- Archivos tocados: ninguno se solapa con los cinco de la sesión 2
  (`contabilidad/actions.ts`, `fiscal/actions.ts`, `admin/carrier-actions.ts`,
  `admin/notificaciones/actions.ts`, `marketing/noticias-web/actions.ts`).
  `admin/carrier-actions.ts` lo **leí** para descartarlo como hueco, pero no lo
  modifiqué.
