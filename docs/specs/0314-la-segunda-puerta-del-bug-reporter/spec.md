---
sdd: "0314"
title: "La segunda puerta de la máquina de estados del Bug Reporter"
status: done
author: "founder"
created: 2026-08-27
updated: 2026-08-29
supersedes: null
superseded_by: null
related: ["0036", "0312"]
confidencialidad: interno
---

# DTD-0314 — La segunda puerta de la máquina de estados del Bug Reporter

> La 0028 dice, en el comentario de su propia policy, que «las transiciones de
> estado pasan por RPC». No era verdad. Al lado de la RPC había un
> `grant update` por el que un admin escribía el estado a mano — sin whitelist,
> sin renglón de bitácora y sin sellar la hora. El expediente seguía
> viéndose bien.

## Qué estaba abierto

Salió del barrido de [SDD-0312](../0312-contratos-para-la-logica-sin-red/spec.md),
que dejó el hueco **escrito y sin cerrar** en la cabecera de
`supabase/tests/0028_bug_reporter.test.sql`, bajo «DOS HUECOS MEDIDOS QUE ESTE
CONTRATO NO CIERRA», punto A. Esto lo cierra.

Convivían dos piezas en `supabase/migrations/0028_bug_reporter.sql`:

```sql
grant update on public.bug_reports to authenticated;   -- línea 715
create policy "bug_reports_admin_update" ...           -- línea 517
```

y la policy sólo exige ser **admin del tenant**. Todos los guards de la máquina
de estados —la whitelist de transiciones, el corte en los estados terminales, el
auto-sellado de `taken_by`/`resolved_at`, el renglón obligatorio en
`bug_timeline`— viven **dentro de `bug_advance_state`**. La puerta de al lado no
pasaba por ninguno.

## Lo medido, no lo inferido

2026-08-27, contra un Postgres desechable (`postgres:17` en Docker, con los
stubs de plataforma + las migraciones 0028 y 0039 reales), actuando como
`authenticated` con el uid de un admin del tenant:

| Acción | Resultado | `resolved_at` | Renglones de timeline |
|---|---|---|---|
| `update bug_reports set state='resuelto'` desde `nuevo` | **ACEPTADO** | queda `NULL` | 0 |
| `update bug_reports set state='nuevo'` desde `resuelto` | **ACEPTADO** — terminal reabierto | — | 0 |
| La misma transición por `bug_advance_state` | **RECHAZADO** `P0003` | — | — |

## Alcance del daño

**No es una fuga entre empresas.** Es dentro del propio tenant y hace falta ser
admin, y por eso nunca reventó: la app nunca toma esa puerta —los cinco sitios
que cambian estado llaman a la RPC— así que el hueco es de superficie, no de
comportamiento observado.

Lo que se pierde es la **fidelidad del expediente**: un bug puede figurar
resuelto sin que exista rastro de quién lo resolvió ni cuándo. Para un canal
cuyo producto ES la trazabilidad de qué se hizo con cada reporte, eso vacía el
registro sin que nada se vea roto.

## Cómo se cierra: dos capas

`supabase/migrations/0394_bug_state_transitions_via_rpc_only.sql`. Cada capa
tapa el punto ciego de la otra.

**Capa 1 · Privilegios por columna.** `authenticated` deja de tener UPDATE sobre
la tabla y lo recibe sólo sobre las cinco columnas que la app escribe en
directo: `severity`, `eta_days`, `admin_thanks`, `commit_url`,
`duplicate_of_id` — medidas en `PATCHABLE_FIELDS` de
[`route.ts`](../../../app/api/studio/bugs/[id]/route.ts) y en
`updateBugAdminAction` de [`actions.ts`](../../../app/studio/(app)/bugs/actions.ts).
Nombrar `state` en un UPDATE pasa a ser `42501`, y lo rechaza el motor: no hay
nada que forjar.
👉 **Punto ciego:** un `grant update on public.bug_reports to authenticated`
futuro la borra de un plumazo — que es exactamente cómo nació el hueco.

