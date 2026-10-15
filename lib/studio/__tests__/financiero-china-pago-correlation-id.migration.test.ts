// @vitest-environment node
/**
 * SDD-0534 · 0483: marcar pagado en China un cruce de reclamo (Financiero China) (mark_claim_offset_paid_in_china_governed,
 * 0317) con el correlation_id dentro de los 128 caracteres del writer AUD-01.
 * Control rojo, mutantes, deriva y texto: ver ./r3-correlation-contract.ts.
 */
import { describeCorrelationMigration } from "./r3-correlation-contract";

describeCorrelationMigration({
  n: "0483",
  src: "0317",
  file: "0483_financiero_china_pago_correlation_id",
  srcFile: "0317_partner_claim_payment_governance.sql",
  name: "mark_claim_offset_paid_in_china_governed",
  sig: "uuid,date,text,text",
  prefix: "partner-claim-payment",
  idParam: "p_claim_id",
  screenFile: "app/studio/(app)/financiero-china/_components/ClaimOffsetsTab.tsx",
  screenTemplate: "`partner-claim-payment:${claim.id}:${crypto.randomUUID()}`",
});
