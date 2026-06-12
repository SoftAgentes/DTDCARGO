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
  clientNoFromMarkbox,
  buildPrealertaCode,
  buildLabels,
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
  isPrealertaDocType,
  PREALERTA_DOC_TYPE_LABEL,
  PREALERTA_DOC_MAX_BYTES,
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

describe("helpers de adjuntos de compra", () => {
  it("isPrealertaDocType discrimina los 4 tipos", () => {
    for (const t of ["packing", "factura", "foto", "whatsapp"]) {
      expect(isPrealertaDocType(t)).toBe(true);
    }
    expect(isPrealertaDocType("bl")).toBe(false);
    expect(isPrealertaDocType(null)).toBe(false);
    expect(isPrealertaDocType(123)).toBe(false);
  });

  it("hay label legible para cada tipo", () => {
    expect(PREALERTA_DOC_TYPE_LABEL.packing).toMatch(/packing/i);
    expect(PREALERTA_DOC_TYPE_LABEL.whatsapp).toMatch(/wechat/i);
  });

  it("acepta solo mimes de imagen/pdf permitidos", () => {
    expect(isAllowedPrealertaDocMime("application/pdf")).toBe(true);
    expect(isAllowedPrealertaDocMime("image/jpeg")).toBe(true);
    expect(isAllowedPrealertaDocMime("image/heic")).toBe(true);
    expect(isAllowedPrealertaDocMime("application/zip")).toBe(false);
    expect(isAllowedPrealertaDocMime("text/html")).toBe(false);
  });

  it("mapea el mime a la extensión canónica", () => {
    expect(prealertaDocExtFromMime("application/pdf")).toBe("pdf");
    expect(prealertaDocExtFromMime("image/jpeg")).toBe("jpg");
    expect(prealertaDocExtFromMime("image/png")).toBe("png");
    expect(prealertaDocExtFromMime("image/heic")).toBe("heic");
    expect(prealertaDocExtFromMime("application/octet-stream")).toBe("bin");
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

  it("el límite de archivo es 10 MB", () => {
    expect(PREALERTA_DOC_MAX_BYTES).toBe(10 * 1024 * 1024);
  });
});
