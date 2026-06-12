/**
 * Tests del Expediente de defensa legal (SDD-0070 · SDD-E).
 *
 * Cubren el `acceptance` de la spec:
 *   - `summarizeCompleteness` (helper PURO): 5/5, parcial, 0/5.
 *   - `getDefenseFile` con stub de Supabase: secciones presente/vacía sin
 *     romper; envío inexistente → null.
 *   - Hash de la aceptación HEREDADO de 0067: fila íntegra → verificada;
 *     fila alterada post-hoc → no verifica (el expediente se arma igual).
 *   - Join indirecto del POD: cadena completa → POD presente; cadena cortada
 *     (sin paquete que referencie la recepción) → fail-soft vacío.
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDefenseFile } from "../expediente-queries";
import {
  summarizeCompleteness,
  type DefenseFile,
  type DefenseSection,
} from "../expediente-types";
import type { AcceptanceEvidenceExport } from "../queries";
import { hashEvidence } from "../seal";
import type { DocRef } from "../types";

// ════════════════════════════════════════════════════════════
// summarizeCompleteness (PURO · sin DB)
// ════════════════════════════════════════════════════════════

function sec<T>(items: T[]): DefenseSection<T> {
  return { present: items.length > 0, items };
}

/** DefenseFile mínimo donde cada pieza está presente o no según el flag. */
function fileWith(flags: {
  acceptances?: boolean;
  packing?: boolean;
  originPhotos?: boolean;
  timeline?: boolean;
  pod?: boolean;
}): DefenseFile {
  const one = <T,>(present: boolean, item: T): DefenseSection<T> =>
    present ? sec([item]) : sec<T>([]);
  return {
    shipment: {
      id: "sh1",
      code: "S-2026-0042",
      clientName: "Demo C.A.",
      markbox: "DTD-5452",
      origin: "Yiwu",
      destination: "Valencia",
      service: "consolidacion",
      status: "delivered",
      createdAt: "2026-06-01T00:00:00.000Z",
      deliveredAt: null,
      podSignedBy: null,
    },
    acceptances: one(!!flags.acceptances, {} as AcceptanceEvidenceExport),
    packing: one(!!flags.packing, {
      id: "p1",
      code: "DTD-5452-1-1",
      description: "x",
      boxes: 1,
      trackingCn: null,
      documents: [],
    }),
    originPhotos: one(!!flags.originPhotos, {
      receiptId: "r1",
      receiptCode: "WR-2026-0001",
      supplierName: null,
      boxes: 1,
      receivedAt: null,
      photos: [],
    }),
    timeline: one(!!flags.timeline, {
      id: "e1",
      status: "in_warehouse",
      note: null,
      occurredAt: "2026-06-02T00:00:00.000Z",
    }),
    pod: one(!!flags.pod, {
      id: "pod1",
      orderCode: "OD-2026-0001",
      receivedBy: "Juan",
      receivedDoc: null,
      notes: null,
      createdAt: "2026-06-05T00:00:00.000Z",
      photos: [],
    }),
    generatedAt: "2026-06-11T00:00:00.000Z",
  };
}

describe("summarizeCompleteness", () => {
  it("5/5 piezas presentes", () => {
    const out = summarizeCompleteness(
      fileWith({
        acceptances: true,
        packing: true,
        originPhotos: true,
        timeline: true,
        pod: true,
      }),
    );
    expect(out.count).toBe(5);
    expect(out.present).toHaveLength(5);
    expect(out.missing).toHaveLength(0);
  });

  it("parcial (2/5): cuenta y reparte present/missing", () => {
    const out = summarizeCompleteness(
      fileWith({ acceptances: true, timeline: true }),
    );
    expect(out.count).toBe(2);
    expect(out.present).toEqual([
      "Aceptación de términos",
      "Cronología de eventos",
    ]);
    expect(out.missing).toEqual([
      "Packing y compras",
      "Fotos de origen (almacén CN)",
      "Prueba de entrega (POD)",
    ]);
  });

  it("0/5 piezas → todo ausente", () => {
    const out = summarizeCompleteness(fileWith({}));
    expect(out.count).toBe(0);
    expect(out.present).toHaveLength(0);
    expect(out.missing).toHaveLength(5);
  });
});

