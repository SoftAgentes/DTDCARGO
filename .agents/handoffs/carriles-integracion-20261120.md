# Handoff · carriles de integración (pasos 1 y 2, contrato del paso 3)

- Fecha: 2026-11-20 · Owner: Worker `local-carriles-integracion-305dae` · Encarga: Dir_DTD.
- Worktree: `.claude/worktrees/carriles-integracion-305dae` · Rama: `claude/carriles-integracion-305dae`.
- Base: `origin/main` `af0f635ad61f179e20719828b319461d10f37429`.
- SDD: no aplica. Es harness (reglas de integración y una herramienta del tren), no comportamiento del Studio.
  El runbook no pide SDD para esto.
- Autorización: commits, publicar la rama y abrir la PR en borrador. Sin merge ni producción.
- Estado de la tarea: lista-para-revision (PR en borrador).

## OBJETIVO ORIGINAL

Sam aprobó el 2026-11-20 los carriles de integración («Carriles: sí, arranca hoy con los pasos 1 a 3»). Esta
tarea cubre el paso 1 (la regla escrita en AGENTS, runbook y skill del Director), el paso 2 (el clasificador
`scripts/carril.mjs` con sus pruebas y un check de CI informativo) y, del paso 3, el contrato que va a usar
`tren.sh`. Todo en una PR en borrador.

## COMPLETADO

- `AGENTS.md`: sección «Carriles de integración», con los dos carriles, la reversión, la revisión de madrugada
  y las ventanas.
- `docs/runbooks/codex-engineering.md`: sección «Carriles de integración», con las reglas completas, la
  semana de prueba y qué se mide, la nota de que GitHub no es la barrera, cómo decide el clasificador y su
  límite conocido, y el contrato del tren: comando, JSON, códigos de salida y desde qué copia se corre.
- `.agents/skills/director/SKILL.md`: resumen operativo para el Director.
- `scripts/carril.mjs`: Node sin dependencias. Toma las rutas por argumento, por stdin o con `--pr N`. Salida en
  texto o en `--json`. Códigos: `0` rapido, `1` revision, `2` error.
- `scripts/tests/carril.node.mjs`: 108 pruebas con `node:test`, que corren en `pnpm harness:test`.
- `.github/workflows/carril.yml`: el check «Carril (informativo)». Corre sin install, con permisos de solo
  lectura y usando el clasificador de la base. Escribe el carril en el resumen del job y como anotación, y no
  bloquea.

Decisiones tomadas dentro del alcance:

- **`--pr` lee el diff completo (`gh pr diff N --color=never`) y no `--name-only`.** `--name-only` da solo la
  ruta nueva de un renombre, y alguien podría esconder un archivo sensible renombrándolo a una ruta segura. El
  script toma las dos rutas de las cabeceras del diff.
- **Las reglas mismas van con revisión previa.** Entran ahí `AGENTS.md` y `CLAUDE.md`, `.agents/` (salvo los
  handoffs), `.claude/`, `docs/governance/`, el runbook de integración, el de migraciones en producción, el
  clasificador, sus pruebas y el contrato del CI. Así una PR no puede rebajar su propio carril. Por esa misma
  razón, el CI y el tren usan el clasificador de `main`.
- **`layout.tsx` y `template.tsx` van con revisión previa** aunque sean pantallas, porque suelen llevar las
  puertas de acceso.
- **Los formularios** (`*Form.tsx`), el consentimiento de cookies, la analítica y Clarity van con revisión
  previa: deciden qué datos personales se capturan.
- **Ventanas (corregido por Dir_DTD, 2026-11-20).** Hoy un push a `main` no publica: el vigilante está detenido y
  publicar es un paso manual del Director. Por eso el tren fusiona a cualquier hora y las ventanas
  rigen solo para publicar. Si el vigilante vuelve a activarse, la regla se revisa. La primera versión decía que el
  tren fusionaba solo en ventana.
