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
2. esperar estado saludable;
3. aplicar migraciones del repositorio en orden;
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

## Fallo

Ante cualquier error después de crear Auth, tenant o datos:

- no reintentar el seed sobre el mismo proyecto;
- no borrar filas para “limpiarlo”;
- destruir el proyecto completo;
- crear otro entorno para el siguiente intento.

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
confirmar que el proyecto completo dejó de estar disponible.
