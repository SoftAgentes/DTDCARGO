# Handoff — SDD-0502 · mínimo facturable con batería configurable

Fecha: 2026-09-23. Estado de tarea: `lista-para-revision`.

- **Owner / sesión escritora:** `01a0cf85-0b0a-7a53-8817-e6cef69a8297` (Worker Codex).
- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/calculadora-minimo-bateria-config`.
- **Rama:** `codex/calculadora-minimo-bateria-config`.
- **Base:** `origin/main` en `e9b7c4f43406a00d11068e032f07660e0391e821` después de `git fetch origin`.
- **SDD:** `docs/specs/0502-minimo-bateria-configurable/spec.md`, reservada antes de editar producto.
- **Estado SDD:** `in-progress`. La implementación Worker está lista para revisión, pero la SDD no se marca `done` antes de la integración a `main`; el estado de tarea y el estado SDD son independientes según el runbook.
- **Permiso:** Sam autorizó implementar, probar, commitear, publicar la rama y abrir el PR. No autorizó merge, despliegue, migraciones ni cambios de configuración en producción.

## OBJETIVO ORIGINAL

Corregir la calculadora pública para que, cuando la cotización cae por debajo del mínimo y lleva baterías, primero alcance el mínimo facturable y después aplique el multiplicador de batería vigente en Administración. Con piso USD 50, `×1,5` debe producir USD 75 y, si Administración cambia la configuración a `×2`, el mismo caso debe producir USD 100 sin cambiar código ni hardcodear esos totales.

## COMPLETADO

- `lib/calculadora.ts` conserva la aritmética cruda y aplica el orden autorizado: subtotal → piso normal → batería configurable → descuento → protección final únicamente del piso normal.
- El multiplicador sigue entrando por `params.recargoBateriaMult`, alimentado por la configuración de Administración; no se agregó un valor fijo para USD 75, USD 100, `×1,5` ni `×2` en el motor.
- El desglose afectado reconcilia a centavos sin cambiar el total histórico sobre el piso. Ejemplo mínimo visible: USD 8,50 de volumen + USD 41,50 de ajuste + USD 25,00 de batería = USD 75,00.
- `components/CalculadoraForm.tsx` muestra dos decimales sólo cuando son necesarios. No hubo rediseño, cambio de jerarquía ni cambio en `CalculadoraPage.tsx`.
- `__tests__/calculadora.test.ts` cubre mínimo sin batería, batería `×1,5`, batería `×2`, descuentos, bases fraccionarias bajo/sobre el piso y preservación del total histórico.
- `components/CalculadoraForm.minimo-bateria.test.tsx` prueba la reconciliación visible del mínimo con batería.
- `lib/studio/document-import/estimate.test.ts` confirma que el consumidor documental compartido recibe la regla corregida sin duplicar la fórmula.
- Se actualizaron `docs/marketing/README.md`, `docs/marketing/calculadora-explicada.html` y la SDD-0502.
- `graphify update . --force` recorrió el corpus local, reportó dos archivos legales con extracción sintáctica parcial y no detectó cambios de topología. El grafo conservó dos desfases estructurales canónicos ya descritos por el propio runbook.
- Tres subagentes de la misma tarea leyeron lotes no solapados de las 16 fuentes canónicas; no editaron archivos de producto ni operaron como sesiones Worker independientes. Quedaron dos fragmentos canónicos, ignorados y parseables, para 9/16 fuentes: lote A (5 fuentes, 37 nodos, 43 aristas, 1 hyperedge) y lote C —que incluye la regla de SDD-0502— (4 fuentes, 54 nodos, 62 aristas, 3 hyperedges). El lote B de 7 fuentes no logró materializarse tras reintento y fue interrumpido; no se afirma 16/16.

## VALIDACIÓN

- **PASÓ:** pruebas focales — 3 archivos, 103 pruebas.
- **PASÓ:** matriz relevante — 16 archivos, 216 pruebas.
- **PASÓ:** ESLint focal sobre los archivos TypeScript/TSX cambiados.
- **PASÓ:** typecheck.
- **PASÓ:** `pnpm docs:check` — 488 specs.
- **PASÓ:** `pnpm sdd:check`.
- **PASÓ:** inspección manual por Webpack en `/tarifas`, desktop `1440×1000` y móvil `390×844`: USD 8,50 + USD 41,50 + USD 25 = USD 75, sin overflow.
- **FALLÓ (ambiental / Turbopack no disponible para esta prueba):** el servidor local con Turbopack no resolvió `@vercel/turbopack-next/internal/font/google/font`. Se reinició la misma rama con Webpack, sin alterar dependencias ni configuración, y allí pasó la prueba visual.
- **NO DISPONIBLE en la consola local:** faltaban `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`; la calculadora usó su respaldo `×1,5`. Esto no prueba una lectura real de configuración productiva. La prueba automatizada demuestra que el motor también respeta `×2` cuando ese valor es inyectado.
- **PASÓ CON CIERRE INCOMPLETO:** `pnpm verify` terminó con exit 0 y 14/17 pasos medidos pasaron. Vitest: 655 archivos, 8.912 pruebas pasaron y 1 quedó omitida. E2E: 167 pasaron, 18 omitidas y 1 flaky pasó al reintento; el watchdog forzó el cierre de un proceso WebKit en Windows después de 300.000 ms. El build de producción pasó.
- **NO EJECUTADO / NO DISPONIBLE:** `migrations-applied`, por ausencia de credenciales autorizadas.
- **NO DISPONIBLE:** `sql-tests` y `schema-rebuild`, porque Docker no estaba disponible.
- **Veredicto canónico de `pnpm verify`:** `CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR`. Exit 0 no equivale a cierre verde completo.
- **PENDIENTE / NO DISPONIBLE:** Graphify estructural quedó `PENDING`: este handoff estaba sin commit durante la medición y persistieron los desfases de encabezados en `docs/engineering/project-rules.md` y `docs/runbooks/knowledge-graphify-obsidian.md`. El runbook exige que el Director quite/reinyecte la capa semántica desde el checkout principal para corregir ese caso; el Worker no alteró manualmente el grafo.
- **PENDIENTE / NO DISPONIBLE:** cobertura semántica piloto `0/16` en el recibo vigente. Los fragmentos A y C cubren 9/16, pero el lote B no quedó disponible y no se importó evidencia parcial sobre una estructura `PENDING`.
- **PASÓ:** Archify `2.16.0` quedó `CURRENT` para `700ec903865988c23ffc48fba07b717b97165e2e`, con 9/9 comprobaciones y 11 fuentes; conserva explícitamente Graphify estructural/semántico como `PENDING`.
- **PASÓ:** `pnpm knowledge:publish --preview` generó una vista local de 1.163 documentos para `700ec903`, sin publicar la bóveda compartida.
- **FALLÓ como gate esperado:** `pnpm knowledge:check --preview` terminó con exit 1 por `MAIN_REQUIRED`, `DIRTY_SOURCE` (este handoff previo a commit), `STRUCTURAL_PENDING` y `SEMANTIC_PILOT_PENDING: 0/16`. No se presenta como conocimiento integrado.
- **PASÓ:** `git diff --check` sobre el handoff final antes de commit.

## COMMITS

- `86abfc5d` — incorpora la reserva válida SDD-0502 (`codex/sdd-reserve-0502`, origen `11ed19287734ff7966506ce82a6f552633b5ff19`).
- `8fe94470` — especifica la decisión comercial y el alcance antes del cambio de producto.
- `700ec903` — implementa piso → batería configurable, reconciliación visible, pruebas y documentación.
- **Commit que contiene este documento:** cierre Worker, evidencia de conocimiento y handoff. El SHA final se registra en la PR y en el mensaje al Director, sin crear una recursión de commits.

## PR / BRANCH

- **Base:** `main` / `e9b7c4f43406a00d11068e032f07660e0391e821` al crear la rama.
- **Head:** `codex/calculadora-minimo-bateria-config`.
- **PR:** se abre como **DRAFT** inmediatamente después de publicar el commit que contiene este documento, marcado `review only / cierre local incompleto por gates de infraestructura`. La URL y el SHA remoto exacto se registran en la PR, el artefacto del task y el mensaje al Director.
- El Worker no mergea, no despliega y no aplica migraciones.

## PENDIENTES DE ESTA TAREA

- Publicar el commit final y abrir el PR DRAFT contra `main`.
- Dejar que CI mida lo que el entorno remoto tenga disponible y que el Director revise el SHA exacto antes de integrar.
- El Director debe decidir si recupera/reextrae las 7 fuentes del lote B y aplica los fragmentos A/C desde una copia o desde `main`; esta limitación documental no modifica la fórmula ni sus pruebas, pero mantiene bloqueado el gate de conocimiento.

## FUERA DE ALCANCE DETECTADO

- Hacer merge a `main`, desplegar a Vercel, aplicar migraciones o tocar datos/configuración de producción.
- Cambiar el valor vigente del multiplicador desde este Worker.
- Corregir el problema ambiental de Turbopack/`next/font`, instalar o iniciar Docker, o proveer credenciales Supabase.
- Resolver los skips/flaky históricos del arnés E2E que no reproducen una regresión de esta fórmula.
- Publicar la bóveda Obsidian compartida: exige `main = origin/main` integrado y comprobado.
- Limpiar la reserva remota ambigua `codex/sdd-reserve-0501`. El Director detectó que otro handoff canónico ya usa ese número; la reserva `393aa37dff231ba1e888e03816fb5fb5b6bc563f` queda preservada, sin PR, sin borrado, sin force y sin reciclaje.

## HANDOFF AL DIRECTOR

Revisar el PR DRAFT sobre su SHA remoto exacto, observar CI y decidir la integración. La regla compartida impacta la calculadora pública y el estimador de importación documental mediante `calcularEnvioLCL`; no hay cambio de esquema, RPC ni Administración. Después de integrar, el Director debe comprobar `main`, despliegue y recorrido productivo como evidencias separadas antes de afirmar que está en producción.

El ownership del worktree se libera únicamente después de publicar la rama, abrir/adjuntar el PR y notificar al Director. No se elimina el worktree ni la rama.
