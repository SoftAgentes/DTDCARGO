# Handoff — extracción del foco de DestinoCombobox

Task ID: 2026-09-05-destino-focus-extract. Fecha: 2026-09-05.
Owner/claim: 01a073a6-f21d-7483-9b74-4d9f3464c295, Worker.
Estado: en-progreso.
Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/destino-focus-fix-20260905.
Rama: codex/destino-focus-fix-20260905.
Base: origin/main b8294664a1b4f9e25c423dd814f4813fa5b1be8f, revalidada con fetch.
Fuente fijada: 46afa953633507c1f506f2a879f3d8431155f2ad, PR #21.
SDD: 0360-destino-combobox-focus-race; se reutiliza, no se numera otra.

## OBJETIVO ORIGINAL

Evitar que el foco tardío seleccione y borre la búsqueda ya escrita; conservar
Escape, flechas/Enter, cursor manual y estilo. Extraer solo el arreglo y sus
pruebas, demostrar regresión y validar las combinaciones locales con A y B.

## COMPLETADO

Preflight: main y A/B coinciden con los SHA asignados; worktrees de A/B limpios,
claims liberados y remoto actualizado. Nuevo aislamiento y claim propios.
BRAND y skill Worker leídos; superficie pública, sin cambio visual ni de datos.

Se extrajeron solo componente y tests del origen, con blobs exactos:
441df9bf51ee27f12211f7a26c46bcbf477f16cb (componente) y
516fe68d77698c4270d981e3de67f157a235e755 (test). Diez pruebas previas intactas.
Selección síncrona en focus y ref de un solo mouseup, invalidada por teclado,
edición o blur. El diff no cambia clases, estilos, textos, catálogo ni red.

Allowlist exacta: components/DestinoCombobox.tsx;
components/DestinoCombobox.test.tsx;
docs/specs/0360-destino-combobox-focus-race/spec.md;
docs/specs/README.md (generado);
.agents/handoffs/2026-09-05-destino-focus-extract.md.
No importar auditorías/handoffs históricos ni otros cambios de #21.

## VALIDACIÓN

- PASÓ: pnpm install --frozen-lockfile, Node24.19.0/pnpm11.19.0; sin env copiada.
- ROJO esperado sobre original: dos regresiones de frames, esperaban mara y
  recibieron Valencia (sede)mara / a. Comando: node node_modules/vitest/vitest.mjs
  run components/DestinoCombobox.test.tsx -t 'antes del primer frame|entre letras'.
  Log: %TEMP%/dtd-destino-red.log. Un intento previo a finalizar install no cargó
  Vitest; no se contó como regresión. El rojo informado sí ejecutó ambas pruebas.
- PASÓ después: node node_modules/vitest/vitest.mjs run
  components/DestinoCombobox.test.tsx, 13/13. Log: %TEMP%/dtd-destino-green.log.
- PASÓ: ESLint de ambos TSX, docs:check y diff-check.
- PASÓ navegador: fixture Vite de datos ficticios con el componente real y
  app/globals.css, en Edge local mediante agent-browser0.36.0. Escritura mara,
  frame/edición protegidos por los unitarios; cursor en posición2 + x = maxra,
  Escape restaura la selección, flechas/Enter y clic eligen y cierran el popup,
  con foco de vuelta al input. También se comprobó cursor mediante mouse real.
  Sin errores de página/overlay; red observada solo 127.0.0.1, sin servicios
  de negocio. La fixture monta tres destinos ficticios con onChange local.
  Archivos reproducibles: %TEMP%/dtd-destino-fixture.mjs y
  %TEMP%/dtd-destino-browser.ps1; capturas en
  %TEMP%/dtd-destino-fixture-0360/{initial,typing,selected}.png.
  El servidor temporal necesitó rutas Windows largas y watcher por polling;
  se resolvió fuera del repo. Browser/servidor propios detenidos al terminar.
- Compatibilidad #31: Director informó git merge-file --stdout sobre copias
  de base b8294664, foco46afa953 y colores648bddf6: exit0 sin marcadores,
  preservando selectOnMouseUpRef y calc-ink-secondary, sin requestAnimationFrame.
  Mi inspección de diff confirma tres cambios de estilo en #31. Se incorpora
  esa evidencia sin duplicar la prueba; no acredita #31 completa ni revisión
  visual de colores combinados. Ambas quedan para integración posterior.
- PENDIENTE: verify completo en B final y evidencia de equivalencia de producto
  entre extracción/A/B. Director autorizó concentrar allí suite/build; en A y
  extracción se comprobarán docs/alcance y foco sin repetir producto equivalente.

## COMMITS

Producto: ef99fca5fff6cf9b4562255370876313ffd7ced3,
fix(DTD-0360): preservar la búsqueda al recibir foco. Solo los dos TSX.
Documentación/coordinación separadas; SHA finales en el reporte del Worker.

## PR / BRANCH

Extracción local propia. Destinos de integración local: A (PR #34) y B (PR #32).
El Director conserva pushes y actualizaciones de PR; esta sesión no publica.

## PENDIENTES DE ESTA TAREA

Integración local A/B, verify en combinación final y cierre de evidencia.

## FUERA DE ALCANCE DETECTADO

No integrar #21/#31 completas. No cambiar estilos/tokens/textos, catálogo,
precios, persistencia ni red. No aflojar tests ni modificar workflow/gates.

## HANDOFF AL DIRECTOR

Entregar SHA de producto y SHA finales A/B con evidencia y límites de validación.
Sin push, merge main, producción, ledger con credenciales, migraciones,
secrets/rulesets ni limpieza. Conservar ramas/worktrees y liberar claims al cierre.
