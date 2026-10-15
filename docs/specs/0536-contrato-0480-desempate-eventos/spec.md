---
sdd: "0536"
title: "Contrato 0480: el último evento se elige por guardado, no por hora"
status: in-progress
author: "Sam (founder) + Claude Opus 5.5 (Worker)"
created: 2026-10-15
updated: 2026-10-15
supersedes: null
superseded_by: null
related: ["0529"]
confidencialidad: interno
---

# SDD-0536 — Contrato 0480: el último evento se elige por guardado

> El contrato de la 0480 busca «el último evento de edición» de un operario
> ordenando por la hora del evento. En PGlite esa hora sólo tiene milisegundos,
> y dos guardados seguidos del mismo operario pueden empatar: entonces la prueba
> mira el evento viejo y cae sin que la 0480 tenga nada malo. Cambia sólo el
> contrato de prueba; la migración 0480, ya aplicada, no se toca.

## Contexto

El CI «Calidad continua» de la PR #239 (run 38771102511, SHA `fb949002`) falló
el 2026-10-15 en el intento 1 (job 116547450948), copiado de su log:

```
FAIL lib/studio/__tests__/operarios-editar-por-region.migration.test.ts > SDD-0529 · 0480 (PGlite) > mutante sin bloquear la fila: muere donde debe
Expected: "TEST 0480: pero sí bloqueó la fila mientras comparaba"
Received: "TEST 0480: le da el modo del rol nuevo"
```

El mutante murió en el bloque 8 del contrato, antes del bloque 9 donde debía
morir. En local la misma prueba pasaba 43/43; las corridas de main anteriores
también.

### Diagnóstico, verificado en `origin/main` `5d98ef62`

- `supabase/tests/0480_operarios_editar_por_region.test.sql:372` (antes de este
  cambio, `:367`): `pg_temp.last_event` ordenaba con
  `order by e.occurred_at desc limit 1`.
- **La hora no es la de la transacción.** La hipótesis de partida era el
  `default now()` de `occurred_at`. No aplica: `append_audit_event` escribe
  `pg_catalog.clock_timestamp()` explícito
  (`supabase/migrations/0267_audit_contract_append_only.sql:619`; 0294 sólo la
  renombra a `append_audit_event_v1` y la envuelve, `0294_audit_d2_human_reasons.sql:43`
  y `:79`). Cada evento lleva la hora del reloj al insertarse.
- **El reloj de PGlite no tiene microsegundos.** Medido con
  `@electric-sql/pglite` 0.5.8: 20.000 lecturas de `clock_timestamp()` dieron 9
  valores distintos y ninguna con microsegundos distintos de cero.
- **Los guardados seguidos quedan a 1–3 ms.** Tres corridas locales del contrato
  verde, separación entre eventos consecutivos del mismo operario:
  `cn-viejo` 2→3 de 1 a 3 ms (la que cayó), `cn-bruno` 2→3 de 1 a 2 ms,
  `ve-multi` 1→2 de 1 a 2 ms; `ve-luis` más de 50 ms (sus logins pasan por
  bcrypt). En el CI la prueba que cayó tardó 1052 ms; aquí cada corrida del
  contrato tarda entre 2,8 y 3,8 s. Con un runner unas tres veces más rápido,
  1–3 ms se vuelven el mismo milisegundo.
- **Con empate gana el viejo.** Con los dos últimos guardados de `cn-viejo` a la
  misma hora (disposición armada con un trigger, ver criterios), `last_event`
  devolvió `{"cambios": ["display_name"]}`, el evento viejo, y el contrato cayó
  en «TEST 0480: le da el modo del rol nuevo», el mensaje del CI. Inferencia, no
  medida: con `limit 1`, el ordenamiento de Postgres conserva la primera fila
  leída entre las empatadas, y la lectura secuencial lee primero la más vieja.
- `cn-bruno` (bloque 6, aserción «queda vacío y el evento dice que cambió»,
  `:632`) está expuesto igual; no se ha visto caer.

## Decisión

