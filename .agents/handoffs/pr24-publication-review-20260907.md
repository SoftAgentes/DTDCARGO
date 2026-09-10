# Director — publicación para revisión de PR24

Fecha: 2026-09-07. Owner: 01a073cc-1278-7422-81da-9f85c2fff047.
Task: pr24-publication-review-20260907.
Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/pr24-publication-review-20260907.
Rama propia: codex/pr24-publication-review-20260907.
PR destino: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/24.
Rama remota destino: codex/analytics-privacy.
Base comprobada: main 74bb52ab9677f96908cc032a15f2364ab9d94716.
Fuente local revisada: 7943e12e4306d3a1d73decf43417dbb79357955b.
Head remoto antes de publicar: 545af5756d61c1da27b6b86336e12f90a2459fd3.
SDD: docs/specs/0371-analytics-access-boundary/spec.md.

## Objetivo y autorización

Actualizar la PR existente con la corrección revisada de Analytics y sus pruebas, dejando el candidato disponible para CI y revisión. Sam delegó el 2026-09-07 la priorización y ejecución de los pendientes dentro del goal continuo. Director aplica esa autorización a esta publicación para revisión; los límites de publicación del encargo histórico quedan registrados como históricos. No se integra main ni se despliega manualmente, y no hay migraciones o datos de producción dentro de esta tarea. El push puede generar CI y preview habituales.

Allowlist de escritura de esta tarea: únicamente este handoff. Producto, tests, configuración, lockfile y documentación de la entrega fuente se conservan byte por byte. El árbol original del Worker se preserva. Claim adquirido antes de editar; se libera al terminar la publicación y su comprobación remota.

## Cambio que se publica

La PR excluye rutas privadas y URLs con credenciales de Analytics. La remediación 7d13021224292b4b6379ebdd2f4e9d34b9273166 impide que porcentajes malformados oculten credenciales anidadas dentro de atribución permitida; conserva campañas públicas legítimas. El sanitizador también descarta valores sensibles. Es el mismo código y las mismas pruebas de 7943e12e, ya combinado con main74bb52ab.

## Validación y procedencia

- Revisión independiente de 7d130212: 183 casos propios aprobados y cierre del bypass reproducido. Informe DTD-backups/director-goal-20260905/DTD-PR24-revalidacion-7d130212-20260905.md, SHA25695f7b9bffc063d48f281959a004c43e6aadffb149aa14e4e45f4026108e05b7f.
- Gate previo del mismo código: verify exit0 con14/16 pasos reales. Vitest6359/6359 en502 archivos, SQL139, rebuild380+18 y build aprobados. Ledger Cloud y E2E general fueron SKIP. El detalle y recibos constan en el handoff de remediación; esta tarea no vuelve a ejecutar esas suites ni transforma las omisiones en cobertura completa.
- E2E129 sin backend: PASÓ sobre b787b6f, mismo producto;129 intentos, cero fallos/flaky/skips. Recibo persistente DTD-backups/pr24-e2e-129-20260906T035639378Z/validated-summary.json.
- E2E21 con configuración pública: PASÓ sobre7943e12e, de2026-09-06T06:22:22.599Z a06:23:52.311Z;21 intentos, cero fallos/flaky/skips y exit0. Director corrigió el pendiente documental antiguo de39: estos21 sí se ejecutaron. Recibo DTD-backups/pr24-e2e-21-20260906/result.json SHA2562a780161b1c6c2147131e5887ed8c60d86108e8f6beea746f209a8ce9732dd7a; Playwright JSON9f42b4305527e90d2b5afbfedcd97a5deab6f79b71940b4adb93e0f1104734d3.
- Restan18 Auth. Las corridas129 y21 son separadas; no son una única suite168 aprobada. La infraestructura local de PR28 sigue siendo trabajo independiente.
- Esta publicación valida estado Git, ancestralidad, diff/documentación/numeración y correspondencia exacta de producto con la fuente revisada. CI del head publicado se consulta después del push; no se heredan checks del head remoto anterior.

## Commits y handoff

El commit que contiene este documento añade solamente evidencia de publicación. El SHA final se registra en la descripción de PR24 y el recibo externo del Director, evitando autorreferencias de commits.

Pendientes de esta tarea al preparar: push fast-forward a la rama existente, descripción actualizada y comprobación de head/base/CI. Pendientes de integración:18 Auth, clasificación del alcance aplicable, revisión del head publicado y autorización del efecto productivo. No se aprueba merge por este documento.

Fuera de alcance: operación interna de Google, retención/contratos, consentimiento integral, datos reales, permisos de Workers y otras PRs. No se certifica cumplimiento legal ni ausencia universal de fugas.
