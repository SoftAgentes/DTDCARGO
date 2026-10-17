// @vitest-environment node
/**
 * SDD-0534 · 0485: pagar la indemnización de un reclamo (Reclamos) (pay_claim_indemnity_governed,
 * 0319) con el correlation_id dentro de los 128 caracteres del writer AUD-01.
 * Control rojo, mutantes, deriva y texto: ver ./r3-correlation-contract.ts.
 */
import { describeCorrelationMigration } from "./r3-correlation-contract";

describeCorrelationMigration({
  n: "0485",
  src: "0319",
  file: "0485_reclamos_pagar_indemnizacion_correlation_id",
  srcFile: "0319_claim_indemnity_payment_governance.sql",
  name: "pay_claim_indemnity_governed",
  sig: "uuid,text,date,text,text",
  prefix: "claim-indemnity-payment",
  idParam: "p_claim_id",
  screenFile: "app/studio/(app)/reclamos/_components/ReclamosClient.tsx",
  screenTemplate: "`claim-indemnity-payment:${claim.id}:${crypto.randomUUID()}`",
});
