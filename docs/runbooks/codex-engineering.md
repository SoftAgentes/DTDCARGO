# Ingeniería con Director y Workers

Dueño: Director de ingeniería · Estado: vigente · Fecha: 2026-09-05.

## Empezar

En una nueva tarea Codex, abierta en la copia que contiene este harness:

```text
$director
Director, ¿cómo estamos hoy? Reconstruye el estado desde Git, PRs, specs y handoffs.
```

Un Worker recibe `$worker` y el prompt de asignación. Sin selector de skills:
«Lee .agents/skills/director/SKILL.md y actúa como Director» o el equivalente
Worker, con ruta absoluta si se abre otra carpeta. CLI comprobada:
`codex --cd "<ruta-del-worktree>"`; luego pega el prompt. No se promete
`/director`: `$director` es la invocación explícita nativa.

Skills repo-scoped en `.agents/skills/`: no requieren instalar un plugin ni
modificar configuración global. El plugin existente de gobernanza sigue separado,
es derivado read-only y no se duplica. Codex CLI 0.153.4 tiene soporte de plugins,
pero para estos workflows del repo las carpetas nativas evitan instalación y
desfase del caché. Si no aparecen, abre nueva tarea o reinicia Codex.

Fuentes verificadas: [skills nativas](https://learn.chatgpt.com/docs/build-skills),
[AGENTS y overrides](https://learn.chatgpt.com/docs/agent-configuration/agents-md),
[worktrees Codex](https://learn.chatgpt.com/docs/environments/git-worktrees).

## Aislamiento

```powershell
git fetch origin
node scripts/harness-worktree.mjs start objetivo-concreto
# Usa la ruta exacta devuelta por start:
codex --cd "<ruta>"
```

`start` crea rama `codex/<slug>` sin upstream desde origin/main, fuera del
checkout principal, en el contenedor hermano DTD-worktrees. Ese sigue siendo su
único destino; `finish` en cambio informa sobre cualquier worktree registrado. No mueve trabajo,
no copia .env, no instala dependencias, no publica. GitHub no disponible:
usa una base local verificada con `--from <ref>`, declara antigüedad y no
integres hasta verificar el remoto.

El Worker usa guard y claim antes de editar. El claim local bajo metadatos Git
por worktree impide que dos sesiones cooperantes lo reclamen simultáneamente;
no es una barrera contra una herramienta que lo omita. No se instalan hooks
globales ni se cambia core.hooksPath compartido. Una sesión no transfiere
ownership a otra sin handoff y liberación explícita. Un claim antiguo o una
tarea Codex en espera pueden seguir siendo trabajo activo.

Herramientas nativas de creación de tareas se usan solo cuando Sam solicita
nuevas tareas; consultar proyecto y crear en modo worktree, esperar preparación,
verificar ruta y rama antes de escribir. El Director conserva su tarea de mando.
No se da por hecho que un subagente tenga worktree propio: revisiones pueden
ser read-only, implementación interna comparte un único owner con allowlists
disjuntas. No lances procesos Codex ocultos con permisos ampliados como sustituto.

## Asignación y handoff

Usa el identificador de issue existente o un slug único (fecha + objetivo).
No se agrega otro gestor de proyectos. Antes del primer cambio de producto,
cada Worker conserva este contrato en `.agents/handoffs/<task-id>.md`.
Si no existe issue y no se asigna aún un Worker, el Director registra el pendiente
en un handoff por tarea dentro de su rama de coordinación; lo publica solo con
permiso. La ausencia de PR nunca significa que no haya trabajo.

Prompt listo para completar por Director, sin dejar placeholders al asignar:

```text
$worker
Objetivo: <resultado observable, una tarea>.
Task ID / owner: <id> / <sesión>.
Repositorio / worktree / rama / base: <rutas y refs verificadas o crear aislamiento>.
SDD: <ruta y estado, ID coordinado/reservado>.
Aceptación: <criterios comprobables>.
Alcance: <archivos/módulos permitidos y exclusiones>.
Dependencias / orden: <ninguna o tareas/PR y condición para iniciar>.
Contratos compartidos / riesgos: <API, schema, migraciones, UI compartida>.
Validación: <comandos y escenarios>.
Autorización: <commits locales; publicación rama/PR sí o no; no merge ni prod>.
Handoff: .agents/handoffs/<task-id>.md.
Ejecuta hasta completar; separa hallazgos ajenos y reporta bloqueos reales.
```

El handoff registra fecha, owner, ID de sesión (si existe), rutas, rama, base SHA,
objetivo, spec, estado de tarea, aceptación, dependencias, permisos, último resultado
y siguiente paso. Estado de tarea sugerido: pendiente/en-progreso/bloqueada/
lista-para-revision/integrada; independiente del estado SDD.

Cierre obligatorio (también cuando queda parcial):

- **OBJETIVO ORIGINAL:** resultado solicitado.
- **COMPLETADO:** cambios concretos y criterios cumplidos.
- **VALIDACIÓN:** comando, alcance/SHA observado, PASÓ/FALLÓ/NO EJECUTADO/NO DISPONIBLE.
  No aplica se justifica en el detalle de NO EJECUTADO.
- **COMMITS:** hashes y propósito. Para un commit que contiene el propio handoff,
  usa «commit que contiene este documento» y actualiza hashes finales en la PR;
  no crees recursión de commits solo para su propio hash.
- **PR / BRANCH:** URL si existe, base, rama y worktree.
- **PENDIENTES DE ESTA TAREA:** lo necesario para aceptación; «Ninguno» solo si es cierto.
- **FUERA DE ALCANCE DETECTADO:** otros problemas, sin convertirlos en pendientes propios.
- **HANDOFF AL DIRECTOR:** siguiente acción, revisión/dependencias, cambios compartidos,
  integración/publicación pendiente, sesiones consumidoras y si se liberó ownership.

Worker mantiene su artefacto; Director mantiene revisión/orden en PR o su propio
handoff por tarea. No hay `current.md` global compartido. Si no hay red, commits y
handoff locales permiten retomar; se reporta que aún no existe respaldo remoto.
El briefing lee artefactos desde cada rama relevante y no modifica worktrees ajenos.

## SDD

Conserva `docs/specs/NNNN-slug/spec.md`, sus campos ISO y estados
draft/proposed/approved/in-progress/done/superseded.
Director coordina un solo turno de asignación a la vez:

1. Actualiza origin sin prune; inspecciona PRs abiertas (incluye forks/drafts),
   todas las refs, reservas y specs/migraciones sin commit en worktrees.
2. `pnpm sdd:next` reúne números. Es inventario, no una reserva.
   Offline/inventario incompleto: no anuncia número globalmente libre.
3. `pnpm sdd:next --reserve <slug>` crea stub en commit y ref propia sin tocar
   checkout/index/HEAD. La reserva local es durable y visible para este clon;
   no excluye otros equipos hasta publicación. Toma el máximo + 1, no el
   primer hueco (SDD-0545). Si el Director ya asignó el número:
   - `--expect NNNN` cancela, sin crear refs, si el que tocaría no es ese:
     otra sesión reservó entre el inventario y la reserva;
   - `--number NNNN` reserva un número asignado (por ejemplo, un hueco) sólo si
     está libre en todo el inventario y no pasa del siguiente.

   No se combinan. `ADVISORY hueco reciente` nombra los números libres entre
   lo integrado en `origin/main` y el siguiente: nadie los toma solo.
4. Con permiso de publicar reserva, usa la opción `--push` al reservar:
   publica únicamente la rama numérica `codex/sdd-reserve-NNNN` con expectativa
   de que NO exista. El script usa únicamente la forma create-only
   `--force-with-lease=<ref-de-reserva>:`: no sobrescribe una ref existente.
   Esta comparación atómica es la única excepción técnica a «no force push».
   El rechazo por carrera no se fuerza: vuelve a inventariar y
   asigna otro ID. No borres la reserva que ganó.
5. Crea PR draft de reserva si el trabajo va a durar; registra owner/tarea. El
   Worker puede partir de esa ref e incorporar el stub a su rama. Reutiliza la
   PR de reserva para implementación si es apropiado o vincula ambas PRs y
   cierra la redundante solo al conservar la spec en el PR real.
6. Regenera índice en la rama que entrega la spec con `pnpm docs:index`; no
   editar a mano. Verifica `pnpm docs:check` y `pnpm sdd:check`.
7. Antes de integración cruza carpetas en PRs y trabajo activo. Un mismo ID en
   títulos puede ser una misma spec legítima: inspecciona rutas y requisitos.
   Si son specs diferentes, renumera la que no está en main, en su propia rama,
   carpeta + frontmatter + referencias + índice; repite comprobaciones.
   Nunca renumeres migración aplicada ni añadas exención para ocultar un choque.

Las reservas y la exclusión por rama reducen carreras entre usuarios de este
protocolo; no evitan que una sesión antigua ignore el mecanismo. Por eso la
revisión de PRs y el gate de numbering se conservan. Un ID usado no se recicla
por antigüedad. Migraciones son secuencia separada, coordinada por Director
contra archivos y reservas activas; su asignación se registra en el handoff/PR
antes de ejecutar Workers en paralelo, sin aplicar nada a producción.

## Briefing diario

`node scripts/director-status.mjs` produce JSON fechado de solo lectura:
worktrees, estado sin commit, branches ahead/behind, HEAD/main, commits recientes,
handoffs, specs, PRs y checks cuando gh está disponible. No lee secretos ni
contenido de filas. `--offline` omite GitHub explícitamente. Guarda salida fuera
de Git si necesitas una foto; el reporte no se convierte en source of truth.

El Director interpreta evidencia, inspecciona diffs/contratos y devuelve las seis
secciones del skill. No infiere bloqueo de un check pending ni finalización de un
árbol limpio. Un error de consulta es NO DISPONIBLE. Compara paths entre PRs y
dependencias de API/DB/UI aunque los paths sean diferentes; construye un orden
topológico y no integra ciclos sin resolverlos. Recomienda Workers solo para
tareas suficientemente definidas e independientes, cada uno con prompt completo.

## Conocimiento al iniciar y cerrar

El handoff conserva impacto documental, fuentes verificadas y pendientes. Director propone lo nuevo con destino/razón y conserva lo ya autorizado en su documento canónico. Graphify, Archify y la publicación a Obsidian están retirados (SDD-0632).

## PR e integración

TASK → WORKTREE → BRANCH → COMMITS → VALIDACIÓN → PR → DIRECTOR REVIEW →
INTEGRACIÓN → MAIN → RELEASE/DEPLOY SEGÚN POLÍTICA → CLEANUP.

Publicación autorizada del Worker: `git push -u origin <rama>:<rama>`, sin
destino main. `gh pr create --base main --head <rama> --draft --body-file <archivo>`
para revisión parcial; conserva base distinta cuando se asignó explícitamente.
Revisa el efecto de push en CI/previews del proveedor; no ejecutes deploy manual.

**El CI corre al marcar la PR lista para revisión** (SDD-0621). En borrador,
«Calidad continua» (`quality.yml`) y los cargadores Kommo y portal no corren:
el job sale `skipped` y no gasta minutos, así que el Worker puede empujar las
veces que necesite. Cuando el trabajo está terminado y la rama publicada, se
marca con `gh pr ready <numero>`: el evento `ready_for_review` lanza la corrida
sobre la cabeza; cada push posterior la repite. Para volver a iterar sin gastar,
`gh pr ready <numero> --undo`. Un check `skipped` **no es verde** aunque el
ruleset de main lo cuente como aprobado: entre `gh pr ready` y el registro de la
corrida nueva, la PR puede verse fusionable sin CI real. Regla para quien
fusiona: **`success`, no `skipped`, del check requerido, en una corrida
`pull_request` sobre la cabeza exacta**. Manda la corrida **más reciente** de
`pull_request` de `quality.yml` sobre esa cabeza:

```bash
gh api "repos/SoftAgentes/DTDCARGO/actions/workflows/quality.yml/runs?head_sha=<sha>&event=pull_request" --jq '.workflow_runs | max_by(.id) | [.status, .conclusion, .check_suite_id] | @tsv'
```

Vale solo `completed` + `success`. `<sha>` va completo, de 40 caracteres
(`git rev-parse <rama>`): con un SHA corto la API no encuentra corridas y el
comando imprime dos tabuladores vacíos y sale con 0. Si una `success` vino
antes de una `failure`, `cancelled` o `skipped`, manda la última. El filtro
`event=pull_request` deja fuera una corrida manual (`gh workflow run`) sobre la
misma cabeza. No sirve leer `commits/<sha>/check-runs`: cada corrida es una
check suite distinta y trae una fila por corrida (el `skipped` del borrador y
la posterior). **Tampoco basta `gh pr checks`**: muestra el `skipped` como
«skipping» y sale con 0.

**Marca la PR lista después de que aparezca la corrida del push, o espera a que
el `skipped` termine.** La concurrencia es por rama: si la corrida del push en
borrador entra a la cola después de la de `ready_for_review`, la cancela y la
cabeza queda sin corrida real (pasó en `3c777e33e`, #482: `skipped` posterior,
`cancelled` la real). La corrida del push apareció cuando el comando de arriba,
sobre la cabeza nueva, devuelve una fila con `check_suite_id`; el `skipped`
terminó cuando esa fila dice `completed` y `skipped`. El mismo comando detecta
la carrera después; el remedio es el de la re-ejecución.

Re-ejecutar una corrida que nació en borrador no rescata el `skipped`: la
re-ejecución usa el evento original, con `draft: true`, y vuelve a saltar. El
remedio es un push nuevo con la PR lista, o `gh pr ready <numero> --undo` y
`gh pr ready <numero>`. Una corrida `skipped` de un borrador no es un rojo: los
vigías no la cuentan como fallo.
`push` a `main` y `workflow_dispatch` corren siempre (para correr el CI de un
borrador a propósito: `gh workflow run quality.yml --ref <rama>`; esa corrida
prueba la rama sola y no reemplaza la de la PR, que prueba su fusión con `main`). El contrato
`scripts/__tests__/ci-workflow-contract.test.mjs` exige los cuatro tipos de
`pull_request` y la condición exacta del job.

Antes del merge, Director inspecciona diff completo, commits ajenos, SDD/allowlist,
criterios, checks efectivos y permisos. Decide orden por dependencias, no edad.
Si hay solapamiento pide actualización al Worker; no escribe en su árbol activo.
Para validar combinación usa worktree descartable propio desde head revisado y
merge origin/main; nunca main local. Si resuelve conflictos, esos cambios vuelven
al PR y se revisan; el resultado probado debe corresponder a lo que se integra.

Antes del merge verifica si main dispara producción automáticamente. Si lo hace,
la autorización debe cubrir ese efecto productivo; permiso solo de merge no basta.
No desactives el pipeline para eludirlo. En esta migración ambos están prohibidos.
Reconsulta head/base/checks/mergeabilidad inmediatamente antes de integrar.
Con autorización concreta y CI/revisión satisfechas puede usar
`gh pr merge <numero> --merge --match-head-commit <SHA-revisado>`.
No `--admin`, force ni `--delete-branch` en el merge. Si la base cambia tras
validar, revalida. Sin protección remota hay una carrera residual entre consulta
y merge: no afirmar garantía técnica; integrar serialmente y verificar el SHA
resultante, o esperar protección/CI si el riesgo requiere exclusión atómica.

Mantén merge commits por defecto para preservar commits revisables y verificar
ancestralidad al limpiar. Squash solo como decisión concreta; su cleanup necesita
comparar equivalencia del cambio porque head no será ancestro. No rebase de ramas
compartidas. El Director no programa producto durante revisión: devuelve correcciones
al Worker.

## Carriles de integración

Aprobados por Sam el 2026-11-20 («Carriles: sí, arranca hoy con los pasos 1 a 3»), a prueba durante una
semana. Antes, toda PR esperaba su turno en un único tren serial: revisión independiente APPROVED más CI verde
sobre la cabeza exacta. Cada PR que entraba dejaba atrasada a la siguiente, que volvía a correr el CI completo.
Ahora hay dos carriles según el riesgo.

### Los dos carriles

- **Carril rápido.** La PR entra con el CI en verde (la corrida `pull_request` de `quality.yml` sobre la cabeza
  exacta, con la regla de siempre: `success`, no `skipped`) y se revisa **después**, en la revisión de
  madrugada. Cubre pantallas que solo leen, textos, estilos, documentos y pruebas.
  No aplica si la PR lleva migraciones, RLS o permisos, facturación, pagos o montos, escrituras de datos
  personales, registro o acceso al portal, o integraciones (correo, Meta, Chatwoot, Kommo).
- **Carril con revisión previa.** Todo lo demás. Sigue la regla de siempre: revisión independiente APPROVED,
  que lanza el Director, más el CI verde en la cabeza exacta, ambas antes de fusionar.

El carril lo decide el clasificador (`scripts/carril.mjs`), no el autor. Una PR que mezcla rutas de los dos
carriles va con revisión previa. Si el autor cree que el clasificador se equivocó, la PR igual va con revisión
previa, y la corrección de la regla es otra PR (que también va con revisión previa: ver abajo).

**Reversión.** Si `main` queda en rojo después de una PR del carril rápido, se revierte con su propia PR,
`git revert -m 1 <merge>` en una rama nueva. Toca las mismas rutas que la PR revertida, así que el clasificador
también la da `rapido`. Primero se revierte y después se investiga. La corrección vuelve como PR nueva, por el carril que le toque.

**Revisión de madrugada.** La lanza el Director a las 2:00 de Caracas sobre todo lo que entró por el carril
rápido en las últimas 24 h (los merges a `main` cuyo carril registrado fue `rapido`). Las correcciones pequeñas
que encuentre van como PR del carril rápido. Lo que pida el otro carril, o una decisión, espera a Sam. De noche
no se publica: lo que se fusione de madrugada sale en la ventana de las 11:00.

**Fusionar y publicar son pasos distintos.** Hoy un push a `main` no publica: el vigilante de la publicación
automática (SDD-0541) está detenido desde el 2026-10-25 y el servidor no tiene crontab. Publicar es un paso
manual del Director (`publicar-web.sh publicar <sha>` en el VPS). Por eso el tren fusiona a cualquier hora, en cuanto la PR cumple su carril.

**Ventanas de publicación.** Rigen solo para publicar: 11:00, 15:00 y 19:00 de Caracas, con OK fijo de Sam
para lo que ya está integrado en `main`. Si el vigilante vuelve a activarse (cada push a `main` publicaría
otra vez), esta regla se revisa antes, porque fusionar volvería a ser publicar. Las migraciones y encender interruptores (feature
flags) en producción siguen pidiendo un OK nominal de Sam, como dice el
[runbook de migraciones](aplicar-migraciones-prod.md). El OK fijo no cubre los smokes que pida una espera
concreta.

**Prueba de una semana.** Del 2026-11-20 al 2026-11-27 se mide:

- el tiempo de cada PR desde que está lista (`ready_for_review`, o la apertura si nació lista) hasta que su SHA
  está en producción (la evidencia de publicación de `publicar-web.sh`), separado por carril;
- las reversiones: cuántas PR del carril rápido hubo que revertir, y por qué;
- los hallazgos de la revisión de madrugada: cuántos, de qué gravedad y cuántos fueron PR de corrección.

El Director registra el carril de cada PR (la salida JSON del clasificador) junto a su merge, para poder medirlo.
Al cerrar la semana, Sam decide si los carriles siguen, cambian o se retiran.

### GitHub no es la barrera

Las reglas de GitHub de «revisor requerido por ruta» (CODEOWNERS con revisión obligatoria) no sirven aquí: todas
las PR salen de la misma cuenta y GitHub no deja aprobar las propias, así que bloquearían todo. **No se proponen
como barrera.** La barrera es el tren del Director con el clasificador. El check «Carril (informativo)»
(`.github/workflows/carril.yml`) solo muestra el carril en cada PR. No es check requerido ni bloquea.

### El clasificador

`scripts/carril.mjs`, en Node y sin dependencias. Es conservador: lo que no reconoce es `revision`, y basta un
archivo `revision` para que lo sea toda la PR. Tiene dos capas, una por ruta y otra por contenido. En este orden:

1. **Reglas fijas por ruta** (siempre `revision`, también para documentos y pruebas que vivan ahí):
   - Base de datos y secretos: `supabase/`, cualquier `.sql`, `lib/db/` y `.env*`.
   - CI e infraestructura: `.github/`, `infra/`, `Dockerfile` y compose, y `scripts/consolidados/`.
   - Registro y acceso: `app/registro/`, `app/entrar/`, `app/invitar/`, `app/acceso/`, `app/abrir/`,
     `app/activar/`, `app/verificar/`, los grupos `(auth)` de `app/`, `lib/auth/`, `proxy.ts` y
     `middleware.ts`.
   - Legal: `lib/studio/legal/`, `lib/legal-public.ts` y las páginas de términos, privacidad y cookies.
   - Fuera y dependencias: `app/api/`, cualquier `route.ts` y `private/`; también las dependencias y la
     configuración global (`package.json`, el lockfile, `next.config`, `eslint.config`, `tsconfig`,
     `vitest.config` y similares).
   - Dos reglas que no alcanzan a las pruebas:
     - Las server actions: `actions.ts`, `*-actions.ts` y `_actions/`.
     - Las **páginas de las zonas con sesión**: `page.tsx` dentro de `app/studio/`, `app/portal/`, `app/m/`,
       `app/back/`, `app/interno/` o `app/admin/`. Suelen llevar las puertas `require*()` y las lecturas con
       `createAdminClient()`.
   - Por último, las reglas mismas: `AGENTS.md` y `CLAUDE.md` en cualquier carpeta, `.agents/` (salvo
     `.agents/handoffs/`), `.claude/`, `.harness/`, `docs/governance/`, `docs/engineering/project-rules.md`,
     este runbook, el de migraciones en producción, el de publicación automática, `scripts/carril.mjs`, sus
     pruebas y el contrato del CI. Así una PR no puede rebajar su propio carril.
2. **Temas sensibles por palabra en la ruta**, solo para código:
   - facturación, pagos, contabilidad, tarifas y montos (`facturacion`, `pagos`, `contabilidad`, `fiscal`,
     `tesoreria`, `nomina`, `tarifas`, `cotizador`, `calculadora`, `bcv`…);
   - permisos y acceso (`auth`, `login`, `permisos`, `roles`, `usuarios`, `admin`, `rbac`, `token`, `legal`,
     `consent`, `cookies`…);
   - datos personales (`clientes`, `perfil`, `profile`, `ficha`, `contacto`, `gps`, `ubicacion`, `tms`,
     `backfill`, `crm`, `lead`, `comment`, `bug`, `borrado`, `purga`, `export`, `import`, `personas`, `empleados`, `direccion`, `attachments`,
     `upload`, `form`, `analytics`, `clarity`…);
   - integraciones (`chatwoot`, `kommo`, `meta`, `whatsapp`, `email`, `mail`, `correo`, `newsletter`,
     `webhooks`, `push`, `notif`, `cron`, `api`, `oficina`, `agent`…).

   La ruta se corta por `/ - _ . ( ) [ ]` y por mayúsculas, así que `WhatsAppFAB.tsx`, `GpsBlock.tsx` o
   `estado-de-cuenta/` caen. La lista exacta está en el script.
3. **Rutas seguras**, candidatas a `rapido`:
   - documentos: `docs/` y `*.md` fuera de las reglas fijas, incluidos los handoffs;
   - texto plano: `.txt` de `app/` o `public/` y diccionarios `.json` de `lib/i18n/`;
   - pruebas: `__tests__/`, `*.test.*`, `*.spec.*` y `scripts/tests/*.node.mjs`. En `e2e/` solo cuentan los
     `*.spec.*`; los ayudantes y los diagnósticos son código;
   - estilos: `.css` y `lib/design-tokens.ts`;
   - pantallas y componentes: `.tsx` de `app/` o `components/`, salvo `layout.tsx` y `template.tsx`;
   - imágenes y fuentes de `public/`, `docs/` y `lib/font-files/`.
4. **Contenido de las pantallas, por archivo y por lo que importan.** Para cada pantalla que llegó hasta aquí,
   el clasificador lee el archivo **completo** en la base (el merge-base) y en la cabeza; con `--pr`, también en
   la versión actual de `origin/main`. Si **cualquiera de esas versiones** trae una de estas marcas, va a
   `revision` (`contenido-sensible`):
   - puertas o sesión: `require*(`, `canAccess*`, `has*Access`, `getStudioAccess`, `isAdmin`, `hasRole`, `can(`,
     `puede*(`, `getUser`, `getSession`, `rbac`, `redirect(`, `notFound(`, `cookies()` y `headers()`;
   - lecturas sin RLS: `createAdminClient` y `service_role`;
   - consultas o escrituras: `.from(`, `.rpc(`, `.insert(`, `.update(`, `.upsert(` y `.delete(`;
   - escrituras por HTTP o por formulario: cualquier `fetch(`, `method:`, `<form … method=`, `action={`,
     `formAction`, `sendBeacon(` y `XMLHttpRequest`;
   - props de acción llamadas con un objeto: `onSave({`, `onSubmit({`, `onDelete…({` y `onConfirm({`;
   - acciones del servidor: `"use server"` y cualquier import cuya ruta lleve `action` (`_actions/`, `/actions`,
     `*-actions`);
   - otras: `@supabase/` y `lib/db` o `@/lib/auth`.

   Además, **los imports con código** de la pantalla (`@/…` y relativos; no los `import type`) se leen en **dos
   niveles**: lo que importa la pantalla y lo que importan esos módulos. Si un módulo importado cae en una regla
   fija o en un tema por su ruta (por ejemplo `lib/studio/accounting/…`, `lib/marca/access.ts` o
   `WhatsAppFAB.tsx`), o si su contenido trae una marca (incluido `"use server"`), la pantalla va a `revision`. Así
   caen la pantalla que llama a `voidExpenseEntriesForExpense` (escribe asientos con service role) y la que usa la
   puerta `hasBrandAccess` con otro nombre. Los módulos de estilos y de textos (`lib/design-tokens.ts`) no cuentan.

   Decidir por archivo cierra el hueco de mirar solo las líneas cambiadas. Quitar `.is("deleted_at", null)` o una
   puerta `canAccessModule(…)` cae en revisión porque la base las tenía, aunque el `.from(` o el import estén en
   otra línea. Como el archivo que importa una acción o un módulo sensible ya va a revisión, también caen sus
   llamadas.

   Se falla cerrado. Da `revision` (`sin-contenido` o `contenido-sensible`) en estos casos:
   - el archivo no se puede leer como texto: un byte NUL, UTF-8 inválido o «Binary files» en el diff;
   - el archivo no aparece ni en la base ni en la cabeza;
   - no se leyó, porque solo se pasaron nombres por argumento o por stdin;
   - un import trae un salto de línea en su ruta;
   - la salida de `git cat-file --batch` no cuadra con lo pedido (eso es un error, código `2`).

   Los documentos, los estilos, el texto plano y las pruebas no se leen.
5. Todo lo demás: `revision` («sin-clasificar»). Esto incluye la lógica de `lib/` (también los diccionarios
   `lib/i18n/**/*.ts`, que son TypeScript ejecutable), los scripts y los ayudantes de `e2e/`.

En el carril rápido quedan los componentes de presentación cuyo archivo y cuyos imports (dos niveles) no traen
ninguna marca ni caen en un tema. Se suman los estilos, el texto plano, los documentos y las pruebas. Al
2026-11-20 son **131 pantallas** del árbol. Antes de leer los imports eran 216, y antes de leer el archivo
completo, 239. Son casi todas tarjetas, tablas, insignias, iconos y bloques de texto. La regla de imports es
conservadora: las páginas públicas que usan `WhatsAppFAB` caen por su ruta («whatsapp», integraciones).

**Límite conocido.** La capa de contenido busca palabras, no entiende el código. No ve estos casos:

- una lectura o escritura que está a **tres niveles o más** de la pantalla (pantalla → módulo → módulo → la
  función que escribe), cuando los dos primeros niveles no traen marca ni caen en un tema;
- un permiso que llega por prop, o un callback que escribe cuando la llamada no le pasa un objeto
  (`onSave(id)`). La escritura vive en el padre, que suele ser una `page.tsx` de una zona con sesión y va a
  revisión, pero un cambio solo en el hijo no.

Esa es la razón de la revisión de madrugada. Las reglas nuevas para tapar un caso así, o para ampliar la lista de
rutas seguras, van en una PR con revisión previa, porque tocan `scripts/carril.mjs`.

Las pruebas viven en `scripts/tests/carril.node.mjs` y corren con `pnpm harness:test` o con
`node --test scripts/tests/carril.node.mjs`. Verifican lo siguiente:

- una ruta de cada frontera sensible da `revision`, incluidas las pantallas que citó la revisión del 2026-11-20
  (`app/studio/(app)/admin/page.tsx`, `app/m/cn/page.tsx`, `PortalBackfillSection.tsx`, `GpsBlock.tsx`,
  `ProfileModal.tsx`, el perfil del portal y los clientes del Studio);
- las pantallas de la segunda revisión dan `revision`: quitar `.is("deleted_at", null)` de `GenerateBLModal.tsx`
  o `canAccessModule(…)` de `CrmEmbudosSlot.tsx` (la base lo tenía), y los imports de `_actions/` de
  `CommentsThread.tsx` y `DeletedCommentsPanel.tsx`;
- cada clase de ruta segura da `rapido` con un archivo de presentación;
- cada marca de contenido da `revision`, y también un `.tsx` binario o un import de un archivo con `"use server"`;
- los casos de la tercera revisión dan `revision`: una pantalla que llama a `voidExpenseEntriesForExpense`
  (`lib/studio/accounting/expense-posting.ts`), la que importa `lib/marca/access.ts` (`hasBrandAccess`), un
  módulo sensible en el segundo nivel y un import con salto de línea; un `import type` no cuenta;
- el contrato de abajo.

### Contrato para el tren del Director

El tren (`tren.sh`) vive fuera del repo y lo cambia el Director. Usa el clasificador así:

```bash
node scripts/carril.mjs --json --pr <N>
```

- **Desde qué copia.** Se corre desde una copia de `origin/main` recién actualizada (`git fetch origin` y el
  script de `origin/main`), nunca desde la cabeza de la PR. Así la PR no decide su carril con su propia versión
  del clasificador. El check de CI hace lo mismo: usa el script de la base.
- **De dónde salen las rutas.** `--pr <N>` lee el diff completo con `gh pr diff <N> --color=never` y toma de
  las cabeceras de cada archivo las dos rutas, la vieja y la nueva. No usa `gh pr diff --name-only`, que en un
  renombre da solo la ruta nueva: un archivo sensible se escondería renombrándolo a una ruta segura. Si GitHub no
  da el diff (por ejemplo, `HTTP 406` en un diff muy grande), es un error y la PR va con revisión previa.
- **Atado a una cabeza.** `--pr` lee la cabeza con `gh pr view <N> --json headRefOid` antes del diff y otra vez
  después. Si cambió en el medio, es un error. El JSON devuelve esa cabeza en `head`. Con `--head <sha>`, además,
  la cabeza tiene que ser esa: si no, es un error.
- **De dónde salen los archivos.** `--pr` trae la cabeza con `git fetch --no-tags origin pull/<N>/head` y calcula
  la base como el merge-base de la cabeza con `origin/main` (otra rama con `--base <ref>`). Lee las pantallas y
  sus imports en tres versiones (la base, la cabeza y `origin/main` tal como está en la copia del tren), con un
  `git cat-file --batch` por vuelta. Por eso se corre en una copia del repo con `origin` recién traído. Si git
  falla, o su salida no cuadra con lo pedido, es un error.
- **Lo que no lee.** Los cambios que lleguen a `main` después de esa lectura no se ven. No hace falta: el tren
  clasifica la cabeza ya actualizada, porque exige que la PR no esté BEHIND de `main`, y fusiona con
  `--match-head-commit`. Si `main` avanza, la PR queda BEHIND, se actualiza y se clasifica otra vez.
- **Otras entradas.** Para consultas:
  - `git diff --no-renames <base> <cabeza> | node scripts/carril.mjs --json --diff --base <base> --head <cabeza>`
    exige que los dos sean commits del repositorio y que el diff de stdin sea exactamente ese `git diff`. Si no,
    es un error. Así lo usa el check de CI, con el merge de prueba como cabeza.
  - `--diff` sin `--base` ni `--head` solo ve nombres.
  - Las rutas solas, por argumento (`node scripts/carril.mjs --json <ruta>...`) o por stdin (una por línea),
    tampoco leen nada, así que una pantalla da `revision`.

  Con stdin vacío o sin rutas, sale con error. **Para el tren solo vale `origen: "pr"`**: un JSON de otra entrada
  no ata la cabeza de la PR y se trata como `revision`.

**Cómo fusiona el tren una PR del carril rápido.** Lo hace en este orden:

1. Corre `node scripts/carril.mjs --json --pr <N>` y lee `head` del JSON.
2. Comprueba el CI de **esa** cabeza con la regla de siempre: la corrida `pull_request` más reciente de
   `quality.yml` sobre `head_sha=<head>`, en `completed` y `success`.
3. Fusiona con `gh pr merge <N> --merge --match-head-commit <head>`. Si llegó un push después de clasificar,
   GitHub rechaza el merge y el tren vuelve al paso 1.
4. Registra el JSON (con `head` y el SHA del merge) junto al merge, para la revisión de madrugada y la medición.

El carril, el CI y el merge van sobre el mismo SHA. Para el carril con revisión previa vale lo mismo: la revisión
APPROVED también tiene que ser de esa cabeza.

**Códigos de salida:**

| Código | Significado | Qué hace el tren |
|---|---|---|
| `0` | `rapido` | puede fusionar la cabeza `head` con el CI verde en esa cabeza, sin esperar la revisión |
| `1` | `revision` | exige revisión independiente APPROVED y CI verde en la cabeza exacta |
| `2` | error (uso, `gh` o `git`, diff sin archivos o distinto del de `--base`/`--head`, cabeza que cambió) o `--help` | lo trata como `revision` |

El tren va por el carril rápido solo si el código es `0` **y** el JSON dice `"carril": "rapido"`, `"origen": "pr"` y
trae un `head` de 40 caracteres. Cualquier otro caso, incluido un código inesperado o un JSON ilegible, va con revisión previa.

**Salida JSON** (`--json`, en stdout; los mensajes de error van además a stderr):

```json
{
  "version": 3,
  "carril": "revision",
  "motivo": "1 de 2 archivos piden revisión previa (contenido-sensible)",
  "total": 2,
  "contenido": true,
  "causantes": [
    { "ruta": "components/Footer.tsx", "regla": "contenido-sensible", "motivo": "el archivo (en la base o en la cabeza) toca puertas, sesión o datos («createAdminClient»)" }
  ],
  "archivos": [
    { "ruta": "docs/a.md", "carril": "rapido", "regla": "documentos", "motivo": "documento" },
    { "ruta": "components/Footer.tsx", "carril": "revision", "regla": "contenido-sensible", "motivo": "el archivo (en la base o en la cabeza) toca puertas, sesión o datos («createAdminClient»)" }
  ],
  "origen": "pr",
  "pr": 123,
  "head": "<sha de 40 caracteres>",
  "base": "<sha del merge-base>"
}
```

- `carril`: `rapido` o `revision`. `motivo`: una frase para el registro.
- `contenido`: `true` si se leyeron los archivos (`--pr`, o `--diff` con `--base` y `--head`) y `false` si solo
  los nombres.
- `causantes`: los archivos que piden revisión, con su `regla` y su `motivo`. Si el carril es `rapido`, viene vacío.
- `archivos`: todos los archivos, cada uno con su carril. `total`: cuántos son, sin repetidos.
- `origen`: `pr`, `diff`, `args` o `stdin`. `pr`: el número, solo con `--pr`. `head` y `base`: la cabeza
  clasificada y la base contra la que se leyó, con `--pr` y con `--diff --base --head`.
- `version`: sube si cambia la forma del JSON (la 2 agregó `head` y `contenido`; la 3, `base` y la lectura por archivo). El tren debe rechazar, y tratar
  como `revision`, una versión que no conoce.
- En error: `{ "version": 3, "carril": "revision", "error": "<qué pasó>" }` y código `2`.

**Cuándo se clasifica.** El carril vale solo para `head`. Un push nuevo a la PR obliga a clasificar otra vez, y el
`--match-head-commit` del merge lo hace cumplir.

## Validación y producción

`pnpm verify` ya incluye build (no repetir sin razón). Reporta SKIPs
individuales. `migrations-applied` consulta ledger real y puede fallar porque
una migración nueva aún no se aplicó: se clasifica pendiente de release, nunca
se aplica para pasar el gate. Pruebas SQL/schema efímeras y revisión sí son
preintegración. Omisiones en checks críticos bloquean aprobación hasta evidencia
o excepción explícita, aunque el proceso salga 0.

El e2e de verify corre con watchdog (SDD-0454). `VERIFY_E2E_IDLE_MIN` minutos
sin salida (10 por defecto) o `VERIFY_E2E_TIMEOUT_MIN` en total (60) terminan
sólo el árbol de procesos del paso y lo reportan FALLÓ con motivo
COLGADO/TIMEOUT, sin reintento. Ya no hace falta cortar ese árbol a mano: cita
la línea `watchdog:` como evidencia y revisa a mano sólo los sobrevivientes que
nombre.

Al 2026-09-05 el workflow «Calidad local sin secretos» se extrae de PR #21
como unidad mínima SDD-0349 sobre main, en la rama local
`codex/ci-quality-extract-20260905`. No se integra el saneamiento completo.
SDD-0444 incorpora esa unidad local y añade `pnpm harness:test` explícito al job:
`pnpm test` ejecuta Vitest, que no descubre los archivos `.node.mjs` del harness.
El contrato del workflow debe fallar si se elimina/condiciona ese paso o se
ignora su fallo; nunca inferir cobertura del harness a partir de Vitest.

La extracción y la combinación necesitan evidencia propia sobre sus SHA locales;
un CI verde histórico de #21 no las valida. La corrida alojada y los required
checks no existen para estas correcciones hasta publicación autorizada.
Checks Vercel/Agent Review/Preview Comments no sustituyen pruebas. Consultar
los resultados por gate y pendientes en los handoffs de SDD-0349 y SDD-0444.

Esto no hace compatibles #21 y #32 completos. Comparten diez rutas de tooling
y documentación. Al integrar #21 después, revisar sus tests que importan
`runWorktreeCommand` (ausente en #32) y los contratos de `finish`: #21 elimina
con comprobaciones, #32 solo informa. No elegir una versión completa de los
archivos para resolverlos. Trasladar a project-rules las correcciones técnicas
de AGENTS de #21 sin restaurar su metodología antigua; validar la nueva combinación.

Pipeline observado: vercel.json usa ignoreCommand sobre HEAD^ HEAD,
excluye docs/** y Markdown de la raíz mediante :(exclude,glob)*.md, pero
comprueba docs/marketing aparte. Markdown en otras subcarpetas sí puede
disparar build. El repo documenta Vercel como
publicador de main; confirma configuración efectiva de proyecto/ambiente antes
de cada release. El SHA servido no se deduce de un HTTP 200 ni de un merge.
La corrección modifica solo el workflow de calidad; no altera el pipeline de
producción, no publica esta revisión, no mergea main y no despliega.

> **Nota del 2026-10-19 · el párrafo anterior es histórico.** Desde el
> 2026-10-16 Vercel está en pausa y sin integración de Git: ya no publica
> `main` y su `ignoreCommand` no decide nada. La web corre en el servidor
> propio y se publica sola con el vigilante (SDD-0541,
> [publicación automática](publicacion-automatica-web.md)): cada push a `main`
> construye su imagen `sha-*`, sin excluir documentación, y `:publicable`
> avanza cuando la imagen y el CI están en verde. Un merge a `main` sigue siendo
> un efecto productivo. La base es el Supabase del mismo servidor desde el
> 2026-10-14 ([migraciones](aplicar-migraciones-prod.md)). En el párrafo de
> abajo, el «ID de deployment READY» se lee como la evidencia de
> `publicar-web.sh` (journal del vigilante y `publicaciones.json`), y el
> redeploy de una versión conocida, como `publicar-web.sh volver` o
> `publicar <sha>`, que corre la sesión de Contabo.
>
> **Nota del 2026-11-20 · el vigilante está detenido.** Desde el 2026-10-25 la
> publicación automática está detenida a propósito: un merge a `main` arma su
> imagen pero no publica, y la web la publica el Director a mano
> (`publicar-web.sh publicar <sha>`). Fusionar y publicar son pasos distintos
> (ver [Carriles de integración](#carriles-de-integración)). Si el vigilante
> vuelve a activarse, esta nota y los carriles se revisan.
> Los documentos fechados que todavía dicen que fusionar publica se quedan como
> están porque son registro histórico: `docs/audits/2026-10-18-contabilidad-anexo-planes.md`,
> `docs/specs/0586-chatwoot-enrutamiento-segmento-e10/spec.md`,
> `docs/specs/0589-guia-motor-studio/spec.md` y la nota del 2026-10-19 de arriba.
> Los avisos de `infra/ops/web/publicar-web.sh` sobre el próximo merge dicen desde
> el 2026-11-20 que valen solo con el vigilante encendido.

Release requiere evidencia: autorización, PR/SHA integrado, checks aplicables,
migraciones por nombre y una por vez según runbook, ID de deployment READY y
SHA correcto, smoke test y plan de rollback. Si una migración debe preceder al
código, coordina la ventana migrate-first con autorización específica; PR y
pruebas efímeras ya revisadas antes de tocar DB. No generalices el rollback SQL:
hay que evaluar compatibilidad. El único ejemplo encontrado es
`docs/runbooks/deploy-orden-venta-0072.md`; no hay rollback global probado.
Preparar revert por PR o redeploy aprobado de versión conocida según el caso.

Recomendaciones GitHub (no activadas):
PR obligatoria; impedir push directo/force/delete main; revisión y conversaciones
resueltas; invalidar aprobación con nuevos commits; checks requeridos por SHA.
Primero revisar/publicar con autorización la extracción mínima SDD-0349 y la
combinación SDD-0444 con harness:test; decidir SQL/E2E por alcance. Después
activar el nombre real `Calidad local sin secretos` más checks aplicables,
sin inventar un check inexistente. Separar credenciales Worker sin admin de
integración. CODEOWNERS para harness/gobernanza/DB solo con responsables reales.
Mantener auto-delete apagado mientras haya worktrees activos; revaluarlo tras
adopción. Merge queue solo si volumen/plan GitHub lo justifican y CI soporta
merge_group; ahora no está verificada esa capacidad ni es necesaria para arrancar.

## Cleanup

`harness-worktree finish` solo informa: no elimina. Resuelve el candidato contra
`git worktree list`, así que cubre tanto `DTD-worktrees/<slug>` como los worktrees
que crea la app de Claude Code en `<checkout>/.claude/worktrees/<nombre>`; sin
argumento informa sobre el worktree desde donde se corre, y el checkout principal
nunca es candidato (SDD-0458). Director limpia únicamente tras solicitud de
limpieza o autorización concreta de cierre con cleanup:

1. Identificar ruta absoluta registrada, branch, HEAD y owner/sesiones/procesos.
   Excluir checkout principal, su propio cwd y worktrees preexistentes protegidos
   por el encargo de migración.
2. Confirmar tarea terminada, PR MERGED (base correcta), cambios preservados
   remotamente y origin/main actualizado. Verificar ancestralidad del HEAD o,
   si hubo squash, equivalencia revisada y documentada; sin certeza, conservar.
3. Status completo limpio, incluidos untracked. Revisar también archivos
   ignorados importantes sin imprimir secretos: un .env o datos locales puede
   requerir preservación. Nada de `clean -fdx`.
4. Verificar con herramienta de tareas/owner que nadie depende del árbol,
   incluso sesiones en espera y servidores. Si no es posible, preguntar por
   esa sesión concreta; silencio/antigüedad no autoriza. Claim debe estar liberado.
5. Revalidar ruta dentro del contenedor acordado (o ruta explícitamente
   autorizada), rama, HEAD, estado y registro inmediatamente antes de
   `git worktree remove "<ruta-absoluta>"`, sin force ni fallback recursivo.
   Si falla, conservar y diagnosticar; no prune global ni robocopy /MIR.
6. Rama local: `git branch -d <rama>` solo con comprobaciones anteriores.
   Si no acepta, no usar -D. Rama remota solo por autorización y verificación
   adicional de consumidores; no activarlo automáticamente al merge.
7. Archivar tarea Codex con herramienta disponible tras confirmar finalización;
   CLI instalada incluye `codex archive` (consultar su help para argumentos).
   Si no se puede, indicar título/ID exactos para cerrar manualmente.
   Reportar lo eliminado, conservado y motivo.

## Adopción sin interrumpir trabajo activo

Este harness vive primero en una rama/PR. Hasta su integración no está en main
ni cambia instrucciones de sesiones ya abiertas. No copies AGENTS encima de
cambios locales. Para probar ahora abre la ruta de esta rama con Codex.

Después del merge autorizado, cada Worker antiguo adopta al retomar: guardar
estado propio, leer nuevas reglas, mantener branch/worktree y crear su handoff/PR.
Nada de reset, mover cambios, forzar rebase o borrar trabajo para «normalizar».
Los wrappers Claude versionados apuntan a las skills; comandos locales externos
como avivar/Forja no se reescriben globalmente y no pueden autorizar push main.

La protección basada en instrucciones/claims es cooperativa. Sin ruleset remoto
y credenciales separadas no existe barrera absoluta contra push directo.
