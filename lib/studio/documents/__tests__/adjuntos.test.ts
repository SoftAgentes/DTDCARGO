// @vitest-environment node
/** SDD-0507 · funciones puras de «adjuntos visibles». */
import { describe, it, expect } from "vitest";
import {
  agruparAdjuntos,
  conteoCliente,
  conteoEmbarque,
  conteosPorId,
  desgloseCliente,
  desgloseEmbarque,
  moduloDeRutaAdjunto,
  pasaFiltroAdjuntos,
  textoAdjuntos,
  type Adjunto,
} from "../adjuntos";

describe("textos del indicador", () => {
  it("singular y plural", () => {
    expect(textoAdjuntos(1)).toBe("1 adjunto");
    expect(textoAdjuntos(5)).toBe("5 adjuntos");
  });

  it("desglose de un cliente: ficha, embarques y cuántos ve el cliente", () => {
    expect(desgloseCliente(conteoCliente(2, 1, 2))).toBe(
      "5 adjuntos: 2 en su ficha · 3 en sus embarques (2 los ve el cliente en el portal)",
    );
    expect(desgloseCliente(conteoCliente(1, 1, 0))).toBe(
      "2 adjuntos: 1 en su ficha · 1 en sus embarques",
    );
    // Todo lo del embarque lo ve el cliente: no se repite el número.
    expect(desgloseCliente(conteoCliente(0, 0, 1))).toBe(
      "1 adjunto: 1 en sus embarques (lo ve el cliente en el portal)",
    );
    expect(desgloseCliente(conteoCliente(3, 0, 0))).toBe("3 adjuntos: 3 en su ficha");
    expect(desgloseCliente(conteoCliente(0, 0, 0))).toBe(
      "Sin adjuntos en su ficha ni en sus embarques",
    );
  });

  it("desglose de un embarque", () => {
    expect(desgloseEmbarque(conteoEmbarque(1, 1))).toBe(
      "2 adjuntos: 1 interno · 1 lo ve el cliente en el portal",
    );
    expect(desgloseEmbarque(conteoEmbarque(2, 0))).toBe("2 adjuntos: 2 internos");
    expect(desgloseEmbarque(conteoEmbarque(0, 3))).toBe(
      "3 adjuntos: 3 los ve el cliente en el portal",
    );
    expect(desgloseEmbarque(conteoEmbarque(0, 0))).toBe("Sin adjuntos");
  });

  it("los totales salen de las partes", () => {
    expect(conteoCliente(2, 1, 2).total).toBe(5);
    expect(conteoEmbarque(1, 2).total).toBe(3);
  });
});

describe("filtro «con / sin adjuntos»", () => {
  const conteos = conteosPorId(
    new Map([
      ["a", conteoEmbarque(1, 0)],
      ["b", conteoEmbarque(0, 0)],
    ]),
  );

  it("conteosPorId conserva el null de «no se pudo contar»", () => {
    expect(conteosPorId(null)).toBeNull();
    expect(conteos).toEqual({ a: conteoEmbarque(1, 0), b: conteoEmbarque(0, 0) });
  });

  it("«con» deja los de total > 0, «sin» los de cero, «todos» todo", () => {
    expect(["a", "b"].filter((id) => pasaFiltroAdjuntos("con", conteos, id))).toEqual(["a"]);
    expect(["a", "b"].filter((id) => pasaFiltroAdjuntos("sin", conteos, id))).toEqual(["b"]);
    expect(["a", "b"].filter((id) => pasaFiltroAdjuntos("todos", conteos, id))).toEqual(["a", "b"]);
  });

  it("sin conteo (no se pudo contar) no filtra nada", () => {
    expect(pasaFiltroAdjuntos("con", null, "a")).toBe(true);
    expect(pasaFiltroAdjuntos("sin", null, "a")).toBe(true);
  });
});

