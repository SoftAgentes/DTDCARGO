/**
 * SDD-0560 · El plan del asistente de borrado (`calcularPlan`), sin I/O.
 *
 * Lo que defiende, regla por regla:
 *   1. falla cerrado: lista que no cuadra, dependencia desconocida o algo sin
 *      comprobar → bloqueado, sin pasos;
 *   2. si algo no se resuelve, no se ofrece NADA (ni anular facturas);
 *   3. orden fijo: módulo → borrador (P2) → gasto/CxP/factura (P3) → embarque,
 *      sin importar el orden de la lectura;
 *   4. factura con asiento vivo (B1): bloquea;
 *   5. factura o CxP con cobros/pagos: se resuelve en su módulo.
 */
import { describe, expect, it } from "vitest";
import {
  GUARDAS_CON_PASO,
  RESOLUCION_DE_GUARDA,
  calcularPlan,
  type EntradaPlan,
  type FacturaDep,
  type Paso,
  type PlanBorrado,
} from "../asistente";
import { BLOQUEOS_EMBARQUE, type BloqueoEmbarque, type InfoBorradoEmbarque } from "../reglas";

const EMB = { id: "11111111-1111-4111-8111-111111111111", codigo: "S-2026-0042" };

function entrada(bloqueos: InfoBorradoEmbarque["bloqueos"], extra: Partial<EntradaPlan> = {}): EntradaPlan {
  return {
    embarque: EMB,
    info: { bloqueos, avisos: {} },
    facturas: [],
    gastos: [],
    cxp: [],
    rutas: [],
    consolidaciones: [],
    recepciones: [],
    compras: [],
    ...extra,
  };
}

const factura = (codigo: string, extra: Partial<FacturaDep> = {}): FacturaDep => ({
  id: `fac-${codigo}`,
  codigo,
  estado: "emitida",
  pagado: 0,
  asientoVivo: false,
  ...extra,
});

function enCurso(plan: PlanBorrado) {
  if (plan.estado !== "en_curso") throw new Error(`se esperaba en_curso y vino ${plan.estado}`);
  return plan;
}
function bloqueado(plan: PlanBorrado) {
  if (plan.estado !== "bloqueado") throw new Error(`se esperaba bloqueado y vino ${plan.estado}`);
  return plan;
}
const claves = (pasos: Paso[]) => pasos.map((p) => p.clave);

/** Un embarque con un paso de cada tipo, para revisar todos los textos. */
function todoParaTextos(): EntradaPlan {
  return entrada(
    { invoices: 3, expenses: 1, supplier_bills: 2, tms_routes: 1, naviera_consolidations: 1, cn_receipts: 1, purchases: 1 },
    {
      facturas: [factura("F-1"), factura("F-2", { estado: "borrador" }), factura("F-3", { estado: "parcial", pagado: 1 })],
      gastos: [{ id: "g", codigo: "EXP-1" }],
      cxp: [
        { id: "c-1", codigo: "CXP-1", estado: "pendiente", pagado: 0 },
        { id: "c-2", codigo: "CXP-2", estado: "parcial", pagado: 1 },
      ],
      rutas: [{ id: "r", codigo: "R-1", estado: "planificado" }],
      consolidaciones: [{ id: "n", codigo: "DTD-CONSOL-1" }],
      recepciones: [{ id: "w", codigo: "WR-1" }],
      compras: [{ id: "p", codigo: "DTD-1" }],
    },
  );
}

