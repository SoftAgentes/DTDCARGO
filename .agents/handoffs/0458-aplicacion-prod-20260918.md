# 0458 aplicada a producción — 2026-09-18

- Owner/sesión: `worker-0458-aplicacion-prod-opus5-20260918` (Claude Opus 5, Worker; sesión
  `dtdcargo-c9`).
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0458-aplicacion-prod-20260918`.
- Rama: `codex/0458-aplicacion-prod-20260918`, creada con `harness-worktree start` desde
  `origin/main` = `784109132fca8402422d6f9aa46bb29aba479172`. `guard` OK y claim adquirido antes
  de editar.
- SDD: [0476](../../docs/specs/0476-tarifa-lectura-sin-vigencia/spec.md). Migración
  `supabase/migrations/0458_tarifa_lectura_sin_vigencia.sql`.
- Runbook: `docs/runbooks/aplicar-migraciones-prod.md`.
- Autorización de Sam, texto literal del encargo:

  > Aplicar la migración 0458: mientras no se aplique, el sitio no puede leer la tarifa vencida.
  > Figura en espera; no lo comprobé contra producción. Ya no es urgente: si la tarifa vence el
  > 29-nov sin aplicarla, el respaldo igual cotiza $850.

  Nombra la migración, que es lo que exige el runbook. El encargo no incluía publicar. Después,
  a la pregunta explícita de si autorizaba publicar la rama y abrir la PR contra `main`, Sam
  respondió, textual: «autorizo». Esa autorización cubre publicar esta rama y abrir su PR, **no**
  el merge, que serializa `dtdcargo-18`.
- Coordinación: después de aplicar llegaron dos mensajes de otras sesiones. `dtdcargo-53`
  (supervisión) pidió reportarle al cerrar y confirmar con `dtdcargo-18` antes de tocar
  producción. `dtdcargo-18` (coordina integración y aplicaciones) asignó los comentarios de
  abajo a esta rama y pidió aviso antes de abrir la PR. La regla de coordinar llegó **después**
  de aplicar; se les avisó a los dos en el acto. `dtdcargo-18` respondió que no había nada que
  reprochar porque el OK nominal de Sam existía.

## OBJETIVO ORIGINAL

Aplicar `0458_tarifa_lectura_sin_vigencia` a Supabase producción para que el sitio lea de la
base la tarifa pública aunque esté vencida.

## COMPLETADO

**APLICADA Y VERIFICADA.** Estado de tarea: lista-para-revision (falta publicar el recibo).

### Preflight (sólo catálogo y ledger; ninguna fila de negocio)

- Proyecto `xpfuzqombmjmxvprjgmi`, DTD Cargo, `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.121.
- Ledger: 462 filas, última `20260917160718 · 0457_document_import_workspaces`; **ninguna** fila
  de 0458 (tampoco por nombre parecido). La afirmación heredada de que no estaba aplicada quedó
  comprobada, no supuesta.
- `public.public_cbm_rate`: una sola sobrecarga, `(p_modo text)`.
- **Cuerpo vivo = cuerpo de 0255, exacto**: `md5(prosrc)` `739db3bca2f7d8780e91a06a11e3f087`,
  507 caracteres; sin espacios `d4dc764dd15752b46f69b9b5fe9bdc08`. Los dos coinciden con el
  bloque `$$…$$` de `0255_rates_public_calc_modo.sql` calculado en local. Era la condición que
  pedía la espera del baseline («si difiere, NO aplicar y escalar»).
- Atributos: SECURITY DEFINER, STABLE, `search_path=public`, owner `postgres`, ACL
  `{postgres=X, service_role=X, anon=X, authenticated=X}`.
- Salida de la RPC como `anon` (`set local role anon`), la misma que sirve el sitio: DDP
  `850.00 / 50.00 / 2026-11-29`, consolidado `580.00 / null / null`, sin argumento = DDP.
- Advisors de seguridad: huella `c80be09588e4dd2dd588379f246765f5` (JSON sin `observed_at` a
  cualquier profundidad), 230 apariciones de `observed_at`. Las dos menciones de
  `public_cbm_rate` son los lints preexistentes `anon_/authenticated_security_definer_function_executable`:
  es su diseño desde 0255.

### Aplicación

- Texto enviado escrito primero a un archivo temporal y comparado **byte a byte** con el blob de
  main: md5 `43709f507946947b150919530b1f8fd9`, 8.498 bytes, `git hash-object` =
  `09217dbaed51c90572c03647e6525496eaa3cbe4` = `HEAD:supabase/migrations/0458_…sql`. Sólo LF.
- `apply_migration(name = "0458_tarifa_lectura_sin_vigencia")` → `{"success":true}`. Una sola
  migración, sin bundle. No toma locks sobre `public.rates`: sólo reemplaza una entrada de
  `pg_proc`.