// ════════════════════════════════════════════════════════════
// Stub de Supabase (tablas + storage.createSignedUrls)
// ════════════════════════════════════════════════════════════

const TENANT = "tn";
const MARKBOX = "DTD-5452";
const SHIP_CODE = "S-2026-0042";
const VIGENTES: DocRef[] = [
  { key: "tyc", version: "v2.1" },
  { key: "operador", version: "v1.4" },
];

/** Fila v2 íntegra de legal_acceptances (hash recomputado de su evidencia). */
function acceptanceRow(opts: {
  id: string;
  code: string;
  accepted_at?: string;
  hash?: string;
  user_agent?: string | null;
}): Record<string, unknown> {
  const user_agent =
    opts.user_agent !== undefined ? opts.user_agent : "Mozilla/5.0";
  const accepted_at = opts.accepted_at ?? "2026-06-10T10:00:00.000Z";
  const goodHash = hashEvidence({
    client_markbox: MARKBOX,
    quote_code: SHIP_CODE,
    docs: VIGENTES,
    cbm: 7,
    weight_kg: 2800,
    total_usd: 5600,
    ip: "1.1.1.1",
    user_agent,
    merchant_declaration: true,
    accepted_at,
  });
  return {
    id: opts.id,
    tenant_id: TENANT,
    acceptance_code: opts.code,
    client_id: "c1",
    client_markbox: MARKBOX,
    quote_code: SHIP_CODE,
    docs: VIGENTES,
    cbm: 7,
    weight_kg: 2800,
    total_usd: 5600,
    accepted_at,
    ip: "1.1.1.1",
    user_agent,
    merchant_declaration: true,
    invoice_id: "inv-1",
    hash: opts.hash ?? goodHash,
    idempotency_key: null,
    created_at: "",
  };
}

type Rows = Record<string, Record<string, unknown>[]>;

/**
 * Stub chainable que soporta lo que usan las queries del expediente:
 *  - .select / .order / .limit / .is (no-ops sobre el filtrado)
 *  - .eq(col, val)  → filtro de igualdad
 *  - .in(col, vals) → filtro de pertenencia
 *  - await (then)   → { data, error:null } con las filas filtradas
 *  - .maybeSingle() → primera fila o null
 *  - .storage.from(bucket).createSignedUrls(paths, ttl) → 1 URL fake por path
 */
function stub(rowsByTable: Rows, signError = false): SupabaseClient {
  return {
    from(table: string) {
      const eqFilters: Array<[string, unknown]> = [];
      const inFilters: Array<[string, unknown[]]> = [];
      function apply(): Record<string, unknown>[] {
        return (rowsByTable[table] ?? []).filter(
          (row) =>
            eqFilters.every(([c, v]) => row[c] === v) &&
            inFilters.every(([c, vs]) => vs.includes(row[c])),
        );
      }
      const chain: Record<string, unknown> = {
        select: () => chain,
        order: () => chain,
        limit: () => chain,
        is: () => chain,
        eq(col: string, val: unknown) {
          eqFilters.push([col, val]);
          return chain;
        },
        in(col: string, vals: unknown[]) {
          inFilters.push([col, vals]);
          return chain;
        },
        maybeSingle: () =>
          Promise.resolve({ data: apply()[0] ?? null, error: null }),
        then: (resolve: (v: { data: unknown; error: null }) => unknown) =>
          Promise.resolve({ data: apply(), error: null }).then(resolve),
      };
      return chain;
    },
    storage: {
      from() {
        return {
          createSignedUrls(paths: string[]) {
            if (signError) {
              return Promise.resolve({ data: null, error: { message: "x" } });
            }
            return Promise.resolve({
              data: paths.map((p) => ({
                path: p,
                signedUrl: `https://signed/${p}`,
              })),
              error: null,
            });
          },
        };
      },
    },
  } as unknown as SupabaseClient;
}

