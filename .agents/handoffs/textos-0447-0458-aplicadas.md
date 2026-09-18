# Textos que daban por pendientes la 0447 y la 0458 — 2026-09-18

- Owner/sesión: Worker `342b4f` («Corregir textos que dan 0447 y 0458 por pendientes»),
  Claude Opus 5.
- Director: `dtdcargo-18`. Revisa, fija el turno e integra; el Worker no mergea.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/textos-0447-0458-aplicadas`.
- Rama: `codex/textos-0447-0458-aplicadas`, creada con `harness-worktree start` desde
  `origin/main` = `1d80c18a2521ab40e95062be0325eaf34e2a40cc`. `guard` OK y claim `342b4f`
  antes de editar.
- SDD: ninguna nueva. El Director decidió que no hace falta porque no cambia comportamiento.
  Se agrega una nota fechada en
  [SDD-0476](../../docs/specs/0476-tarifa-lectura-sin-vigencia/spec.md) § Seguimiento.
- Autorización: encargo de Sam. Cubre commits locales, publicar esta rama y abrir su PR contra
  `main` después de reportarle al Director. No cubre merge ni escritura en producción. En
  producción solo se permite leer metadata (`list_migrations`), sin filas de negocio.
- Turno y publicación, texto literal del Director (`dtdcargo-18`), 2026-09-18:

  > TU TURNO. Vas antes que baterías, porque ya estás listo. […] Si todo da PASÓ, haz un solo
  > push y **abre la PR contra main** sin esperar otra respuesta mía. Te autorizo desde ahora.
  > Después mándame el número de la PR y el SHA.

  Esto cubre el push de esta rama a sí misma y abrir la PR. No cubre el merge, que hace el
  Director.
- Estado de tarea: lista-para-revision.

## OBJETIVO ORIGINAL

Actualizar dos textos que todavía daban por pendientes migraciones ya aplicadas:

1. `docs/legal/privacidad/README.md:16`, que decía «0447 pendiente de autorización/aplicación
   Cloud».
2. El comentario de cabecera de `app/api/public/cbm-rate/route.ts`, «⚠️ QUÉ PASA CUANDO LA
   TARIFA VENCE», escrito en condicional sobre si la 0458 estaba aplicada. Debe describir el
   comportamiento vigente, sin el condicional.

Sin tocar las cabeceras de los `.sql` aplicados: el ledger guarda su texto exacto y la
identidad archivo ↔ ledger se prueba por md5.

## ALCANCE

- Asignado por Sam: los dos textos de arriba.
- Ampliado por el Director, `dtdcargo-18`, el 2026-09-18:
  - `lib/public/rates-queries.ts`, líneas 13 a 32 y 67. Tenían el mismo condicional sobre la 0458.
  - Una línea fechada en SDD-0476 § Seguimiento, porque la spec decía que esas cabeceras
    «no se tocan».
- Nada más. Otros textos del mismo tipo van en FUERA DE ALCANCE.

## COMPLETADO

1. **`docs/legal/privacidad/README.md:16`**, la fila de `revision-0445-2026-09-04.md`. Ahora dice
   que la revisión es una foto al 2026-09-04: la 0447 que da por pendiente se aplicó en Cloud el
   2026-09-10 (ledger `20260910164232`), y la 0461 (SDD-0481) le retiró el bloqueo el 2026-09-18
   (ledger `20260918174236`). Menciona las dos a pedido del Director. Decir solo «aplicada» haría
   creer que la contención de la 0447 sigue activa.
2. **`app/api/public/cbm-rate/route.ts`**. La cabecera ya no tiene las dos ramas «sin/con la
   0458». Ahora dice:
   - al vencer, el sitio sigue cotizando el mismo precio;
   - desde la 0458 (SDD-0476, aplicada el 2026-09-18, ledger `20260918040814`) la vigencia no
     filtra la lectura;
   - `{ per_cbm: null }` queda para Supabase caído, borrador, `is_public` sin marcar o
     `valid_from` a futuro, que es la misma lista que la spec ya había revisado;
   - solo en esos casos las páginas Next caen a `CONFIG.tarifaBaseCBM`.

   La decisión del founder queda «cumplida por diseño». Se sacó el «$850» del respaldo: una
   cifra copiada en un comentario vuelve a quedar vieja con el próximo cambio de precio, que es
   el problema que la misma cabecera advierte.
3. **`lib/public/rates-queries.ts`**. «QUÉ CUENTA COMO NO SERVIBLE» describe solo el
   comportamiento vigente, con la fecha y el ledger de la 0458. La línea 67 ya no dice «con la
   0458 aplicada». Se quitó la frase sobre la firma de la RPC «con y sin la 0458», que solo
   importaba durante la transición.
4. **SDD-0476 § Seguimiento**. Una línea fechada registra quién decidió la reescritura y por
   qué:
   - la decidió el Director, `dtdcargo-18`, en una tarea que lanzó Sam;
   - el condicional seguía siendo cierto y no era un error;
   - con la 0458 aplicada, la rama «sin la 0458» ya no describe nada vigente, y una revisión del
     2026-09-18 la tomó por texto desactualizado.

   La atribución es la que indicó el Director: no dice «a pedido de Sam» como si Sam hubiera
   pedido ese cambio en concreto.

No se tocaron:

- Las cabeceras de `0447_…`, `0458_…`, `0459_…` y `0461_….sql`, que conservan la identidad por
  md5 con el ledger.
- `docs/legal/privacidad/revision-0445-2026-09-04.md`, una revisión fechada que era cierta en su
  fecha. El Director lo confirmó.

## FECHAS Y LEDGERS

| Migración | Versión del ledger | Aplicada | Fuente |
| --- | --- | --- | --- |
| `0447_identity_photo_replacement_privacy_gate` | `20260910164232` | 2026-09-10 | Leída en producción el 2026-09-18, solo metadata, primero por el Director (`dtdcargo-18`) y después con `list_migrations` desde esta sesión. Coincide con `mapa-de-borrado.md` y `fotos-identidad-cliente-v1.md` de main `cc15e48c` |
| `0458_tarifa_lectura_sin_vigencia` | `20260918040814` | 2026-09-18 | Mismas dos lecturas. Coincide con `.agents/handoffs/0458-aplicacion-prod-20260918.md` y con SDD-0476 § Aplicación |
| `0461_identity_photo_replacement_enable` | `20260918174236` | 2026-09-18 | Mismas dos lecturas. Coincide con `fotos-identidad-cliente-v1.md` y `mapa-de-borrado.md` de main `cc15e48c` |

- `list_migrations` desde esta sesión, proyecto `xpfuzqombmjmxvprjgmi`, 2026-09-18 poco antes de
  las 18:47 de Caracas (22:47 UTC), solo metadata. Confirma las tres filas con la misma versión
  y el mismo nombre:
  `20260910164232 · 0447_identity_photo_replacement_privacy_gate`,
  `20260918040814 · 0458_tarifa_lectura_sin_vigencia` y
  `20260918174236 · 0461_identity_photo_replacement_enable`. De paso confirma
  `20260910165737 · 0446_portal_profile_functional_remediation`, que se cita en FUERA DE ALCANCE.
  - Al principio de la sesión el conector figuraba `pending` y sus herramientas no estaban
    cargadas. Por eso el Director hizo primero la lectura y los textos se escribieron con ella.
  - Las herramientas cargaron más tarde, al llegar el turno, y esta confirmación propia se hizo
    antes del merge y del push.
  - Las fechas son las mismas en UTC y en hora de Caracas.
- `supabase/migrations-baseline.json › pendingBelowCutoff`, tanto en la base como en main
  `cc15e48c`, solo tiene `0422` y `0423`: ni 0447, ni 0458, ni 0461 figuran.

## VALIDACIÓN

### Sobre el merge `f7b65252`, que es lo que se publica

Sus padres son `9ddc9c98` y main `cc15e48c`. Main se trajo con su propio driver, y el driver no
llegó a actuar porque la rama no toca los registros generados. El commit que contiene este
documento solo modifica este archivo.

| Comprobación | Alcance | Resultado |
| --- | --- | --- |
| Diff neto contra main | `git diff --stat origin/main HEAD` | Exactamente los 5 archivos de la tarea: este handoff, `route.ts`, el README de privacidad, la spec 0476 y `rates-queries.ts` |
| Dependencias | `package.json` y `pnpm-lock.yaml` entre la base y main | Sin cambios, así que el `node_modules` del worktree sigue siendo válido |
| `git diff --check origin/main HEAD` | diff neto contra main | **PASÓ** |
| `corepack pnpm docs:index` y después `docs:check` | índice de specs regenerado con el script | **PASÓ**: 468 specs y 13 huecos. Regenerar no cambió nada |
| `corepack pnpm typecheck` | repo completo, exit tomado del proceso | **PASÓ**: exit 0 |
| JS emitido sin comentarios, igual a main | `route.ts` y `rates-queries.ts` contra `origin/main` `cc15e48c` | **PASÓ**: idéntico en los dos; el control positivo sí cambia el JS |
| Las 4 pruebas focales, de a una con `--pool=threads --maxWorkers=1` | las mismas de abajo | **PASÓ**: route 6, combinar-destinos 7, public-cbm-rate.migration 11 y calculadora-respaldo-alineado 6, con 1 archivo en cada corrida |
| `list_migrations` propio | metadata del ledger | **PASÓ**: 0447, 0458 y 0461 con las versiones citadas (ver FECHAS Y LEDGERS) |

### Antes del merge, sobre `f238c0e5` (base `1d80c18a`)

| Comprobación | Alcance | Resultado |
| --- | --- | --- |
| `git diff --check` | los 4 archivos del cambio | **PASÓ** |
| `corepack pnpm docs:check` | índice de specs | **PASÓ**: índice sincronizado, 467 specs |
| `corepack pnpm typecheck` | repo completo, exit tomado del proceso sin tubería | **PASÓ**: exit 0, sin errores de `tsc` |
| JS emitido sin comentarios, igual a la base | `route.ts` y `rates-queries.ts` contra `1d80c18a`, con `transpileModule` y `removeComments` | **PASÓ**: md5 `86e53df3…` en `route.ts` y `8342c770…` en `rates-queries.ts`, iguales antes y después. Control positivo: al mutar el primer literal del código (`"next/server"` y `"./supabase-anon"`), el JS cambia en los dos |
| `vitest run app/api/public/cbm-rate/__tests__/route.test.ts` | `--pool=threads --maxWorkers=1` | **PASÓ**: 1 archivo, 6 tests |
| `vitest run lib/public/__tests__/combinar-destinos.test.ts` | importa el `rates-queries` real | **PASÓ**: 1 archivo, 7 tests |
| `vitest run lib/public/public-cbm-rate.migration.test.ts` | la RPC de la 0458 en PGlite, es decir, lo que describen los comentarios | **PASÓ**: 1 archivo, 11 tests |
| `vitest run __tests__/calculadora-respaldo-alineado.test.ts` | el respaldo `CONFIG.tarifaBaseCBM` que citan los comentarios | **PASÓ**: 1 archivo, 6 tests |
| `pnpm verify` | — | **NO EJECUTADO**. El cambio solo toca comentarios y prosa, y el JS sin comentarios es idéntico al de la base. Se corrieron las comprobaciones que pidieron el encargo y el Director. En esta máquina el paso `test` de verify falla por timeouts ajenos incluso sin carga (ver memoria del proyecto), así que no aportaría evidencia sobre este cambio |
| `list_migrations` desde esta sesión | metadata del ledger | **NO DISPONIBLE en ese momento**: el conector de Supabase estaba `pending`. Los textos se escribieron con la lectura del Director, y después se confirmó con una lectura propia (tabla de arriba) |
| `knowledge:status` | worktree nuevo | **EJECUTADO**, `ok: false`. Estructural `INVALID` porque falta `graphify-out/graph.json` en el worktree nuevo. Semántico `INVALID` con 0/1103; piloto `PENDING` con 0/16; Archify `PENDING` (`ARCHIFY_RUNTIME_MISSING`); Obsidian `PENDING`, 0 conflictos |
| Recibo semántico | — | **NO APLICA**: ninguno de los 4 archivos está en `semanticPilot` (`canonical-16-2026-09-16`). README y spec quedan como pendiente global visible |
| Archify (`knowledge:visual` y `knowledge:visual:check`) | — | **NO APLICA**: ninguno de los 4 archivos es fuente del mapa (comprobado contra `scripts/knowledge-visual-evidence.json` y `docs/architecture/knowledge-lifecycle.archify.json`). Además el runtime 2.16.0 no está en el worktree |
| `graphify update .` (estructural) | — | **NO EJECUTADO**: la CPU de la máquina estaba al 100 % en 5 de 5 muestras, con suites de otras sesiones corriendo. Construir el grafo desde cero habría agregado contención; en el worktree de la 0458 tardó 5 min 51 s. El Director confirmó la saturación al dar el turno: «La CPU está saturada por otras sesiones: no corras la suite completa». En el código, el cambio es solo de comentarios |
| `knowledge:publish --preview` | — | **NO DISPONIBLE**: `ok: false`, «No hay grafo comprobable para publicar». Depende del grafo de la fila anterior |
| CI alojado «Calidad local sin secretos» | — | **PENDIENTE**: corre al publicar. El resultado va al Director por mensaje; no se empuja a la rama |

## COMMITS

- `9eb97ca4`, `docs(privacidad)`: la fila de `revision-0445` ya no da la 0447 por pendiente.
- `f238c0e5`, `docs(SDD-0476)`: `route.ts` y `rates-queries.ts` describen la 0458 aplicada, y
  SDD-0476 § Seguimiento registra por qué.
- `9ddc9c98`, `docs(handoff)`: primera versión de este documento.
- `f7b65252`: merge de `origin/main` `cc15e48c`. Entra la #145 (SDD-0481/0461) y el merge sale
  sin conflictos.
- El commit que contiene este documento: `docs(handoff)`, con el cierre y la validación sobre
  el merge. Su hash y el número de la PR se le mandan al Director por mensaje: registrarlos
  aquí obligaría a otro push.

## PR / BRANCH

- Rama `codex/textos-0447-0458-aplicadas` y worktree de arriba.
- Se publica con un solo push (`git push -u origin codex/textos-0447-0458-aplicadas`) y la PR se
  abre contra `main` enseguida, con la autorización del turno.
- Después del push la rama queda congelada hasta que el Director integre.

## PENDIENTES DE ESTA TAREA

1. Mandarle al Director, por mensaje, el resultado del CI alojado sobre el head publicado, sin
   empujar a la rama.

Ninguno más para la aceptación: los cuatro textos están corregidos y validados sobre el merge.

## FUERA DE ALCANCE DETECTADO

Mismo tipo de texto (dan por pendiente una migración ya aplicada), leídos en main `cc15e48c` y no
tocados:

1. **`docs/specs/0439-portal-cliente-edicion-de-perfil/spec.md:112`** dice
   «`0446_portal_profile_functional_remediation.sql` (pendiente)» y «hasta decidir su
   aplicación». La 0446 se aplicó el 2026-09-10: ledger `20260910165737`, confirmado con
   `list_migrations` desde esta sesión. La conservación de `SDD-0435` en el comentario SQL
   sigue siendo correcta, porque la cabecera aplicada no se reescribe. Lo que quedó viejo es el
   «(pendiente)».
2. **`docs/legal/privacidad/fotos-identidad-cliente-v1.md`, § 7, control 3**, dice «La migración
   funcional 0446 lo implementa por separado; falta su merge, aplicación nominal y verificación
   Cloud». La tabla «Actualización 2026-09-18 · SDD-0481» del mismo documento ya da el control 3
   por cumplido, pero el texto del control no se actualizó.

Destino, fijado por el Director el 2026-09-18: los dos se los pasa a `dtdcargo-63`, que va a
editar esos archivos en la SDD-0482. No entran en esta PR.

Revisados y descartados, porque están fechados y seguidos de su actualización:

- `mapa-de-borrado.md:291-298`, con «Estado técnico al 2026-09-04».
- La tabla § 6 de `fotos-identidad-cliente-v1.md`, con «Estado comprobado al 2026-09-04».
- `docs/specs/0438-…/spec.md:163-166`, una lectura del ledger de ese momento.
- SDD-0476 § 3, porque su pendiente documental quedó cerrado en § Seguimiento.

## HANDOFF AL DIRECTOR

- Siguiente acción: revisar la PR, esperar el check obligatorio sobre el head publicado e
  integrar según la cola. El Worker no toca la rama después del push.
- Revisión: son 4 archivos más este handoff, solo prosa y comentarios. Conviene mirar:
  - la redacción de la fila del README, que cita la 0447 y la 0461;
  - la atribución en SDD-0476 § Seguimiento;
  - que los `.sql` aplicados no aparezcan en el diff.
- Cambios compartidos: ninguno. No toca API, schema, migraciones ni UI.
- Integración o publicación pendiente: el merge lo hace el Director. Merge a main despliega en
  Vercel: el JS no cambia, pero el despliegue igual ocurre.
- Conocimiento, después de integrar: `graphify update .` desde main y el pendiente semántico
  global de README y spec, que quedan fuera del piloto.
- Sesiones consumidoras del worktree: ninguna, aparte de esta.
- Ownership: el claim `342b4f` se libera después del push, porque la escritura terminó.
- Cleanup: el worktree y la rama se conservan hasta que el Director limpie. Hace falta que la PR
  esté integrada y que el cleanup tenga autorización.