### Postflight

| Comprobación | Resultado |
|---|---|
| Ledger | 463 filas; `20260918040814 · 0458_tarifa_lectura_sin_vigencia` |
| Identidad ledger ↔ blob | 1 sentencia; `md5(array_to_string(statements,''))` `43709f507946947b150919530b1f8fd9`, `octet_length` 8.498 — iguales al blob |
| Cuerpo vivo | md5 `cc52f3571e354c6bc77c10d0ec287fd3`, 718 caracteres, sin espacios `5f347b78f1a601d2419dad918ae6a16f` — iguales al bloque `$$…$$` de 0458 en local |
| Filtros | Sin `valid_until >= current_date`; conserva `valid_from <= current_date` y `per_cbm is not null` |
| Firma | `p_modo text`, default `'ddp'::text`, `TABLE(per_cbm numeric, min_charge numeric, valid_until date)`, una sobrecarga |
| Atributos | SECURITY DEFINER, STABLE, `search_path=public`, owner `postgres` |
| ACL | Idéntica: `{postgres=X, service_role=X, anon=X, authenticated=X}`; anon y authenticated con EXECUTE |
| Comentario | El de 0458 (`DESDE LA MIGR 0458 NO FILTRA POR VIGENCIA…`), md5 `9455ef360d28405ec0ea7cd2afacb48c` |
| RPC como `anon` | Idéntica a la de antes: DDP `850.00 / 50.00 / 2026-11-29`, consolidado `580.00` |
| Advisors de seguridad | Huella `c80be09588e4dd2dd588379f246765f5`, 230 entradas: **idénticos** antes y después |

**Simulación del vencimiento**, sin escribir nada: la lógica de los dos cuerpos con la fecha
fijada en vez de `current_date`, leyendo sólo las columnas que la RPC ya expone a `anon`
(`per_cbm, min_charge, valid_until` de la fila pública DDP):

| Día | Cuerpo 0255 | Cuerpo 0458 |
|---|---|---|
| 2026-11-29 | `850.00 / 50.00` | `850.00 / 50.00` |
| 2026-11-30 | **sin fila** → el sitio caería a `CONFIG.tarifaBaseCBM` | `850.00 / 50.00` |
| 2027-01-15 | **sin fila** | `850.00 / 50.00` |

Esa lectura de `public.rates` quedó limitada a la fila pública y a los tres valores que el sitio
ya publica; no se leyó ninguna otra fila ni columna.

**Verificación independiente** de otras sesiones: `dtdcargo-18`, sólo catálogo (ledger
`20260918040814`, sin filtro de `valid_until`, DDP `850 / 2026-11-29`, consolidado `580 / null`);
`dtdcargo-53`, `dtdcargo.com/api/public/cbm-rate` → 200
`{"per_cbm":850,"min_charge":50,"valid_until":"2026-11-29"}`.

### Repo, en esta rama

1. `supabase/migrations-baseline.json`: sale **sólo** la entrada
   `0458_tarifa_lectura_sin_vigencia` de `pendingBelowCutoff`, editando el texto, sin volver a
   serializar el JSON. Un script comprobó que `cutoff` sigue en 238, que las otras cuatro esperas
   (0415, 0414, 0422, 0423) quedan idénticas carácter por carácter y que `$doc` no cambia. La
   única otra línea del diff es la coma final de la entrada 0423.
2. `docs/specs/0476-…/spec.md`: `status: done` y `updated: 2026-09-18`, con una sección
   «Aplicación a producción» que tiene la evidencia de arriba y las verificaciones de las otras
   dos sesiones. Su condición de cierre era «cuando la 0458 esté aplicada y verificada allí».
   `docs/specs/README.md` se regeneró con `node scripts/build-docs-index.mjs` (464 specs; sólo
   cambia el estado de 0476).
3. Comentarios que la aplicación volvió falsos, **sólo prosa**, asignados por `dtdcargo-18`:
   - `lib/calculadora.ts`, JSDoc de `CONFIG.tarifaBaseCBM`: la constante queda para la caída
     real (Supabase, env, borrador, `is_public`, `valid_from` a futuro) y ya no para el
     vencimiento. Lo de antes queda fechado.
   - `__tests__/calculadora-respaldo-alineado.test.ts:127-141`: «🔴 PERO HOY EL SISTEMA NO HACE
     ESO» pasa a «✅ desde el 2026-09-18 lo hace por diseño», y lo anterior queda como historia.
   - **Además de los rangos asignados**, el mismo defecto a pocas líneas: la cabecera del test
     («o la vigencia de la tarifa vencida, que es lo normal cada mes»; «la RPC filtra por
     vigencia»), el comentario de `consolidado` en el test («la RPC filtra con `valid_until is
     null or …`») y, en `calculadora.ts`, «vigila la fecha de vigencia». Esta última ya era falsa
     antes de la 0458: el propio test dice que no hay test de vigencia.
