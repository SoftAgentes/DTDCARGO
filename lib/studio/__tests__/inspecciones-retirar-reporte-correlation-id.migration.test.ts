// @vitest-environment node
/**
 * SDD-0534 · 0488: retirar un reporte de Inspecciones (retire_inspection_report_governed,
 * 0323) con el correlation_id dentro de los 128 caracteres del writer AUD-01.
 * Control rojo, mutantes, deriva y texto: ver ./r3-correlation-contract.ts.
 */
import { describeCorrelationMigration } from "./r3-correlation-contract";

describeCorrelationMigration({
  n: "0488",
  src: "0323",
  file: "0488_inspecciones_retirar_reporte_correlation_id",
  srcFile: "0323_inspection_report_retirement_governance.sql",
  name: "retire_inspection_report_governed",
  sig: "uuid,text,text,text",
  prefix: "inspection-report-retirement",
  idParam: "p_report_id",
  screenFile: "app/studio/(app)/inspecciones/_components/InspeccionesClient.tsx",
  screenTemplate: "`inspection-report-retirement:${reportId}:${crypto.randomUUID()}`",
});
