# Worker — calculadora-zonas-entrega-incluida-20261008

Fecha: 2026-10-08. Owner/sesión: worker-01a11cc5-94ca-70b1-a3b8-74b6fa5edb8a.
Worktree: `C:/Users/AKX generator/.codex/worktrees/calculadora-zonas-entrega-incluida-20261008/DTDCARGO`.
Rama: `codex/calculadora-zonas-entrega-incluida-20261008`.
Base: `eadef1130dd1b192f0d6829b3dac9f4515e4541d` (reserva SDD-0504 desde `c3d37a8eeb347e260a2d047ceb882795e06a408f`).
SDD: `docs/specs/0504-zonas-entrega-incluida/spec.md`. Estado: in-progress por cierre general incompleto. Implementación local lista para revisión con límites; no equivale a autorización de integración/release.

## OBJETIVO ORIGINAL

Administrar ciudades con entrega incluida desde configuración de calculadora; conservar Caracas, Valencia, Maracay y demás coberturas, excluir Acarigua y preservar tarifas/fórmula.

## COMPLETADO

Aislamiento adjunto, rama propia y guard/claim comprobados. Allowlist final registrada en SDD antes de producto, ampliaciones justificadas antes de cada archivo adicional.

- Sección «Zonas con entrega incluida» en Administración > Calculadora pública > Ciudades. Estados por ciudad, cambiar/guardar/cancelar, espera bloqueada, error persistente con foco, no-admin sin controles y borrador conservado al cambiar subpestaña.
- saveDeliveryZoneAction modifica exclusivamente casco. Gate/contexto de membresía activa, admin explícito, filtros tenant/id/deleted_at/estado previo, cero filas detectado y error seguro. Revalida Administración, tarifas y embed.
- combinarDestinos respeta bandera persistida, también false. Fallback sólo sin catálogo; Acarigua false con tarifa de respaldo existente 123,60 USD/m³ intacta. Caracas, Valencia, Maracay, Barquisimeto, Guacara, Naguanagua y San Diego conservan inclusión de respaldo. No se borran otras ciudades/coberturas.
- Fórmula SDD-0502 intacta. Inventario RBAC 427 → 428 por nueva acción, sin cambiar scanner, excepciones o deuda.

## VALIDACIÓN

No acceso a Supabase producción, sin secretos copiados. Dependencias instaladas con lockfile congelado y sin scripts; lockfile intacto.

| Comprobación | Estado y alcance |
|---|---|
| Tests dirigidos iniciales | 119/120 PASÓ; test encontró reset del checkbox ante error y se corrigió sin relajar test |
| Tests dirigidos finales | PASÓ 554/554 en 6 archivos, con un worker: acción, UI (6/6 incluyendo conservación entre tabs), combinación/cálculo, tipos e inventario RBAC |
| Inventario/guards RBAC | PASÓ 433/433 tras registrar la nueva acción; gate real y cliente simulado cubren no-admin, disabled_at, sesión, tenant, borrado y concurrencia |
| Cálculo/persistencia simulada | PASÓ dirigido: exclusión/reinclusión cambia total 973,60/850; sin tarifa deriva; tarifa persistida, mínimo terrestre, batería y descuento conservados |
| sdd:check | PASÓ; 490 specs, 467 migraciones; colisiones históricas declaradas no renumeradas |
| docs:check / governance:check / components:check | PASÓ; índice generado, 28 políticas y 5 fuentes CMP |
| git diff --check | PASÓ antes de cierre |
| pnpm verify | FALLÓ e INCOMPLETO: 14/17 pasos ejecutados; lint inicial, suite y E2E fallidos; migrations-applied, sql-tests y schema-rebuild no medidos. Lint inicial encontró ENOENT al mover bundle temporal fuera del barrido; lint limpio PASÓ, 0 errores y 15 warnings preexistentes. Harness PASÓ 201/201, RSC PASÓ, typecheck PASÓ, Edge PASÓ 4/4. Último intento de suite: 16 archivos fallidos / 635 pasaron / 1 omitido; 34 tests fallidos / 8.743 pasaron / 1 omitido, con errores de arranque de workers y timeouts fuera del slice. Inventario RBAC inicial corregido y verificado dirigido |
| Build de producción local | PASÓ, incluyendo TypeScript, páginas y postbuild Norte; tsconfig restaurado y sin cambios rastreados del build |
| Ledger de migraciones | NO EJECUTADO, sin credenciales; no se consultó producción |
| SQL / reconstrucción de esquema | NO DISPONIBLE: Docker ausente; no se ejecutaron |
| Visual local | PASÓ componente real aislado, filas/acciones sintéticas: escritorio light/dark, móvil sin overflow, guardar/reintentar, no-admin, borrador tras error; cero pageErrors |
| E2E general | FALLÓ tras reintento automático: 175 pasaron, 3 fallaron (selector light/dark chromium y captura de carrusel), 20 omitidos y un error de cierre de worker ajeno a test. Primer intento: 175 pasaron, 1 falló (selector dark mobile-chrome: esperaba mara y obtuvo Valencia (sede)mara), 2 flaky, 20 omitidos. Supabase sintético deny-only, sin datos reales |
| Auth admin real / Postgres / producción | NO EJECUTADO; simulación no prueba RLS/trigger ejecutados ni web productiva |