const SHIPMENT_ROW = {
  id: "sh1",
  tenant_id: TENANT,
  code: SHIP_CODE,
  client_name: "Demo C.A.",
  client_markbox: MARKBOX,
  origin: "Yiwu",
  destination: "Valencia",
  shipment_service: "consolidacion",
  status: "delivered",
  created_at: "2026-06-01T00:00:00.000Z",
  delivered_at: "2026-06-05T00:00:00.000Z",
  pod_signed_by: "Juan Pérez",
  deleted_at: null,
};

// ════════════════════════════════════════════════════════════
// getDefenseFile
// ════════════════════════════════════════════════════════════

describe("getDefenseFile · envío inexistente y fail-closed", () => {
  it("envío que no existe en el tenant → null", async () => {
    const db = stub({ shipments: [] });
    const out = await getDefenseFile(db, {
      tenantId: TENANT,
      shipmentCode: "S-2026-9999",
    });
    expect(out).toBeNull();
  });

  it("fail-closed sin tenant / sin código → null", async () => {
    const db = stub({ shipments: [SHIPMENT_ROW] });
    expect(
      await getDefenseFile(db, { tenantId: "", shipmentCode: SHIP_CODE }),
    ).toBeNull();
    expect(
      await getDefenseFile(db, { tenantId: TENANT, shipmentCode: "  " }),
    ).toBeNull();
  });

  it("envío de OTRO tenant → null (tenant explícito)", async () => {
    const db = stub({ shipments: [SHIPMENT_ROW] });
    const out = await getDefenseFile(db, {
      tenantId: "otro-tenant",
      shipmentCode: SHIP_CODE,
    });
    expect(out).toBeNull();
  });
});

describe("getDefenseFile · secciones vacías no rompen", () => {
  it("envío sin ninguna pieza → todas las secciones vacías, expediente válido", async () => {
    const db = stub({ shipments: [SHIPMENT_ROW] });
    const out = await getDefenseFile(db, {
      tenantId: TENANT,
      shipmentCode: SHIP_CODE,
    });
    expect(out).not.toBeNull();
    expect(out!.shipment.code).toBe(SHIP_CODE);
    expect(out!.shipment.markbox).toBe(MARKBOX);
    expect(out!.acceptances.present).toBe(false);
    expect(out!.packing.present).toBe(false);
    expect(out!.originPhotos.present).toBe(false);
    expect(out!.timeline.present).toBe(false);
    expect(out!.pod.present).toBe(false);
    expect(summarizeCompleteness(out!).count).toBe(0);
  });
});

