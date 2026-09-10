# Director — PR26 para revisión del correctivo de perfil

Fecha: 2026-09-07. Owner:01a073cc-1278-7422-81da-9f85c2fff047.
Task:pr26-publication-review-20260907.
Worktree:C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/pr26-publication-review-20260907.
Rama propia:codex/pr26-publication-review-20260907.
PR:https://github.com/hailuwaycom-sketch/DTDCARGO/pull/26.
Destino remoto:codex/0445-functional-remediation.
Fuente revisada:75e3c643826fc7221dd6ced1f298a2504df82899.
Head remoto previo:7f68d38436a75ca3a84c087ca36d689f79ecd31e.
Base:main74bb52ab9677f96908cc032a15f2364ab9d94716.
SDD:docs/specs/0438-portal-profile-functional-remediation/spec.md.

## Alcance y autorización

Sam delegó el2026-09-07 la priorización y ejecución de pendientes del goal continuo. Director publica para revisión el correctivo local ya revisado; las restricciones de publicación de la asignación histórica quedan como evidencia de aquel alcance. No se aplica0446 ni otra migración en producción; no se integra main. El push puede activar CI/preview habituales.

Se creó worktree propio y claim. Allowlist nueva: únicamente este handoff. Los seis archivos del delta frente a main, incluidos SQL, pruebas y runner, conservan exactamente75e3c643; el árbol de origen se preserva. La rama destino puede avanzar sin force porque su head previo y main son ancestros de la fuente.

## Comportamiento y evidencia

La PR invalida el veredicto de identidad al cambiar su evidencia y conserva el cupo vitalicio al fusionar clientes. La remediación ce9312a3 corrige el histórico A→B→C: sigue hasta el superviviente terminal del mismo tenant, conserva IDs/cardinalidad/cupos y rechaza ciclos, vínculos corruptos o terminales retirados con rollback completo. No reescribe0445 aplicada. El comentario posterior de07d1dea1 documenta la ventana de concurrencia y75e3c643 corrige la sonda del runner para esperar PostgreSQL final por TCP.

- PASÓ focal causal y corrida fría del runner:14 grupos esperados,1controlRED y13GREEN. Incluyen16saltos, fan-in, idempotencia, tenant nulo/cruzado, corrupción y rollback; cadena real0445→0446→0447 con merge_clients.
- PASÓ contrato SQL0446, documentación, gobernanza, numeración, sintaxis del runner y diff, según recibos propios del handoff de corrección.
- Revisión independiente de locks: deadlock reproducido tanto en baseline como en fix, sin regresión atribuida al correctivo. No hay garantía de lecturas ininterrumpidas ni de que las fusiones concurrentes sólo esperen.
- La validación de la combinación de perfil tiene su propio SHA50bb5f1b y límites. Sus150 aserciones E2E terminaron con exit1 por cierre del Worker; no se acreditan como E2E verde ni se transfieren como suite individual de75e3c643. Auth18/UAT y aceptación completa de la cadena siguen pendientes.
- Esta publicación ejecuta comprobaciones de documentación, numeración, diff, ancestralidad y equivalencia de producto. No repite pruebas de producto porque el único delta nuevo es este handoff. CI remoto se consulta para el head nuevo.

## Release y handoff

0446 requiere autorización nominal y preflight real antes de producción. Debe ejecutarse en ventana sin fusiones ni transacciones concurrentes relevantes; esperar las ya iniciadas y prever timeout/deadlock. Ante40P01, reintentar toda la transacción abortada, nunca una parte. La lectura anterior del ledger reportó0445 presente y0446 ausente; es evidencia fechada, no prueba de ausencia de ejecución manual ni sustituto del preflight productivo.

Se conserva la base main de PR26 y la separación de PR23/PR27. La revisión-only de PR29 no se amplía. Pendientes propios al preparar:push fast-forward, descripción, head/checks y liberación del claim. Pendientes de integración:clasificación de cobertura, revisión del head publicado y release autorizado. Fuera de alcance:Storage de PR27, China/WeChat, UI y datos reales. El SHA final se registra en la PR y recibo externo, sin autorreferencia de commits.