describe("la tabla de guardas → paso o bloqueo", () => {
  it("clasifica TODAS las guardas de la 0476 (salvo «ya eliminado»), y la de «otro»", () => {
    const esperadas = [...BLOQUEOS_EMBARQUE.filter((k) => k !== "already_deleted"), "otro"].sort();
    expect(Object.keys(RESOLUCION_DE_GUARDA).sort()).toEqual(esperadas);
  });

  it("las guardas con paso son exactamente las que la tabla no marca «bloquea»", () => {
    const conPaso = Object.entries(RESOLUCION_DE_GUARDA)
      .filter(([, r]) => r !== "bloquea")
      .map(([k]) => k)
      .sort();
    expect([...GUARDAS_CON_PASO].sort()).toEqual(conPaso);
  });

  it("las que bloquean siempre son las que pidió el Director y las que no tienen acción", () => {
    const bloquean = Object.entries(RESOLUCION_DE_GUARDA)
      .filter(([, r]) => r === "bloquea")
      .map(([k]) => k)
      .sort();
    expect(bloquean).toEqual(["china_finance", "client_claims", "customs_filings", "delivered", "otro", "shipment_costs"]);
  });
});

describe("estados sin pasos", () => {
  it("si la lectura de la 0476 falló: no_disponible", () => {
    expect(calcularPlan({ ...entrada({}), info: "fallo" }).estado).toBe("no_disponible");
  });
  it("si no vino la fila: no_encontrado", () => {
    expect(calcularPlan({ ...entrada({}), info: "no_encontrado" }).estado).toBe("no_encontrado");
  });
  it("ya eliminado gana a todo lo demás", () => {
    expect(calcularPlan(entrada({ already_deleted: 1, invoices: 1 })).estado).toBe("ya_eliminado");
  });
});

describe("sin nada que lo bloquee", () => {
  it("un solo paso: eliminar el embarque, R3 con motivo, con los avisos de la 0522", () => {
    const plan = enCurso(
      calcularPlan({ ...entrada({}), info: { bloqueos: {}, avisos: { documents: 2, scheduled_notifications: 1 } } }),
    );
    expect(claves(plan.pasos)).toEqual([`eliminar_embarque:${EMB.id}`]);
    expect(plan.siguiente).toBe(plan.pasos[0]);
    expect(plan.siguiente).toMatchObject({
      tipo: "asistente",
      accion: "eliminar_embarque",
      objetivoId: EMB.id,
      pideMotivo: true,
      friccion: "R3",
      titulo: "Eliminar el embarque S-2026-0042",
    });
    expect(plan.siguiente.consecuencia).toContain("Se conservan 2 adjuntos. Se cancela 1 aviso pendiente.");
  });
});

describe("el ejemplo de Sam: una factura emitida", () => {
  it("primero anular la factura, después eliminar el embarque", () => {
    const plan = enCurso(calcularPlan(entrada({ invoices: 1 }, { facturas: [factura("F-2026-0007")] })));
    expect(claves(plan.pasos)).toEqual(["anular_factura:fac-F-2026-0007", `eliminar_embarque:${EMB.id}`]);
    const anular = plan.siguiente;
    expect(anular).toMatchObject({
      tipo: "asistente",
      accion: "anular_factura",
      objetivoId: "fac-F-2026-0007",
      permanencia: "P3",
      friccion: "R3",
      pideMotivo: true,
      titulo: "Anular la factura F-2026-0007",
      boton: "Anular factura…",
    });
    expect(anular.consecuencia).toContain("No se borra, porque es un documento fiscal");
  });

  it("vencida también se anula; borrador se elimina (P2, R2, sin motivo)", () => {
    const plan = enCurso(
      calcularPlan(
        entrada(
          { invoices: 2 },
          { facturas: [factura("F-2", { estado: "vencida" }), factura("F-1", { estado: "borrador" })] },
        ),
      ),
    );
    expect(claves(plan.pasos)).toEqual(["eliminar_borrador_factura:fac-F-1", "anular_factura:fac-F-2", `eliminar_embarque:${EMB.id}`]);
    expect(plan.pasos[0]).toMatchObject({ permanencia: "P2", friccion: "R2", pideMotivo: false });
  });
});

