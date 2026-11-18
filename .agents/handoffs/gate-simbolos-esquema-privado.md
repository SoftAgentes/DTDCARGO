# Handoff · gate de símbolos: esquemas que PostgREST no expone

- Rama: `claude/gate-simbolos-esquema-privado`, desde `origin/main` 65a3ad8db.
- PR: [#688](https://github.com/SoftAgentes/DTDCARGO/pull/688). Solo harness. La pidió el Director General para destrabar la #318 (SDD-0578) y se fusiona antes que ella.
- Fecha: 2026-11-18. Worker: Claude (sesión de la #318).

## Qué hace

`scripts/check-pending-migration-symbols.mjs` mide un símbolo nacido en un esquema que PostgREST no expone solo donde el código lo nombra calificado (`esquema.nombre`). Una columna agregada a una relación de ese esquema cuenta donde se nombra la relación calificada, y la asociación por relación de ADR-0003 no se le aplica.

Los esquemas expuestos los lee `readExposedSchemas` de `PGRST_DB_SCHEMAS` en `infra/dtd-cargo/compose.supabase.yml` (el default) y en `infra/dtd-cargo/.env.example`. Toma la unión de las dos fuentes y siempre agrega `public`. Falla cerrado, contando todos los esquemas como expuestos, en dos casos: si ninguna fuente fija la lista, o si alguna nombra la variable en una línea que el lector no entiende.

Enmienda en ADR-0003, con medición, decisión, límites (incluido el wrapper de `public` que llama a una función privada pendiente) y rollback.

## Evidencia

| Comprobación | Estado |
|---|---|
| `check-pending-migration-symbols.test.mjs` | PASÓ 31/31, con 11 casos nuevos |
| Mutante: `isExposedSchema` siempre `true` | MUERE |
| Mutante: sin `&& isExposedSchema(...)` en la asociación | MUERE (caso `privado."Members"` + `client_users`) |
| Mutante: sin `found.add("public")` | MUERE |
| Mutante: ignorar líneas ilegibles | MUERE |
| Gate sobre main | 0 ROJO · 0 AMARILLO, sin cambio |
| Gate sobre el árbol de la #318 | 0 ROJO · 1 AMARILLO (antes 702 ROJO) |
| `pnpm verify` | NO EJECUTADO: cambio solo de harness; aplican las pruebas del script y el CI |

Las pruebas corrieron con los `node_modules` de la #318 sobre una copia temporal del script, porque este worktree no tiene instalación. CI de GitHub: «Calidad continua» sobre la cabeza de la PR.

## Pendiente de esta tarea

- CI verde en la cabeza exacta y fusión por el DG.
- Después, traer main a la #318.

## FUERA DE ALCANCE DETECTADO

- `createColumnAssociation` compara los tokens del módulo en minúsculas con el nombre de la relación tal como se normalizó. Un identificador entre comillas con mayúsculas en `public` tampoco se asocia. No lo toqué.
