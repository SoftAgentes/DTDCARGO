import { describe, it, expect } from "vitest";
import {
  armarOferta,
  getChargeMode,
  nucleosElegibles,
  DEFAULT_CHARGE_MODE,
  CHARGE_MODES,
  DEFAULT_OFFER_MATRIX,
  type OfferOverrides,
} from "../service-offer";
import { SERVICE_CATALOG, type ServicioId } from "../service-catalog";

describe("service-offer · anti-drift con el catálogo", () => {
  it("cada servicio del catálogo tiene un modo de cobro default", () => {
    for (const s of SERVICE_CATALOG) {
      expect(DEFAULT_CHARGE_MODE[s.id], `falta charge_mode de ${s.id}`).toBeDefined();
      expect(CHARGE_MODES).toContain(DEFAULT_CHARGE_MODE[s.id]);
    }
  });

  it("la matriz default solo tiene entradas de núcleo", () => {
    for (const id of Object.keys(DEFAULT_OFFER_MATRIX) as ServicioId[]) {
      const cat = SERVICE_CATALOG.find((s) => s.id === id);
      expect(cat?.tipo, `${id} no es núcleo pero está en la matriz`).toBe("nucleo");
    }
  });

  it("todo lo que la matriz sugiere/incluye es un id real del catálogo", () => {
    const ids = new Set(SERVICE_CATALOG.map((s) => s.id));
    for (const entry of Object.values(DEFAULT_OFFER_MATRIX)) {
      for (const id of [...entry!.suggests, ...entry!.includes]) {
        expect(ids.has(id), `${id} no existe en el catálogo`).toBe(true);
      }
    }
  });
});

describe("service-offer · modo embarque", () => {
  it("sin núcleo → default a DDP", () => {
    const o = armarOferta({ intencion: "embarque" });
    expect(o.nucleo).toBe("puerta-a-puerta-ddp");
    expect(o.modo).toBe("embarque");
  });

  it("DDP incluye aduana y NO la ofrece como sugerido", () => {
    const o = armarOferta({ intencion: "embarque", nucleoId: "puerta-a-puerta-ddp" });
    expect(o.incluidos).toContain("transito-aduana");
    expect(o.sugeridos).not.toContain("transito-aduana");
    expect(o.sugeridos).not.toContain("documentos-importacion");
  });

  it("LCL NO incluye aduana → la ofrece como sugerido", () => {
    const o = armarOferta({ intencion: "embarque", nucleoId: "lcl-consolidado" });
    expect(o.incluidos).toHaveLength(0);
    expect(o.sugeridos).toContain("transito-aduana");
  });

  it("FCL Fábrica NO sugiere servicios de bodega (no pasa por bodega DTD)", () => {
    const o = armarOferta({ intencion: "embarque", nucleoId: "fcl-directo" });
    expect(o.sugeridos).not.toContain("revision-recepcion");
    expect(o.sugeridos).not.toContain("etiquetado-piezas");
    expect(o.sugeridos).not.toContain("reempaque-defectuosas");
    // sí inspección + aduana SUGERIDA (el wizard no conoce la modalidad de
    // recepción del FCL — todo pagado la incluye, hasta puerto no)
    expect(o.sugeridos).toContain("inspeccion-calidad");
    expect(o.sugeridos).toContain("transito-aduana");
  });

  it("FCL Bodega SÍ sugiere servicios de bodega", () => {
    const o = armarOferta({ intencion: "embarque", nucleoId: "fcl-bodega" });
    expect(o.sugeridos).toContain("revision-recepcion");
  });

  it("sugeridos vienen ordenados por el orden del catálogo, sin duplicados", () => {
    const o = armarOferta({ intencion: "embarque", nucleoId: "lcl-consolidado" });
    const ordenes = o.sugeridos.map(
      (id) => SERVICE_CATALOG.find((s) => s.id === id)!.orden,
    );
    expect([...ordenes]).toEqual([...ordenes].sort((a, b) => a - b));
    expect(new Set(o.sugeridos).size).toBe(o.sugeridos.length);
  });

  it("ofrece los trámites transversales (visado, marca) en su propio slot", () => {
    const o = armarOferta({ intencion: "embarque", nucleoId: "puerta-a-puerta-ddp" });
    expect(o.transversales).toContain("visado-chino");
    expect(o.transversales).toContain("registro-marca-cn");
    expect(o.sugeridos).not.toContain("visado-chino");
  });

  it("el núcleo nunca aparece en sus propios sugeridos", () => {
    const o = armarOferta({ intencion: "embarque", nucleoId: "puerta-a-puerta-ddp" });
    expect(o.sugeridos).not.toContain("puerta-a-puerta-ddp");
  });

  it("un nucleoId que no es núcleo cae a DDP", () => {
    const o = armarOferta({ intencion: "embarque", nucleoId: "inspeccion-calidad" });
    expect(o.nucleo).toBe("puerta-a-puerta-ddp");
  });

  it("cobro cubre núcleo + sugeridos + transversales", () => {
    const o = armarOferta({ intencion: "embarque", nucleoId: "lcl-consolidado" });
    for (const id of [o.nucleo!, ...o.sugeridos, ...o.transversales]) {
      expect(o.cobro[id], `falta cobro de ${id}`).toBeDefined();
    }
    expect(o.cobro["puerta-a-puerta-ddp"] ?? o.cobro[o.nucleo!]).toBeDefined();
    expect(o.cobro["compra-asistida"]).toBe("tabla_comision");
  });
});