describe("regla 4 · factura con asiento vivo: falla cerrado", () => {
  it("emitida con asiento vivo: bloqueado, sin ningún paso, y explica B1", () => {
    const plan = bloqueado(calcularPlan(entrada({ invoices: 1 }, { facturas: [factura("F-9", { asientoVivo: true })] })));
    expect(plan).not.toHaveProperty("pasos");
    expect(plan.bloqueos).toHaveLength(1);
    expect(plan.bloqueos[0].titulo).toBe("La factura F-9 tiene su asiento de venta vivo");
    expect(plan.bloqueos[0].detalle).toContain("B1");
    expect(plan.bloqueos[0].enlace?.href).toBe("/studio/facturacion/F-9");
  });

  it("sin poder comprobar el asiento: también bloquea", () => {
    const plan = bloqueado(calcularPlan(entrada({ invoices: 1 }, { facturas: [factura("F-9", { asientoVivo: null })] })));
    expect(plan.bloqueos[0].clave).toBe("asiento_sin_comprobar:fac-F-9");
  });

  it("un borrador con asiento vivo tampoco se ofrece", () => {
    const plan = calcularPlan(
      entrada({ invoices: 1 }, { facturas: [factura("F-9", { estado: "borrador", asientoVivo: true })] }),
    );
    expect(plan.estado).toBe("bloqueado");
  });

  it("una sola factura con asiento vivo frena también la que sí se podría anular", () => {
    const plan = bloqueado(
      calcularPlan(
        entrada({ invoices: 2 }, { facturas: [factura("F-1"), factura("F-2", { asientoVivo: true })] }),
      ),
    );
    expect(plan.bloqueos.map((b) => b.clave)).toEqual(["asiento_vivo:fac-F-2"]);
  });
});

describe("regla 2 · si algo no se resuelve, no se ofrece nada", () => {
  it.each([
    ["delivered", "Ya se entregó"],
    ["client_claims", "Tiene 1 reclamo"],
    ["customs_filings", "Tiene 1 expediente de Aduana"],
    ["shipment_costs", "Tiene un costeo"],
    ["china_finance", "Tiene 1 movimiento en Financiero China"],
    ["otro", "Tiene 1 dependencia que el asistente no conoce"],
  ] as [BloqueoEmbarque, string][])("%s con una factura anulable: sólo el bloqueo, ningún paso", (guarda, titulo) => {
    const plan = bloqueado(calcularPlan(entrada({ [guarda]: 1, invoices: 1 }, { facturas: [factura("F-1")] })));
    expect(plan.bloqueos.map((b) => b.titulo)).toEqual([titulo]);
  });

  it("el reclamo se explica como evidencia y no se ofrece eliminarlo", () => {
    const plan = bloqueado(calcularPlan(entrada({ client_claims: 2 })));
    expect(plan.bloqueos[0].detalle).toContain("Un reclamo es evidencia");
    expect(plan.bloqueos[0].enlace).toEqual({ href: "/studio/reclamos", etiqueta: "Ver en Reclamos" });
  });

  it("una guarda nueva sin manejador (la agrega una migración futura) bloquea igual", () => {
    const plan = bloqueado(calcularPlan(entrada({ ["guarda_futura" as BloqueoEmbarque]: 3 })));
    expect(plan.bloqueos[0].clave).toBe("guarda:guarda_futura");
  });
});

describe("regla 1 · la lista tiene que cuadrar con el conteo de la base", () => {
  it.each([
    ["no se pudo leer", null],
    ["vino una menos", []],
    ["vino una más", [factura("F-1"), factura("F-2")]],
    ["vino repetida", [factura("F-1"), factura("F-1")]],
  ])("facturas: %s → bloqueado", (_caso, facturas) => {
    const n = facturas?.length === 2 && facturas[0].id === facturas[1].id ? 2 : 1;
    const plan = bloqueado(calcularPlan(entrada({ invoices: n }, { facturas: facturas as FacturaDep[] | null })));
    expect(plan.bloqueos[0].clave).toBe("sin_confirmar:invoices");
  });

  it.each([
    ["expenses", "gastos"],
    ["supplier_bills", "cxp"],
    ["tms_routes", "rutas"],
    ["naviera_consolidations", "consolidaciones"],
    ["cn_receipts", "recepciones"],
    ["purchases", "compras"],
  ] as [BloqueoEmbarque, keyof EntradaPlan][])("%s sin poder leerse → bloqueado", (guarda, lista) => {
    const plan = bloqueado(calcularPlan(entrada({ [guarda]: 1 }, { [lista]: null })));
    expect(plan.bloqueos[0].clave).toBe(`sin_confirmar:${guarda}`);
  });
});