**Capa 2 · Trigger.** `bug_reports_state_via_rpc_guard()` rechaza tocar `state`
y sus cuatro sellos (`taken_by`, `taken_at`, `resolved_at`, `discarded_at`)
cuando el cambio no viene de adentro de la RPC. **Sobrevive a ese re-GRANT.** La
señal exige dos cosas a la vez:

1. la GUC `dtd.bug_state_via_rpc` en `'on'` — la abre y la cierra la propia
   `bug_advance_state` alrededor de su UPDATE; y
2. `current_user` = dueño de la tabla.

La (2) es la mitad **no forjable**: una GUC de prefijo propio la setea
cualquiera, pero un cliente conectado como `authenticated` nunca llega a ser el
dueño, así que forjar la GUC sola no compra nada. La (1) da la precisión:
distingue a `bug_advance_state` de cualquier otra escritura a nivel dueño.

**No se duplica la whitelist en el trigger** —como sí hace
`dispatch_orders_status_transition_guard`—: la whitelist tiene un solo dueño, y
dos copias driftean. Este trigger no decide *qué* transición es válida; decide
*quién* puede decidirlo.

**Escotilla explícita** para una reparación deliberada desde una migración, que
corre como dueño:

```sql
select set_config('dtd.bug_state_via_rpc', 'on', true);
```

## Contratos

Cuatro nuevos en `supabase/tests/0028_bug_reporter.test.sql` (14 al 17), que
pasan de 13 a 17 al integrarse con SDD-0312. La cabecera deja de denunciar el
hueco de la segunda puerta y pasa a contratarlo; el `EXECUTE` de `anon` sobre
`next_bug_folio` ya queda contratado por el 12 de SDD-0312.

⚠️ **El detalle que hace que el 14 signifique algo.** Las dos capas no son
independientes al medir: la de privilegios **tapa** a la del trigger. Medido, el
contrato 14 recibe `permission denied for table bug_reports` — o sea que ni
siquiera llega al trigger. Un 14 verde no dice nada sobre si el trigger existe.
Por eso el **contrato 16 borra la capa 1 a propósito**, con la línea exacta de
la 0028 que abrió el hueco, y recién ahí mira si el trigger sostiene solo.

### Validación por mutación

Cada contrato se rompió a propósito y se verificó **cuál** se pone rojo:

| Mutación | Qué se arranca | Contrato que se pone rojo |
|---|---|---|
| A | el candado entero (vuelve la 0028 tal cual) | **14** |
| B | sólo el trigger, capa 1 intacta | **16** |
| C | el trigger deja de exigir `current_user` = dueño | **17** |
| D | el trigger deja de mirar los sellos (+ capa 1 fuera) | **15** |

Las cuatro pusieron rojo al contrato que les toca.

### Lo que hubo que ajustar del archivo existente

- **Contrato 6** antedata `taken_at` con un UPDATE directo (como dueño) para
  probar que la RPC no lo re-escribe. Es un sello, así que ahora usa la
  escotilla documentada. Es la misma escotilla que la migración ofrece para una
  reparación deliberada, y de paso la ejercita.
- **Fixture nuevo** `BUG-00006`: los contratos 14 al 17 necesitan un bug
  **intacto** —prueban que la puerta de al lado no lo mueve— y los cinco de
  antes ya los mueven los contratos 1 al 6.
- **Contrato 7** (folio = `max()+1`) pasa a esperar `BUG-00007`, y el **11**
  (aislamiento de lectura) a contar 6 bugs. Son consecuencia aritmética del
  fixture nuevo: ninguno de los dos se debilitó.

## Estado

- ✅ Migración escrita como **archivo** en la rama.
- ✅ **APLICADA a producción el 2026-08-27** con OK del founder nombrando la
  migración, de a UNA, siguiendo
  [`docs/runbooks/aplicar-migraciones-prod.md`](../../runbooks/aplicar-migraciones-prod.md).
  Ledger: `version 20260828005950`, `name 0394_bug_state_transitions_via_rpc_only`
  (basename exacto, la regla hacia adelante).
- ✅ Contratos verdes y validados por mutación.

### Sondeos previos a aplicar (el `create or replace` sobre una función viva)

