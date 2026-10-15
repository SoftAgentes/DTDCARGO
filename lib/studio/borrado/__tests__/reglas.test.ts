/**
 * SDD-0522 · La regla pura del borrado: qué bloquea, con qué texto y el
 * resultado todo o nada. La base decide; esto es lo que la UI y la acción
 * tienen que leer igual.
 */
import { describe, expect, it } from "vitest";
import {
  AVISOS_EMBARQUE,
  BLOQUEOS_EMBARQUE,
  BLOQUEOS_RECEPCION,
  MAX_LOTE_BORRADO,
  SIN_DATOS_EMBARQUE,
  codigoResultadoRecepciones,
  interpretarFilas,
  mensajeResultadoEmbarques,
  normalizarLote,
  parseAvisos,
  parseBloqueos,
  receiptBoxesToRetire,
  receiptDeleteBlockers,
  shipmentDeleteBlockReason,
  shipmentDeleteWarningsSummary,
  tipoDeError,
} from "../reglas";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const sinAvisos = { avisos: {} };

describe("parseBloqueos · falla cerrado", () => {
  it("lee los tipos conocidos con su conteo", () => {
    expect(parseBloqueos({ invoices: 2, expenses: 1 }, BLOQUEOS_EMBARQUE)).toEqual({ invoices: 2, expenses: 1 });
  });

  it("una clave desconocida (guarda futura) bloquea como «otro», sumando", () => {
    expect(parseBloqueos({ guarda_nueva: 3, otra_mas: 1 }, BLOQUEOS_EMBARQUE)).toEqual({ otro: 4 });
  });

  it("un valor que no es entero positivo cuenta 1, no 0", () => {
    expect(parseBloqueos({ invoices: "2", expenses: 0, supplier_bills: null }, BLOQUEOS_EMBARQUE)).toEqual({
      invoices: 1,
      expenses: 1,
      supplier_bills: 1,
    });
  });

  it("algo que no es un objeto bloquea", () => {
    for (const raw of [null, undefined, "x", 3, [1]]) {
      expect(parseBloqueos(raw, BLOQUEOS_EMBARQUE)).toEqual({ otro: 1 });
    }
  });

  it("{} es «sin bloqueos»", () => {
    expect(parseBloqueos({}, BLOQUEOS_EMBARQUE)).toEqual({});
  });
});

describe("parseAvisos · no bloquean", () => {
  it("ignora lo desconocido y lo inválido", () => {
    expect(parseAvisos({ documents: 2, nuevo: 5, sent_notifications: "1" }, AVISOS_EMBARQUE)).toEqual({ documents: 2 });
    expect(parseAvisos(null, AVISOS_EMBARQUE)).toEqual({});
  });
});

describe("shipmentDeleteBlockReason", () => {
  it("sin bloqueos se puede: null", () => {
    expect(shipmentDeleteBlockReason({ bloqueos: {}, avisos: { documents: 3 } })).toBeNull();
  });

  it("sin información bloquea (la UI no ofrece lo que no comprobó)", () => {
    expect(shipmentDeleteBlockReason(null)).toBe(SIN_DATOS_EMBARQUE);
    expect(shipmentDeleteBlockReason(undefined)).toBe(SIN_DATOS_EMBARQUE);
  });

  it("nombra cada dependencia con su cantidad y su módulo, y qué hacer", () => {
    expect(shipmentDeleteBlockReason({ bloqueos: { invoices: 1, expenses: 2, cn_receipts: 3 }, ...sinAvisos })).toBe(
      "No se puede eliminar: tiene 1 factura sin anular (Facturación), 2 gastos (Gastos) y 3 recepciones en Almacén CN. Primero anula, elimina o desvincula eso en su módulo.",
    );
  });

  it("cada tipo de bloqueo produce un motivo", () => {
    for (const k of [...BLOQUEOS_EMBARQUE, "otro"] as const) {
      expect(shipmentDeleteBlockReason({ bloqueos: { [k]: 1 }, ...sinAvisos }), k).toMatch(/^(No se puede|Ya estaba)/);
    }
  });

  it("entregado y ya eliminado tienen su propio motivo y mandan", () => {
    expect(shipmentDeleteBlockReason({ bloqueos: { delivered: 1, invoices: 1 }, ...sinAvisos })).toBe(
      "No se puede eliminar: ya se entregó, y la entrega no se borra.",
    );
    expect(shipmentDeleteBlockReason({ bloqueos: { already_deleted: 1, delivered: 1 }, ...sinAvisos })).toBe(
      "Ya estaba eliminado. Recarga la lista.",
    );
  });

  it("tuteo, sin voseo", () => {
    const todos = Object.fromEntries([...BLOQUEOS_EMBARQUE].map((k) => [k, 2]));
    const texto = [
      shipmentDeleteBlockReason({ bloqueos: { ...todos, already_deleted: 0, delivered: 0 }, ...sinAvisos }),
      SIN_DATOS_EMBARQUE,
    ].join(" ");
    expect(texto).not.toMatch(/\b(anulá|eliminá|desvinculá|recargá|tenés|podés)\b/i);
    expect(texto).toMatch(/anula, elimina o desvincula/);
  });
});

