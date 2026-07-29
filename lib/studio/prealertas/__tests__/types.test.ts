/**
 * Tests del módulo Portal · Compras (prealertas) + Proveedores (SDD-0057).
 * Cubre validadores (name/description vacíos, boxes 0/negativo, status inválido,
 * est_value negativo), el armado del código del Norte
 * `DTD-{clientNo}-{supplier_seq}-{order_seq}`, la lista de etiquetas por caja, el
 * resumen de proveedores y los helpers label/tone por status.
 */

import { describe, it, expect } from "vitest";
import {
  validateSupplierInput,
  validatePrealertaInput,
  PREALERTA_DESCRIPCION_PENDIENTE,
  normalizeClientNote,
  PREALERTA_CLIENT_NOTE_MAX,
  clientNoFromMarkbox,
  buildPrealertaCode,
  buildLabels,
  buildLabelsFromBoxes,
  summarizeSuppliers,
  prealertaStatusLabel,
  prealertaStatusTone,
  isPrealertaStatus,
  PREALERTA_STATUSES,
  PREALERTA_STATUS,
  type PrealertaStatus,
  buildPrealertaDocPath,
  isAllowedPrealertaDocMime,
  prealertaDocExtFromMime,
  inferPrealertaDocType,
  isPrealertaDocType,
  PREALERTA_DOC_TYPE_LABEL,
  PREALERTA_DOC_MAX_BYTES,
  normalizeSupplierProfileInput,
  supplierProfileRow,
  SUPPLIER_SOURCE_ORIGINS,
  SUPPLIER_PURCHASE_HISTORIES,
  SUPPLIER_COMM_METHODS,
} from "../types";

// ╔═══════════════════════════════════════════════════════════╗
// ║ validateSupplierInput                                      ║
// ╚═══════════════════════════════════════════════════════════╝

