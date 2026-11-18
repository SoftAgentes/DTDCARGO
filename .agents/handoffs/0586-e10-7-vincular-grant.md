# Handoff · SDD-0586 paso 10.7 — `vincular.sh`: service_role no leía las temporales

- **Owner:** Claude Worker «10.5», en la sesión que inició el Subdirector de Chatwoot (`local_535053f4-40c2-4124-a280-63f4fc882820`).
- **Claim:** `worker-10.5-vincular`.
- **Ruta y rama:** `DTD-worktrees/0586-e10-7-vincular-grant`, rama `codex/0586-e10-7-vincular-grant`, desde `main` en `88a87b181`.
- **SDD:** [0586](../../docs/specs/0586-chatwoot-enrutamiento-segmento-e10/spec.md), §10.5.10.

## El defecto

Lo encontró la punta a punta de E5 en la #461, y el Subdirector lo verificó en el log del CI (run 42509666073, líneas 1293 y 1296):

```
psql:<stdin>:21: ERROR:  permission denied for table preparado
```

- **La causa:** `infra/ops/portal-historial/vincular.sh` crea las temporales `vinculos` y `preparado` como `postgres` (`-U postgres`). Después hace `set role service_role`, que es el único rol que ejecuta la 0523, y las lee ya con ese rol. `service_role` no tiene privilegio sobre las temporales de otro rol, así que `chatwoot_portal_vincular_carga` nunca se llamaba.
- **Entró con:** `a8cbfc780` (la #456), en el tren #460.
- **Daño:** ninguno, porque la puerta 3 no se abrió.
- **Por qué no lo vio la prueba de los scripts:** su `docker` es falso y no corre psql. El contrato de la 0523 tenía el mismo problema y lo resolvía leyendo la cabecera antes del `set role`, pero eso no pasó al guion.

## El arreglo

`grant select on pg_temp.vinculos, pg_temp.preparado to service_role;`, justo antes del `set role`.
- **Por qué el `grant` y no `\gset`:** es una sola línea, y no depende del tamaño de `vinculos`.
  - Con `\gset`, el arreglo `jsonb` entero pasaría por una variable de psql y volvería como literal en el `select`. Hoy son 24 hilos y 73 mensajes, pero el tamaño crece con el historial.
  - Además, el texto entero de los vínculos quedaría en la línea de la consulta, y saldría en el log de Postgres si algo falla.
- **El privilegio dura lo que la sesión:** las temporales mueren con ella.

## Validación

| Comprobación | Estado |
|---|---|
| `bash -n infra/ops/portal-historial/vincular.sh` | PASÓ |
| La secuencia del guion en PGlite, con un script suelto: temporales de `postgres`, `set role service_role` y lectura | Sin el `grant`: «permission denied for table preparado», el mismo error del CI. Con el `grant`: PASÓ, lee las dos |
| `shellcheck` | NO DISPONIBLE en la PC |
| La punta a punta real (la #461 de E5, con «[depende de #N]») | Pendiente: tiene que mostrar A1 con 22023, C4 con 2, 3 y 7, y un solo corte |
| `infra/ops/tests/prueba-portal-historial.sh` | En Calidad. Sigue pasando: el `docker` falso no mira esta línea |

## FUERA DE ALCANCE DETECTADO

- **La prueba de los scripts no corre psql de verdad:** el `docker` falso no pudo ver este defecto. Lo cubre la punta a punta de E5. Una prueba con un Postgres real queda como idea para Calidad.
