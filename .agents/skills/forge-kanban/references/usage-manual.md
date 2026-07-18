# Manual de uso — Skill Plugin Kanban

## Qué resuelve

Forge Kanban es el control plane que convierte el estado real de un proyecto en
un inventario visual, rutas de ejecución y propuestas auditables. No sustituye
los skills especialistas: selecciona constructor, revisor, gate, modelo y método
de construcción para cada tarea.

La secuencia oficial es:

`AVIVAR/START → CLASIFICAR → ENRUTAR → FORJAR → VERIFICAR → CERRAR`

`/avivar` recupera contexto. Forge Kanban analiza qué existe, qué falta, qué está
bloqueado y cómo debe construirse. Ninguno autoriza por sí solo cambios de
producción, creación de tickets o eliminación de worktrees.

## Semáforo visual

| Estado | Significado | Acción |
|---|---|---|
| 🔴 | Bloqueo o contradicción | Resolver antes de construir |
| 🟡 | Parcial, pendiente o sin evidencia suficiente | Preparar o verificar |
| ⚫ | Ambiguo o requiere decisión humana | Revisar; nunca automatizar |
| 🟢 | Implementado y verificado con evidencia | Conservar y no reconstruir |
| ⚪ | Futuro o fuera del alcance vigente | Mostrar, pero no crear ticket |

Estos colores describen el estado de una feature. La prioridad de un ticket es
otro campo y debe incluir su propia razón.

## Comandos principales

Desde PowerShell, primero resuelve la instalación disponible:

```powershell
$FORGE_KANBAN = @(
  '.agents\skills\forge-kanban',
  (Join-Path $HOME '.claude\skills\forge-kanban'),
  (Join-Path $HOME '.codex\skills\forge-kanban')
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $FORGE_KANBAN) { throw 'Forge Kanban no está instalado.' }
$FORGE_KANBAN = (Resolve-Path $FORGE_KANBAN).Path
```

Luego usa:

```powershell
node "$FORGE_KANBAN\scripts\forge-kanban.mjs" doctor
node "$FORGE_KANBAN\scripts\forge-kanban.mjs" start
node "$FORGE_KANBAN\scripts\forge-kanban.mjs" status
node "$FORGE_KANBAN\scripts\forge-kanban.mjs" board
node "$FORGE_KANBAN\scripts\forge-kanban.mjs" advance --json
node "$FORGE_KANBAN\scripts\forge-kanban.mjs" features
node "$FORGE_KANBAN\scripts\forge-kanban.mjs" reconcile
node "$FORGE_KANBAN\scripts\forge-kanban.mjs" propose
node "$FORGE_KANBAN\scripts\forge-kanban.mjs" approve FKP-XXXXXXXX --by "Nombre" --reason "Alcance validado"
node "$FORGE_KANBAN\scripts\forge-kanban.mjs" apply FKP-XXXXXXXX
```

- `doctor`: valida instalación, configuración y capacidades.
- `start`: inicializa o adopta el proyecto sin exigir Forge.
- `status`: resume backlog, Git, worktrees y bloqueos.
- `board`: presenta la tabla principal de ejecución y genera Markdown, JSON y
  dashboard HTML con prioridad, motor, agentes, LLM, modelo, metodología y gate.
- `advance`: selecciona el siguiente ticket v3 aprobado y emite el paquete que
  la IA debe construir, revisar, verificar y cerrar antes de volver a consultar.
- `features`: muestra el inventario completo con semáforo.
- `reconcile`: genera reporte Markdown y dashboard HTML auditables.
- `propose`: genera propuestas estables; no crea tickets.
- `approve`: registra una autorización humana nominativa y auditable.
- `apply`: materializa únicamente la propuesta aprobada como ticket v3.

## Escenario 1 — proyecto avanzado

### Sesión nueva

1. Abre el repositorio correcto.
2. Si el proyecto tiene Forge, ejecuta `/avivar`.
3. Invoca `/forge-kanban`: debe ejecutar `doctor` y `board` automáticamente y
   mostrar la tabla completa. `status` y `features` son vistas auxiliares.