`last_event` ordena por `e.xmin::text::bigint desc`. Cada guardado del contrato
corre en su propia subtransacción (el bloque con excepción de `pg_temp.run_as`,
`:332`), y el xid de cada subtransacción sale del contador global en el orden
en que se asigna: el evento del último guardado tiene el xmin mayor. Un bloque
nuevo, el 12, comprueba la premisa: ningún par de eventos de edición comparte
xmin.

Descartadas:

- **Guardados en transacciones distintas.** El contrato entero es una
  transacción (`begin;` en `:32`, `rollback;` en `:762`) y un `do` no puede
  confirmar dentro de ella. Además no alcanzaría: el empate es del reloj, no de
  la transacción.
- **Una columna creciente de `entity_audit_log`.** No hay: `id` es
  `gen_random_uuid()` y `correlation_id` es `'operario_updated:' ||
  gen_random_uuid()` (`0480_operarios_editar_por_region.sql:363`).
- **`ctid`.** Es el orden físico de la tabla, el mismo del que dependía el
  empate.
- **Esperar a que el reloj avance entre guardados.** Evita el empate pero sigue
  dependiendo del reloj.

Límite conocido: xmin es de 32 bits; compararlo como número falla sólo tras dar
la vuelta al contador, imposible en la base efímera de un contrato.

## Alcance

Sólo el contrato de prueba y su envoltorio PGlite. La migración 0480 no cambia:
está aplicada en producción y el ledger guarda su texto exacto.

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `supabase/tests/0480_operarios_editar_por_region.test.sql` | `last_event` ordena por xmin; bloque 12 con la premisa |
| `lib/studio/__tests__/operarios-editar-por-region.migration.test.ts` | cabecera; describe SDD-0536 con la disposición infeliz en verde y dos controles rojos |
| `docs/specs/0536-contrato-0480-desempate-eventos/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0536-contrato-0480-desempate-eventos.md` | handoff |

## Criterios de aceptación

1. El contrato pasa en PGlite con 0480 aplicada dos veces, como antes, y el
   envoltorio entero sigue verde (preflights, mutantes, propiedad y cajón).
2. Disposición infeliz: con un trigger que, desde el bloque 8, fija la misma
   hora a todo evento nuevo, los dos últimos guardados de `cn-viejo` empatan con
   el viejo primero en la tabla, y el contrato sigue verde.
3. Control rojo del desempate: esa misma disposición con el orden por hora de
   antes cae en «TEST 0480: le da el modo del rol nuevo», el mensaje del CI.
4. Control rojo de la premisa: dos ediciones en la misma subtransacción, sin
   `run_as` en medio, hacen caer el bloque 12.
5. `supabase/migrations/0480_operarios_editar_por_region.sql` no cambia.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | no aplica | sólo cambia un contrato de prueba y su envoltorio |
| AUD-01 | no aplica | ningún evento ni RPC cambia; la 0480 queda intacta |

## FUERA DE ALCANCE DETECTADO

Búsqueda de `order by … occurred_at desc limit 1` en `supabase/tests/*.test.sql`:

- `0475_pin_operarios_endurecer.test.sql:568` y `:575`:
  `order by occurred_at desc, id desc limit 1`, sin filtrar por tipo de evento,
  tras dos restablecimientos seguidos de `cn-2` en el mismo `do`. El desempate
  `id desc` es un uuid aleatorio: si empatan, acierta la mitad de las veces.
  Riesgo bajo medido: con una sonda en cada lectura, el evento que lee `:568`
  quedó a 61–110 ms del anterior y el de `:575` a 18–28 ms (tres corridas
  locales). Los pares de `cn-2` a 2–3 ms son posteriores y ese orden no los lee.
  Lo corre en CI `lib/studio/__tests__/pin-operarios-endurecer.migration.test.ts`.
- `0455_borrado_cliente_auditado.test.sql:244` y `:250`,
  `0460_retencion_vinculo_portal_revocado.test.sql:251`: el mismo orden, pero
  cada lectura encuentra un solo evento por entidad y tipo (el contrato lo
  afirma: `client_events(...) = 1`, `erased_events(c) = 1`). Sin riesgo.

## Validación

Ver el handoff `.agents/handoffs/0536-contrato-0480-desempate-eventos.md`.
