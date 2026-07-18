---
name: forge-kanban
description: "Control plane portable para proyectos con muchas tareas, con o sin Forge: después de /avivar o forge-kanban start clasifica tickets por dominio, riesgo y artefacto; selecciona constructor, revisor, clase de modelo, Yunque/Forja, gate y evidencia; con advance ejecuta de forma controlada los tickets aprobados; coordina backlog, worktrees, commits atómicos/selectivos, integración y limpieza fail-closed."
---

# Forge Kanban

## Propósito

Transformar Specs o Blueprints aprobados en tickets ejecutables sin dejar
decisiones al agente constructor. Forge Kanban es un control plane: clasifica y
enruta; no copia la lógica de los skills especializados. La spec define el
alcance, el shard conserva decisiones de ejecución y `KANBAN.md`, dashboard y
bitácora son vistas operativas controladas.

## Metodología: AVIVAR/START → CLASIFICAR → ENRUTAR → FORJAR → VERIFICAR → CERRAR

1. **AVIVAR/START:** consumir el preflight de `/avivar` en Forge o ejecutar
   `forge-kanban start` en modo standalone: identidad, memoria, specs,
   tickets, ventanas, worktrees, Git, gates y restricciones. No repetir
   exploración que siga vigente.
2. **CLASIFICAR:** identificar artefacto, dominio, riesgo, dependencias y rutas
   propias/compartidas/prohibidas.
3. **ENRUTAR:** elegir un skill constructor y otro revisor, modelo con razón,
   Yunque/Forja, gate y evidencia. Si falta un skill, bloquear o crear uno con
   `skill-creator`; nunca improvisar una especialidad.
4. **FORJAR:** ejecutar sólo tickets preparados. Yunque maneja trabajo acoplado;
   La Forja crea workers aislados para rutas disjuntas.
5. **VERIFICAR:** el revisor independiente evalúa el artefacto; el gate produce
   evidencia proporcional al riesgo. Sin evidencia, no hay cierre.
6. **CERRAR:** `source-command-cerrar` demuestra propiedad, crea commit atómico
   con staging selectivo, publica, entrega handoff e integra. El integrador
   exclusivo limpia worktrees sólo cuando es demostrablemente seguro.

Leer `references/methodology.md` antes de planificar la primera tarea de una
sesión. Consultar `references/capability-router.yaml` para seleccionar skills;
si el proyecto registra una capacidad adicional, extender el registro sin
inflar este archivo.

Después de `/avivar`, ejecutar `forge-kanban status` para el resumen y
`forge-kanban features` para el inventario accionable. `forge-kanban reconcile`
genera dos vistas del mismo análisis: Markdown auditable y dashboard HTML.
`forge-kanban propose` genera propuestas estables con routing, pero nunca crea
tickets ni cambia el backlog sin aprobación explícita. El único flujo de alta
es `propose → approve <ID> --by <persona> --reason <razón> → apply <ID>`.
La aprobación queda ligada al hash de la spec y al commit base; `apply` bloquea
deriva, decisiones humanas, contratos incompletos y duplicados.

## Modo `advance`

`forge-kanban advance [TICKET] --json` selecciona el siguiente ticket ejecutable
y emite un paquete determinista. Sólo selecciona tickets v3 materializados por
`approve → apply`, con dependencias terminadas, routing declarado, rutas propias,
gate, evidencia y cierre atómico/selectivo. Prioriza rojo, amarillo, negro,
verde y nice-to-have; dentro de una prioridad termina primero `review`, `qa` y
`dev` antes de abrir trabajo nuevo.

El script no invoca un LLM ni simula construcción. La capa agente consume el
paquete y ejecuta este loop después de un `GO` humano vigente:

1. Ejecutar el preflight de `source-command-cerrar` antes de la primera
   escritura y aislar el checkout si otra tarea lo comparte.
2. Ejecutar el preflight del arnés y el snapshot inicial.
3. Leer únicamente el contexto y los skills constructor/revisor declarados.
4. Construir con Yunque o La Forja respetando `owned_paths`, `shared_paths` y
   `forbidden_paths`.
5. Ejecutar revisor, gate y evidencia; luego snapshots finales y reporte.
6. Actualizar el ticket por `planning/dev/qa/review/done`; `done` sólo después
   de gate y evidencia verdes. Aplicar el protocolo de cierre: commit atómico, staging selectivo, push de la
   rama worker y handoff. El integrador exclusivo integra y limpia.
7. Volver a ejecutar `advance --json` y continuar mientras existan tickets
   elegibles y el usuario haya autorizado avanzar por toda la cola.

