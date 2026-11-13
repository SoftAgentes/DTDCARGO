import { describe, expect, it } from "vitest";
import {
  DIAS_DESDE_PUERTO,
  DIAS_TRANSITO_DEFAULT,
  DIAS_TRANSITO_POR_PUERTO,
  diasDeTransito,
  estimarSeguimiento,
  leerFecha,
} from "@/lib/portal/seguimiento-estimado";

const dia = (iso: string) => iso.slice(0, 10);

describe("SDD-0627 · días de tránsito", () => {
  it("usa los días del zarpe cuando vienen cargados", () => {
    expect(diasDeTransito({ transitDays: 33, etd: "2026-11-01", eta: "2026-12-30", pod: "PBL" })).toEqual({
      dias: 33,
      fuente: "zarpe",
    });
  });

  it("sin días, usa ETA − ETD del mismo itinerario", () => {
    expect(diasDeTransito({ etd: "2026-11-01", eta: "2026-12-06" })).toEqual({
      dias: 35,
      fuente: "itinerario",
    });
  });

  it("descarta valores absurdos y cae al puerto, y después al default", () => {
    expect(diasDeTransito({ transitDays: 0, etd: "2026-11-10", eta: "2026-11-01", pod: "lgu" })).toEqual({
      dias: DIAS_TRANSITO_POR_PUERTO.LGU,
      fuente: "puerto",
    });
    expect(diasDeTransito({ transitDays: 500, pod: "XXX" })).toEqual({
      dias: DIAS_TRANSITO_DEFAULT,
      fuente: "default",
    });
    expect(diasDeTransito(null)).toEqual({ dias: DIAS_TRANSITO_DEFAULT, fuente: "default" });
  });
});

describe("SDD-0627 · estimarSeguimiento", () => {
  it("antes del zarpe no estima nada (decisión de Sam)", () => {
    for (const status of ["in_warehouse", "consolidating"] as const) {
      expect(
        estimarSeguimiento({
          status,
          service: "consolidado_lcl",
          itinerario: { etd: "2026-11-01", transitDays: 30 },
        }),
      ).toBeNull();
    }
  });

  it("sin fecha de zarpe ni ETD no inventa una", () => {
    expect(
      estimarSeguimiento({ status: "shipped", service: "consolidado_lcl", stepDates: {} }),
    ).toBeNull();
  });

  it("terminales y excepción no se estiman", () => {
    for (const status of ["delivered", "cancelled", "draft", "exception"] as const) {
      expect(
        estimarSeguimiento({
          status,
          service: "consolidado_lcl",
          stepDates: { shipped: "2026-11-01T10:00:00Z" },
        }),
      ).toBeNull();
    }
  });

  it("zarpado: ETA de puerto = zarpe + días del zarpe; etapas futuras escalonadas", () => {
    const r = estimarSeguimiento({
      status: "shipped",
      service: "consolidado_lcl",
      stepDates: { shipped: "2026-11-01T10:00:00Z" },
      itinerario: { transitDays: 30, etd: "2026-10-28", pod: "PBL" },
    });
    expect(r).not.toBeNull();
    expect(r!.fuente).toBe("zarpe");
    expect(dia(r!.zarpeIso)).toBe("2026-11-01");
    expect(dia(r!.etaPuertoIso)).toBe("2026-12-01");
    expect(dia(r!.porEtapa.in_transit!)).toBe("2026-11-02");
    expect(dia(r!.porEtapa.in_customs!)).toBe("2026-12-01");
    expect(dia(r!.porEtapa.arrived_destination!)).toBe(
      dia(new Date(Date.parse("2026-12-01T10:00:00Z") + DIAS_DESDE_PUERTO.arrived_destination! * 864e5).toISOString()),
    );
    expect(r!.entregaIso).toBe(r!.porEtapa.delivered);
    // Las etapas ya cumplidas no llevan estimado.
    expect(r!.porEtapa.shipped).toBeUndefined();
    expect(r!.porEtapa.consolidating).toBeUndefined();
  });

  it("el zarpe real manda sobre el ETD del itinerario (un zarpe atrasado corre la ETA)", () => {
    const r = estimarSeguimiento({
      status: "in_transit",
      service: "puerta_a_puerta_DDP",
      stepDates: { shipped: "2026-11-10T00:00:00Z" },
      itinerario: { etd: "2026-11-01", eta: "2026-12-06" },
    });
    expect(r!.fuente).toBe("itinerario");
    expect(dia(r!.etaPuertoIso)).toBe("2026-12-15");
    expect(r!.porEtapa.in_transit).toBeUndefined();
  });

  it("embarcado sin evento (lote SQL) usa el ETD del itinerario como zarpe", () => {
    const r = estimarSeguimiento({
      status: "shipped",
      service: "fcl_directo",
      stepDates: {},
      itinerario: { etd: "2026-11-01", pod: "LGU" },
    });
    expect(r!.fuente).toBe("puerto");
    expect(dia(r!.etaPuertoIso)).toBe(
      dia(new Date(leerFecha("2026-11-01")! + DIAS_TRANSITO_POR_PUERTO.LGU * 864e5).toISOString()),
    );
  });

  it("en aduana con fecha real: el resto se ancla en esa fecha, no en el estimado de mar", () => {
    const r = estimarSeguimiento({
      status: "in_customs",
      service: "consolidado_lcl",
      stepDates: { shipped: "2026-11-01T00:00:00Z", in_customs: "2026-12-20T00:00:00Z" },
      itinerario: { transitDays: 30 },
    });
    expect(dia(r!.etaPuertoIso)).toBe("2026-12-20");
    expect(r!.porEtapa.in_customs).toBeUndefined();
    expect(dia(r!.porEtapa.arrived_destination!)).toBe("2026-12-30");
  });

  it("terrestre: entrega a pocos días del despacho, sin aduana", () => {
    const r = estimarSeguimiento({
      status: "shipped",
      service: "transporte_terrestre",
      stepDates: { shipped: "2026-11-01T00:00:00Z" },
    });
    expect(r!.porEtapa.in_customs).toBeUndefined();
    expect(dia(r!.entregaIso!)).toBe("2026-11-04");
  });

  it("los defaults caen dentro del rango real de la ruta a La Guaira (59–75 días)", () => {
    for (const dias of [DIAS_TRANSITO_DEFAULT, DIAS_TRANSITO_POR_PUERTO.LGU]) {
      expect(dias).toBeGreaterThanOrEqual(59);
      expect(dias).toBeLessThanOrEqual(75);
    }
  });

  it("es determinística: no lee el reloj", () => {
    const input = {
      status: "shipped" as const,
      service: "consolidado_lcl" as const,
      stepDates: { shipped: "2026-11-01T00:00:00Z" },
    };
    expect(estimarSeguimiento(input)).toEqual(estimarSeguimiento(input));
  });
});