Evidencia visual ignorada: graphify-out/qa-0504/desktop-light.png, desktop-dark.png, mobile-dark.png, mobile-readonly.png, error-draft.png y visual-report.json. Es el componente real compilado, no el módulo autenticado completo. Preview http://127.0.0.1:4324 mientras esté activo el servidor de esta tarea. Logs preservados en graphify-out/qa-0504/: targeted.log, lint.log, graphify.log, archify-check.json y verify.log. No representan CI alojado.

## Gobernanza y UI-CHECK

Cumplimiento BTN/FRM/LOD/ERR/A11Y del slice: controles nativos, submit único, pending, cancelación, labels, foco de error, tokens y componentes Badge/EmptyState canónicos. Sin consumidores deprecated. Revisión React local: componente de formulario a nivel de módulo, estados mínimos, sin cascada HTTP cliente, tipos estrictos y hooks consistentes. No Vercel Agent ni servicio pagado.

Auditoría conservada por trigger audit_d5_calculator_cities (0293), en la misma mutación: evidencia de código, NO ejecución SQL de esta sesión. El trigger histórico registra calculator_city_updated con slug/active; no registra before/after de casco. No se amplió el contrato del evento.

UI-CHECK local: tokens y fuentes Studio, list/form nativos, una acción primaria en edición, sin ancho fijo nuevo y acciones responsive. Sin excepciones nuevas de marca. La revisión aislada no certifica accesibilidad transversal ni sesión real.

## COMMITS

- c37cd50c0cd784f16668fd3c60760a92eeb883de — feat(studio): SDD-0504 administrar zonas con entrega incluida (15 archivos de implementación, SDD/índice y pruebas).
- b88951f9e321bf12990ec8a5c224500b15f385b7 — cierre documental local inicial.
- Publicación: commit que contiene la actualización de este handoff; SHA final en Git/PR y cierre de sesión para evitar autorreferencia.

## PR / BRANCH

Sam autorizó continuar y subir los cambios el 2026-10-08. Rama propia publicada a la misma rama de origin; PR #193 abierta en borrador hacia main: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/193. Base comprobada c3d37a8eeb347e260a2d047ceb882795e06a408f, sin cambios respecto a validación local. CI y preview Vercel automáticos iniciados; su resultado se comprueba al finalizar, no se presume aprobado. No merge, despliegue manual ni operación de producción autorizados en esta ampliación.

## PENDIENTES DE ESTA TAREA

Implementación, pruebas dirigidas, revisión visual y build locales completados. Antes de integración/release: resolver o evaluar explícitamente los fallos/omisiones del gate general, ejecutar recorrido de Administración con sesión real en entorno autorizado y confirmar catálogo/tarifa productivos. Producción queda pendiente por frontera de autoridad; no se afirma corregida. Refrescar derivados/recibos del handoff final y revisar Obsidian desde main integrado comprobado corresponde al cierre del Director.

## FUERA DE ALCANCE DETECTADO

15 warnings de lint en Wizard/Detalle de compra, KommoBoardView, DocumentCalculator y knowledge-vault: no modificados. Suite general reporta fallos/timeouts en Packing List/portal, registro, Nav, etiquetas y fiscal, además de errores de arranque/terminación del pool; el log conserva los casos completos. E2E reporta selector público SDD-0360/0441 (texto inicial concatenado al teclear), captura de carrusel y worker que no cierra. Ningún componente de selector/carrusel modificado por esta tarea. No se atribuye causa definitiva ni se afirma que todos sean fallas históricas. Graphify advierte extracción parcial de dos TSX de Legal; no se absorben esos módulos.

## HANDOFF AL DIRECTOR