- **Madrugada.** El runbook dice que la lanza el Director, sin nombrar la herramienta.
- **Fusionar no publica, en todo el repo (pedido de Dir_DTD, 2026-11-20).** Había frases que daban por hecho
  que un merge publica, y las corregí, dejando dicho que si el vigilante vuelve la regla se revisa:
  - `AGENTS.md`, «Fronteras críticas»: «cada push a `main` construye y publica automáticamente… Un merge a `main`
    es publicación web».
  - `docs/engineering/project-rules.md`, «⚠️ Producción web: cada push a `main` publica» (título y texto).
  - `docs/runbooks/aplicar-migraciones-prod.md` §5: «Fusionar es publicar: la web entra sola en el VPS». Ahora
    el Director publica a mano justo después del merge, dentro de la misma autorización.
  - `docs/runbooks/codex-engineering.md`: nota nueva debajo de la nota histórica del 2026-10-19.
  - Notas del 2026-10-19 en `setup-resend.md`, `setup-resend-inbound.md`, `setup-telegram-bot.md`,
    `setup-web-push.md` y `deploy-orden-venta-0072.md`: «se publica sola con el vigilante» pasa a «se
    publicaba… (detenido desde el 2026-10-25: hoy la publica el Director a mano)».
  - `publicacion-automatica-web.md` ya decía que la publicación está detenida desde el 2026-10-25: no lo cambié.
  - El comando que cito es el documentado en el repo, `publicar-web.sh publicar <sha>`. Dir_DTD lo llamó
    `publicar.sh`.

- **Revisión de Dir_DTD sobre `cb7de5ed8` (CHANGES_REQUESTED), atendida:**
  - Alta: dos capas. Por ruta, las `page.tsx` de las zonas con sesión van a revisión, y se suman palabras
    nuevas (`clientes`, `perfil`, `profile`, `ficha`, `contacto`, `gps`, `ubicacion`, `tms`, `admin`, `rbac`,
    `backfill`). Por contenido, una pantalla en ruta segura va a revisión si una línea agregada o quitada toca
    puertas, sesión, lecturas o escrituras. Sin el diff, una pantalla da revisión. Las pruebas cubren los casos
    del revisor.
  - Media: el JSON v2 trae `head`. `--pr` compara la cabeza antes y después del diff, y el runbook pide que el
    tren fusione con `--match-head-commit <head>`. `project-rules`, `publicacion-automatica-web` y `.harness/` van
    a revisión. En el §5 de migraciones, publicar pide su propia autorización y arrastra las PR rápidas
    pendientes.
  - Baja: `--help` sale con 2. Los ayudantes de `e2e/` y `lib/i18n/*.ts` son código. Los documentos fechados
    quedan como están, con una nota en el runbook. En `publicar-web.sh` solo se tocó el comentario.
  - En el árbol, con el contenido de cada archivo como diff, quedan 239 pantallas en `rapido`. Dos traen un
    `fetch` GET de lectura (`ZipButton.tsx` y `BugReplayPlayer.tsx`).

- **Segunda revisión de Dir_DTD sobre `a557ca449` (CHANGES_REQUESTED), atendida:**
  - La capa de contenido ahora decide por archivo. Cada pantalla se lee completa en la base (el merge-base) y en
    la cabeza con un solo `git cat-file --batch`, y si cualquiera de las dos trae una marca, va a revisión.
    Quitar `.is("deleted_at", null)` de `GenerateBLModal.tsx` o `canAccessModule` de `CrmEmbudosSlot.tsx` ya
    da revisión; las dos están en las pruebas.
  - Los imports de `_actions/`, de `/actions` o de un archivo local con `"use server"` mandan a revisión
    (`CommentsThread.tsx` y `DeletedCommentsPanel.tsx` están en las pruebas). Un `.tsx` con NUL, con UTF-8
    inválido o marcado como «Binary files» también va a revisión.
  - Marcas nuevas: `canAccess*`, `getStudioAccess`, `isAdmin`, `hasRole`, `can(` y `puede*(`. Palabras
    de ruta nuevas: `crm`, `lead`, `comment` y `bug`.
  - `--diff` pide `--base` y `--head` juntos y verifica que el diff sea `git diff --no-renames base head`. El
    runbook dice que para el tren solo vale `origen: "pr"`. El JSON pasa a la versión 3, con `base`.
  - Los dos avisos de `publicar-web.sh` (vuelta atrás y publicación a mano) ahora dicen que valen solo con el
    vigilante encendido.
  - En el árbol quedan 216 pantallas en `rapido` (antes, 239). Muestra de diez: `app/faq/page.tsx`,
    `PortalAdvisorCard.tsx`, `PortalMaintenanceNotice.tsx`, `app/shipping-mark/page.tsx`,
    `VistasAlmacen.tsx`, `ReportPreview.tsx`, `ContenedorPanel.tsx`, `EmptyState.tsx`,
    `DecimalInput.tsx` y `Timeline.tsx`. Ninguna trae `fetch` ni formulario.

