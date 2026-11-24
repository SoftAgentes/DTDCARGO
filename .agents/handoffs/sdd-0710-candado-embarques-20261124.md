# SDD-0710 · Enmienda candado y selección de consulta

## OBJETIVO ORIGINAL

Opción A asignada: candado junto a Rastrear; motivo y asistente al seleccionar la fila bloqueada.

## Identidad y alcance

- Owner: `codex-sdd-0710-candado-20261124`.
- Sesión: `orca_session_id:a25ce849-8992-47e8-8c0a-5f358c058ec2`.
- Task: `task_547d5910aac4`; Dispatch: `ctx_b8cfda079a3d`.
- Rama: `SoftAgentes/sdd-0710-candado-embarques-20261124`.
- Worktree: `C:\Users\AKX generator\Desktop\Developer\Orca\DTDCARGO\sdd-0710-candado-embarques-20261124`.
- Base: `8580490f8d95872a407ab83ab9acb6b1b265a451`.
- Allowlist: la sección 6 enmendada de SDD-0710. Edición, commits y PR autorizados; sin merge ni publicación.

## COMPLETADO

Edición inicial del candado accesible, casillas de consulta y ayuda en barra. La confirmación filtra los IDs por la regla canónica actual; el servidor y el asistente canónico se conservan. El conteo de selección incluye consulta, mientras el conteo destructivo solo incluye elegibles.

## VALIDACIÓN

Revisión del Director `msg_b03379c0bd84`: se oculta Eliminar con solo bloqueadas y se rotula `Eliminar N…` en selección mixta. Para varias consultas se reemplaza posición fija y colchón de 96 por sticky en flujo con máximo 40dvh y scroll accesible por teclado; conserva todos los motivos y pasos. Caso focal añadido, aún sin ejecución. La comprobación móvil en navegador continúa pendiente; el contrato CSS no sustituye evidencia visual.

- PASÓ: claim y guard del owner; base exacta; `git diff --check`.
- PASÓ: instalación `corepack pnpm install --frozen-lockfile`, 813 paquetes, lockfile sin cambios. Turno concedido mediante `msg_b297b9132e63`.
- PASÓ: `node node_modules/vitest/vitest.mjs run EmbarquesClient.borrado.test.tsx EmbarquesClient.abrir.test.tsx --maxWorkers=1`: 2 archivos, 30 pruebas, 28,66 s. Incluye casos normal/bloqueado/mixto, teclado, permiso/lectura, detalle y asistente. jsdom avisa `Not implemented: navigation to another Document`: comprueba href y propagación de Rastrear, no navegación real entre páginas.
- PASÓ: numeración SDD (con excepciones históricas registradas por el script), docs:check, governance:check y components:check. El primer intento de components:check fue prematuro durante instalación y falló por ajv ausente; la repetición tras instalar pasó.
- FALLÓ: validador derivado del plugin governance-check: `policy-registry.json está desactualizado`. No se modifica el plugin; políticas normativas leídas del repo (BTN-01 v1.3 y A11Y-01 v1.1), cápsula del repo vigente.
- PASÓ: lint focal con `node node_modules/eslint/bin/eslint.js` sobre EmbarquesClient y las dos suites modificadas, sin salida y exit 0.
- PASÓ: `corepack pnpm typecheck` completo (prune-next-types sano y tsc --noEmit, exit 0). Turno de PC liberado tras finalizar todos los comandos pesados.
- NO EJECUTADO: verify global y build local. El Director solicita focales/tipos/lint y Quality global sobre la PR para liberar pronto la PC.
- NO EJECUTADO: navegador escritorio/móvil. Búsqueda inicial en rutas rastreadas no encontró arnés específico de Embarques; sí fixtures unitarios en las dos pruebas asignadas. Ninguna evidencia de producción utilizada.
- Pruebas añadidas pendientes: teclado con Espacio y desmarcado, payload mixto, pérdida de permiso/lectura; adaptado flujo del asistente para selección previa.
- Revisión propia de gobernanza: cumplimiento por código de nombre/descripción del candado, regla canónica, controles separados y tokens. A11Y-01 visual, reflow y contraste pendientes de navegador. BTN-01: reutiliza controles y asistente existentes; no añade acción destructiva por fila.

### UI-CHECK (revisión propia de código, no independiente)

- Cumplimiento observado en componente: código azul y Rastrear conservados; candado compacto con nombre y descripción; controles nativos separados, foco heredado en código/rastreo/pasos; motivo canónico completo asociado a casilla y candado.
- Cumplimiento BTN-01 por código: consulta sin CTA destructivo competidor; selección mixta indica el número exacto a eliminar. SGE/MP/AUD: no cambia permanencia, acción del servidor ni auditoría; reutiliza ConfirmDialog y asistente canónicos R3.
- Pendiente de evidencia visual: escritorio/móvil, zoom, contraste y foco visible en barra. La limitación 40dvh y overflow se verificó como contrato de componente; no demuestra geometría real. Riesgo del slice R3 por selección que alimenta borrado; requiere revisión previa y Quality sobre el SHA final.

## COMMITS

Pendientes.

## PR / BRANCH

PR pendiente; conservar rama y worktree.

## PENDIENTES DE ESTA TAREA

Quality global y revisión independiente en la PR. Evidencia visual real escritorio/móvil pendiente por ausencia de arnés aislado encontrado; no se usaron datos reales. No se declara cierre canónico completo ni aceptación humana.

## FUERA DE ALCANCE DETECTADO

Ninguno confirmado.

## HANDOFF AL DIRECTOR

Impacto documental: SDD-0710 enmendada con allowlist exacta y contrato que sustituye las casillas bloqueadas. Entrega local lista para revisión; no declara aceptación humana ni publicación. SDD permanece in-progress por evidencia visual y revisión pendientes. Tras recibir el SHA, SDD-0715 puede tomar EmbarquesClient desde esta entrega mediante coordinación del Director; esta sesión deja de escribir después de liberar su claim.
