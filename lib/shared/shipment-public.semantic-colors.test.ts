import { describe, expect, it } from "vitest";
import { STATUS_TONES } from "./shipment-public";
import { rateStatusTone } from "@/lib/studio/rate-types";
import { statusBadgeTone } from "@/lib/studio/invoice-types";
import { PAYMENT_STATUS_TONES } from "@/lib/studio/warehouse-cn-types";
import { prealertaStatusTone } from "@/lib/studio/prealertas/types";

describe("SDD-0441 · estado normal frente a riesgo real", () => {
  it("tránsito y aduana son información, incidencias conservan danger", () => {
    expect(STATUS_TONES.in_transit).toBe("info");
    expect(STATUS_TONES.in_customs).toBe("info");
    expect(STATUS_TONES.exception).toBe("danger");
    expect(STATUS_TONES.delivered).toBe("success");
    expect(STATUS_TONES.delayed_warehouse).toBe("warning");
  });
  it("no confunde factura parcial o pago pendiente con vencimiento", () => {
    expect(statusBadgeTone("parcial")).toBe("info");
    expect(statusBadgeTone("vencida")).toBe("danger");
    expect(PAYMENT_STATUS_TONES.pendiente).toBe("info");
    expect(PAYMENT_STATUS_TONES.pagado).toBe("success");
  });
  it("prealerta en camino no está en riesgo y consolidación confirma un hecho", () => {
    expect(prealertaStatusTone("en_camino")).toBe("info");
    expect(prealertaStatusTone("consolidada")).toBe("success");
  });
  it("borrador de tarifa es neutro", () => {
    expect(rateStatusTone("draft")).toBe("neutral");
    expect(rateStatusTone("published")).toBe("success");
  });
});