describe("shipmentDeleteWarningsSummary", () => {
  it("suma los avisos de todos los elegidos", () => {
    expect(
      shipmentDeleteWarningsSummary([
        { bloqueos: {}, avisos: { documents: 2, sent_notifications: 1 } },
        { bloqueos: {}, avisos: { documents: 1, scheduled_notifications: 3, converted_quotes: 1 } },
        null,
      ]),
    ).toBe(
      "Se conservan 3 adjuntos y 1 aviso ya enviado. Se cancelan 3 avisos pendientes. 1 estimado queda marcado como convertido en un embarque eliminado.",
    );
  });

  it("sin nada que avisar: null", () => {
    expect(shipmentDeleteWarningsSummary([{ bloqueos: {}, avisos: {} }])).toBeNull();
  });
});

describe("receiptDeleteBlockers", () => {
  it("lista los tipos en orden fijo", () => {
    expect(receiptDeleteBlockers({ bloqueos: { stowed_boxes: 2, consolidated: 1 }, avisos: {} })).toEqual([
      { kind: "consolidated", count: 1 },
      { kind: "stowed_boxes", count: 2 },
    ]);
  });

  it("sin información bloquea; sin bloqueos, []", () => {
    expect(receiptDeleteBlockers(null)).toEqual([{ kind: "sin_datos", count: 1 }]);
    expect(receiptDeleteBlockers({ bloqueos: {}, avisos: { boxes: 4 } })).toEqual([]);
  });

  it("cuenta las cajas que se retiran", () => {
    expect(receiptBoxesToRetire([{ bloqueos: {}, avisos: { boxes: 4 } }, null, { bloqueos: {}, avisos: { boxes: 1 } }])).toBe(5);
  });
});

describe("normalizarLote", () => {
  it("1 a 100 uuid distintos, sin duplicados", () => {
    expect(normalizarLote([A, B, A.toUpperCase()])).toEqual({ ok: true, ids: [A, B] });
  });

  it("vacío, no-arreglo o con algo que no es uuid", () => {
    expect(normalizarLote([])).toEqual({ ok: false, motivo: "vacio" });
    expect(normalizarLote("x")).toEqual({ ok: false, motivo: "vacio" });
    expect(normalizarLote([A, "S-2026-0001"])).toEqual({ ok: false, motivo: "invalido" });
    expect(normalizarLote([A, null])).toEqual({ ok: false, motivo: "invalido" });
  });

  it("el tope es el de la base: 100 entran, 101 no", () => {
    const ids = (n: number) =>
      Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    expect(normalizarLote(ids(MAX_LOTE_BORRADO)).ok).toBe(true);
    expect(normalizarLote(ids(MAX_LOTE_BORRADO + 1))).toEqual({ ok: false, motivo: "maximo" });
  });
});

