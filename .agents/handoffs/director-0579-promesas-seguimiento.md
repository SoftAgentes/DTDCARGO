# Director — SDD-0579, promesas de seguimiento

Dueño: Director de esta conversación.
Fecha: 2026-10-23 · America/Caracas.
Estado: entrega local revisada y aceptada con límites de validación explícitos; pendiente de integración/publicación no autorizadas.

## Encargo y autorización

Sam autorizó empezar por las promesas de seguimiento con un Worker aislado y dejarlo implementado y probado localmente. Prohibiciones expresas: push, merge, despliegue y cambios en la cuenta de Kommo. El encargo no incluye P2 móvil ni P3 Ads.

El Worker puede editar las FAQ, la referencia obsoleta a consulta pública por código de privacidad y las fuentes locales de Kommo/infografía, dentro de la allowlist de la spec. No activa el rastreo, modifica reglas de registro, consulta datos de clientes, aplica migraciones ni envía mensajes/eventos a terceros.

## Identidad y evidencia de aislamiento

- Reserva: `codex/sdd-reserve-0579-promesas-seguimiento-web-kommo`.
- Commit reserva: `1dac0816dc78f9233be428a90ab62088acc1e30f`.
- Padre integrado de reserva: `d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8`.
- Inventario de reserva: 526 refs más worktrees, tras refresh y lectura de PR abiertas; tomó máximo más uno. Avisos de colisiones históricas quedaron visibles; no se renumeró nada ajeno.
- Rama Worker: `codex/0579-promesas-seguimiento-web-kommo`.
- Ruta Worker: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0579-promesas-seguimiento-web-kommo`.
- Agente interno Worker: `/root/worker_seguimiento`.
- Owner asignado: `worker-0579-promesas-seguimiento`.
- Spec asignada: `docs/specs/0579-promesas-seguimiento-web-kommo/spec.md`.
- Handoff Worker: `.agents/handoffs/0579-promesas-seguimiento-web-kommo.md`.
- Este documento pertenece al worktree de coordinación `plan-mejoras-web-20261023`, no al del Worker. Director no edita producto ni pruebas.

La reserva es local y no excluye otra máquina. No se publicará mientras siga vigente el no-push. La consulta focal de PR abiertas no encontró los cuatro archivos de contenido en diffs abiertos; eso no prueba disponibilidad de sesiones ni ausencia de conflictos semánticos. El inventario amplio de Director terminó: GitHub disponible, 18 PRs abiertas (incluidas bases ajenas a main), ninguna con esos cuatro archivos, actividad de sesiones NOT_VERIFIED. No se adoptaron ni limpiaron otros worktrees.

## Aceptación encomendada

- Cinco FAQ sin prometer eventos/rastreo visible cuando la bandera está activa; preguntas, categorías, widgets y destinos conservados.
- Texto UI y JSON-LD coherentes, consumidores Shipping Mark y Puerta a Puerta no vacíos. Si hay variantes, probar ambas posiciones sin cambiar la constante real.
- Cuatro cláusulas equivalentes de la fuente de Kommo preparadas localmente; subida a cuenta NO EJECUTADA.
- Privacidad factual sin ampliar finalidades/retención/derechos ni borrar tratamiento histórico; el resto y su versionado se conservan en esta corrección local.
- Fuente de infografía sin prometer visualización de estado. No regenerar ni publicar piezas.
- Pruebas focales y canónicas aplicables con datos sintéticos, red productiva bloqueada y omisiones explícitas. Inspección local de páginas sin enviar registro/contacto.
- Commits selectivos y handoff durable; revisión del SHA final por Director antes de aceptar entrega local.

## Conocimiento y límites al iniciar

Estado principal: `knowledge-sync status` ejecutado mediante Node directo, `ok:false`, estructura CURRENT, semántica PENDING, Archify CURRENT y Obsidian PENDING. No se instaló ni publicó nada para forzar verde. El Worker conservará su propio estado y derivados locales; ninguna publicación compartida está autorizada.

## Revisión final

Revisión intermedia del commit inmutable `206728c5a4eca131a6240a67144be3749039b4fc`: diff de los cuatro archivos de contenido y suite nueva inspeccionados, sin observaciones bloqueantes. Cinco FAQ variantes conservan literal anterior al apagar la bandera; no cambia la constante real. Las cuatro cláusulas equivalentes de KB, la fila factual de privacidad y la fuente de infografía respetan el alcance. Las otras 37 FAQ, preguntas, categorías y widgets se conservan.

El Director inspeccionó las tres capturas locales guardadas: FAQ, Shipping Mark y privacidad. El texto afectado es completo y legible. El recorte del encabezado de Shipping Mark a la derecha es ajeno al cambio y queda fuera de P1; no acredita verificación móvil.

Evidencia comprobada por lectura de logs y deltas:

- Focal PASÓ 41 pruebas en cuatro archivos; UI PASÓ cuatro rutas con datos sintéticos y sin intentos remotos inesperados en la corrida final.
- Lint PASÓ con 15 warnings preexistentes; RSC PASÓ (1706 módulos); typecheck PASÓ. Build de release y generación Norte PASÓ, sin despliegue.
- La primera pasada general terminó en 630,97 s: 859 archivos PASÓ, dos FALLÓ, uno omitido; 12.284 pruebas PASÓ, cuatro FALLÓ y una omitida. Los cuatro fallos pertenecen a dos archivos: URL de enlace de email mockeado fijada por el runner y bind local 0.0.0.0 bloqueado por el preload. Se corrigieron exclusivamente los auxiliares propios; rechecks acceso 17/17 y puertos 12/12 PASÓ.
- El retry automático de Vitest conservaba el entorno anterior. Director autorizó detener exclusivamente ese árbol identificado para evitar otra pasada completa sin información nueva. PID y padre se comprobaron; verify continuó hasta build. No se interrumpieron runner, verify ni árboles ajenos.
- Harness original FALLÓ por la restricción de transporte de los fixtures de numeración y por la pérdida de util.promisify.custom en el wrapper de execFile. Los deltas del auxiliar conservan controles de red y contratos Node; rechecks numeración 21/21 y watchdog 15/15 PASÓ. Se probaron resultado stdout/stderr, promise.child y denegación desde hijo. No hubo cambios en el harness ni sus tests preexistentes.
- Canonical conservado **FALLÓ / CIERRE INCOMPLETO**: harness y test; cinco omisiones: Edge, ledger de migraciones aplicadas, SQL, reconstrucción de esquema y E2E general. No se repitió la suite completa tras corregir los auxiliares. Los rechecks focales aprobados no sustituyen un canonical completo en verde.
- Controles documentales, numeración, constantes de funcionalidades, componentes, políticas de gobernanza y símbolos de migraciones pendientes PASÓ. El amarillo de migración 0495 es preexistente y queda fuera del alcance. No se consultó ni aplicó DB real.

Cierre de conocimiento del principal observado mediante Node directo: revisión `d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8`, ok true, estructura CURRENT, semántica PENDING, Archify CURRENT y archivos Obsidian CURRENT. Ese estado se observó; esta sesión no publicó ni abrió Obsidian. Coordinación en `6509009271b2d432d1cce86c973cf9bef5e15fb8`: ok false, estructura/semántica INVALID y Archify/Obsidian PENDING, rama no integrada. La entrega Worker registra por separado sus propios derivados y preview; no se atribuye cobertura semántica global a una extracción AST.

Worker: Graphify 0.9.61 actualizó AST propio (43.778 nodos, 79.870 aristas) con dos advertencias parciales de sintaxis ajenas. Los cambios posteriores de QA/handoff dejan estructura PENDING; el fragmento semántico preparado del README marketing (9 nodos, 8 relaciones) fue rechazado por el check de importación con esa estructura pendiente, sin forzar su registro. Archify 2.16.0 se obtuvo de copia local comprobada contra el lock; build/check PASÓ sobre `206728c5a`, con 9 checks/11 fuentes y las capas pendientes declaradas. La preview local se canceló por SOURCE_CHANGED cuando cambió la documentación durante la exportación: sigue PENDING y no hay publicación ni revisión visible en Obsidian de esta rama. Es deuda de derivados antes de una futura integración/publicación, no una prueba de producto fallida.

Entrega final revisada: **`d069b5b26df962b25f6476bfd7c3c626c4764be2`**, sobre base **`d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8`**. El delta posterior a `206728c5a4eca131a6240a67144be3749039b4fc` se limita a los dos auxiliares de ensayo y cuatro documentos/índice, ya inspeccionados; no cambia producto. Diff total de 16 archivos coincide exactamente con allowlist; `git diff --check` PASÓ y árbol tracked limpio. La reserva local sigue incluida en la historia.

**Aceptación Director:** P1 implementada y probada localmente en su alcance, sin observaciones bloqueantes del diff de producto. Esto no declara un gate global en verde ni aprueba release: conserva FALLÓ/INCOMPLETO, rechecks y omisiones descritos arriba. P2 móvil/P3 Ads no iniciados. La fuente Markdown de Kommo está preparada localmente, sin DOCX ni carga a la cuenta. No hay push, PR, merge, despliegue, migración ni mensajes/notificaciones enviados.

Worker liberó el claim `worker-0579-promesas-seguimiento`, conservando rama y worktree; servidor UI, navegador y fixtures propios finalizaron, puerto 45790 sin listener y `.next-verify` ausente. No se cerraron procesos ajenos. Esta revisión no autoriza borrar ramas/worktrees sin respaldo remoto ni iniciar integración.

El principal conserva `main` en `d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8` y los dos untracked preexistentes; no tiene cambios rastreados de esta tarea. Los archivos ajenos no se abrieron ni limpiaron. El commit que contiene este documento guarda la coordinación y revisión; el claim Director se libera al terminar ese commit.