function adj(id: string, createdAt: string, embarqueId: string | null): Adjunto {
  return {
    id, bucket: embarqueId ? "shipment-docs" : "documents", visibilidad: embarqueId ? "portal" : "interno",
    nombre: id, tipo: null, carpeta: null, contentType: null, sizeBytes: null,
    storagePath: `x/${id}`, createdAt, version: null, embarqueId,
  };
}

describe("agruparAdjuntos", () => {
  const e1 = { id: "e1", code: "S-2026-0001", origin: "Yiwu", destination: "Valencia" };
  const e2 = { id: "e2", code: "S-2026-0002", origin: "Shenzhen", destination: "Caracas" };
  const e3 = { id: "e3", code: "S-2026-0003", origin: null, destination: null };

  it("primero la ficha; después los embarques por su adjunto más reciente; sin grupos vacíos", () => {
    const r = agruparAdjuntos(
      [
        adj("f1", "2026-09-01", null),
        adj("f2", "2026-10-05", null),
        adj("x1", "2026-09-20", "e1"),
        adj("y1", "2026-10-01", "e2"),
        adj("y2", "2026-08-01", "e2"),
      ],
      [e1, e2, e3],
    );
    expect(r.total).toBe(5);
    expect(r.grupos.map((g) => (g.origen === "cliente" ? "ficha" : g.embarque.id))).toEqual([
      "ficha",
      "e2",
      "e1",
    ]);
    // Dentro de cada grupo, lo más nuevo arriba.
    expect(r.grupos[0].adjuntos.map((a) => a.id)).toEqual(["f2", "f1"]);
    expect(r.grupos[1].adjuntos.map((a) => a.id)).toEqual(["y1", "y2"]);
  });

  it("sin ficha empieza por los embarques; sin nada, ningún grupo", () => {
    expect(agruparAdjuntos([adj("x1", "2026-09-20", "e1")], [e1]).grupos[0].origen).toBe("embarque");
    expect(agruparAdjuntos([], [e1, e2])).toEqual({ total: 0, grupos: [] });
  });

  it("un adjunto de un embarque que no está en la lista no se inventa un origen", () => {
    const r = agruparAdjuntos([adj("z", "2026-10-01", "ajeno")], [e1]);
    expect(r).toEqual({ total: 0, grupos: [] });
  });
});

describe("moduloDeRutaAdjunto (qué se puede firmar desde «Todos los adjuntos»)", () => {
  const T = "11111111-1111-4111-8111-111111111111";
  const E = "22222222-2222-4222-8222-222222222222";
  const F = "33333333-3333-4333-8333-333333333333";

  it("acepta las formas que arman las subidas de hoy", () => {
    expect(moduloDeRutaAdjunto("documents", `${T}/client/${E}/${F}.pdf`)).toBe("clients");
    expect(moduloDeRutaAdjunto("documents", `${T}/shipment/${E}/${F}.jpg`)).toBe("tracking");
    expect(moduloDeRutaAdjunto("shipment-docs", `${T}/${E}/${F}.pdf`)).toBe("tracking");
  });

  it("rechaza otros buckets, otras entidades y rutas raras", () => {
    expect(moduloDeRutaAdjunto("payment-proofs", `${T}/${E}/${F}.pdf`)).toBeNull();
    expect(moduloDeRutaAdjunto("documents", `${T}/invoice/${E}/${F}.pdf`)).toBeNull();
    expect(moduloDeRutaAdjunto("documents", `${T}/none/none/${F}.pdf`)).toBeNull();
    expect(moduloDeRutaAdjunto("documents", `${T}/client/${E}/../${F}.pdf`)).toBeNull();
    expect(moduloDeRutaAdjunto("shipment-docs", `${T}/${E}/sub/${F}.pdf`)).toBeNull();
    expect(moduloDeRutaAdjunto("shipment-docs", `otro/${E}/${F}.pdf`)).toBeNull();
    expect(moduloDeRutaAdjunto("documents", "")).toBeNull();
  });
});