4. Revisa primero rojos y negros; después amarillos.
5. Ejecuta `reconcile` sólo cuando quieras regenerar los reportes persistentes.
6. Ejecuta `propose` sólo para preparar candidatos a tickets.
7. Usa `approve` únicamente sobre una propuesta elegible y revisada.
8. Usa `apply` para crear exactamente ese ticket; repetirlo no lo duplica.
9. Aprueba explícitamente alcance y Blueprint antes de construir.

### Adopción de un proyecto ya avanzado

Usa `start` o `adopt`. El motor debe descubrir código, specs, tickets, pruebas,
migraciones, ramas y worktrees existentes antes de proponer trabajo. Para cada
feature nueva o modificada, usa el contrato de `feature-schema.md`, separando:

- alcance o diseño;
- implementación;
- verificación;
- evidencia real;
- decisiones humanas;
- trabajo futuro.

No reconstruyas una feature verde. No interpretes `spec completa` como
`implementación completa`. Si no existe evidencia verificable, permanece
amarilla o roja según la contradicción encontrada.

## Escenario 2 — proyecto nuevo de Forge

1. Ejecuta el flujo normal de Forge: `/plan` → Blueprint aprobado →
   `/forge-init`.
2. Inicializa Forge Kanban:

```powershell
node "$FORGE_KANBAN\scripts\init-project.mjs"
```

3. Si el nombre comercial difiere del nombre de carpeta:

```powershell
node "$FORGE_KANBAN\scripts\init-project.mjs" --display-name "Nombre comercial"
```

4. Registra las features del Blueprint con el contrato v1.
5. Ejecuta `doctor`, `features` y `reconcile`.
6. Usa `propose`; revisa, ejecuta `approve` y sólo después `apply`.
7. Elige Yunque para rutas compartidas y Forja únicamente para rutas disjuntas.

Forge aporta la estructura y `/avivar`; Forge Kanban aporta clasificación,
routing, evidencia, coordinación Git y cierre seguro.

## Escenario 3 — proyecto sin Forge

No necesitas `/avivar`. Instala Forge Kanban globalmente en
`~/.codex/skills/forge-kanban` o `~/.claude/skills/forge-kanban`, abre la raíz del
repositorio y ejecuta `start`. El motor crea únicamente su configuración y sus
artefactos operativos; no convierte el proyecto al stack Forge ni reestructura
el código.

Flujo mínimo:

```powershell
node "$FORGE_KANBAN\scripts\forge-kanban.mjs" start
node "$FORGE_KANBAN\scripts\forge-kanban.mjs" doctor
node "$FORGE_KANBAN\scripts\forge-kanban.mjs" features
node "$FORGE_KANBAN\scripts\forge-kanban.mjs" reconcile
```

Si el proyecto no tiene specs compatibles, configura sus raíces y nombres de
archivo en `.forge/forge-kanban.yml`. Las capacidades no declaradas quedan
bloqueadas; el router no debe inventar skills ni modelos.

## Construcción de una tarea

1. La propuesta debe convertirse en ticket sólo mediante `approve → apply`.
2. El ticket declara alcance, rutas propias/compartidas/prohibidas, constructor,
   revisor, gate, evidencia y criterios de éxito.
3. Antes de editar:

```powershell
node "$FORGE_KANBAN\scripts\forge-kanban.mjs" snapshot T-000 start
```

4. Construye en Yunque o en un worktree aislado de Forja.
5. Ejecuta el gate y guarda evidencia.
6. Haz staging selectivo y un commit atómico de una sola intención.
7. Al terminar:

```powershell
node "$FORGE_KANBAN\scripts\forge-kanban.mjs" snapshot T-000 end
node "$FORGE_KANBAN\scripts\forge-kanban.mjs" report T-000
```

8. Invoca `source-command-cerrar` o el integrador equivalente.

## Avance autónomo controlado