- **Tercera revisión de Dir_DTD sobre `8190d6a4f` (CHANGES_REQUESTED), atendida:**
  - Imports en dos niveles. Si un módulo importado con código (no `import type`) cae en una regla fija o en un
    tema por su ruta, o trae una marca, la pantalla va a revisión. Así caen `voidExpenseEntriesForExpense`
    (`lib/studio/accounting/`) y `lib/marca/access.ts` (`hasBrandAccess`). Los estilos y los textos importados
    (`lib/design-tokens.ts`) no cuentan.
  - Marcas nuevas: `has*Access`, `fetch(`, `<form … method=`, `action={`, `formAction`, `sendBeacon(`,
    `XMLHttpRequest` y las props `onSave/onSubmit/onDelete…/onConfirm` llamadas con un objeto. Medí esa última:
    hoy no la trae ninguna pantalla del árbol, así que no da falsos positivos.
  - `cat-file --batch` falla cerrado si una ruta trae un salto de línea o si la salida no cuadra con lo pedido.
    Un import con salto de línea en la ruta da revisión.
  - `--pr` lee también la versión actual de `origin/main`. El runbook documenta que los cambios posteriores no se
    leen, porque el tren exige que la PR no esté BEHIND.
  - En el árbol quedan **131 pantallas** en `rapido` (antes, 216). El costo más grande de la regla de imports son
    las 19 páginas que importan `WhatsAppFAB`, que cae por la palabra «whatsapp».

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| `node --test scripts/tests/carril.node.mjs` | `d4bdcb406` | PASÓ (108/108) |
| `node --test scripts/tests/carril.node.mjs` tras la revisión | `d6249d98a` y siguientes | PASÓ (149/149) |
| Mutaciones de la capa nueva: sin contenido sensible, sin «sin-contenido», sin chequeo de cabeza, sin `(?<!Array)` | copia restaurada | PASÓ: 18, 3, 1 y 1 en rojo |
| `--pr 727/724/723/715` contra GitHub, con `head` | PRs fusionadas | PASÓ: rapido (docs), rapido (docs), revision (skill), rapido (docs) |
| Simulación de `carril.yml` con un merge real de prueba (`--diff --head HEAD^2`) | diff de esta PR | PASÓ: revision, `head` correcto, exit 0 |
| `bash -n infra/ops/web/publicar-web.sh` | comentario | PASÓ |
| `node --test scripts/tests/carril.node.mjs` tras la segunda revisión | `5da89b4cb` y siguientes | PASÓ (175/175) |
| Mutaciones de la capa por archivo: solo la cabeza, sin binarios, sin acciones importadas, sin `canAccess*`, sin verificar el diff, sin «Binary files», sin chequeo de cabeza | copia restaurada | PASÓ: 2, 1, 1, 3, 1, 1 y 1 en rojo |
| `--pr 727/721/715/726` con git real (fetch, merge-base, cat-file) | PRs fusionadas | PASÓ: rapido, revision, rapido, revision; 8 a 10 s cada una |
| Simulación de `carril.yml` sobre un merge real con `--diff --base HEAD^1 --head HEAD` | diff de esta PR más dos archivos de prueba | PASÓ: `head` es el merge, `ZzDatos.tsx` (importa `lib/db`) da revision y `ZzNuevo.tsx` da rapido |
| `bash -n infra/ops/web/publicar-web.sh` | avisos | PASÓ |
| `node --test scripts/tests/carril.node.mjs` tras la tercera revisión | cabeza de esta vuelta | PASÓ (192/192) |
| Mutaciones de la tercera vuelta: sin imports de nivel 1, sin nivel 2, `import type` cuenta, sin chequeo de que cuadre, sin exención de estilos, sin marca `fetch(` | copia restaurada | PASÓ: 2, 1, 1, 1, 1 y 1 en rojo |
| `--pr 727/721/726` con git real (tres versiones) | PRs | PASÓ: rapido, revision (15 de 36), revision; 7 a 12 s |
| Simulación de `carril.yml` sobre un merge real | más `ZzAnula.tsx`, que llama a `voidExpenseEntriesForExpense` | PASÓ: `ZzAnula.tsx` da revision por el import y `ZzNuevo.tsx` da rapido |
| Mutaciones a mano: carril fijo en rapido, sin causantes, `---` dentro de un hunk, temas aplicados a docs | copia de trabajo, restaurada | PASÓ: 48, 5, 1 y 24 pruebas en rojo, en ese orden |
| `node --test` de `harness-discovery` y `verify-harness-discovery` | `d4bdcb406` | PASÓ (5/5) |
| Simulación del paso de `carril.yml` en un worktree descartable (commit sintético sobre la base) | diff de esta PR | PASÓ: da `revision` (gobernanza y ci), resumen y anotación correctos, exit 0 |
| `node scripts/carril.mjs --pr 726/724/723` contra GitHub | PRs ya fusionadas | PASÓ: revision (contratos SQL), rapido (spec), revision (skill) |
| `node scripts/build-docs-index.mjs --check` | árbol | PASÓ |
| `node scripts/check-numbering.mjs` | árbol | PASÓ |
| `node scripts/check-skills-manifest.mjs` | árbol | PASÓ |
| `node scripts/build-governance-capsule.mjs --check` | árbol | PASÓ |
| `git diff --check` | diff | PASÓ |
| `pnpm lint` (ESLint sobre `scripts/carril.mjs`) | — | NO EJECUTADO: el worktree no tiene `node_modules` e instalar pide turno. Lo cubre el CI al marcar la PR lista. |
| `pnpm verify` / Vitest | — | NO EJECUTADO: es harness, no producto, y no tengo turno de PC. El CI corre `pnpm harness:test` y el contrato del workflow de calidad. |
| Corrida real de `carril.yml` en GitHub | — | NO EJECUTADO todavía: corre al abrir la PR (también en borrador). |

