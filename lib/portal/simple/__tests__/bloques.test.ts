// @vitest-environment node
/**
 * SDD-0654 fase 2 · armado de los bloques del inicio simple.
 * AC-8 (seis bloques, mismos y en el mismo orden, con y sin datos), AC-11 (no
 * nombra un hito oculto; sin lectura estricta no hay estado ni ruta), AC-12
 * (en construcción no hay ruta) y AC-14 (solo proveedores de la cuenta).
 */
import { describe, expect, it } from "vitest";
import { summarizeSuppliers } from "@/lib/studio/prealertas/types";
import type { ShipmentStatus } from "@/lib/shared/shipment-public";
import {
  ENLACE_PRO,
  ORDEN_BLOQUES,
  armarInicioSimple,
  armarProveedores,
  armarRuta,
  nombreDePila,
  partesCodigo,
  type DatosInicioSimple,
} from "../bloques";
import { ETAPAS_RUTA, FRASE_ESTADO } from "../contenido/estados";

const KPIS = {
  activeShipments: 0,
  deliveredYtd: 0,
  invoicesAvailable: true,
  invoicedTotal: 0,
  outstandingBalance: 0,
  currency: "USD" as const,
  mixedCurrencies: false,
  pendingInvoiceCount: 0,
};

const vacia: DatosInicioSimple = {
  nombre: "Mariela Ejemplo",
  markbox: "DTD-9999",
  nextArrival: null,
  shipments: [],
  ocultos: { ok: true, ocultos: new Set() },
  kpis: KPIS,
  profile: { hasPhoto: true, hasAddress: true, complete: true },
  pendingAcceptanceCodes: [],
  documentos: [],
  proveedores: [],
  asesor: null,
  seguimientoEnConstruccion: true,
};

const envio = (code: string, status: ShipmentStatus) => ({
  id: `id-${code}`,
  code,
  service: "consolidado_lcl" as const,
  status,
  origin: "Guangzhou",
  destination: "La Guaira",
  updatedAt: "2026-11-10T00:00:00Z",
});

const conDatos: DatosInicioSimple = {
  ...vacia,
  nextArrival: { ...envio("DTD-9999-1-1", "in_customs"), etaIso: "2026-12-08T00:00:00Z" },
  shipments: [envio("DTD-9999-1-1", "in_customs"), envio("DTD-9999-2-1", "in_warehouse"), envio("DTD-9999-3-1", "delivered")],
  kpis: { ...KPIS, outstandingBalance: 120, pendingInvoiceCount: 1 },
  profile: { hasPhoto: false, hasAddress: true, complete: false },
  pendingAcceptanceCodes: ["F-2026-0001"],
  documentos: [
    {
      id: "d1",
      docType: "otro",
      storagePath: "x/1.pdf",
      fileName: "Factura de las sillas.pdf",
      contentType: "application/pdf",
      sizeBytes: 1,
      createdAt: "2026-11-01T00:00:00Z",
      shipmentCode: "DTD-9999-1-1",
    },
  ],
  proveedores: summarizeSuppliers(
    "DTD-9999",
    [
      { id: "s2", supplier_seq: 2, name: "Repuestos Ejemplo", wechat: null, city: null, contact: null, notes: null },
      { id: "s1", supplier_seq: 1, name: "Muebles Ejemplo", wechat: null, city: null, contact: null, notes: null },
    ],
    { s2: 1 },
  ),
  asesor: { name: "Laura Pérez", phone: null, avatarUrl: null, positionLabel: "Asesora comercial" },
};

