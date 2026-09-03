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

## Puerta de entrada: no confundir el paquete actual con el bootstrap completo

Antes de crear recursos, acordar el alcance y el SHA de código. El paquete
existente tiene seis casos lógicos en tres proyectos Playwright (18 ejecuciones):
comentarios, confirmaciones de Gastos/Nómina y buscador Studio. No incluye login
positivo de Portal/Back/PIN, el journey comercial ni una matriz de dos tenants.
Inventario y selector: [`e2e/README.md`](../../e2e/README.md).

| Gate | Evidencia exigida antes del siguiente paso |
|---|---|
| Autorización | GO para crear, sembrar datos ficticios, probar y destruir el entorno concreto, con costo aceptado; no autoriza main ni producción |
| Identidad | Branch propio, no predeterminado ni persistente; project ref distinto del productivo; registrar branch ID y parent ref |
| Versión | SHA de app y manifiesto de migraciones esperado; contrastar el ledger completo, no sólo su mayor número |
| Preparación | Salud y replay correctos, credenciales del mismo branch y entorno coherente conforme a SDD-0369 |
| Ejecución | Seed una vez; 18 casos seleccionados y ejecutados sin skips; un fallo no se convierte en pase por repetir sólo el subconjunto verde |
| Cierre | Verificación del fixture separada del teardown; destrucción confirmada por control plane y main preservada |

Usar app local con el backend efímero autorizado o un Preview accesible para
los cuatro specs. `VERCEL_AUTOMATION_BYPASS_SECRET` sólo está conectado al spec
de comentarios: no habilita los otros cinco casos en un Preview protegido.
No relajar la protección de Vercel para suplir esa cobertura del arnés.

El guard de variables no demuestra ownership o salud del branch. El preflight
de columnas del seed tampoco verifica el ledger ni todas las RPC que consume
la app. Un branch saludable no incorpora por deducción los commits locales del
worker. Si faltan migraciones, detenerse y resolver su entrega/aplicación con
autorización nominal; no usar SQL ad hoc, repair ni un fallback a producción.

Los branches son entornos separados con credenciales propias; el mecanismo de
creación y la integración Git determinan la fuente de las migraciones. Ver la
[documentación oficial de Branching](https://supabase.com/docs/guides/deployment/branching).
La política de este repo conserva el teardown completo y no habilita merges
de branches alojados, resets ni cambios de configuración por esa referencia.

### Disponibilidad medida · 2026-09-03, antes de 01:17 UTC

- El conector con project ID explícito confirmó `DTD Cargo`, ref
  `xpfuzqombmjmxvprjgmi`, `ACTIVE_HEALTHY`. `list_branches` devolvió sólo `main`
  (`5b95d217-1e2a-45b1-b60d-fb091361b70b`, `is_default=true`): cero branches
  desechables disponibles. Su `persistent=false` **no** la hace elegible.
- Las siete variables requeridas por `loadE2EEnvironment` estaban ausentes del
  proceso inspeccionado. No se buscaron ni leyeron valores en archivos secretos
  o secret managers; su estado fuera de ese proceso no se afirma.
- El MCP local devolvió una URL placeholder y `fetch failed` al inventariar.
  No se usó ese fallo para inferir ausencia: la evidencia proviene del conector
  explícito anterior. No se creó, sembró, modificó ni destruyó ningún recurso.
- No hubo corrida autenticada. Esta comprobación sólo resuelve disponibilidad
  y delimita el siguiente gate; no completa el bootstrap ni eleva su porcentaje.

## Secuencia

1. crear un proyecto/branch Supabase desechable desde el control plane;
2. esperar estado saludable y `MIGRATIONS_PASSED`;
3. contrastar el ledger con el manifiesto de migraciones del SHA autorizado;
4. cargar en el proceso:
   - `E2E_SUPABASE_PROJECT_REF`;
   - `E2E_SUPABASE_URL`;
   - `E2E_SUPABASE_ANON_KEY`;
   - `E2E_SUPABASE_SERVICE_ROLE_KEY`;
   - `SUPABASE_SERVICE_ROLE_KEY` con el mismo valor, sólo en el proceso que
     levanta Next, para adapters server-side;
   - `STUDIO_E2E_PASSWORD`;
   - `E2E_ENVIRONMENT_KIND=ephemeral`;
   - `E2E_EPHEMERAL_PROJECT_REF` igual al project ref;
5. ejecutar `pnpm.cmd seed:e2e`;
6. ejecutar el recorrido E2E autorizado. Con el guard efímero completo,
   `playwright.config.ts` deriva del fixture determinista
   `STUDIO_E2E_EMAIL`, `STUDIO_E2E_EXPENSE_CODE` y
   `STUDIO_E2E_PAYROLL_SETTLEMENT_CODE`; un valor manual distinto aborta antes
   de ejecutar pruebas. La evidencia append-only se lee con
   un cliente `authenticated`, nunca ampliando `SELECT` de `service_role`;
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
