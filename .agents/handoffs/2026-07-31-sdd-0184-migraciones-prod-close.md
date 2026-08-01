# Cierre · SDD-0184 · las tres migraciones en producción

- **Fecha:** 2026-07-31
- **Rol:** worker autónomo
- **Rama:** `claude/container-loading-design-plan-db597c`

## Qué se aplicó

Las tres de SDD-0184, **de a una**, cada una con OK del founder nombrando el
archivo, siguiendo `docs/runbooks/aplicar-migraciones-prod.md`. Vía el conector
`claude.ai Supabase` (`project_id: xpfuzqombmjmxvprjgmi`), que no es read-only.

| Migración | Qué hizo | Verificado contra el objeto |
|---|---|---|
| `0297_container_types_activos_y_capacidad_util` | Capacidad **útil**, `active`, techo real, áreas sin altura | 20GP 30/activo/6 áreas · 40GP 60/apagado/9 · 40HC 68/activo/9/techo 66,4 |
| `0298_consolidation_plans` | Tabla del plan, versionada | RLS prendida · 2 policies · único de versión vigente · trigger de tenant · anon sin acceso · `authenticated` no invoca el trigger |
| `0299_estiba_plan_vs_real` | `plan_id` + `siguio_plan` | 2 columnas nullable · índice del diff · FK en `SET NULL` · **0 filas tocadas** |

`migrations-baseline.json` ya no tiene ninguna entrada de SDD-0184. Solo quedan
las dos esperas ajenas: `0017_no_olvidar` y `0257_rates_expiry_alert`.

## Lo que hay que saber, y que no está en el código

**Los tres tipos venían con el volumen GEOMÉTRICO, no solo el 40'HC.** El seed de
0096 sembró 33 / 67 / 76, que son las medidas de pared a pared. El 68 del founder
implica un factor práctico de 0,8923; aplicado a los otros dos da 30 y 60. El 20'
es uno de los dos activos y decía 33.

**Efecto visible sin desplegar nada:** el módulo Inventario lee la capacidad DE LA
BASE (`containerCapacityCbm`), así que su porcentaje de ocupación cambió solo al
aplicar la 0297. Un contenedor con 60 CBM pasó de leer 79% a 88%. **No es un bug:**
antes dividía entre 76 y decía que había más espacio del que hay. Naviera ya leía
68 desde el código, así que la contradicción entre las dos pantallas quedó cerrada.

**Hay DOS migraciones numeradas 0297 en el repo**, las dos ya en producción:
`0297_container_types_activos_y_capacidad_util` (esta ventana) y
`0297_legal_docs_body_hash` (otra ventana, aplicada un minuto antes). El repo ya
arrastra duplicados (0243, 0247, 0261/0261b, 0277) y el ledger las distingue por
`name`, así que el gate concilia bien. **NO renumerar ninguna de las dos:** el
ledger ya las tiene con esos basenames y renumerar las volvería invisibles.

**Trampa del ledger, verificada:** el conector graba `version` con un timestamp y
`name` con el basename que se le pasa. La RPC `applied_migration_names()` devuelve
la columna que el gate necesita; consultar `version` a mano hace parecer que la
migración se aplicó sin dejar rastro. No es así.

**Tres colisiones de numeración en una sola sesión** (0289-0291, luego 0294-0296,
luego el 0297 duplicado). La regla que sale: el barrido de números libres va sobre
`git for-each-ref refs/heads refs/remotes`, **nunca** sobre `git ls-tree origin/main`.

## Estado del gate

`node scripts/verify.mjs` → **rojo en `migrations-applied`, y ya no por nada de
esta ventana.** Faltan `0294_audit_d2_human_reasons`,
`0295_audit_d3_human_reasons` y `0296_audit_d4_empty_search_path`, de la ventana de
gobernanza: están en `main` sin aplicar y sin declarar en el baseline. Eso deja el
gate rojo para **toda** ventana del repo, que es cómo se enmascaran regresiones.

## Qué se puede tocar ya

- `/studio/naviera` → contenedor con carga → **"Calcular plan"** → planta 2D y
  orden de descarga.
- `/m/cn/estibar` → al escanear, el operario ve la sugerencia del plan con el
  botón del lado marcado.
- `/llenado` en el sitio público.

## Pendiente

- **La spec sigue `in-progress`, y es correcto.** Falta probarla con **carga
  real**. Ese es el único paso para cerrarla a `done`, y va en el mismo commit que
  la evidencia (regla anti-drift del repo).
- **Avisarle a la ventana de gobernanza** que SDD-0184 absorbió el Slice C1 y el
  E1 de REV-SGE-009.
- Fuera de alcance por decisión: vista de descarga en `/m/ve` y reporte imprimible
  paso a paso.

## Siguiente responsable

Quien haga la prueba con carga real. Antes de cerrar la spec, releer §9 de
`docs/specs/0184-plan-carga-volumen/spec.md`.