describe("getDefenseFile · secciones presentes (con firma de fotos)", () => {
  it("arma las 5 piezas con datos y firma fotos/docs por bucket", async () => {
    const db = stub({
      shipments: [SHIPMENT_ROW],
      legal_acceptances: [acceptanceRow({ id: "a1", code: "AC-2026-0001" })],
      prealertas: [
        {
          id: "pr1",
          tenant_id: TENANT,
          shipment_id: "sh1",
          code: "DTD-5452-1-1",
          description: "Cargadores",
          boxes: 3,
          tracking_cn: "SF123",
          deleted_at: null,
          created_at: "",
        },
      ],
      prealerta_documents: [
        {
          id: "d1",
          tenant_id: TENANT,
          prealerta_id: "pr1",
          doc_type: "packing",
          storage_path: "tn/pr1/a.pdf",
          file_name: "packing.pdf",
          deleted_at: null,
          created_at: "",
        },
      ],
      warehouse_receipts_cn: [
        {
          id: "r1",
          tenant_id: TENANT,
          shipment_id: "sh1",
          receipt_code: "WR-2026-0001",
          supplier_name: "义乌厂",
          supplier_name_translated: "Fábrica Yiwu",
          boxes: 3,
          received_at: "2026-06-02",
          deleted_at: null,
        },
      ],
      warehouse_receipt_photos: [
        {
          id: "ph1",
          tenant_id: TENANT,
          receipt_id: "r1",
          storage_path: "tn/r1/01.jpg",
          position: 0,
        },
      ],
      shipment_events: [
        {
          id: "e1",
          tenant_id: TENANT,
          shipment_id: "sh1",
          status: "in_warehouse",
          note: "Recibido en CN",
          occurred_at: "2026-06-02T00:00:00.000Z",
          deleted_at: null,
        },
      ],
      dispatch_order_packages: [
        {
          od_id: "od1",
          package_kind: "warehouse_receipt_cn",
          package_id: "r1",
        },
      ],
      dispatch_orders: [
        { id: "od1", tenant_id: TENANT, order_code: "OD-2026-0001" },
      ],
      dispatch_pods: [
        {
          id: "pod1",
          tenant_id: TENANT,
          od_id: "od1",
          photo_path: "pod/tn/od1/1.jpg",
          signature_path: "firma/tn/od1/1.png",
          received_by: "Juan Pérez",
          received_doc: "V-12345678",
          notes: "Entregado OK",
          created_at: "2026-06-05T00:00:00.000Z",
        },
      ],
    });

    const out = await getDefenseFile(db, {
      tenantId: TENANT,
      shipmentCode: SHIP_CODE,
    });
    expect(out).not.toBeNull();

    // Las 5 piezas presentes.
    expect(summarizeCompleteness(out!).count).toBe(5);

    // 1 · aceptación con hash verificado (heredado de 0067).
    expect(out!.acceptances.items).toHaveLength(1);
    expect(out!.acceptances.items[0].hash_verified).toBe(true);

    // 2 · packing con doc firmado.
    expect(out!.packing.items[0].documents[0].url).toBe(
      "https://signed/tn/pr1/a.pdf",
    );

    // 3 · fotos de origen firmadas + supplier traducido.
    expect(out!.originPhotos.items[0].supplierName).toBe("Fábrica Yiwu");
    expect(out!.originPhotos.items[0].photos[0].url).toBe(
      "https://signed/tn/r1/01.jpg",
    );

    // 4 · cronología.
    expect(out!.timeline.items[0].status).toBe("in_warehouse");

    // 5 · POD por el join indirecto: foto + firma firmadas + order_code.
    expect(out!.pod.items[0].orderCode).toBe("OD-2026-0001");
    expect(out!.pod.items[0].receivedBy).toBe("Juan Pérez");
    expect(out!.pod.items[0].photos.map((p) => p.url)).toEqual([
      "https://signed/pod/tn/od1/1.jpg",
      "https://signed/firma/tn/od1/1.png",
    ]);
  });

  it("error de firma de storage → fotos con url vacía, sección igual presente (fail-soft)", async () => {
    const db = stub(
      {
        shipments: [SHIPMENT_ROW],
        warehouse_receipts_cn: [
          {
            id: "r1",
            tenant_id: TENANT,
            shipment_id: "sh1",
            receipt_code: "WR-2026-0001",
            supplier_name: null,
            supplier_name_translated: null,
            boxes: 1,
            received_at: "2026-06-02",
            deleted_at: null,
          },
        ],
        warehouse_receipt_photos: [
          {
            id: "ph1",
            tenant_id: TENANT,
            receipt_id: "r1",
            storage_path: "tn/r1/01.jpg",
            position: 0,
          },
        ],
      },
      true, // signError
    );

    const out = await getDefenseFile(db, {
      tenantId: TENANT,
      shipmentCode: SHIP_CODE,
    });
    expect(out!.originPhotos.present).toBe(true);
    expect(out!.originPhotos.items[0].photos[0].url).toBe("");
  });
});

// ════════════════════════════════════════════════════════════
// Hash heredado de 0067 (íntegra / alterada)
// ════════════════════════════════════════════════════════════