4. **No se tocan**:
   - `app/api/public/cbm-rate/route.ts` y `lib/public/rates-queries.ts`. Su condicional
     verificable («mientras la 0458 figure en `pendingBelowCutoff`, NO se aplicó») sigue siendo
     cierto, y al salir la entrada del baseline se resuelve solo. Llegué a editarlos y los revertí
     cuando `dtdcargo-18` confirmó que están diseñados para no necesitar cambios.
   - La cabecera del `.sql`, que sigue diciendo «NO APLICADA A PRODUCCIÓN». Es el texto exacto
     que guarda el ledger: cambiarla rompería la comparación de identidad archivo ↔ ledger.
     Precedente: 0255, 0256, 0257 y 0457 conservan la misma frase después de aplicadas.

## VALIDACIÓN

| Comprobación | Alcance / SHA | Resultado |
|---|---|---|
| Preflight de catálogo, cuerpo = 0255 | producción, antes de aplicar | PASÓ |
| Texto enviado = blob de main | `09217dba`, byte a byte | PASÓ |
| `apply_migration` | producción | PASÓ (`{"success":true}`) |
| Postflight: ledger, identidad, cuerpo, firma, atributos, ACL y comentario | producción | PASÓ |
| RPC como `anon` antes = después | producción | PASÓ |
| Simulación del 30-nov, cuerpo viejo y nuevo | producción, sólo lectura | PASÓ (0255 sin fila; 0458 da 850) |
| Advisors de seguridad antes = después | producción | PASÓ |
| JS emitido sin comentarios = main (`calculadora.ts`, test de respaldo) con control positivo | `1548cae3` contra `origin/main` | PASÓ (md5 `887858aa` y `32b25f11`; el control cambia el JS en los dos) |
| vitest: respaldo, calculadora, mínimo en cajas, guía Alibaba, `public-cbm-rate.migration` | árbol de `1548cae3` | PASÓ (5 archivos, 117 tests) |
| vitest: `check-migrations-applied`, `check-pending-migration-symbols`, `route.test.ts` | árbol de `1548cae3` | PASÓ (3 archivos, 48 tests) |
| `node scripts/check-pending-migration-symbols.mjs` | árbol de `1548cae3` | PASÓ (0 rojo, 0 amarillo) |
| `node scripts/check-migrations-applied.mjs` | worktree sin `.env.local` | NO DISPONIBLE (SKIP sin credenciales, como en todo worktree; el postflight de arriba es la comprobación real) |
| `pnpm docs:check` / `pnpm sdd:check` | árbol de `1548cae3` | PASÓ / PASÓ |
| `git diff --check` | árbol de `1548cae3` | PASÓ |
| `pnpm verify` | `1548cae3` | **FALLÓ** (exit 1) sólo en el paso `test`: 1 fallo de 7.792, un timeout preexistente de esta máquina (ver abajo). Pasos individuales: harness, lint (0 errores, 15 warnings que ya estaban en main), rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols, sql-tests, schema-rebuild y build **PASÓ**; e2e **PASÓ con cobertura parcial** (15 pruebas omitidas sin Supabase público); migrations-applied **NO DISPONIBLE** (SKIP sin credenciales) |
| `pnpm test` repetido solo | `1548cae3` | FALLÓ igual: el mismo test, 23,7 s; 7.790 pasan |
| **Control:** `pnpm test` completo en main sin estos commits | `78410913`, checkout principal | FALLÓ igual: el mismo test, 24,1 s; 7.790 pasan |
| Ese test aislado | `1548cae3` | PASÓ (9/9; el test en cuestión, 4,7 s) |
| CI «Calidad continua» de main | `78410913` | PASÓ (GitHub Actions) |

**El único rojo es preexistente y ajeno a esta rama.**
`app/p/[token]/PackingListProductsStep.test.tsx › supplier invoice product lines › adds another
group and isolates its measurements and totals` supera su límite de 20 s cuando corre dentro de la
suite completa en esta máquina Windows: 22 a 24 s, en `verify` con su reintento, en la repetición y
en main sin estos commits. Aislado tarda 4,7 s y en el CI de main pasa. No importa `calculadora` ni
`rates-queries`, y el JS emitido de los archivos tocados es idéntico al de main. No se tocó el test:
ni se alargó su límite ni se debilitó.

Nota: una primera corrida de los dos archivos de scripts con `node --test` dio «fail 2». Esos
archivos importan `vitest`, así que ese no es su corredor; con vitest pasan. No fue un fallo del
código.

## COMMITS

- `1e4e1ada` — chore(db): 0458 aplicada a producción, sale de pendingBelowCutoff (baseline, SDD,
  índice).