Detener el loop ante decisiones humanas, contratos incompletos, dependencias,
secretos, infraestructura online, migraciones alojadas, producción, conflicto
de propiedad o evidencia insuficiente. `advance` nunca convierte una feature en
ticket: si devuelve `prepare_tickets`, ejecutar `propose → approve → apply`.
Mantener una sola sesión coordinadora de `advance` por repositorio; otras
ventanas trabajan únicamente los tickets/worktrees que esa coordinadora asignó.

**Al invocar Forge Kanban, la salida principal es obligatoria:** ejecutar
`doctor --json`; si está sano, ejecutar `board` y presentar su tabla completa en
la respuesta. No detenerse en conteos de `status` ni en la lista resumida de
`features`. `board` unifica tickets abiertos y features pendientes, deduplica
las cubiertas por tickets y genera `execution-board.md`, `.json` y `.html`.
Debe mostrar prioridad, qué se construye, dominio, Yunque/Forja, constructor,
revisor, uso de LLM, modelo, metodología, gate y situación. Un routing inferido
se muestra como **sugerido** y queda ⚫ hasta confirmación humana.

Semáforo de features (no confundir con prioridad del ticket):

- 🔴 bloqueo o contradicción que requiere acción.
- 🟡 feature parcial, pendiente o terminada sin evidencia suficiente.
- ⚫ evidencia ambigua: revisión humana, nunca ticket automático.
- 🟢 completa mediante estado explícito o tickets enlazados terminados.
- ⚪ futura o fuera de alcance: visible, pero no accionable.

Para specs nuevas usar el contrato de `references/feature-schema.md`, que
separa alcance, implementación y verificación. Una implementación sólo queda
verde cuando las rutas declaradas de código, tests y migraciones existen.
`scope_status: complete` por sí solo significa “diseño cerrado”, no “construido”.

## Inicialización del proyecto

Resolver primero el directorio de la skill. La copia local es preferida y la
instalación global permite usarla al cambiar de proyecto:

```powershell
$FORGE_KANBAN = @(
  '.agents\skills\forge-kanban',
  (Join-Path $HOME '.claude\skills\forge-kanban'),
  (Join-Path $HOME '.codex\skills\forge-kanban')
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $FORGE_KANBAN) { throw 'Forge Kanban no está instalado.' }
$FORGE_KANBAN = (Resolve-Path $FORGE_KANBAN).Path
node "$FORGE_KANBAN\scripts\init-project.mjs"
```

Para fijar un nombre comercial distinto de la carpeta:

```powershell
node "$FORGE_KANBAN\scripts\init-project.mjs" --display-name "Atlas"
```

La identidad se resuelve así:

1. `.codex/project.json` → `displayName`.
2. Nombre de la carpeta del repositorio principal.
3. Los worktrees heredan el nombre del repositorio principal, no su sufijo.

El título visible es `Bitácora <Nombre>` y el archivo usa slug seguro:
`docs/bitacora-<slug>.html`. Si existe otra bitácora que no coincide con la
identidad resuelta, detenerse; nunca crear una bitácora paralela.

## Prioridades

| Valor | Etiqueta | Criterio |
|---|---|---|
| `red` | 🔴 Rojo | Bloquea seguridad, datos, producción, dependencias críticas o entrega inmediata. |
| `yellow` | 🟡 Amarillo | Obligatorio para el alcance, pero no bloquea el carril crítico actual. |
| `green` | 🟢 Verde | Mejora útil, de bajo riesgo y no bloqueante. |
| `nice_to_have` | ✨ Nice to have | Opcional y fuera de los criterios mínimos de lanzamiento. |

Cada ticket v2 incluye `priority_reason`. No seleccionar un `nice_to_have`
mientras exista un rojo elegible, salvo que corra en Forja, esté completamente
aislado y no consuma el carril crítico.

## Model router

| Clase lógica | Usar para |
|---|---|
| `sol` | Arquitectura, seguridad, datos críticos y decisiones difíciles. |
| `terra` | Construcción habitual de frontend, backend e integración conocida. |
| `luna` | Documentación, contenido y verificaciones mecánicas. |

Resolver `model` y `reasoning_effort` desde `.forge/forge-kanban.yml`; no
hardcodearlos ni inferirlos. `reasoning_effort: null` es válido cuando el
provider no admite ese parámetro. `model_reason` siempre explica la decisión.

## Yunque o Forja

- **Yunque:** tarea secuencial, migración, archivo compartido, integración o
  dependencia estricta.
- **Forja:** tarea independiente, rutas disjuntas, contrato cerrado y worktree
  propio.

No usar Forja para acelerar tareas acopladas. El paralelismo se decide por
fronteras de archivos y datos, no por tamaño.

## Contrato del ticket v3