describe("interpretarFilas · todo o nada", () => {
  const fila = (id: string, outcome: string, blockers: unknown = {}) => ({ shipment_id: id, code: `S-${id.slice(0, 4)}`, outcome, blockers });

  it("todas borradas: eliminado con sus códigos", () => {
    expect(interpretarFilas([fila(A, "deleted"), fila(B, "deleted")], "shipment_id", [A, B], BLOQUEOS_EMBARQUE)).toEqual({
      estado: "eliminado",
      codigos: ["S-1111", "S-2222"],
    });
  });

  it("ninguna borrada: rechazado, con las bloqueadas y las que no existen", () => {
    const r = interpretarFilas(
      [fila(A, "blocked", { invoices: 1 }), fila(B, "not_found")],
      "shipment_id",
      [A, B],
      BLOQUEOS_EMBARQUE,
    );
    expect(r).toEqual({
      estado: "rechazado",
      bloqueadas: [{ id: A, codigo: "S-1111", outcome: "blocked", bloqueos: { invoices: 1 } }],
      noEncontradas: 1,
    });
  });

  it("una borrada y otra no rompe el contrato: sin_confirmar, nunca eliminado", () => {
    expect(
      interpretarFilas([fila(A, "deleted"), fila(B, "held")], "shipment_id", [A, B], BLOQUEOS_EMBARQUE),
    ).toEqual({ estado: "error", tipo: "sin_confirmar" });
  });

  it("filas que no cuadran con lo pedido: sin_confirmar", () => {
    const sc = { estado: "error", tipo: "sin_confirmar" };
    expect(interpretarFilas([fila(A, "deleted")], "shipment_id", [A, B], BLOQUEOS_EMBARQUE)).toEqual(sc);
    expect(interpretarFilas([fila(B, "deleted")], "shipment_id", [A], BLOQUEOS_EMBARQUE)).toEqual(sc);
    expect(interpretarFilas(null, "shipment_id", [A], BLOQUEOS_EMBARQUE)).toEqual(sc);
    expect(interpretarFilas([fila(A, "borrado")], "shipment_id", [A], BLOQUEOS_EMBARQUE)).toEqual(sc);
    expect(interpretarFilas([{ receipt_id: A, outcome: "deleted" }], "shipment_id", [A], BLOQUEOS_EMBARQUE)).toEqual(sc);
  });
});

describe("tipoDeError", () => {
  it("42501 permiso, 22023 entrada, el resto falla", () => {
    expect(tipoDeError({ code: "42501" })).toBe("permiso");
    expect(tipoDeError({ code: "22023" })).toBe("entrada");
    expect(tipoDeError({ code: "PGRST202" })).toBe("fallo");
    expect(tipoDeError(null)).toBe("fallo");
  });
});

describe("mensajeResultadoEmbarques", () => {
  it("el rechazo usa el mismo motivo que la casilla, por código", () => {
    const r = mensajeResultadoEmbarques({
      estado: "rechazado",
      bloqueadas: [{ id: A, codigo: "S-2026-0001", outcome: "blocked", bloqueos: { delivered: 1 } }],
      noEncontradas: 2,
    });
    expect(r).toEqual({
      error:
        "No se eliminó ningún embarque. S-2026-0001: No se puede eliminar: ya se entregó, y la entrega no se borra. 2 embarques ya no existen o no tienes acceso a ellos: recarga la lista.",
    });
  });

  it("eliminado: ok con conteo y códigos", () => {
    expect(mensajeResultadoEmbarques({ estado: "eliminado", codigos: ["S-1", "S-2"] })).toEqual({
      ok: true,
      deleted: 2,
      codes: ["S-1", "S-2"],
    });
  });
});

describe("codigoResultadoRecepciones", () => {
  it("bloqueadas: código bilingüe, cuántas y por qué cada una", () => {
    expect(
      codigoResultadoRecepciones({
        estado: "rechazado",
        bloqueadas: [{ id: A, codigo: "WR-2026-0001", outcome: "blocked", bloqueos: { ve_receipts: 1 } }],
        noEncontradas: 0,
      }),
    ).toEqual({
      errorCode: "cn_delete_blocked",
      errorParams: { count: 1 },
      blocked: [{ id: A, code: "WR-2026-0001", blockers: [{ kind: "ve_receipts", count: 1 }] }],
    });
  });

  it("sólo no encontradas; y cada error de la base con su código", () => {
    expect(codigoResultadoRecepciones({ estado: "rechazado", bloqueadas: [], noEncontradas: 1 })).toEqual({
      errorCode: "cn_delete_not_found",
    });
    expect(codigoResultadoRecepciones({ estado: "error", tipo: "permiso" })).toEqual({ errorCode: "permission_denied" });
    expect(codigoResultadoRecepciones({ estado: "error", tipo: "fallo" })).toEqual({ errorCode: "cn_delete_failed" });
    expect(codigoResultadoRecepciones({ estado: "error", tipo: "sin_confirmar" })).toEqual({
      errorCode: "cn_delete_unconfirmed",
    });
  });

  it("cada tipo de bloqueo de recepción tiene su clave", () => {
    for (const k of BLOQUEOS_RECEPCION) {
      expect(receiptDeleteBlockers({ bloqueos: { [k]: 1 }, avisos: {} })).toEqual([{ kind: k, count: 1 }]);
    }
  });
});
