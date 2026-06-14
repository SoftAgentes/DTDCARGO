import { describe, it, expect } from "vitest";
import { agruparPorViaje, RAIL_NODOS } from "@/lib/servicios-timeline";
import { SERVICIOS_DETALLE, SERVICIOS_GRUPOS } from "@/lib/servicios-detalle";

describe("agruparPorViaje — con el catálogo estático", () => {
  const { ddp, fases } = agruparPorViaje(SERVICIOS_DETALLE);

  it("separa DDP como paraguas", () => {
    expect(ddp).not.toBeNull();
    expect(ddp?.slug).toBe("dtd-services-lcl");
  });

  it("cubre las 18 fichas restantes sin duplicar ni perder ninguna", () => {
    const slugs = fases.flatMap((f) => f.servicios.map((s) => s.slug));
    expect(slugs).toHaveLength(SERVICIOS_DETALLE.length - 1); // 19 - DDP
    expect(new Set(slugs).size).toBe(slugs.length); // sin duplicados
    // DDP no aparece dentro de ninguna fase
    expect(slugs).not.toContain("dtd-services-lcl");
  });

  it("reparte cada servicio en su fase del viaje", () => {
    const porFase = Object.fromEntries(
      fases.map((f) => [f.id, f.servicios.map((s) => s.slug)]),
    );
    expect(porFase.origen).toEqual([
      "chequeo-etiquetado",
      "verificacion-proveedores",
      "auditoria-calidad",
      "lab-permisologia",
      "compra-asistida",
      "asesoria-pagos",
    ]);
    expect(porFase.recepcion_bodega).toEqual([
      "consolidacion-bodega-yiwu",
      "revision-recepcion",
      "etiquetado-piezas",
      "reempaque-defectuosas",
    ]);
    expect(porFase.transporte_aduana).toEqual([
      "lcl-consolidado",
      "reserva-contenedores",
      "transporte-terrestre",
      "transito-aduana",
      "documentos-importacion",
    ]);
    expect(porFase.transversal).toEqual([
      "muestras-courier",
      "visado-chino",
      "registro-marca-cn",
    ]);
  });

  it("devuelve las 4 fases en orden de viaje", () => {
    expect(fases.map((f) => f.id)).toEqual([
      "origen",
      "recepcion_bodega",
      "transporte_aduana",
      "transversal",
    ]);
  });

  it("reusa los blurbs aprobados de SERVICIOS_GRUPOS (cero copy nuevo)", () => {
    const blurbDe = Object.fromEntries(
      SERVICIOS_GRUPOS.map((g) => [g.id, g.blurb]),
    );
    const fase = (id: string) => fases.find((f) => f.id === id)!;
    expect(fase("origen").blurb).toBe(blurbDe.origen);
    expect(fase("recepcion_bodega").blurb).toBe(blurbDe.bodega);
    expect(fase("transporte_aduana").blurb).toBe(blurbDe.transporte);
    expect(fase("transversal").blurb).toBe(blurbDe.tramites);
  });

  it("no filtra campos internos al render (sin _pendiente)", () => {
    const todos = [ddp!, ...fases.flatMap((f) => f.servicios)];
    for (const s of todos) {
      expect(s).not.toHaveProperty("_pendiente");
    }
  });
});

describe("agruparPorViaje — robustez", () => {
  it("manda un slug desconocido a 'transversal' sin romper", () => {
    const fake = {
      slug: "servicio-fantasma-del-erp",
      titulo: "Servicio nuevo",
      sede: "ambas" as const,
      resumen: "x",
      incluye: [],
      noIncluye: [],
      precio: "",
      comoSolicitar: "",
      tiempos: "",
    };
    const { ddp, fases } = agruparPorViaje([fake]);
    expect(ddp).toBeNull();
    expect(fases).toHaveLength(1);
    expect(fases[0].id).toBe("transversal");
    expect(fases[0].servicios[0].slug).toBe("servicio-fantasma-del-erp");
  });

  it("con lista vacía no devuelve fases ni DDP", () => {
    const { ddp, fases } = agruparPorViaje([]);
    expect(ddp).toBeNull();
    expect(fases).toEqual([]);
  });
});

describe("RAIL_NODOS", () => {
  it("es 'Todo' + las 4 fases en orden", () => {
    expect(RAIL_NODOS.map((n) => n.id)).toEqual([
      "todo",
      "origen",
      "recepcion_bodega",
      "transporte_aduana",
      "transversal",
    ]);
  });
});
