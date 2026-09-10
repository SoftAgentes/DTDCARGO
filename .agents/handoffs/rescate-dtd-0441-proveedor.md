# Rescate DTD-0441 · portal público del proveedor

## OBJETIVO ORIGINAL

Rescatar el fix de contraste y ancho del portal proveedor en PR #57 y cerrar su único hallazgo de /ui-check: añadir el icono del sistema a los errores de campos, envío genérico y adjuntos.

Task ID: `rescate-dtd-0441-proveedor`. Owner: `rescate-dtd-0441-proveedor-root-20260910`. Sesión de seguimiento: `01a08cbb-5a9d-7ce3-afdd-45f62fb5e898`. Fecha: 2026-09-10. Estado: lista-para-revision; corrección de iconos y validación local del proveedor completas, verify global fallido por timeout ajeno y cobertura crítica incompleta. PR draft; no integrada.

Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/rescate-dtd-0441-proveedor-20260910`. Rama: `codex/rescate-dtd-0441-proveedor-20260910`. Base asignada: main `9dc21d0ceeca9b8de9a91f87298505a1974662e4`. HEAD inicial del seguimiento: `0cfd01ac77f2f9044c45112525e92d7b015dbb16`, ya publicado e incluyendo esa base.

SDD reutilizado: [0441](../../docs/specs/0441-colores-semanticos-marca/spec.md), permanece in-progress. Dependencia existente: `components/StatusIcon.tsx`. Aceptación: icono de peligro en los tres mensajes; conservar texto, `text-ink`, `border-status-danger`, viñetas y primera línea; tokens de color/espaciado; documento de 390 px; handoff actualizado.

Alcance exclusivo del seguimiento: `app/p/[token]/PackingListFormSection.tsx`, `app/p/[token]/SupplierUploadSection.tsx` y este handoff. Spec y allowlist ya contienen las rutas y no se modifican. Autorizado commit y push sobre la rama existente de #57. No otra PR, merge, producción, migraciones, ruleset ni borrado de ramas/worktrees.

## COMPLETADO

- Continuación explícitamente asignada por Sam a esta tarea. Worktree limpio; claim previo ausente. Los procesos relacionados correspondían a la cadena Codex de esta invocación (companion `73033918-c363-4802-a479-bd1cc639fccc`), sin servidor consumidor. Claim adquirido antes de escribir y guard verificado.
- Actualizado el worktree por fast-forward desde `462cf65a` a la rama remota `0cfd01ac`. Sin merge adicional, rebase ni traslado de cambios de otro worktree.
- Añadido `StatusIcon tone="danger" size={14}` a cada elemento de la lista de errores y a los dos párrafos de error. Los tres posibles campos llevan un icono cada uno: se conserva el `ul` con `list-disc` y cada `li` nativo; no hace falta una cabecera ni texto nuevo.
- SVG inline-block con `verticalAlign: "text-bottom"`; color `var(--color-status-danger)` y separación lógica `var(--spacing)` (4 px computados). El tamaño 14 corresponde al componente asignado; sin nuevos valores arbitrarios de espaciado ni hex.
- Clases de texto y borde intactas. No cambian condiciones, mensajes, datos, contratos, handlers, impresión ni otras pantallas. Se conservan live regions y `aria-hidden="true"` del SVG, sin añadir `aria-label` ni `role`.
- Gobernanza: cumplimiento del delta con BRAND/VIS-01/ERR-01/A11Y-01/CMP-01; se reutiliza componente compartido sin modificarlo. No aplica cambio de lógica de formulario, privacidad, DB o contratos.

Antecedente conservado: el rescate anterior portó cuatro cambios de clases desde `c8c79298` en `33da9cae`, documentados en `462cf65a`. Demostró el defecto en main `13facbad` y preservó íntegra la rama original en `origin/codex/portal-colors-reception-integration-20260906` (`dbecd209`). Su handoff completo está en Git en `462cf65a:.agents/handoffs/rescate-dtd-0441-proveedor.md`; evidencia original en el directorio de respaldo indicado abajo. Esta revalidación mide fuentes nuevas; no reutiliza resultados anteriores como actuales.

## VALIDACIÓN

Evidencia del seguimiento: `C:/Users/AKX generator/Desktop/Developer/DTD-backups/rescate-dtd-0441-proveedor-20260910/`: `iconos57-install.log`, `iconos57-vitest-focal.log`, `iconos57-docs.log`, `iconos57-sdd.log`, `iconos57-verify.log` y `iconos57-visual/`.

| Comprobación | Resultado |
|---|---|
| `corepack pnpm install --frozen-lockfile` | PASÓ; pnpm 12.3.4, lockfile intacto; aviso existente de onlyBuiltDependencies, sin cambiar configuración |
| `corepack pnpm exec vitest run 'app/p/[token]/supplier-flow.test.tsx'` | PASÓ; 4 tests / 1 archivo, sin skips; 9.17 s |
| `corepack pnpm docs:check` | PASÓ; índice sincronizado, 407 specs |
| `corepack pnpm sdd:check` | PASÓ; 407 specs / 414 migraciones; exenciones históricas reportadas, sin alterarlas |
| Revisión independiente de código y alcance | PASÓ; solo imports y SVGs en los dos componentes, textos/lógica/ARIA/clases intactos; `git diff --check` pasó |
| Matriz visual y multilínea | PASÓ; 16/16 escenarios, 48 estados (24 antes + 24 después) |
| `corepack pnpm verify` | FALLÓ; exit 1, 13/17 pasos ejecutados: 12 pasaron y test global falló en ambos intentos; build PASÓ |

Verify se ejecutó con `VERIFY_SKIP_SQL=1` por exclusión de migraciones y `VERIFY_SKIP_E2E=1` por falta de credenciales, declarada en el encargo. No hay .env.local ni variables de Supabase en este worktree; no se copiaron credenciales.

| Gate de verify | Resultado y alcance |
|---|---|
| harness | PASÓ; 18 tests |
| lint | PASÓ; 0 errores / 8 warnings preexistentes |
| rsc-boundary | PASÓ; 1597 módulos |
| typecheck | PASÓ |
| edge-functions | PASÓ; 4 funciones con Deno |
| test | FALLÓ; ambos intentos: 6525 pasaron / 1 timeout, 521 archivos; 140.25 s y 144.87 s |
| docs:check | PASÓ; 407 specs |
| numbering | PASÓ; 407 specs / 414 migraciones |
| feature-constants | PASÓ; 5 banderas |
| components:check | PASÓ; agregado reproducible y cero rutas rotas |
| governance:check | PASÓ; 28 políticas aprobadas |
| migrations-applied | NO DISPONIBLE; sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, auto-SKIP |
| pending-migration-symbols | PASÓ; 0 rojo / 0 amarillo |
| sql-tests | NO EJECUTADO; exclusión de migraciones, VERIFY_SKIP_SQL=1 |
| schema-rebuild | NO EJECUTADO; misma exclusión |
| e2e | NO DISPONIBLE; sin credenciales, VERIFY_SKIP_E2E=1 |
| build | PASÓ; compilación, tipos y generación de páginas completadas; tsconfig.json restaurado por el gate |

Veredicto literal del gate:

> verify: 1 fallo(s) → test CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied, sql-tests, schema-rebuild, e2e.

La matriz visual compara `0cfd01ac` con las fuentes posteriores congeladas, Chromium/WebKit × claro/oscuro × antes/después, primero con mensajes cortos y luego multilínea. Documento: **390 px en todos los escenarios y en cada estado de error**; scroll horizontal interno y 15 etiquetas sr-only preservados.

| Métrica | Claro | Oscuro |
|---|---:|---:|
| Contraste texto antes y después (idéntico) | 16.491:1 | 13.083:1 |
| Contraste icono | 5.420:1 | 6.734:1 |
| Borde danger | 2 px | 2 px |
| Separación desde token | 4 px | 4 px |
| Diferencia de centros icono/primera línea | 0 px | 0 px |

Lista `disc` / `list-item`, SVG 14×14 y live regions comprobados. Capturas de los 12 bloques posteriores de la matriz multilínea revisadas; Worker principal revisó además muestras de lista/envío/adjuntos. Sin errores JS ni solicitudes externas; solo respuestas HTTP 400/503 sintéticas esperadas. `iconos57-visual/summary.json`, `source-integrity.json` y `cleanup.json` guardan resultados, integridad y cierre de navegadores/Vite: procesos propios ausentes, puerto 5173 libre.

Fuentes posteriores medidas, SHA-256:

- PackingListFormSection: `90f206b92a55349c0f5158bdd03dc7123024ead7842df21c2ffeb9e6ec67bc0f`.
- SupplierUploadSection: `86d2f24e1a7f63f1a3fed9e090456ddd09bbe6f1842de18020cce245297ce82a`.

Límites: fixture sintético del componente y wrapper reales, CSS actual, navegación simulada, fuentes fallback y oscuro sintético. NO EJECUTADO Next integrado, lector de pantalla real, dispositivo físico, fullscreen, impresión, WeChat ni UAT. La matriz no sustituye E2E integrado ni ledger y no certifica producción.

## COMMITS

- `33da9caed468b74a985043399356825cc99057a9`: rescate original de clases, spec/allowlist y handoff.
- `462cf65a369ec54505fbadb249dbadf95394961d`: cierre de evidencia del rescate.
- `0cfd01ac77f2f9044c45112525e92d7b015dbb16`: actualización publicada de la rama con main, recibida por fast-forward.
- Commit que contiene este documento: iconos de error y seguimiento del handoff; exclusivamente las tres rutas asignadas. SHA final comprobable en el head de #57 y recibo externo de cierre.

## PR / BRANCH

[PR #57](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/57), misma rama `codex/rescate-dtd-0441-proveedor-20260910`, base main `9dc21d0c`. Se devuelve a draft por validación incompleta, según Worker. No se abre otra PR ni se integra.

El delta acumulado de la PR conserva cinco rutas: los dos componentes, el handoff y la spec/allowlist del rescate anterior. El seguimiento de iconos modifica solo tres; no añade rutas nuevas ni toca spec/allowlist. CI alojado se consulta por el SHA nuevo después del push; estados anteriores no validan este commit.

## PENDIENTES DE ESTA TAREA

Ninguno de implementación del icono ni de aceptación visual local; todas las comprobaciones solicitadas fueron ejecutadas o clasificadas explícitamente. La integración requiere revisión del Director y tratamiento del gate global fallido y de los críticos no disponibles; no se declara cierre verde completo ni SDD done. La publicación y liberación finales se acreditan en el recibo externo indicado al cierre.

## FUERA DE ALCANCE DETECTADO

- `app/studio/(app)/clientes/_components/ClientsClient.contador.test.tsx:125`: caso «no ofrece pasar del techo de PostgREST: lo dice y manda a buscar». Ambos intentos de verify fallaron con **Error: Test timed out in 20000ms.**, a 22199 ms y 24709 ms. Renderiza 1000 clientes. Revisión estática independiente: 80 archivos de su grafo local sin cambios frente a `0cfd01ac` y `9dc21d0c`; no incluye los componentes proveedor modificados. No se atribuye una causa exacta de rendimiento ni se debilita la prueba.
- Ocho warnings preexistentes de ESLint fuera del delta. Avisos de pnpm/npm sobre configuración existente; sin cambios de configuración.
- Build completado con mensajes recuperados de consultas públicas por falta de configuración Supabase; no valida contenido remoto de servicios, noticias ni tarifas.
- E2E y ledger sin credenciales; SQL/schema excluidos. No se amplía alcance a otros defectos del proveedor, Studio o SDD-0443.

## HANDOFF AL DIRECTOR

Revisar los iconos de los tres avisos sobre el nuevo head de #57 con esta evidencia. Layout por elemento de lista conserva las viñetas; textos/bordes mantienen contraste y documento de 390 px. Sin contratos compartidos nuevos ni archivos fuera del alcance del seguimiento.

El timeout global de Clientes se entrega como hallazgo ajeno; decidir su tratamiento por tarea independiente antes de integrar. E2E/ledger y release conservan sus requisitos y autorizaciones. Conservar ramas, worktrees y evidencia.

Al redactar, claim propio activo. Tras el último commit/push, ejecutar `node scripts/harness-worktree.mjs release --owner rescate-dtd-0441-proveedor-root-20260910`; el SHA publicado, estado limpio y liberación se comprobarán en `iconos57-cierre.json` del directorio externo de evidencia. Agentes de revisión/medición finalizados; no hay sesiones escritoras independientes ni servidores visuales consumidores.
