// @vitest-environment node
/**
 * SDD-0534 · 0486: completar una ruta TMS (complete_tms_route_governed,
 * 0320) con el correlation_id dentro de los 128 caracteres del writer AUD-01.
 * Control rojo, mutantes, deriva y texto: ver ./r3-correlation-contract.ts.
 */
import { describeCorrelationMigration } from "./r3-correlation-contract";

describeCorrelationMigration({
  n: "0486",
  src: "0320",
  file: "0486_tms_completar_ruta_correlation_id",
  srcFile: "0320_tms_route_completion_governance.sql",
  name: "complete_tms_route_governed",
  sig: "uuid,text,text",
  prefix: "tms-route-completion",
  idParam: "p_route_id",
  screenFile: "app/studio/(app)/tms/_components/RoutesTab.tsx",
  screenTemplate: "`tms-route-completion:${route.id}:${crypto.randomUUID()}`",
});
