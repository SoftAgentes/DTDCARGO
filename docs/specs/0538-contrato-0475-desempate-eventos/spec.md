---
sdd: "0538"
title: "Contrato 0475: el bloque 5 lee el último restablecimiento por guardado, no por hora"
status: in-progress
author: "Sam (founder) + Claude Opus 5.5 (Worker)"
created: 2026-10-15
updated: 2026-10-15
supersedes: null
superseded_by: null
related: ["0515", "0536"]
confidencialidad: interno
---

# SDD-0538 — Contrato 0475: el bloque 5 lee el último restablecimiento por guardado

> El bloque 5 del contrato de la 0475 busca el evento del último
> restablecimiento de `cn-2` ordenando por hora y, si la hora empata, por el id
> del evento, que es un uuid aleatorio. En PGlite la hora sólo tiene
> milisegundos: si dos restablecimientos caen en el mismo, la prueba acierta al
> azar. Es el mismo defecto que la SDD-0536 corrigió en el contrato 0480, que la
> dejó anotado como fuera de alcance. Cambia sólo el contrato de prueba; la
> migración 0475, ya aplicada, no se toca.

## Contexto

La SDD-0536 (PR hailuwaycom-sketch/DTDCARGO#242) arregló un rojo intermitente
del CI en el contrato 0480: dos guardados seguidos del mismo operario empataban
en `occurred_at` y `order by occurred_at desc limit 1` devolvía el evento viejo.
En su sección «FUERA DE ALCANCE DETECTADO» dejó anotado este caso.

### Diagnóstico, verificado en `origin/main` `5d98ef62`

- `supabase/tests/0475_pin_operarios_endurecer.test.sql:568` y `:575` (antes de
  este cambio; `:573` y `:580` después; las demás líneas citadas son de esta
  rama): las dos lecturas del bloque 5 eran
  `select * into v_event from public.entity_audit_log where entity_id = pg_temp.fixture_id('cn-2') order by occurred_at desc, id desc limit 1;`.
- **La hora es la del reloj, sin microsegundos en PGlite.** `append_audit_event`
  escribe `pg_catalog.clock_timestamp()`
  (`supabase/migrations/0267_audit_contract_append_only.sql:619`; 0294 sólo la
  envuelve). La SDD-0536 midió con `@electric-sql/pglite` 0.5.8 que ese reloj no
  tiene microsegundos.
- **El desempate es aleatorio.** `id` es `gen_random_uuid()` (la tabla del
  contrato, `:205`; el `insert` del writer no lo fija, `0267:593`). Con la hora
  empatada, `id desc` elige al azar.
- **Qué eventos ve el bloque 5.** `cn-2` llega con uno, el del bloque 4 (`:501`).
  Los rechazos del bloque 5 no dejan evento (el contrato lo afirma en `:561`).
  La primera lectura elige entre ese y el de `«Otro»` (`:564`); la segunda,
  entre esos dos y el de `revision_seguridad` (`:576`).
- **Medido con la hora empatada y el orden viejo.** Con un trigger que, desde el
  bloque 4, fija la misma hora a todo evento nuevo y deja el uuid aleatorio, 18
  corridas del contrato: 6 verdes, 8 caídas en la primera lectura («con «Otro» la
  auditoría guarda el código y el texto») y 4 en la segunda («con un código fijo
  la auditoría guarda sólo el código, no el texto»). Con el orden por xmin, 18
  verdes de 18. Inferencia, no medida: con uuids independientes la primera
  lectura cae la mitad de las veces y el contrato pasa una de cada seis.
- **El riesgo real es bajo.** La SDD-0536 midió, con una sonda en cada lectura,
  que el evento que lee `:568` quedó a 61–110 ms del anterior y el de `:575` a
  18–28 ms. No se ha visto caer en CI.

## Decisión

Las dos lecturas ordenan por `xmin::text::bigint desc`, como `pg_temp.last_event`
en el contrato 0480. Cada restablecimiento del contrato corre en su propia
subtransacción: `pg_temp.run_as` ejecuta la sentencia dentro de un bloque con
excepción (`:284–288`). Ni `admin_reset_operario_pin`, ni
`admin_ver_operario_pin`, ni `append_audit_event` abren subtransacciones
propias: no hay `exception when` en `0475_pin_operarios_endurecer.sql`, `0267` ni
`0294`. El xid de cada subtransacción sale del contador global en el orden en que
se asigna, así que el evento del último restablecimiento tiene el xmin mayor.

Un bloque nuevo, el 14, comprueba la premisa: ningún par de eventos de `cn-2`
comparte xmin. Cubre todos los eventos de `cn-2` del contrato, no sólo los del
bloque 5: todos nacen dentro de `run_as` o `read_as`.

Descartadas:

- **Buscar por el payload, como el bloque 9 (`:738`).** Las aserciones del bloque
  5 comprueban justamente el payload: elegir el evento por él volvería
  tautológica esa mitad de la aserción.
- **Restablecimientos en transacciones distintas.** El contrato entero es una
  transacción (`begin;` en `:36`, `rollback;` al final) y un `do` no puede
  confirmar dentro de ella. Además el empate es del reloj, no de la transacción.
- **Una columna creciente de `entity_audit_log`.** No hay: `id` es
  `gen_random_uuid()` y `correlation_id` lleva otro uuid aleatorio.
- **`ctid`.** Es el orden físico de la tabla, no el del guardado.
- **Esperar a que el reloj avance entre restablecimientos.** Evita el empate pero
  sigue dependiendo del reloj.

Límite conocido: xmin es de 32 bits; compararlo como número falla sólo tras dar
la vuelta al contador, imposible en la base efímera de un contrato.

## Alcance

Sólo el contrato de prueba y su envoltorio PGlite. La migración 0475 no cambia:
está aplicada en el servidor propio desde el 2026-10-14 y el ledger guarda su
texto exacto (el envoltorio ya fija su md5 `1273d8a4…` y sus 61685 bytes).

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `supabase/tests/0475_pin_operarios_endurecer.test.sql` | las dos lecturas del bloque 5 ordenan por xmin; bloque 14 con la premisa |
| `lib/studio/__tests__/pin-operarios-endurecer.migration.test.ts` | cabecera; describe SDD-0538 con la disposición infeliz en verde y tres controles rojos |
| `docs/specs/0538-contrato-0475-desempate-eventos/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0538-contrato-0475-desempate-eventos.md` | handoff |

## Criterios de aceptación

1. El contrato pasa en PGlite con 0475 aplicada dos veces, como antes, y el
   envoltorio entero sigue verde (texto, preflights, mutantes, propiedad y
   motivo).
2. Disposición infeliz: con un trigger que, desde el bloque 4, fija la misma hora
   a todo evento nuevo y le da un uuid que baja, los tres restablecimientos de
   `cn-2` empatan en la hora, el viejo gana cualquier desempate por id, y el
   contrato sigue verde.
3. Control rojo por lectura: en esa disposición, la primera lectura con el orden
   por hora e id cae en «con «Otro» la auditoría guarda el código y el texto», y
   la segunda en «con un código fijo la auditoría guarda sólo el código, no el
   texto».
4. Control rojo de la premisa: dos restablecimientos de `cn-2` en la misma
   subtransacción, sin `run_as` en medio, hacen caer el bloque 14.
5. `supabase/migrations/0475_pin_operarios_endurecer.sql` no cambia.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | no aplica | sólo cambia un contrato de prueba y su envoltorio |
| AUD-01 | no aplica | ningún evento ni RPC cambia; la 0475 queda intacta |

## FUERA DE ALCANCE DETECTADO

Búsqueda de `occurred_at desc` en `supabase/tests/*.test.sql` sobre esta rama:
fuera de los índices, quedan `0455_borrado_cliente_auditado.test.sql:244` y
`:250`, `0460_retencion_vinculo_portal_revocado.test.sql:251` y
`0480_operarios_editar_por_region.test.sql:367`. Los dos primeros encuentran un
solo evento por entidad y tipo, como ya anotó la SDD-0536; el de la 0480 lo
corrige la PR hailuwaycom-sketch/DTDCARGO#242, todavía abierta.

## Validación

Ver el handoff `.agents/handoffs/0538-contrato-0475-desempate-eventos.md`.