Después de revisar el board, el usuario puede autorizar toda la cola elegible
con `GO` y pedir `/forge-kanban advance`. La capa agente debe:

1. Ejecutar `advance --json` y detenerse si devuelve `blocked` o
   `prepare_tickets`.
2. Mostrar el ticket seleccionado y reutilizar el `GO` sólo dentro del alcance
   expresamente autorizado.
3. Ejecutar preflight, snapshot, constructor, revisor, gate, evidencia, cierre
   atómico/selectivo y handoff.
4. Actualizar el ticket hasta `done` únicamente después del gate y guardar la
   evidencia; de lo contrario el selector lo conservará pendiente.
5. Volver a ejecutar `advance --json` después de cerrar el ticket.
6. Terminar cuando devuelva `complete` o aparezca un bloqueo humano/técnico.

Debe existir una sola sesión coordinadora de `advance` por repositorio. Los
workers no ejecutan su propio selector global; reciben un ticket asignado.

`advance` no autoriza producción, secretos, infraestructura online ni
migraciones alojadas. Tampoco ejecuta el LLM desde Node: el script selecciona y
valida; Codex, Claude u otro agente compatible consume el paquete.

## Worktrees y varias ventanas

- Cada worker usa su propia rama y worktree.
- Un worker nunca publica `main` ni integra trabajo ajeno.
- Sólo el integrador exclusivo regenera vistas, ejecuta el gate final, integra y
  publica `main`.
- No elimines un worktree desde la ventana que lo está usando.
- Respeta siempre `locked` y `prunable` de `git worktree list --porcelain`.
- En Windows, un lock de Claude sólo cuenta si su PID está vivo y el puerto
  coincide con su propietario.
- Una terminal abierta dentro del worktree puede ser indetectable. Ante duda,
  la limpieza queda bloqueada.
- Después de integración y push confirmados, el integrador elimina el worktree,
  verifica que la carpeta física desapareció y ejecuta `git worktree prune`.
- Cualquier override debe ser explícito, auditable y realizado por el
  integrador; la incertidumbre nunca autoriza borrar.

## Prohibido

- Crear código sin Blueprint o alcance aprobado.
- Crear tickets automáticamente desde evidencia ambigua.
- Editar `KANBAN.md`, el dashboard o la bitácora como fuentes de verdad.
- Declarar una feature verde sólo porque su spec dice `done`.
- Hardcodear modelos, proveedores o paths de un proyecto específico en el
  núcleo portable.
- Mezclar archivos de otras ventanas en un commit.
- Usar staging global cuando el worktree contiene cambios ajenos.
- Hacer merge, push a `main`, deploy o migraciones alojadas sin autorización.
- Borrar ramas no fusionadas, worktrees con cambios o carpetas cuyo uso no se
  pudo descartar.
- Prometer detección total de sesiones en Windows.

## No recomendado

- Usar Forja sólo porque una tarea es grande.
- Duplicar specs en shards autónomos; la spec conserva alcance y el ticket
  conserva decisiones de ejecución.
- Mantener una copia local y una Personal divergentes. La copia local tiene
  precedencia; actualízalas desde el mismo núcleo canónico.
- Ejecutar `reconcile` en cada consulta: `features` basta para lectura rápida.
- Convertir todo el backlog histórico de una vez. Migra el contrato cuando una
  feature vuelva a tocarse.

## Por qué pueden aparecer dos skills

La interfaz puede mostrar una copia `Personal` y otra del proyecto. No son dos
motores ejecutándose: son dos ámbitos de instalación con el mismo nombre. La
copia del proyecto tiene precedencia dentro de ese repositorio; la Personal
permite usar el skill en cualquier carpeta. Deben conservar la misma versión o
mantener sólo el ámbito que corresponda.

## Criterio de cierre

Una tarea sólo está cerrada cuando existen: gate verde, evidencia guardada,
commit atómico/selectivo, push confirmado, integración demostrada, handoff y
limpieza segura. Si cualquiera falta, el estado correcto es pendiente o
bloqueado, nunca “terminado”.
