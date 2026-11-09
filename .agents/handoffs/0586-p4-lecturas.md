# Handoff · SDD-0586 §10.5.10 · las dos lecturas de la puerta 4

- **Rama:** `codex/0586-p4-lecturas`, desde `origin/main` `8c8e23aef` (tren 7, #472). Worker 10.5, claim `worker-10.5-lecturas`.
- **Encargo:** el Subdirector Chatwoot, después del tren 7. Pidió `conteo-portal.sql` y `cola-y-flag.sql` con su prueba, la lista de sha256 de 3.0, la línea 20 del runbook y la nota de la medición del DG en el README del desarme.

## Qué trae

| Archivo | Qué |
|---|---|
| `infra/ops/portal-historial/conteo-portal.sql` | El bloque literal de la spec 0586 §10.5.10 que corrió el DG el 2026-11-07, md5 `a5da12512b23b4662678e6eb5926c632`. No se edita. Usa `:'tenant'`; el runbook (4.2) pasa `-v ON_ERROR_STOP=1 -v tenant=<uuid>`. |
| `infra/ops/portal-historial/cola-y-flag.sql` | El paso 4.3. Es una transacción `read only` que termina en `rollback` e imprime una línea: `HECHO salida=N flag_encendido=N encendidos_auditados=N corte=fijado\|nulo cola_y_flag=ok\|NO`. No saca ids, nombres ni la hora del corte. |
| `lib/studio/__tests__/portal-historial-lecturas.test.ts` | PGlite sobre el esquema real, con el preámbulo del contrato de la 0524 y una `entity_audit_log` mínima. Ver la tabla de abajo. |
| `docs/runbooks/chatwoot-portal-p4-puertas.md` | La línea 20 (`cargar.sh` y `cargar-portal.rb` ya están en `main` desde la #455 y la #461). La lista de sha256 de 3.0 suma los dos guiones. La fila 4.3 apunta al archivo y la condición es `cola_y_flag=ok`. El bloque SQL en línea del 4.3 se reemplazó por un puntero. |
| `supabase/cargas/portal-historial-deshacer/README.md` | La medición del DG del 2026-11-08: `postgres` tiene `rolsuper = f`, pero lee `pg_control_system()` y `pg_db_role_setting`, así que la guarda de entorno funciona sin cambios. |

Qué cubre la prueba:

| Guion | Casos | Mutantes |
|---|---|---|
| Conteo | La huella md5. Los valores del fixture T1, sin texto ni nombres. | Sin el filtro del tenant. |
| Cola y flag | `ok` en T2. Un `NO` con cada una de las cuatro condiciones. `NO` en T1, porque la cola mandó c1. Un control rojo: sin el guion no sale HECHO. Una comprobación estática: solo lectura, y no imprime la hora. | Una por cada condición del veredicto (4). La salida sin el filtro del tenant. |

## Evidencia

| Comprobación | Estado |
|---|---|
| md5 del conteo contra la spec en `8c8e23aef` | PASÓ |
| `docs:check` | PASÓ (600 specs) |
| Las filas de las tablas del runbook tienen el mismo número de celdas que su encabezado | PASÓ. La línea de salida del 4.3 va en un bloque `text` fuera de la tabla. El único `\|` que queda es el texto de la línea 166, que explica la regla. |
| vitest de `portal-historial-lecturas.test.ts` (`--maxWorkers=1`, reporter por defecto) | PASÓ: 16/16, exit 0, 17,4 s. Incluye el control rojo y los 6 mutantes, que caen. |
| `tsc --noEmit -p .` | PASÓ, exit 0 |
| ESLint del archivo de prueba | PASÓ, exit 0 |

## Pendientes de esta tarea

- **PENDIENTE: la prevención del log en el runbook.** Sigue «por confirmar hasta la #470». La #470 entra en el tren 9.
  - Si esta PR sale después del tren 9, se pasa a **confirmada** en esta misma PR. Hay que citar la #470 y su run verde 42533753896, con L1 a L3 y M35 a M38 en PASÓ.
  - Si sale antes, queda para la PR siguiente.
- Publicar con el OK del Subdirector o del DG, después de mandarle el SHA y el `--stat`.

## Impacto documental

- Cambian el runbook de las puertas y el README del desarme. La spec 0586 no cambia: el conteo es copia literal suya.
- Graphify y Obsidian: nada propio. Siguen a `main` integrado.

## FUERA DE ALCANCE DETECTADO

- Ninguno nuevo.