describe("regla 5 · cobros y pagos se resuelven en su módulo", () => {
  it.each([
    ["parcial", 10],
    ["pagada", 100],
    ["emitida", 5],
    ["emitida", Number.NaN],
  ])("factura %s con pagado %s → Cobranzas, antes de anular nada", (estado, pagado) => {
    const plan = enCurso(calcularPlan(entrada({ invoices: 1 }, { facturas: [factura("F-1", { estado, pagado })] })));
    expect(plan.siguiente).toMatchObject({
      tipo: "modulo",
      clave: "modulo:cobros:fac-F-1",
      modulo: "Cobranzas",
      enlace: { href: "/studio/cobranzas", etiqueta: "Abrir Cobranzas" },
    });
    expect(plan.pasos.some((p) => p.tipo === "asistente" && p.accion === "anular_factura")).toBe(false);
  });

  it("CxP pendiente sin pagos → la anula el asistente; con pagos → Tesorería", () => {
    const plan = enCurso(
      calcularPlan(
        entrada(
          { supplier_bills: 2 },
          {
            cxp: [
              { id: "c-2", codigo: "CXP-2", estado: "parcial", pagado: 40 },
              { id: "c-1", codigo: "CXP-1", estado: "pendiente", pagado: 0 },
            ],
          },
        ),
      ),
    );
    expect(claves(plan.pasos)).toEqual(["modulo:pagos:c-2", "anular_cxp:c-1", `eliminar_embarque:${EMB.id}`]);
  });

  it("estado desconocido de factura o CxP → bloqueado", () => {
    expect(calcularPlan(entrada({ invoices: 1 }, { facturas: [factura("F-1", { estado: "rara" })] })).estado).toBe(
      "bloqueado",
    );
    expect(
      calcularPlan(entrada({ supplier_bills: 1 }, { cxp: [{ id: "c", codigo: "C", estado: "rara", pagado: 0 }] })).estado,
    ).toBe("bloqueado");
  });
});

describe("rutas de TMS", () => {
  it("una ruta sin completar se cancela en TMS", () => {
    const plan = enCurso(
      calcularPlan(entrada({ tms_routes: 1 }, { rutas: [{ id: "r-1", codigo: "R-2026-0001", estado: "planificado" }] })),
    );
    expect(plan.siguiente).toMatchObject({ tipo: "modulo", titulo: "Cancelar la ruta R-2026-0001", modulo: "TMS" });
  });

  it("una ruta completada es última milla ocurrida: bloquea", () => {
    const plan = bloqueado(
      calcularPlan(
        entrada(
          { tms_routes: 2, invoices: 1 },
          {
            rutas: [
              { id: "r-1", codigo: "R-1", estado: "planificado" },
              { id: "r-2", codigo: "R-2", estado: "completado" },
            ],
            facturas: [factura("F-1")],
          },
        ),
      ),
    );
    expect(plan.bloqueos.map((b) => b.clave)).toEqual(["tms_completada"]);
  });
});