describe("getDefenseFile · integridad de la aceptación (heredada de 0067)", () => {
  it("fila íntegra → hash_verified true", async () => {
    const db = stub({
      shipments: [SHIPMENT_ROW],
      legal_acceptances: [acceptanceRow({ id: "a1", code: "AC-2026-0001" })],
    });
    const out = await getDefenseFile(db, {
      tenantId: TENANT,
      shipmentCode: SHIP_CODE,
    });
    expect(out!.acceptances.items[0].hash_verified).toBe(true);
  });

  it("fila con user_agent alterado post-hoc → hash_verified FALSE (se muestra igual)", async () => {
    const good = acceptanceRow({ id: "a1", code: "AC-2026-0001" });
    const tampered = { ...good, user_agent: "OtroUA/9.9" };
    const db = stub({
      shipments: [SHIPMENT_ROW],
      legal_acceptances: [tampered],
    });
    const out = await getDefenseFile(db, {
      tenantId: TENANT,
      shipmentCode: SHIP_CODE,
    });
    expect(out!.acceptances.present).toBe(true);
    expect(out!.acceptances.items[0].hash_verified).toBe(false);
    expect(out!.acceptances.items[0].acceptance.user_agent).toBe("OtroUA/9.9");
  });
});

// ════════════════════════════════════════════════════════════
// POD · join indirecto completo vs cortado
// ════════════════════════════════════════════════════════════

describe("getDefenseFile · POD por join indirecto (fail-soft si se corta)", () => {
  const baseTables = {
    shipments: [SHIPMENT_ROW],
    warehouse_receipts_cn: [
      {
        id: "r1",
        tenant_id: TENANT,
        shipment_id: "sh1",
        receipt_code: "WR-2026-0001",
        supplier_name: null,
        supplier_name_translated: null,
        boxes: 1,
        received_at: "2026-06-02",
        deleted_at: null,
      },
    ],
    dispatch_orders: [
      { id: "od1", tenant_id: TENANT, order_code: "OD-2026-0001" },
    ],
    dispatch_pods: [
      {
        id: "pod1",
        tenant_id: TENANT,
        od_id: "od1",
        photo_path: "pod/tn/od1/1.jpg",
        signature_path: "firma/tn/od1/1.png",
        received_by: "Juan",
        received_doc: null,
        notes: null,
        created_at: "2026-06-05T00:00:00.000Z",
      },
    ],
  };

  it("cadena completa (recepción → paquete → OD → POD) → POD presente", async () => {
    const db = stub({
      ...baseTables,
      dispatch_order_packages: [
        { od_id: "od1", package_kind: "warehouse_receipt_cn", package_id: "r1" },
      ],
    });
    const out = await getDefenseFile(db, {
      tenantId: TENANT,
      shipmentCode: SHIP_CODE,
    });
    expect(out!.pod.present).toBe(true);
    expect(out!.pod.items[0].orderCode).toBe("OD-2026-0001");
  });

  it("cadena cortada: ningún paquete referencia la recepción → POD fail-soft vacío", async () => {
    const db = stub({
      ...baseTables,
      // El paquete referencia OTRA recepción → la cadena se corta.
      dispatch_order_packages: [
        {
          od_id: "od1",
          package_kind: "warehouse_receipt_cn",
          package_id: "r-otra",
        },
      ],
    });
    const out = await getDefenseFile(db, {
      tenantId: TENANT,
      shipmentCode: SHIP_CODE,
    });
    expect(out!.pod.present).toBe(false);
    expect(out!.pod.items).toHaveLength(0);
  });

  it("sin recepciones CN → POD vacío (no hay punto de partida del join)", async () => {
    const db = stub({
      shipments: [SHIPMENT_ROW],
      dispatch_order_packages: [
        { od_id: "od1", package_kind: "warehouse_receipt_cn", package_id: "r1" },
      ],
      dispatch_orders: baseTables.dispatch_orders,
      dispatch_pods: baseTables.dispatch_pods,
    });
    const out = await getDefenseFile(db, {
      tenantId: TENANT,
      shipmentCode: SHIP_CODE,
    });
    expect(out!.pod.present).toBe(false);
  });
});
