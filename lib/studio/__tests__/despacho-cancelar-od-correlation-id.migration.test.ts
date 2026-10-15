// @vitest-environment node
/**
 * SDD-0534 · 0489: cancelar una orden de Despacho (OD) (cancel_dispatch_order_governed,
 * 0324) con el correlation_id dentro de los 128 caracteres del writer AUD-01.
 * Control rojo, mutantes, deriva y texto: ver ./r3-correlation-contract.ts.
 */
import { describeCorrelationMigration } from "./r3-correlation-contract";

describeCorrelationMigration({
  n: "0489",
  src: "0324",
  file: "0489_despacho_cancelar_od_correlation_id",
  srcFile: "0324_dispatch_order_cancellation_governance.sql",
  name: "cancel_dispatch_order_governed",
  sig: "uuid,text,text,text",
  prefix: "dispatch-order-cancellation",
  idParam: "p_order_id",
  screenFile: "app/studio/(app)/despacho/_components/CancelOdDrawer.tsx",
  screenTemplate: "`dispatch-order-cancellation:${od.id}:${crypto.randomUUID()}`",
});