describe("validateSupplierInput", () => {
  it("acepta un proveedor válido y normaliza vacíos a null", () => {
    const { input, fieldErrors } = validateSupplierInput({
      name: "  Shenzhen Logistics  ",
      city: " Yiwu ",
      wechat: "",
      contact: "  ",
      notes: "Mayorista de textiles",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.name).toBe("Shenzhen Logistics");
    expect(input?.city).toBe("Yiwu");
    expect(input?.wechat).toBeNull();
    expect(input?.contact).toBeNull();
    expect(input?.notes).toBe("Mayorista de textiles");
  });

  it("rechaza name vacío", () => {
    const { input, fieldErrors } = validateSupplierInput({ name: "   " });
    expect(input).toBeUndefined();
    expect(fieldErrors?.name).toBeTruthy();
  });

  it("rechaza name ausente", () => {
    const { fieldErrors } = validateSupplierInput({});
    expect(fieldErrors?.name).toBeTruthy();
  });
});

// ╔═══════════════════════════════════════════════════════════╗
// ║ validatePrealertaInput                                     ║
// ╚═══════════════════════════════════════════════════════════╝

describe("validatePrealertaInput", () => {
  it("acepta una compra válida y normaliza campos", () => {
    const { input, fieldErrors } = validatePrealertaInput({
      supplierId: "  abc-123  ",
      description: "  3 cajas de zapatos  ",
      trackingCn: " SF123456789 ",
      boxes: 3,
      estValueUsd: 450.5,
      status: "en_camino",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.supplierId).toBe("abc-123");
    expect(input?.description).toBe("3 cajas de zapatos");
    expect(input?.trackingCn).toBe("SF123456789");
    expect(input?.boxes).toBe(3);
    expect(input?.estValueUsd).toBe(450.5);
    expect(input?.status).toBe("en_camino");
  });

  it("normaliza supplierId vacío a null (compra sin proveedor)", () => {
    const { input } = validatePrealertaInput({
      description: "muestra",
      boxes: 1,
      supplierId: "",
    });
    expect(input?.supplierId).toBeNull();
  });

  it("rechaza description vacía", () => {
    const { input, fieldErrors } = validatePrealertaInput({
      description: "   ",
      boxes: 2,
    });
    expect(input).toBeUndefined();
    expect(fieldErrors?.description).toBeTruthy();
  });

  it("rechaza boxes = 0", () => {
    const { fieldErrors } = validatePrealertaInput({
      description: "algo",
      boxes: 0,
    });
    expect(fieldErrors?.boxes).toBeTruthy();
  });

  it("rechaza boxes negativo", () => {
    const { fieldErrors } = validatePrealertaInput({
      description: "algo",
      boxes: -4,
    });
    expect(fieldErrors?.boxes).toBeTruthy();
  });

  it("rechaza boxes no entero", () => {
    const { fieldErrors } = validatePrealertaInput({
      description: "algo",
      boxes: 2.5,
    });
    expect(fieldErrors?.boxes).toBeTruthy();
  });

  it("rechaza est_value negativo", () => {
    const { fieldErrors } = validatePrealertaInput({
      description: "algo",
      boxes: 1,
      estValueUsd: -10,
    });
    expect(fieldErrors?.estValueUsd).toBeTruthy();
  });

  it("acepta est_value ausente (null)", () => {
    const { input } = validatePrealertaInput({
      description: "algo",
      boxes: 1,
    });
    expect(input?.estValueUsd).toBeNull();
  });

  it("acepta est_value como string numérico", () => {
    const { input } = validatePrealertaInput({
      description: "algo",
      boxes: 1,
      estValueUsd: "320.75" as unknown as number,
    });
    expect(input?.estValueUsd).toBe(320.75);
  });

  it("normaliza status inválido a 'anunciada'", () => {
    const { input } = validatePrealertaInput({
      description: "algo",
      boxes: 1,
      status: "qualquier" as unknown as PrealertaStatus,
    });
    expect(input?.status).toBe("anunciada");
  });

  it("default status = 'anunciada' cuando no viene", () => {
    const { input } = validatePrealertaInput({ description: "algo", boxes: 1 });
    expect(input?.status).toBe("anunciada");
  });
});

// ╔═══════════════════════════════════════════════════════════╗
// ║ validatePrealertaInput · requireDetalle: false (SDD-0172)  ║
// ╚═══════════════════════════════════════════════════════════╝

describe("validatePrealertaInput · sin detalle exigido (asistente 3 pasos)", () => {
  const suelto = { requireDetalle: false } as const;

  it("crea la compra sólo con proveedor", () => {
    const { input, fieldErrors } = validatePrealertaInput(
      { supplierId: "abc-123" },
      suelto,
    );
    expect(fieldErrors).toBeUndefined();
    expect(input?.supplierId).toBe("abc-123");
  });

  it("description vacía cae al marcador legible, no a cadena vacía", () => {
    const { input } = validatePrealertaInput({ description: "   " }, suelto);
    expect(input?.description).toBe(PREALERTA_DESCRIPCION_PENDIENTE);
    expect(input?.description.trim()).not.toBe("");
  });

  it("respeta la description cuando el cliente sí la escribió", () => {
    const { input } = validatePrealertaInput(
      { description: "  3 cajas de zapatos  " },
      suelto,
    );
    expect(input?.description).toBe("3 cajas de zapatos");
  });

  it("boxes ausente cae a 1", () => {
    const { input } = validatePrealertaInput({}, suelto);
    expect(input?.boxes).toBe(1);
  });

  it("boxes vacío ('') cae a 1 — el campo existe pero el cliente no lo tocó", () => {
    const { input } = validatePrealertaInput(
      { boxes: "" as unknown as number },
      suelto,
    );
    expect(input?.boxes).toBe(1);
  });

  // El formato NO se afloja: lo que el cliente escribe se sigue validando duro.
  it("sigue rechazando boxes = 0", () => {
    const { fieldErrors } = validatePrealertaInput({ boxes: 0 }, suelto);
    expect(fieldErrors?.boxes).toBeTruthy();
  });

  it("sigue rechazando boxes no entero", () => {
    const { fieldErrors } = validatePrealertaInput({ boxes: 1.5 }, suelto);
    expect(fieldErrors?.boxes).toBeTruthy();
  });

  it("sigue rechazando est_value negativo", () => {
    const { fieldErrors } = validatePrealertaInput(
      { estValueUsd: -10 },
      suelto,
    );
    expect(fieldErrors?.estValueUsd).toBeTruthy();
  });

  it("el modo por default sigue siendo el estricto de siempre", () => {
    const { input, fieldErrors } = validatePrealertaInput({});
    expect(input).toBeUndefined();
    expect(fieldErrors?.description).toBeTruthy();
    expect(fieldErrors?.boxes).toBeTruthy();
  });
});

// ╔═══════════════════════════════════════════════════════════╗
// ║ clientNoFromMarkbox                                        ║
// ╚═══════════════════════════════════════════════════════════╝

describe("clientNoFromMarkbox", () => {
  it("extrae el nº de cliente del MARKBOX", () => {
    expect(clientNoFromMarkbox("DTD-5532")).toBe("5532");
  });

  it("normaliza a mayúsculas y recorta espacios", () => {
    expect(clientNoFromMarkbox("  dtd-1001  ")).toBe("1001");
  });

  it("cae al MARKBOX completo si no tiene el patrón esperado", () => {
    expect(clientNoFromMarkbox("ABC123")).toBe("ABC123");
    expect(clientNoFromMarkbox("DTD-")).toBe("DTD-");
  });
});

// ╔═══════════════════════════════════════════════════════════╗
// ║ buildPrealertaCode · DTD-{clientNo}-{supplier_seq}-{order} ║
// ╚═══════════════════════════════════════════════════════════╝

describe("buildPrealertaCode", () => {
  it("arma el código del Norte", () => {
    expect(buildPrealertaCode("DTD-5532", 3, 2)).toBe("DTD-5532-3-2");
  });

  it("soporta seq > 9 (sin padding)", () => {
    expect(buildPrealertaCode("DTD-5532", 12, 27)).toBe("DTD-5532-12-27");
  });

  it("normaliza seq < 1 a 1 y trunca fraccionarios", () => {
    expect(buildPrealertaCode("DTD-5532", 0, -3)).toBe("DTD-5532-1-1");
    expect(buildPrealertaCode("DTD-5532", 2.9, 4.2)).toBe("DTD-5532-2-4");
  });

  it("normaliza el MARKBOX (mayúsculas)", () => {
    expect(buildPrealertaCode("dtd-1001", 1, 1)).toBe("DTD-1001-1-1");
  });
});

// ╔═══════════════════════════════════════════════════════════╗
// ║ buildLabels · etiquetas por caja (mismo code + Caja M/N)   ║
// ╚═══════════════════════════════════════════════════════════╝

describe("buildLabels", () => {
  it("arma una etiqueta por caja, todas con el MISMO code", () => {
    const labels = buildLabels("DTD-5532-3-2", 3);
    expect(labels).toHaveLength(3);
    expect(labels.map((l) => l.code)).toEqual([
      "DTD-5532-3-2",
      "DTD-5532-3-2",
      "DTD-5532-3-2",
    ]);
    expect(labels.map((l) => l.boxN)).toEqual([1, 2, 3]);
    expect(labels.every((l) => l.totalBoxes === 3)).toBe(true);
  });

  it("el nº de caja NO es un 5º segmento del código", () => {
    const labels = buildLabels("DTD-5532-3-2", 2);
    expect(labels[1].code).toBe("DTD-5532-3-2"); // no "DTD-5532-3-2-2"
  });

  it("normaliza boxes < 1 a 1 caja", () => {
    expect(buildLabels("DTD-5532-3-2", 0)).toHaveLength(1);
    expect(buildLabels("DTD-5532-3-2", -5)).toHaveLength(1);
  });

  it("trunca boxes fraccionario", () => {
    expect(buildLabels("DTD-5532-3-2", 4.9)).toHaveLength(4);
  });

  it("el fallback deja boxCode en null (etiqueta por cliente, no por caja)", () => {
    const labels = buildLabels("DTD-5532-3-2", 2);
    expect(labels.every((l) => l.boxCode === null)).toBe(true);
  });
});

// ╔═══════════════════════════════════════════════════════════╗
// ║ buildLabelsFromBoxes · SDD-0153 · etiqueta escaneable      ║
// ╚═══════════════════════════════════════════════════════════╝

describe("buildLabelsFromBoxes", () => {
  it("cada etiqueta lleva su DTD-B único como boxCode", () => {
    const labels = buildLabelsFromBoxes("DTD-5532-3-2", [
      { code: "DTD-B-000101", seq: 1 },
      { code: "DTD-B-000102", seq: 2 },
      { code: "DTD-B-000103", seq: 3 },
    ]);
    expect(labels).toHaveLength(3);
    expect(labels.map((l) => l.boxCode)).toEqual([
      "DTD-B-000101",
      "DTD-B-000102",
      "DTD-B-000103",
    ]);
    // el code de la compra sigue siendo el encabezado, igual en todas
    expect(labels.every((l) => l.code === "DTD-5532-3-2")).toBe(true);
  });

  it("boxN/totalBoxes salen del ORDEN, no del seq crudo (que puede tener huecos)", () => {
    // seq 4 y 7 tras una edición de conteo → la etiqueta dice 1/2 y 2/2
    const labels = buildLabelsFromBoxes("DTD-9-1-1", [
      { code: "DTD-B-000207", seq: 7 },
      { code: "DTD-B-000204", seq: 4 },
    ]);
    expect(labels.map((l) => l.boxN)).toEqual([1, 2]);
    expect(labels.every((l) => l.totalBoxes === 2)).toBe(true);
    // ordena por seq asc: el 4 va primero
    expect(labels[0].boxCode).toBe("DTD-B-000204");
    expect(labels[1].boxCode).toBe("DTD-B-000207");
  });

  it("lista vacía → sin etiquetas", () => {
    expect(buildLabelsFromBoxes("DTD-9-1-1", [])).toHaveLength(0);
  });
});

// ╔═══════════════════════════════════════════════════════════╗
// ║ summarizeSuppliers · lista del portal                     ║
// ╚═══════════════════════════════════════════════════════════╝

describe("summarizeSuppliers", () => {
  const suppliers = [
    { id: "s1", supplier_seq: 1, name: "Yiwu Standard Co" },
    { id: "s2", supplier_seq: 2, name: "Shenzhen Lights Ltd" },
  ];

  it("cuenta compras y arma el próximo código por proveedor", () => {
    const views = summarizeSuppliers("DTD-5532", suppliers, { s1: 2, s2: 1 });
    expect(views[0]).toMatchObject({
      supplierSeq: 1,
      orderCount: 2,
      nextCode: "DTD-5532-1-3",
    });
    expect(views[1]).toMatchObject({
      supplierSeq: 2,
      orderCount: 1,
      nextCode: "DTD-5532-2-2",
    });
  });

  it("proveedor sin compras → orderCount 0, próximo código termina en 1", () => {
    const views = summarizeSuppliers("DTD-5532", suppliers, {});
    expect(views[0].orderCount).toBe(0);
    expect(views[0].nextCode).toBe("DTD-5532-1-1");
    expect(views[1].nextCode).toBe("DTD-5532-2-1");
  });
});

// ╔═══════════════════════════════════════════════════════════╗
// ║ Helpers de label/tone por status                          ║
// ╚═══════════════════════════════════════════════════════════╝

describe("prealertaStatus helpers", () => {
  it("expone los 5 estados del enum", () => {
    expect(PREALERTA_STATUSES).toEqual([
      "anunciada",
      "en_camino",
      "recibida",
      "consolidada",
      "cancelada",
    ]);
  });

  it("label y tone para cada status del enum", () => {
    for (const status of PREALERTA_STATUSES) {
      expect(prealertaStatusLabel(status)).toBe(PREALERTA_STATUS[status].label);
      expect(prealertaStatusTone(status)).toBe(PREALERTA_STATUS[status].tone);
    }
  });

  it("label de un status desconocido devuelve el raw", () => {
    expect(prealertaStatusLabel("foo")).toBe("foo");
  });

  it("tone de un status desconocido cae a 'neutral'", () => {
    expect(prealertaStatusTone("foo")).toBe("neutral");
  });

  it("isPrealertaStatus discrimina", () => {
    expect(isPrealertaStatus("recibida")).toBe(true);
    expect(isPrealertaStatus("foo")).toBe(false);
    expect(isPrealertaStatus(123)).toBe(false);
    expect(isPrealertaStatus(null)).toBe(false);
  });
});

// ╔═══════════════════════════════════════════════════════════╗
// ║ Adjuntos de la compra (prealerta_documents · migr 0118)    ║
// ╚═══════════════════════════════════════════════════════════╝

describe("summarizeSuppliers · wechat", () => {
  it("propaga el wechat del proveedor a la vista (null si falta)", () => {
    const views = summarizeSuppliers(
      "DTD-5532",
      [
        { id: "s1", supplier_seq: 1, name: "Yiwu Co", wechat: "wxid_abc" },
        { id: "s2", supplier_seq: 2, name: "Shenzhen Co" },
      ],
      {},
    );
    expect(views[0].wechat).toBe("wxid_abc");
    expect(views[1].wechat).toBeNull();
  });
});

describe("summarizeSuppliers · city/contact/notes (alta desde Studio, 2026-07-12)", () => {
  it("propaga ciudad, contacto y notas a la vista (null si faltan)", () => {
    const views = summarizeSuppliers(
      "DTD-5532",
      [
        {
          id: "s1",
          supplier_seq: 1,
          name: "Yiwu Co",
          city: "Yiwu",
          contact: "+86 138 0000 0000",
          notes: "Prefiere WeChat",
        },
        { id: "s2", supplier_seq: 2, name: "Shenzhen Co" },
      ],
      {},
    );
    expect(views[0]).toMatchObject({
      city: "Yiwu",
      contact: "+86 138 0000 0000",
      notes: "Prefiere WeChat",
    });
    expect(views[1].city).toBeNull();
    expect(views[1].contact).toBeNull();
    expect(views[1].notes).toBeNull();
  });
});

describe("helpers de adjuntos de compra", () => {
  it("isPrealertaDocType discrimina los 5 tipos (SDD-0096 agrega 'otro')", () => {
    for (const t of ["packing", "factura", "foto", "whatsapp", "otro"]) {
      expect(isPrealertaDocType(t)).toBe(true);
    }
    expect(isPrealertaDocType("bl")).toBe(false);
    expect(isPrealertaDocType(null)).toBe(false);
    expect(isPrealertaDocType(123)).toBe(false);
  });

  it("hay label legible para cada tipo", () => {
    expect(PREALERTA_DOC_TYPE_LABEL.packing).toMatch(/packing/i);
    expect(PREALERTA_DOC_TYPE_LABEL.whatsapp).toMatch(/wechat/i);
    expect(PREALERTA_DOC_TYPE_LABEL.otro).toMatch(/otro/i);
  });

  it("acepta mimes de imagen/pdf + Office (SDD-0096: xlsx/csv/doc para resubir el Excel)", () => {
    expect(isAllowedPrealertaDocMime("application/pdf")).toBe(true);
    expect(isAllowedPrealertaDocMime("image/jpeg")).toBe(true);
    expect(isAllowedPrealertaDocMime("image/heic")).toBe(true);
    expect(
      isAllowedPrealertaDocMime(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe(true); // xlsx
    expect(isAllowedPrealertaDocMime("text/csv")).toBe(true);
    expect(isAllowedPrealertaDocMime("application/zip")).toBe(false);
    expect(isAllowedPrealertaDocMime("text/html")).toBe(false);
  });

  it("mapea el mime a la extensión canónica", () => {
    expect(prealertaDocExtFromMime("application/pdf")).toBe("pdf");
    expect(prealertaDocExtFromMime("image/jpeg")).toBe("jpg");
    expect(prealertaDocExtFromMime("image/png")).toBe("png");
    expect(prealertaDocExtFromMime("image/heic")).toBe("heic");
    expect(
      prealertaDocExtFromMime(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe("xlsx"); // SDD-0096
    expect(prealertaDocExtFromMime("text/csv")).toBe("csv");
    expect(prealertaDocExtFromMime("application/octet-stream")).toBe("bin");
  });

  it("infiere doc_type por mime (SDD-0096: imagen→foto, hoja→packing, resto→otro)", () => {
    expect(inferPrealertaDocType("image/jpeg")).toBe("foto");
    expect(inferPrealertaDocType("image/png")).toBe("foto");
    expect(
      inferPrealertaDocType(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe("packing");
    expect(inferPrealertaDocType("text/csv")).toBe("packing");
    expect(inferPrealertaDocType("application/pdf")).toBe("otro");
    expect(
      inferPrealertaDocType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("otro");
  });

  it("arma el path {tenant}/{prealerta}/{uuid}.{ext}", () => {
    expect(
      buildPrealertaDocPath({
        tenantId: "t-1",
        prealertaId: "p-1",
        uuid: "u-1",
        ext: "jpg",
      }),
    ).toBe("t-1/p-1/u-1.jpg");
  });

  it("el límite de archivo es 15 MB (SDD-0096: subido de 10 a 15 para fotos de móvil)", () => {
    expect(PREALERTA_DOC_MAX_BYTES).toBe(15 * 1024 * 1024);
  });
});

// ╔═══════════════════════════════════════════════════════════╗
// ║ Ficha extendida del proveedor (SDD-0172 · migr 0266)       ║
// ╚═══════════════════════════════════════════════════════════╝

describe("normalizeSupplierProfileInput", () => {
  it("acepta la ficha completa y devuelve slugs, no etiquetas", () => {
    const p = normalizeSupplierProfileInput({
      industry: "  calzado deportivo  ",
      contactPhone: " +86 138 0000 0000 ",
      sourceOrigin: "feria_canton",
      purchaseHistory: "previo",
      commMethod: "wechat",
    });
    expect(p.industry).toBe("calzado deportivo");
    expect(p.contactPhone).toBe("+86 138 0000 0000");
    expect(p.sourceOrigin).toBe("feria_canton");
    expect(p.purchaseHistory).toBe("previo");
    expect(p.commMethod).toBe("wechat");
  });

  it("todo vacío → todo null (la ficha es opcional)", () => {
    const p = normalizeSupplierProfileInput({});
    expect(Object.values(p).every((v) => v === null)).toBe(true);
  });

  // El CHECK de la DB es la última línea, no la primera: un valor fuera del
  // vocabulario NO debe tumbar el alta del proveedor.
  it("un valor fuera del vocabulario cae a null, no revienta", () => {
    const p = normalizeSupplierProfileInput({
      sourceOrigin: "mercadolibre",
      purchaseHistory: "quizás",
      commMethod: "telepatía",
    });
    expect(p.sourceOrigin).toBeNull();
    expect(p.purchaseHistory).toBeNull();
    expect(p.commMethod).toBeNull();
  });

  it("la nota sobrevive sólo si el origen la pide", () => {
    const conNota = normalizeSupplierProfileInput({
      sourceOrigin: "recomendado",
      sourceOriginNote: "  me lo pasó Juan  ",
    });
    expect(conNota.sourceOriginNote).toBe("me lo pasó Juan");

    // Alibaba no pregunta nada → la nota sería un texto huérfano.
    const sinNota = normalizeSupplierProfileInput({
      sourceOrigin: "alibaba",
      sourceOriginNote: "algo que quedó de antes",
    });
    expect(sinNota.sourceOriginNote).toBeNull();
  });

  it("'otro' también pide nota", () => {
    const p = normalizeSupplierProfileInput({
      sourceOrigin: "otro",
      sourceOriginNote: "un contacto de la feria de Yiwu",
    });
    expect(p.sourceOriginNote).toBe("un contacto de la feria de Yiwu");
  });

  it("supplierProfileRow mapea a los nombres de columna de la migr 0266", () => {
    const row = supplierProfileRow(
      normalizeSupplierProfileInput({
        industry: "LED",
        contactPhone: "+8613800000000",
        sourceOrigin: "1688",
        purchaseHistory: "nuevo",
        commMethod: "alibaba",
      }),
    );
    expect(row).toEqual({
      industry: "LED",
      contact_phone: "+8613800000000",
      source_origin: "1688",
      source_origin_note: null,
      purchase_history: "nuevo",
      comm_method: "alibaba",
    });
  });

  it("los vocabularios del código son los MISMOS que los CHECK de la migración", () => {
    // Si alguien agrega una opción en el código y olvida la migración, el
    // insert falla en prod con un CHECK violation. Este test lo caza acá.
    expect([...SUPPLIER_SOURCE_ORIGINS]).toEqual([
      "alibaba",
      "1688",
      "feria_canton",
      "recomendado",
      "otro",
    ]);
    expect([...SUPPLIER_PURCHASE_HISTORIES]).toEqual(["nuevo", "previo"]);
    expect([...SUPPLIER_COMM_METHODS]).toEqual([
      "whatsapp",
      "wechat",
      "alibaba",
      "otro",
    ]);
  });
});

// ╔═══════════════════════════════════════════════════════════╗
// ║ normalizeClientNote (SDD-0172 · migr 0268)                 ║
// ╚═══════════════════════════════════════════════════════════╝

describe("normalizeClientNote", () => {
  it("recorta espacios y guarda lo escrito", () => {
    expect(normalizeClientNote("  pedido urgente  ")).toBe("pedido urgente");
  });

  it("vacío o sólo espacios → null (no cadena vacía)", () => {
    expect(normalizeClientNote("")).toBeNull();
    expect(normalizeClientNote("   ")).toBeNull();
    expect(normalizeClientNote(null)).toBeNull();
    expect(normalizeClientNote(undefined)).toBeNull();
  });

  // Recorta en vez de rechazar: una nota larguísima es un pegado accidental,
  // no un error que valga la pena mostrarle a quien sólo quería registrar.
  it("una nota gigante se recorta al tope, no tumba el alta", () => {
    const larga = "x".repeat(PREALERTA_CLIENT_NOTE_MAX + 500);
    const out = normalizeClientNote(larga);
    expect(out).toHaveLength(PREALERTA_CLIENT_NOTE_MAX);
  });

  it("justo en el tope pasa entera", () => {
    const justa = "y".repeat(PREALERTA_CLIENT_NOTE_MAX);
    expect(normalizeClientNote(justa)).toHaveLength(PREALERTA_CLIENT_NOTE_MAX);
  });
});
