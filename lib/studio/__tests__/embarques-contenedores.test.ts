/**
 * SDD-0643 · Agrupado de Embarques por contenedor: nombre visible, FCL o
 * consolidado, número DTD, filtros y orden. Datos inventados.
 */
import { describe, expect, it } from "vitest";
import {
  SIN_CONTENEDOR_KEY,
  agruparPorContenedor,
  clienteCoincide,
  contenedorCoincide,
  nombreDeContenedor,
  numeroDtdDeNotas,
  tipoDeContenedor,
  type ContenedorDeEmbarques,
} from "../embarques-contenedores";
import type { ShipmentListRow } from "../shipment-queries";

function cont(over: Partial<ContenedorDeEmbarques> & { id: string }): ContenedorDeEmbarques {
  return {
    ref: `DTD-CONSOL-${over.id}`,
    containerNo: null,
    numeroDtd: null,
    status: "zarpado",
    naviera: "Naviera X",
    eta: "2026-12-12",
    createdAt: "2026-10-01T00:00:00Z",
    ...over,
  };
}

function envio(over: Partial<ShipmentListRow> & { id: string }): ShipmentListRow {
  return {
    code: over.id.toUpperCase(),
    client_name: "Cliente A",
    client_markbox: "DTD-1001",
    origin: "Yiwu",
    destination: "La Guaira",
    shipment_service: "puerta_a_puerta_DDP",
    status: "in_transit",
    weight_kg: null,
    volume_m3: 1,
    created_at: "2026-10-02T00:00:00Z",
    ...over,
  };
}

describe("numeroDtdDeNotas", () => {
  it("lee el número que deja el cargador de la SDD-0543", () => {
    expect(numeroDtdDeNotas("Carga carga-consolidado:64:abcd1234 · contenedor DTD #64 · DDP")).toBe(64);
    expect(numeroDtdDeNotas("… contenedor DTD #7")).toBe(7);
  });
  it("sin el texto no hay número: no se inventa", () => {
    expect(numeroDtdDeNotas(null)).toBeNull();
    expect(numeroDtdDeNotas("Contenedor abierto a mano")).toBeNull();
    expect(numeroDtdDeNotas("DTD-CONSOL-0064")).toBeNull();
  });
});

describe("tipoDeContenedor", () => {
  it("FCL sólo si todos los embarques son FCL", () => {
    expect(tipoDeContenedor(["fcl_directo"])).toBe("fcl");
    expect(tipoDeContenedor(["fcl_bodega", "fcl_directo"])).toBe("fcl");
  });
  it("con un DDP o un LCL adentro es consolidado (modalidades ddp y mixto)", () => {
    expect(tipoDeContenedor(["puerta_a_puerta_DDP"])).toBe("consolidado");
    expect(tipoDeContenedor(["fcl_directo", "puerta_a_puerta_DDP"])).toBe("consolidado");
    expect(tipoDeContenedor(["consolidado_lcl"])).toBe("consolidado");
    expect(tipoDeContenedor([])).toBe("consolidado");
  });
});

describe("nombreDeContenedor", () => {
  it("«Contenedor 64» y «FCL 63»; nunca «lote»", () => {
    expect(nombreDeContenedor(cont({ id: "a", numeroDtd: 64 }), "consolidado")).toBe("Contenedor 64");
    expect(nombreDeContenedor(cont({ id: "b", numeroDtd: 63 }), "fcl")).toBe("FCL 63");
  });
  it("sin número DTD usa el ISO y, si falta, la ref", () => {
    expect(nombreDeContenedor(cont({ id: "a", containerNo: "ABCU1234567" }), "fcl")).toBe("FCL ABCU1234567");
    expect(nombreDeContenedor(cont({ id: "0009" }), "consolidado")).toBe("Contenedor DTD-CONSOL-0009");
  });
});

describe("contenedorCoincide", () => {
  const c64 = cont({ id: "a", numeroDtd: 64, containerNo: "ABCU7764550" });
  it("por número DTD exacto, con o sin prefijo", () => {
    for (const q of ["64", "#64", "contenedor 64", "Contenedor 64", "FCL 64", " 64 "]) {
      expect(contenedorCoincide(c64, q)).toBe(true);
    }
    expect(contenedorCoincide(c64, "6")).toBe(false);
    expect(contenedorCoincide(c64, "640")).toBe(false);
  });
  it("un número corto no busca dentro del ISO", () => {
    // El ISO tiene «64» adentro, pero «64» es el número DTD y este es el 65.
    expect(contenedorCoincide(cont({ id: "b", numeroDtd: 65, containerNo: "ABCU7764550" }), "64")).toBe(false);
  });
  it("por parte del ISO o de la ref, sin mayúsculas", () => {
    expect(contenedorCoincide(c64, "abcu776")).toBe(true);
    expect(contenedorCoincide(c64, "7764550")).toBe(true);
    expect(contenedorCoincide(c64, "consol-a")).toBe(true);
    expect(contenedorCoincide(c64, "ZZZU")).toBe(false);
  });
  it("vacío deja pasar todo; con texto, «Sin contenedor» no pasa", () => {
    expect(contenedorCoincide(null, "")).toBe(true);
    expect(contenedorCoincide(null, "64")).toBe(false);
  });
});