La migración redefine `bug_advance_state`, así que antes se midió que la versión
viva en prod fuera **exactamente la 0039** y no algo aplicado fuera de banda que
esto habría revertido en silencio. Lo era: guards, whitelist, sellado e INSERT al
timeline idénticos — la única diferencia era un comentario más largo. También se
confirmó `security definer`, dueño `postgres` y `search_path=public`, que son las
tres condiciones de las que depende la mitad no forjable del candado.

### Verificación contra el OBJETO (no contra el nombre)

| Sondeo | Antes | Después |
|---|---|---|
| `UPDATE` de tabla para `authenticated` | 1 | **0** |
| Columnas con `UPDATE` para `authenticated` | las 27 | **las 5** de la allowlist |
| Trigger `bug_reports_state_guard_trigger` | no existía | **vivo** |
| `search_path` del guard | — | `{search_path=public}` |
| `bug_advance_state` abre la GUC | no | **sí** |
| `SELECT` + `INSERT` de `authenticated` | 2 | **2** (intactos) |

### Efecto lateral querido: `service_role` tampoco mueve el expediente

`service_role` conserva su `UPDATE` de tabla (la migración sólo revoca el de
`authenticated`), pero el trigger lo alcanza igual: no es el dueño, así que un
UPDATE directo suyo sobre `state` o los sellos ahora falla. Se verificó que
ningún camino del servidor lo hace — los cinco sitios que cambian estado llaman a
la RPC y el cliente admin sólo lee. Una reparación manual contra prod pasa a
necesitar la escotilla explícita.

### ⚠️ Esta spec nació 0313 y se renumeró a 0314

Colisión de las que AGENTS.md avisa. `pnpm sdd:next` dio **0313** al empezar; al
ir a pushear, horas después, otra ventana ya había publicado
[`0313-el-boton-que-no-decia-que-faltaba`](../0313-el-boton-que-no-decia-que-faltaba/spec.md)
en `main`. Regla aplicada: **la que se mueve es la que NO está en `main`**, o sea
ésta. Pedir el número no alcanza cuando entre numerar y pushear pasa el día —
para eso está `sdd:next --reserve`, que no se usó.

**La migración NO se renumeró:** sigue siendo `0394`, porque ya corrió en prod
con ese número y una migración aplicada nunca se renumera.

🔴 **Consecuencia abierta, medida:** el `comment on function` que quedó grabado
en prod dice `(SDD-0313)` — se aplicó antes de la renumeración. El archivo del
repo ya dice `SDD-0314`, así que hay **drift de un comentario** entre el archivo
y la base. Cero impacto funcional; el riesgo es que mande a un lector futuro a
la spec equivocada. Lo cierra una línea, con OK del founder nombrándola:

```sql
comment on function public.bug_reports_state_via_rpc_guard() is
  'Candado de la máquina de estados del Bug Reporter (SDD-0314): …';
```

No se aplicó sola: escribir en prod exige OK explícito nombrando la migración, y
el de la 0394 no cubre una segunda escritura.

### El `cutoff` del baseline NO se sube

El runbook sugiere subirlo tras aplicar una tanda, pero el baseline es más
específico y gana: 238 es la frontera entre los nombres libres del pasado y la
regla nueva, y subirlo sólo sacaría de la vigilancia a la 0394 y a todo lo que
venga. Se queda en 238.

## Riesgo al aplicar

Bajo. La app nunca escribe `state` en directo: los cinco sitios que lo cambian
(`state/route.ts`, `take/route.ts`, `messages/route.ts` y dos en `actions.ts`)
llaman a `bug_advance_state`. Los dos que sí hacen UPDATE directo tocan sólo las
cinco columnas que la capa 1 conserva. Se midió que la edición legítima de
severidad y ETA sigue andando (contrato 14c) y que la RPC sigue moviendo y
sellando (contratos 16 y 17).

Lo que sí cambia: cualquier reparación manual de `state` hecha a mano contra
prod —por consola o por el conector— **pasa a fallar** hasta que declare la
escotilla. Es el efecto buscado.