## COMMITS

- `e277f92f7` clasificador y pruebas.
- `049bb1ad2` check informativo del carril.
- `f9509648b` regla en AGENTS, runbook y skill del Director, con el contrato del tren.
- `d4bdcb406` limpieza del corte de `--` en los argumentos.
- El commit que contiene este documento.

## PR / BRANCH

- Rama `claude/carriles-integracion-305dae`, con base `main`. El número de la PR queda en la descripción y en el
  aviso a Dir_DTD.

## PENDIENTES DE ESTA TAREA

- Revisión independiente. La PR va por el carril con revisión previa: el propio clasificador la manda ahí.
- Ver la primera corrida real de «Carril (informativo)» en la PR y, al marcarla lista, el verde de
  `quality.yml` (ESLint incluido).

## FUERA DE ALCANCE DETECTADO

- Paso 3: cambiar `tren.sh` para que use el contrato. Lo hace Dir_DTD, fuera del repo.
- La revisión de madrugada (2:00 de Caracas) la lanza Dir_DTD, con la herramienta que elija. No es parte de
  esta PR.
- El registro del carril de cada merge, para medir la semana, lo lleva el tren. Este repo no tiene dónde
  guardarlo.
- El escáner de voseo (`scripts/buscar-voseo.mjs`) da 2 apariciones previas en
  `lib/studio/chatwoot/bot/conocimiento/reglas-duras.ts`. Son ajenas a esta tarea.

## HANDOFF AL DIRECTOR

- Siguiente acción: lanzar la revisión independiente. Después, `gh pr ready` para la corrida de calidad y,
  con eso, fusionar; publicar en una ventana.
- Contrato compartido nuevo: la salida de `scripts/carril.mjs` (versión 1) que va a usar `tren.sh`.
- Impacto documental: AGENTS, el runbook de integración y la skill del Director quedan actualizados. No toca
  `docs/specs` (no hay SDD) ni la cápsula de gobernanza, que sigue vigente.
- Ownership: libero el claim al terminar de escribir.