describe("service-offer · modos origen / suelto / estimar", () => {
  it("origen → sin núcleo, servicios de sourcing", () => {
    const o = armarOferta({ intencion: "origen" });
    expect(o.nucleo).toBeNull();
    expect(o.sugeridos).toContain("compra-asistida");
    expect(o.sugeridos).toContain("verificacion-proveedores");
  });

  it("suelto → trámites puntuales + courier", () => {
    const o = armarOferta({ intencion: "suelto" });
    expect(o.nucleo).toBeNull();
    expect(o.sugeridos).toContain("visado-chino");
    expect(o.sugeridos).toContain("registro-marca-cn");
    expect(o.sugeridos).toContain("muestras-courier");
  });

  it("estimar → vacío (rutea a la calculadora)", () => {
    const o = armarOferta({ intencion: "estimar" });
    expect(o.nucleo).toBeNull();
    expect(o.sugeridos).toHaveLength(0);
    expect(o.cobro).toEqual({});
  });
});

describe("service-offer · overrides (la DB pisa el default)", () => {
  it("override de suggests reemplaza la matriz default", () => {
    const ov: OfferOverrides = {
      "puerta-a-puerta-ddp": { suggests: ["compra-asistida"] },
    };
    const o = armarOferta({ intencion: "embarque", nucleoId: "puerta-a-puerta-ddp" }, ov);
    expect(o.sugeridos).toEqual(["compra-asistida"]);
  });

  it("override de includes saca el servicio de los sugeridos", () => {
    const ov: OfferOverrides = {
      "lcl-consolidado": { includes: ["transito-aduana"] },
    };
    const o = armarOferta({ intencion: "embarque", nucleoId: "lcl-consolidado" }, ov);
    expect(o.incluidos).toContain("transito-aduana");
    expect(o.sugeridos).not.toContain("transito-aduana");
  });

  it("override de chargeMode pisa el default", () => {
    expect(getChargeMode("compra-asistida")).toBe("tabla_comision");
    expect(
      getChargeMode("compra-asistida", {
        "compra-asistida": { chargeMode: "asesor" },
      }),
    ).toBe("asesor");
  });
});

describe("service-offer · nucleosElegibles", () => {
  it("devuelve los 5 núcleo en orden de catálogo", () => {
    const nucleos = nucleosElegibles();
    expect(nucleos).toEqual([
      "puerta-a-puerta-ddp",
      "lcl-consolidado",
      "fcl-bodega",
      "fcl-directo",
      "transporte-terrestre",
    ]);
  });
});
