// @vitest-environment node
/**
 * SDD-0534 · 0484: liberar un trámite de Aduana SENIAT (clear_customs_filing_governed,
 * 0318) con el correlation_id dentro de los 128 caracteres del writer AUD-01.
 * Control rojo, mutantes, deriva y texto: ver ./r3-correlation-contract.ts.
 */
import { describeCorrelationMigration } from "./r3-correlation-contract";

describeCorrelationMigration({
  n: "0484",
  src: "0318",
  file: "0484_seniat_liberar_correlation_id",
  srcFile: "0318_customs_clearance_governance.sql",
  name: "clear_customs_filing_governed",
  sig: "uuid,date,text,text",
  prefix: "customs-clearance",
  idParam: "p_filing_id",
  screenFile: "app/studio/(app)/seniat/_components/FilingDetailDrawer.tsx",
  screenTemplate: "`customs-clearance:${filing.id}:${crypto.randomUUID()}`",
});
