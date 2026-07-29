# Runbook — E2E con Supabase efímero

## Propósito

Ejecutar fixtures persistidas sin tocar Producción ni introducir un camino de
purga por filas.

## Frontera dura

- project ref de Producción: prohibido;
- Preview persistente: prohibido;
- secretos: solo secret manager o variables de proceso;
- cleanup SQL/DML: prohibido;
- teardown: proyecto completo.

## Secuencia

1. crear un proyecto/branch Supabase desechable desde el control plane;
2. esperar estado saludable y `MIGRATIONS_PASSED`;
3. comprobar que el ledger llegó a la última migración esperada;
4. cargar en el proceso:
   - `E2E_SUPABASE_PROJECT_REF`;
   - `E2E_SUPABASE_URL`;
   - `E2E_SUPABASE_SERVICE_ROLE_KEY`;
   - `STUDIO_E2E_PASSWORD`;
   - `E2E_ENVIRONMENT_KIND=ephemeral`;
   - `E2E_EPHEMERAL_PROJECT_REF` igual al project ref;
5. ejecutar `pnpm.cmd seed:e2e`;
6. ejecutar el recorrido E2E autorizado;
7. ejecutar `pnpm.cmd verify:e2e-teardown`;
8. destruir el proyecto desde el control plane;
9. esperar estado terminal/no disponible;
10. registrar project ref, timestamps, resultado E2E y estado del teardown, sin
    registrar secretos.

No se cargan secretos ni se ejecuta el seed mientras el control plane reporte
`CREATING_PROJECT`, `MIGRATIONS_FAILED`, drift de ledger o cualquier estado no
saludable. Un branch creado desde el proyecto principal reproduce el historial
de migraciones automáticamente; no se corrige ese replay aplicando SQL ad hoc.

## Fallo

Ante cualquier error después de crear Auth, tenant o datos:

- no reintentar el seed sobre el mismo proyecto;
- no borrar filas para “limpiarlo”;
- destruir el proyecto completo;
- crear otro entorno para el siguiente intento.

Ante un error de replay **antes** del seed se aplica el mismo teardown. Se
registra la primera migración ausente o fallida, se enlaza la deuda que la
resolverá y no se rebasea, resetea ni repara el branch fallido.

## Evidencia mínima

```text
project_ref=<efímero>
production=false
seed=success
e2e=success|failed
verification=success
database_cleanup_performed=false
teardown=terminal
```

La ausencia de una fila tenant no prueba teardown. El control plane debe
confirmar que el proyecto completo dejó de estar disponible. Para branches, la
evidencia terminal mínima es:

1. `delete_branch` devuelve éxito para el `branch_id` exacto;
2. `list_branches` posterior ya no devuelve ese `branch_id` ni su
   `project_ref`;
3. el inventario conserva intacta la rama `main`.

Un teardown terminal no convierte en exitosa una validación cuyo replay, seed
o E2E falló.