describe("regla 3 · el orden", () => {
  // Fixture infeliz: las listas llegan al revés y con códigos desordenados.
  const todo = entrada(
    {
      invoices: 3,
      expenses: 2,
      supplier_bills: 2,
      tms_routes: 1,
      naviera_consolidations: 1,
      cn_receipts: 2,
      purchases: 1,
    },
    {
      facturas: [factura("F-3"), factura("F-2", { estado: "borrador" }), factura("F-1", { estado: "parcial", pagado: 3 })],
      gastos: [
        { id: "g-2", codigo: "EXP-2" },
        { id: "g-1", codigo: "EXP-1" },
      ],
      cxp: [
        { id: "c-1", codigo: "CXP-1", estado: "pendiente", pagado: 0 },
        { id: "c-2", codigo: "CXP-2", estado: "pagada", pagado: 9 },
      ],
      rutas: [{ id: "r-1", codigo: "R-1", estado: "en_ruta" }],
      consolidaciones: [{ id: "n-1", codigo: "DTD-CONSOL-1" }],
      recepciones: [
        { id: "w-2", codigo: "WR-2" },
        { id: "w-1", codigo: "WR-1" },
      ],
      compras: [{ id: "p-1", codigo: "DTD-1-1-1" }],
    },
  );

  it("módulo → borrador → gastos → CxP → facturas → embarque", () => {
    const plan = enCurso(calcularPlan(todo));
    expect(claves(plan.pasos)).toEqual([
      "modulo:cn_receipts",
      "modulo:naviera_consolidations",
      "modulo:purchases",
      "modulo:tms_routes",
      "modulo:cobros:fac-F-1",
      "modulo:pagos:c-2",
      "eliminar_borrador_factura:fac-F-2",
      "anular_gasto:g-1",
      "anular_gasto:g-2",
      "anular_cxp:c-1",
      "anular_factura:fac-F-3",
      `eliminar_embarque:${EMB.id}`,
    ]);
    expect(plan.siguiente.clave).toBe("modulo:cn_receipts");
  });

  it("el último paso es siempre eliminar el embarque, y las claves no se repiten", () => {
    const plan = enCurso(calcularPlan(todo));
    expect(plan.pasos[plan.pasos.length - 1]).toMatchObject({ accion: "eliminar_embarque" });
    expect(new Set(claves(plan.pasos)).size).toBe(plan.pasos.length);
  });

  it("el plan no depende del orden en que llegaron las listas", () => {
    const alReves: EntradaPlan = {
      ...todo,
      facturas: [...(todo.facturas ?? [])].reverse(),
      gastos: [...(todo.gastos ?? [])].reverse(),
      cxp: [...(todo.cxp ?? [])].reverse(),
      recepciones: [...(todo.recepciones ?? [])].reverse(),
    };
    expect(claves(enCurso(calcularPlan(alReves)).pasos)).toEqual(claves(enCurso(calcularPlan(todo)).pasos));
  });

  it("nombra los códigos de cada dependencia", () => {
    const plan = enCurso(calcularPlan(todo));
    expect(plan.pasos[0].queEs).toContain("WR-1 y WR-2");
    expect(plan.pasos[0].titulo).toBe("Sacar 2 recepciones del contenedor");
  });
});

describe("los textos", () => {
  it("tuteo, sin voseo, en todo lo que el plan puede decir", () => {
    const planes = [
      calcularPlan(entrada({ delivered: 1, client_claims: 1, customs_filings: 1, shipment_costs: 1, china_finance: 1, otro: 1 })),
      calcularPlan(entrada({ invoices: 1 }, { facturas: [factura("F-1", { asientoVivo: true })] })),
      calcularPlan(entrada({ invoices: 1 }, { facturas: null })),
    ];
    const texto = JSON.stringify([...planes, calcularPlan(todoParaTextos())]);
    // Formas del voseo (con tilde). «anula», «revisa», «cancela» son tuteo y valen.
    expect(texto).not.toMatch(
      /(?<!\p{L})(elegí|confirmá|escribí|podés|tenés|anulá|cancelá|revisá|volvé|eliminá|sacá|abrí|devolvé|quitá)(?!\p{L})/u,
    );
    expect(texto).not.toMatch(/(?<!\p{L})vos(?!\p{L})/iu);
  });
});