describe("bloques del inicio simple", () => {
  it("el orden es fijo y cada bloque enlaza a su pantalla de la Vista Pro (AC-8, AC-9)", () => {
    expect(ORDEN_BLOQUES).toEqual(["donde", "tareas", "saldo", "papeles", "proveedor", "duda"]);
    for (const id of ORDEN_BLOQUES) expect(ENLACE_PRO[id].href).toMatch(/^\/portal\//);
  });

  it("cuenta vacía: todos los bloques existen y dicen que no hay nada", () => {
    const r = armarInicioSimple(vacia);
    expect(r.saludo).toEqual({ nombre: "Mariela", markbox: "DTD-9999" });
    expect(r.donde.principal).toBeNull();
    expect(r.donde.otros).toEqual([]);
    expect(r.tareas).toEqual([]);
    expect(r.saldo).toEqual({ disponible: true, debe: false, monto: expect.any(String), facturasPorPagar: 0, variasMonedas: false });
    expect(r.papeles).toEqual({ bloqueado: false, ultimos: [], total: 0 });
    expect(r.proveedores).toEqual([]);
    expect(r.asesor).toBeNull();
  });

  it("cuenta con datos: tareas, saldo, papeles, proveedores y asesor", () => {
    const r = armarInicioSimple(conDatos);
    expect(r.tareas.map((t) => t.id)).toEqual(["aceptar-F-2026-0001", "perfil", "pagar"]);
    expect(r.tareas[0].href).toBe("/portal/facturas/F-2026-0001/aceptar");
    expect(r.saldo).toMatchObject({ disponible: true, debe: true, facturasPorPagar: 1 });
    expect(r.papeles).toMatchObject({ bloqueado: false, total: 1 });
    expect(r.asesor).toEqual({ nombre: "Laura Pérez", cargo: "Asesora comercial" });
    expect(r.donde.otros.map((o) => o.code)).toEqual(["DTD-9999-2-1", "DTD-9999-3-1"]);
  });

  it("facturas ilegibles: el saldo dice «no disponible» y no inventa una tarea de pago", () => {
    const r = armarInicioSimple({ ...conDatos, kpis: { ...conDatos.kpis, invoicesAvailable: false } });
    expect(r.saldo).toEqual({ disponible: false });
    expect(r.tareas.some((t) => t.id === "pagar")).toBe(false);
  });

  it("papeles cerrados hasta completar el perfil", () => {
    expect(armarInicioSimple({ ...conDatos, documentos: null }).papeles).toEqual({ bloqueado: true });
  });
});

describe("bloque 1 · estados ocultos y seguimiento (AC-11, AC-12)", () => {
  const conAduanaOculta = (enConstruccion: boolean): DatosInicioSimple => ({
    ...conDatos,
    ocultos: { ok: true, ocultos: new Set<ShipmentStatus>(["in_customs"]) },
    seguimientoEnConstruccion: enConstruccion,
  });

  it("con «en aduana» oculto, el bloque dice el último estado visible y no nombra la aduana", () => {
    const r = armarInicioSimple(conAduanaOculta(false));
    expect(r.donde.principal?.frase).toBe(FRASE_ESTADO.in_transit);
    expect(r.donde.principal?.frase).not.toMatch(/aduana/i);
    const ruta = r.donde.principal?.ruta ?? [];
    expect(ruta.map((e) => e.nombre)).not.toContain("Aduana");
    expect(ruta.find((e) => e.estado === "actual")?.nombre).toBe("En camino");
    expect(JSON.stringify(r)).not.toMatch(/aduana/i);
  });

  it("si la lectura estricta de ocultos falla, no hay estado ni ruta: solo la fecha estimada", () => {
    const r = armarInicioSimple({ ...conDatos, ocultos: { ok: false }, seguimientoEnConstruccion: false });
    expect(r.donde.principal?.frase).toBeNull();
    expect(r.donde.principal?.ruta).toBeNull();
    expect(r.donde.principal?.etaIso).toBe("2026-12-08T00:00:00Z");
    expect(r.donde.otros.every((o) => o.frase === null)).toBe(true);
  });

  it("si el estado oculto no tiene uno visible antes (o está fuera del flujo), no se nombra", () => {
    for (const status of ["in_warehouse", "delayed_warehouse", "exception"] as ShipmentStatus[]) {
      const r = armarInicioSimple({
        ...conDatos,
        nextArrival: { ...envio("DTD-9999-1-1", status), etaIso: null },
        shipments: [envio("DTD-9999-1-1", status)],
        ocultos: { ok: true, ocultos: new Set<ShipmentStatus>([status]) },
        seguimientoEnConstruccion: false,
      });
      expect(r.donde.principal?.frase).toBeNull();
      expect(r.donde.principal?.ruta).toBeNull();
    }
  });

  it("con el seguimiento en construcción no hay ruta de etapas (AC-12)", () => {
    const r = armarInicioSimple(conAduanaOculta(true));
    expect(r.donde.principal?.ruta).toBeNull();
    expect(r.donde.enConstruccion).toBe(true);
  });

  it("la ruta marca la etapa actual con el estado visible", () => {
    const ruta = armarRuta("in_transit", { ok: true, ocultos: new Set() }, false);
    expect(ruta?.map((e) => `${e.nombre}:${e.estado}`)).toEqual([
      "Comprado:hecha",
      "En almacén de China:hecha",
      "En camino:actual",
      "Aduana:pendiente",
      "Entrega:pendiente",
    ]);
    expect(armarRuta("cancelled", { ok: true, ocultos: new Set() }, false)).toBeNull();
  });

  it("cada estado tiene su frase y su etapa (salvo excepción y cancelado)", () => {
    for (const status of Object.keys(FRASE_ESTADO) as ShipmentStatus[]) {
      expect(FRASE_ESTADO[status].length).toBeGreaterThan(0);
      const enEtapa = ETAPAS_RUTA.some((e) => e.estados.includes(status));
      expect(enEtapa).toBe(status !== "exception" && status !== "cancelled");
    }
  });
});

describe("bloque 5 · proveedores (AC-13, AC-14)", () => {
  it("solo los proveedores de la cuenta, en orden, con el mismo próximo código que «Mis compras»", () => {
    const views = summarizeSuppliers(
      "DTD-9999",
      [
        { id: "s2", supplier_seq: 2, name: "Repuestos Ejemplo", wechat: null, city: null, contact: null, notes: null },
        { id: "s1", supplier_seq: 1, name: "Muebles Ejemplo", wechat: null, city: null, contact: null, notes: null },
      ],
      { s2: 1 },
    );
    const p = armarProveedores(views);
    expect(p.map((x) => [x.numero, x.codigo, x.compras])).toEqual([
      [1, "DTD-9999-1-1", 0],
      [2, "DTD-9999-2-2", 1],
    ]);
    for (const x of p) expect(x.codigo).toBe(views.find((v) => v.id === x.id)?.nextCode);
  });

  it("las partes del código", () => {
    expect(partesCodigo("DTD-9999-2-2")).toEqual({ prefijo: "DTD", cliente: "9999", proveedor: "2", compra: "2" });
    expect(partesCodigo("raro")).toBeNull();
  });

  it("nombre de pila", () => {
    expect(nombreDePila("  Mariela   Ejemplo ")).toBe("Mariela");
    expect(nombreDePila("")).toBe("");
  });
});
