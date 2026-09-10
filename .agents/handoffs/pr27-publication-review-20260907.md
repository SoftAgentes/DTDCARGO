# Director — publicación para revisión de PR27

Fecha: 2026-09-07. Owner: 01a073cc-1278-7422-81da-9f85c2fff047.
Task: pr27-publication-review-20260907.
Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/pr27-publication-review-20260907.
Rama propia: codex/pr27-publication-review-20260907.
Destino: PR27, codex/portal-profile-privacy-remediation.
Base conservada: portalcliente, 4289efc317c060620a7de9335030e9cd612d9aec (PR23).
Head remoto previo: 82fc49ff0a81c88929fdd0493ded27e9e8c1f0a2.
Fuente revisada: 3f2e80f17f293e8022528dbe12a63d4413b05cac.
SDD: docs/specs/0439-portal-cliente-edicion-de-perfil/spec.md.

## Alcance y autorización

Sam delegó el 2026-09-07 la priorización y ejecución de los pendientes del goal continuo. Director publica para revisión la remediación ya validada; la prohibición de push de la asignación local anterior se conserva como estado histórico. La autorización no incluye aplicar 0447 ni integrar main. Puede generarse preview al publicar.

Esta adopción usa las instrucciones Director/Worker vigentes del checkout principal y el encargo actual, conservando los archivos históricos de la base. Harness vigente invocado por ruta absoluta para crear y reclamar el worktree propio. Allowlist nueva: sólo este handoff. Se preservan código, pruebas y SQL de 3f2e80f1, el árbol fuente y la base de la PR. No se incorpora main, PR26 ni la combinación 50bb5f1b a esta rama.

## Comportamiento y evidencia

La PR contiene los nuevos reemplazos de fotos de identidad mientras faltan controles de retención y operación. La remediación d7717861 evita borrar una foto cuyo cambio pudo confirmarse en DB aunque se perdiera la respuesta de la RPC. Revalida sesión, cliente, tenant y prefijo; confirma éxito sólo con el mismo puntero. Conserva la carga ante incertidumbre y permite limpieza únicamente tras rechazo SQL exacto/HTTP4xx y lectura autorizada. No reenvía la mutación.

- Autor: RED causal de la respuesta perdida, GREEN final 27/27 con SDK Supabase real y transporte offline, ESLint, typecheck, docs, gobernanza, componentes y diff aprobados.
- Auditor independiente: 14 escenarios propios con blobs inmutables y SDK offline, exit0. Cierra el defecto de borrado de una foto comprometida; no hereda las 27 pruebas del autor. Informe DTD-backups/director-goal-20260905/pr27-uncertain-response-independent-review.md incluye el addendum de equivalencia del head 3f2e80f1.
- La limpieza DB/Storage no es atómica: la garantía depende del rechazo de la única RPC y el UUID exclusivo generado en servidor. El cambio conserva la contención de reemplazo; no resuelve retención, purga, hold regional ni una reconciliación durable posterior.
- La combinación de perfil tiene validación aparte sobre 45186f89/50bb5f1b: verify14/16 y 150 aserciones E2E, pero proceso exit1 por shutdown. Auth18/UAT siguen pendientes. No se atribuyen esos resultados como suite individual de este head.
- Esta publicación sólo añade documentación; se comprueban docs, numeración, diff, ancestralidad y equivalencia con la fuente. El workflow Calidad de main no está en esta base apilada; se informa su disponibilidad real después del push y no se importa tooling ajeno para aparentar CI.

## Integración y cierre

PR27 permanece sobre portalcliente/PR23; no es una candidata directa a main. La secuencia 0446/0447 y la integración de la cadena requieren revisión de bases, cobertura aplicable y autorización nominal de producción. El push no aplica SQL ni prueba Storage real. No se modifica la frontera review-only de PR29.

Pendientes propios al preparar: push fast-forward, descripción, comprobación remota y liberación de claim. El commit que contiene este handoff sólo documenta la publicación; el SHA final queda en la PR/recibo externo. Fuera de alcance: China/WeChat, retención real, datos personales, cleanup de otros árboles y PR23 completa. Esta revisión técnica no es una certificación legal.
