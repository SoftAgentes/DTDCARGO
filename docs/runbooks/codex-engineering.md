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