```yaml
schema_version: 3
id: T-000
kind: story
title: "Título accionable"
pts: 8
priority: red
priority_reason: "Bloquea la frontera pública de datos"
status: backlog
complexity: critical
model_class: sol
model: <resuelto-desde-config>
model_reason: "RLS y exposición internet-facing"
task_effort: 8
reasoning_effort: high
build_method: yunque
build_method_reason: "Toca rutas compartidas"
commit_strategy: atomic_selective
```

Campos adicionales recomendados: `depends_on`, `gate`, `epic`, `sprint`,
`blocked`, `created`, `updated`, `spec_ref`, `domain`, `artifact_type`,
`risk_tags`, `builder_skills`, `review_skills`, `required_context`,
`owned_paths`, `shared_paths`, `forbidden_paths` y `evidence`.

Un ticket no pasa de `planning` a `dev` hasta declarar: referencia de alcance,
constructor, revisor, gate, evidencia, propiedad de rutas y criterios de éxito.
Constructor y revisor deben ser distintos cuando exista un skill independiente
aplicable. Los campos multivalor usan listas separadas por coma en el formato
flat actual del backlog.

Los tickets sin `schema_version: 2` son legacy: continúan renderizando y se
migran sólo cuando sean editados. No inventar razones faltantes; mostrar
`n/a (legacy)`.

## Tabla obligatoria

La vista generada incluye:

| Prioridad | Preparación | Tipo | ID | Qué se construye | Dominio | Motor | Agente/skill | Revisor | LLM | Modelo | Metodología | Gate | Situación |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

Ordenar primero por prioridad: rojo, amarillo, negro/por definir, verde y nice
to have; después por ID. No editar `KANBAN.md` ni el execution board a mano:
regenerar con sus motores.

## Ejecución y cierre

1. Construir únicamente tickets con criterios de aceptación completos.
2. Capturar el snapshot inicial antes de editar:

```powershell
node "$FORGE_KANBAN\scripts\forge-kanban.mjs" snapshot T-000 start
```

3. Mantener cada worker en worktree y rama propios.
4. Ejecutar el gate indicado por el ticket.
5. Crear un commit con una sola intención y staging explícito. Todo commit es
   atómico y selectivo; `atomic_selective` es el único valor v2.
6. Capturar el snapshot final y calcular el reporte:

```powershell
node "$FORGE_KANBAN\scripts\forge-kanban.mjs" snapshot T-000 end
node "$FORGE_KANBAN\scripts\forge-kanban.mjs" report T-000
node "$FORGE_KANBAN\scripts\forge-kanban.mjs" advance --json
```

7. Invocar `source-command-cerrar` al terminar.
8. El worker registra evidencia, tiempo y tokens medidos en su ticket/handoff.
9. Sólo el integrador exclusivo regenera Kanban, agrega handoffs, escribe la
   bitácora, ejecuta el gate final y publica `main`.
10. Después de integrar y publicar, el integrador limpia cada worktree terminado
    mediante el protocolo de `source-command-cerrar`; también verifica que la
    carpeta física desapareció y ejecuta `git worktree prune`.

Un worktree nunca se elimina desde el worker que lo está usando ni mientras otra
ventana tenga ese `cwd`. Si hay duda sobre una ventana activa, cambios locales,
push, integración o propiedad de archivos, conservar el worktree y marcar la
limpieza como bloqueada. La incertidumbre prohíbe borrar; no lo autoriza.

Si una plataforma no expone tiempo o tokens, registrar `n/a`; nunca estimarlos
como si fueran medición.

## Verificación

```powershell
node .agents/skills/forge-kanban/test-forge-kanban.mjs
node .agents/skills/forge-kanban/test-advance.mjs
node .agents/skills/backlog/backlog.mjs build
node scripts/bitacora-metrics.mjs --json
```

En un proyecto sin adaptador local, ejecutar las métricas portables con:

```powershell
node "$FORGE_KANBAN\scripts\bitacora-metrics.mjs" --json
node "$FORGE_KANBAN\scripts\bitacora-metrics.mjs" --write
```

No aplicar migraciones, desplegar producción ni modificar servicios alojados
como parte de esta metodología.

El arnés universal es deliberadamente un **asesor fail-closed**: inspecciona,
planifica el cierre y bloquea ante evidencia incompleta. La eliminación efectiva
queda en manos del integrador de plataforma con un recibo auditable.

## Referencias

- `references/usage-manual.md`: manual para sesiones nuevas, proyectos
  avanzados, proyectos Forge y proyectos standalone.

- `references/ticket-schema.md`: contrato v2 y compatibilidad legacy.
- `references/feature-schema.md`: contrato de feature y evidencia verificable.
- `references/methodology.md`: ciclo operativo y gates de preparación.
- `references/capability-router.yaml`: registro declarativo de constructores,
  revisores, método y evidencia por dominio.
