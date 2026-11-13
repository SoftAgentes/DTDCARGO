import { describe, expect, it } from "vitest";
import {
  DIAS_DESDE_PUERTO,
  DIAS_TRANSITO_DEFAULT,
  DIAS_TRANSITO_POR_PUERTO,
  diasDeTransito,
  estimarSeguimiento,
  leerFecha,
  rotuloFuente,
} from "@/lib/portal/seguimiento-estimado";

const dia = (iso: string | null | undefined) => (iso ?? "").slice(0, 10);

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

describe("SDD-0627 · revisión: vencidas, ETA conocida, terrestre y rótulos", () => {
  const base = {
    status: "shipped" as const,
    service: "consolidado_lcl" as const,
    stepDates: { shipped: "2026-09-01T12:00:00Z" },
    itinerario: { transitDays: 30 },
  };

  it("M1 · con «hoy» después de las fechas, las vencidas no se muestran como estimadas", () => {
    // Zarpe 01-sep + 30 = puerto 01-oct; bodega 11-oct; entrega 15-oct.
    const r = estimarSeguimiento({ ...base, ahoraIso: "2026-10-12T15:00:00Z" })!;
    expect(r.vencidas).toEqual(["in_transit", "in_customs", "arrived_destination"]);
    expect(r.porEtapa.in_transit).toBeUndefined();
    expect(r.porEtapa.arrived_destination).toBeUndefined();
    expect(dia(r.porEtapa.delivered)).toBe("2026-10-15");
    expect(r.etaPuertoIso).toBeNull();
    expect(r.entregaVencida).toBe(false);
  });

  it("M1 · entrega vencida: sin fecha y marcada para «Pendiente de confirmar»", () => {
    const r = estimarSeguimiento({ ...base, ahoraIso: "2027-01-01T00:00:00Z" })!;
    expect(r.entregaIso).toBeNull();
    expect(r.entregaVencida).toBe(true);
    expect(Object.keys(r.porEtapa)).toEqual([]);
  });

  it("M1 · el mismo día no vence (se compara por día de Caracas)", () => {
    // Puerto estimado 01-oct 12:00 UTC; «hoy» 01-oct 23:30 en Caracas (02-oct 03:30 UTC).
    const r = estimarSeguimiento({ ...base, ahoraIso: "2026-10-02T03:30:00Z" })!;
    expect(r.vencidas).not.toContain("in_customs");
    expect(dia(r.etaPuertoIso)).toBe("2026-10-01");
  });

  it("M2 · una ETA conocida (SeaRates o itinerario) manda sobre la estimada desde el zarpe", () => {
    const r = estimarSeguimiento({ ...base, etaPuertoConocida: "2026-10-20" })!;
    expect(r.fuente).toBe("naviera");
    expect(dia(r.etaPuertoIso)).toBe("2026-10-20");
    expect(dia(r.porEtapa.in_customs)).toBe("2026-10-20");
  });

  it("M2 · la aduana real manda sobre la ETA conocida", () => {
    const r = estimarSeguimiento({
      ...base,
      status: "in_customs",
      stepDates: { ...base.stepDates, in_customs: "2026-10-25T12:00:00Z" },
      etaPuertoConocida: "2026-10-20",
    })!;
    expect(r.fuente).toBe("aduana");
    expect(r.puertoReal).toBe(true);
    expect(dia(r.porEtapa.arrived_destination)).toBe("2026-11-04");
  });

  it("M3 · terrestre: sin puerto ni días de mar, con su propia fuente", () => {
    const r = estimarSeguimiento({
      status: "shipped",
      service: "transporte_terrestre",
      stepDates: { shipped: "2026-11-01T12:00:00Z" },
      etaPuertoConocida: "2026-12-01",
    })!;
    expect(r.fuente).toBe("terrestre");
    expect(r.etaPuertoIso).toBeNull();
    expect(r.diasTransito).toBe(0);
    expect(rotuloFuente(r.fuente)).toMatch(/despacho/);
    expect(rotuloFuente(r.fuente)).not.toMatch(/zarpe|puerto/);
  });

  it("B3 · los rótulos de «puerto» y «default» son distintos", () => {
    expect(rotuloFuente("puerto")).not.toBe(rotuloFuente("default"));
  });
});