describe("clienteCoincide", () => {
  const r = envio({ id: "s1", client_name: "Comercial Ñandú", client_markbox: "DTD-5418" });
  it("por nombre sin acentos ni mayúsculas, o por Shipping Mark", () => {
    expect(clienteCoincide(r, "nandu")).toBe(true);
    expect(clienteCoincide(r, "COMERCIAL")).toBe(true);
    expect(clienteCoincide(r, "dtd-5418")).toBe(true);
    expect(clienteCoincide(r, "5418")).toBe(true);
    expect(clienteCoincide(r, "otro")).toBe(false);
  });
});

describe("agruparPorContenedor", () => {
  const c63 = cont({ id: "c63", numeroDtd: 63, createdAt: "2026-09-01T00:00:00Z" });
  const c64 = cont({ id: "c64", numeroDtd: 64, createdAt: "2026-09-20T00:00:00Z" });
  const cSin = cont({ id: "cx", createdAt: "2026-11-01T00:00:00Z" });
  const filas = [
    envio({ id: "a1", client_markbox: "DTD-1001" }),
    envio({ id: "a2", client_markbox: "DTD-1002", client_name: "Cliente B" }),
    envio({ id: "a3", client_markbox: "DTD-1001" }),
    envio({ id: "f1", client_markbox: "DTD-9000", client_name: "Dueño", shipment_service: "fcl_directo", volume_m3: null }),
    envio({ id: "x1", client_markbox: "DTD-1001" }),
    envio({ id: "suelto", client_markbox: "DTD-1001" }),
  ];
  const datos = {
    contenedores: [c63, c64, cSin],
    porEmbarque: { a1: "c64", a2: "c64", a3: "c64", f1: "c63", x1: "cx", suelto: "borrado" },
  };

  it("arma contenedor → cliente → embarques, con nombres y conteos", () => {
    const g = agruparPorContenedor(filas, datos);
    expect(g.map((x) => x.nombre)).toEqual(["Contenedor 64", "FCL 63", "Contenedor DTD-CONSOL-cx", "Sin contenedor"]);
    const g64 = g[0];
    expect(g64.tipo).toBe("consolidado");
    expect(g64.embarques).toBe(3);
    expect(g64.clientes.map((c) => c.clientMarkbox)).toEqual(["DTD-1001", "DTD-1002"]);
    expect(g64.clientes[0].shipments.map((s) => s.id)).toEqual(["a1", "a3"]);
    expect(g64.totalCbm).toBe(3);
    expect(g[1].tipo).toBe("fcl");
  });

  it("lo que no está en un contenedor vivo va a «Sin contenedor», al final", () => {
    const g = agruparPorContenedor(filas, datos);
    const ultimo = g[g.length - 1];
    expect(ultimo.key).toBe(SIN_CONTENEDOR_KEY);
    expect(ultimo.contenedor).toBeNull();
    expect(ultimo.tipo).toBeNull();
    expect(ultimo.clientes.flatMap((c) => c.shipments.map((s) => s.id))).toEqual(["suelto"]);
  });

  it("la llave del cliente es única en la pantalla aunque repita en dos contenedores", () => {
    const g = agruparPorContenedor(filas, datos);
    const llaves = g.flatMap((x) => x.clientes.map((c) => c.groupKey));
    expect(new Set(llaves).size).toBe(llaves.length);
  });

  it("un contenedor con alertas sube arriba; sin embarques no aparece", () => {
    const conAlerta = filas.map((r) => (r.id === "f1" ? { ...r, status: "exception" as const } : r));
    const g = agruparPorContenedor(conAlerta, datos);
    expect(g[0].nombre).toBe("FCL 63");
    expect(g[0].alertas).toBe(1);
    const sinC64 = agruparPorContenedor(filas.filter((r) => !r.id.startsWith("a")), datos);
    expect(sinC64.some((x) => x.key === "c64")).toBe(false);
  });
});
