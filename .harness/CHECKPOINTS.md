# Checkpoints de revisión DTD Cargo

Dueño: Director de ingeniería · Estado: vigente · Fecha: 2026-09-05.

Revisor compara evidencia con SDD/diff y el [runbook](../docs/runbooks/codex-engineering.md).
Marca cumplimiento, no aplica, excepción o no conformidad, con razón y archivo/línea.

- C1: Validación aplicable al SHA/base revisados. Producto usa verify (incluye build).
  Reportar PASÓ/FALLÓ/NO EJECUTADO/NO DISPONIBLE; exit 0 con SKIPs no prueba todo.
  Harness usa sus pruebas locales. Ledger producción se registra como release.
- C2: Frontera público/ERP intacta según ESLint y AGENTS; lib/shared único puente.
- C3 (DB): migración numerada sin colisiones nuevas. **Toda tabla nueva tiene RLS
  habilitado** y políticas que restringen el acceso por tenant_id cuando corresponde
  al modelo multi-tenant; revisar también grants y contratos SQL/schema efímeros.
  **Sin DDL destructivo (DROP / ALTER de columna) sin default o respaldo y estrategia
  segura de migración/recuperación revisada**. Un default no recupera datos eliminados:
  justificar la protección según la operación. Esta revisión no autoriza ejecutar
  DDL ni aplicar cambios en producción; eso exige aprobación concreta y el runbook.
- C4 (Studio): patrones de queries/actions/types, hogar del código, gobernanza y
  componentes canónicos según docs/engineering/project-rules.md.
- C5 (UI): BRAND, tokens/contraste, Norte vigente y /ui-check. /ui-pro cuando
  se requiera auditoría profunda. No existe ui-ux-designer.
- C6: Tests de aceptación significativos; no debilitar asserts/condiciones ni
  esconder omisiones para verde. Reparación externa solo si necesaria al objetivo.
- C7: SDD e índice coherentes. done solo cuando sus criterios están cumplidos;
  implementación, PR, integración y release quedan separados.
- C8: Un objetivo, commits coherentes/selectivos, sin cambios ajenos; pendientes
  propios separados de FUERA DE ALCANCE DETECTADO.
- C9: Ownership y aislamiento verificados. PR/head/base revisados, dependencias y
  colisiones con PRs pendientes consideradas; Worker no integra a main.
- C10: Handoff durable, autorizaciones de publicación/integración/release explícitas.
  Cleanup solo con evidencia de integración, preservación y ausencia de consumidores.