No schema/RPC nuevos ni migración creada. Rama/worktree preservados, con respaldo remoto y PR #193 en borrador. Ownership reclamado al retomar publicación; se libera después de commit/push final y comprobación de HEAD local/remoto/PR. Resultado en graphify-out/qa-0504/publication-closure.log y cierre. No eliminar rama/worktree. Preview visual sólo lectura puede seguir activa en 4324 para revisión; no es una sesión Worker escritora.

### Plan de corrección persistida (sin ejecutar)

1. Director revisa/integra/publica sólo con permisos específicos y SHA validado. Antes de release, con autorización de consulta de configuración sin clientes/PII, confirmar tenant y ciudades vivas. Al quitar el OR histórico, todo false persistido empezará a respetarse: comprobar que las otras inclusiones comerciales coinciden, especialmente Barquisimeto; detener release ante discrepancia, sin ajustes automáticos.
2. Administración > Calculadora pública > Ciudades > Zonas con entrega incluida: localizar Acarigua, confirmar estado previo y tarifa de VENTA del transportista predeterminado. Desmarcar inclusión y guardar mediante la acción que resuelve tenant del admin activo. Si ya está false, no escribir. No cambiar costo/venta, km, label, orden ni otras filas.
3. Comprobar persistencia, evento calculator_city_updated y RPC public_calculator_cities con Acarigua false; verificar tarifa pública de transportista. Sin precio confirmado ni respaldo confirmado aplicable, comprobar derivación al asesor.
4. Recorrido público con igual carga: Caracas/Valencia/Maracay sin recargo (preservando descuento configurado), Acarigua con su tarifa vigente/piso terrestre. Comprobar total final, mínimo con batería, tarifas/embed y otras coberturas; registrar SHA/deployment/evidencia productiva por separado.
5. Rollback autorizado: restaurar sólo la bandera previa de Acarigua con la acción. Revert de código por PR o redeploy aprobado. No ejecutar SQL/migración para pasar un gate.

Si Director exige migración para corregir datos, coordinar número antes de crearla. 0472 no reservado; esta sesión no lo usa.

### Impacto documental y conocimiento

SDD-0504 e índice actualizados; este handoff guarda decisión autorizada, alcance, evidencia y pendientes. Graphify 0.9.61: actualización estructural local ejecutada, 37.498 nodos / 68.716 edges / 2.453 comunidades, dos advertencias de Legal. Estado consultado en c37cd50c: estructural PENDING por este handoff que cambió durante la extracción; semántica PENDING (1.170 fuentes), piloto PENDING y global PENDING. Ninguna fuente del piloto modificada. No se certifica cobertura semántica ni se amplía esta tarea para resolver deuda global.

Archify 2.16.0: runtime fijado por hashes reutilizado sólo como dependencia; build/check PASÓ, CURRENT en snapshot c37cd50c, 11 fuentes y 9 checks. Conserva graphStructural/graphSemantic PENDING. JSON canónico docs/architecture/knowledge-lifecycle.archify.json intacto: mapa del ciclo de conocimiento, no mapa nuevo de producto. Preview local Obsidian PASÓ tras un rechazo SOURCE_CHANGED mientras se editaba este handoff; reintento estable guardó 1.169 documentos y 41 advertencias en graphify-out/obsidian-preview, modo PREVIEW, snapshot c37cd50c (handoff previo al cierre final). Resultado completo graphify-out/0504-preview.json. Integración/publicación compartida y revisión visible en Obsidian NO EJECUTADAS, reservadas a Director desde main integrado comprobado. El commit final del handoff requiere refrescar recibos/revisión al integrar; CURRENT del mapa no eleva otras capas.

### Descripción de PR publicada

Título: feat(studio): SDD-0504 — administrar zonas con entrega incluida

Administración > Calculadora pública > Ciudades permite cambiar la inclusión por ciudad, guardar/cancelar y recuperar errores sin perder el borrador. La bandera persistida prevalece sobre el fallback: excluir una ciudad aplica su tarifa vigente al total. Acarigua deja de estar incluida en el respaldo; se conservan las otras siete inclusiones, tarifas internas y fórmula de mínimos/batería/descuentos.

La acción exige admin activo, filtra tenant/ciudad viva y detecta concurrencia o cero filas. Reutiliza auditoría/RPC existentes. Validación y límites en la tabla de este handoff; corrección persistida y recorrido productivo pendientes de autorización. Rama y PR draft publicadas con autorización; sin migración, merge ni despliegue manual. Cambios de esta continuación exclusivamente documentales de autoridad/publicación; no se repitió la suite local porque el código y la base validada no cambiaron. Los recibos/preview de conocimiento anteriores conservan su fecha y snapshot; refresco del cierre documental publicado sigue pendiente, sin promover cobertura.