- `1548cae3` — docs(SDD-0476): los comentarios del respaldo describen la tarifa con la 0458
  aplicada (sólo prosa).
- El commit que contiene este documento — docs(handoff).

## PR / BRANCH

Rama `codex/0458-aplicacion-prod-20260918`, base `origin/main` `78410913`, worktree arriba.
Publicación autorizada por Sam («autorizo»). Se le avisa a `dtdcargo-18` con el SHA y el verify
antes de abrir la PR, como pidió. La URL de la PR queda en la propia PR y en el reporte a
supervisión; este documento no la incluye para no crear un commit recursivo. Según `dtdcargo-18`,
**esta rama entra primero** entre las que tocan `migrations-baseline.json` (0414/0415 y la futura
0459). Si hace falta traer main, usar el driver de merge del repo y no resolverlo a mano.

## PENDIENTES DE ESTA TAREA

- Que el CI «Calidad continua» de la PR salga verde, y el merge, que decide y serializa
  `dtdcargo-18`. La aplicación en base ya está completa y no depende de la PR.

## FUERA DE ALCANCE DETECTADO

- **Hueco residual del relevo programado** (anotado ya en SDD-0476, no introducido acá): por el
  índice `rates_one_public_cbm_per_tenant_modo`, dejar una tarifa programada exige despublicar la
  vigente, y entre la despublicación y el arranque el sitio cae al respaldo del código.
- **Cabeceras «NOT applied» en migraciones ya aplicadas** (0255, 0256, 0257, 0457, 0458): es una
  práctica del repo y cambiarlas rompe la identidad con el ledger. Si se quiere una marca de
  estado, tendría que vivir fuera del `.sql`.
- `migrations-applied` sigue dando SKIP en todos los worktrees (sin credenciales): la afirmación
  «0458 figura en espera» del encargo no se había comprobado contra producción; esta vez el
  preflight lo confirmó.
- **Timeout local de `PackingListProductsStep.test.tsx`** («adds another group and isolates its
  measurements and totals»): en esta máquina, dentro de la suite completa, tarda 22-24 s contra un
  límite de 20 s, también en main `78410913`. Deja `pnpm verify` en rojo en cualquier rama local.
  Aislado tarda 4,7 s y el CI de main pasa. Es del dueño de DTD-0468; no se tocó.

## HANDOFF AL DIRECTOR

Producción quedó en 0458 con el ledger y la identidad confirmados. Tres sesiones verificaron que
no hay cambio visible hoy, y la simulación muestra que el 30-nov el sitio seguirá en 850. La
rama tiene tres commits, sólo de repo, y se publica con PR contra `main` por autorización de Sam.
Entra antes que las otras ramas que tocan el baseline. Fusionarla despliega sólo comentarios y
documentos: el JS emitido es idéntico al de main. No quedan acciones en producción. Sesiones consumidoras:
`dtdcargo-18` (integración) y `dtdcargo-53` (supervisión); los dos tienen el reporte. El claim se
libera al cerrar, después del commit de este documento; el worktree y la rama se conservan.

Impacto documental: SDD-0476 (canónico) actualizado; runbook de migraciones sin cambios, porque
el procedimiento funcionó tal como está escrito.

**Conocimiento**, estado de las capas en el worktree a la revisión `1548cae3`:

- Ninguna de las 16 fuentes del piloto semántico (`canonical-16-2026-09-16`) está en el diff, así
  que no hace falta recibo semántico.
- Graphify 0.9.61, estructural: `graphify update .` construyó el grafo del worktree desde cero
  (34.833 nodos, 65.184 aristas y 2.272 comunidades en 5 m 51 s). `knowledge:status` da estructural
  PENDING con 0 faltantes; el único pendiente es este handoff, que al medir no estaba commiteado.
  Los 2 `deleted` son nodos de módulos externos (`react`, `@testing-library/react`), no archivos,
  igual que en la 0475.
- Semántica: PENDING, 0 de 1.091 en global y 0 de 16 en el piloto. Es el backlog global de siempre;
  esta tarea no lo mueve.
- Archify: NO DISPONIBLE (`ARCHIFY_RUNTIME_MISSING`: falta el runtime 2.16.0 en el worktree). El mapa
  `knowledge-lifecycle` no depende de fuentes de esta rama.
- Obsidian: `knowledge:publish --preview` dio `ok: true`, estado PREVIEW en `1548cae3`, en
  `graphify-out/obsidian-preview` del worktree, con 0 conflictos y 39 avisos de enlaces, los mismos
  que en la 0475. La bóveda compartida no se tocó: la publica el Director desde main integrado.
  `publicationProblems` lista `MAIN_REQUIRED`, `STRUCTURAL_PENDING` y `SEMANTIC_PILOT_PENDING`, que
  son esperables en un worktree.
