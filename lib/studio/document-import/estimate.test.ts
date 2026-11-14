// @vitest-environment node
/**
 * Contrato del estimado de transporte de varias compras (SDD-0473).
 *
 * Fija que N compras se cotizan como UN solo envío: el mínimo facturable, el
 * piso del transportista, el embalaje especial, el multiplicador de baterías y
 * el exceso de densidad se cobran UNA vez sobre el conjunto, nunca una vez por
 * compra. Fija también los cierres que protegen la plata y el dato: no se
 * estima con logística incompleta ni con un documento pendiente de revisión, no
 * se cotiza con una tarifa vencida, la misma compra no se puede contar dos
 * veces, el número que sale es TRANSPORTE —nunca el valor de la mercancía— y
 * sólo un principal del portal combina varias compras.
 *
 * `@/lib/calculadora` entra REAL a propósito: lo que se prueba es la plata que
 * sale, no que se haya llamado a una función.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { confirmationIssues, emptyDocumentDraft, toPackingPayload, type DocumentDraft } from "@/lib/shared/document-import";
import { calcularEnvioLCL, type CalcParams, type Ciudad } from "@/lib/calculadora";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PortalClientPrincipal } from "@/lib/portal/portal-queries";

const mocks = vi.hoisted(() => ({
  cbmRate: vi.fn(), calcConfig: vi.fn(), calcCities: vi.fn(), carrierTariffs: vi.fn(), combinar: vi.fn(),
  requirePortal: vi.fn(), authorizeWorkspace: vi.fn(), getWorkspace: vi.fn(),
}));
vi.mock("@/lib/public/rates-queries", () => ({
  getPublicCbmRate: mocks.cbmRate, getPublicCalculatorConfig: mocks.calcConfig,
  getPublicCalculatorCities: mocks.calcCities, getPublicCarrierTariffs: mocks.carrierTariffs,
  combinarDestinos: mocks.combinar,
}));
vi.mock("./access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./access")>()),
  requirePortal: mocks.requirePortal, authorizeWorkspace: mocks.authorizeWorkspace,
}));
vi.mock("./service", () => ({ getWorkspace: mocks.getWorkspace }));
import { ImportHttpError, type WorkspaceRow } from "./access";
import { combinedLogistics, estimateDocuments, estimateForRequest, getEstimateRates } from "./estimate";

type Rates = Parameters<typeof estimateDocuments>[2];
/** Parámetros explícitos: la prueba fija la aritmética, no los defaults del ERP. */
const PARAMS: CalcParams = {
  pesoIncluidoKg: 1000, recargoExcedenteKg: 2, descuentoValencia: 0, recargoEmbalajeEspecial: 75,
  recargoBateriaMult: 1.5, thresholdCascoKm: 0, tarifaKmFueraCasco: 0,
  cbmMaxContenedor: 68, pesoMaxContenedorKg: 27000, pesoMaxEnvioKg: 12000,
};
/** Destino fuera del casco: $100/m³ de entrega nacional con piso de $200 por despacho. */
const MARACAIBO: Ciudad = { id: "maracaibo", label: "Maracaibo", km: 410, casco: false, ventaCbm: 100, minCharge: 200, frecuenciaDias: 7, cubierta: true };
const rates = (rate: Partial<Rates["rate"]> = {}, cities: Ciudad[] = [MARACAIBO]): Rates =>
  ({ rate: { per_cbm: 100, min_charge: 380, valid_until: null, ...rate }, params: PARAMS, cities });
const PRINCIPAL: PortalClientPrincipal = {
  userId: "11111111-1111-4111-8111-111111111111",
  tenantId: "22222222-2222-4222-8222-222222222222",
  client: { id: "33333333-3333-4333-8333-333333333333", markbox: "DTD-0001", name: "Cliente sintético", email: null, phone: null, address: null, docKind: null, rif: null, city: null, state: null },
};

let seq = 0;
const uuid = (n: number) => `${String(n).padStart(4, "0")}abcd-0000-4000-8000-000000000000`;
/** Compra con cajas declaradas: 10 piezas en `cartons` cajas iguales. */
function packed(p: { cbm: number | null; weight: number | null; cartons: number | null; price?: number | null; declaredCbm?: number | null }): DocumentDraft {
  const d = emptyDocumentDraft(); d.transportDeclarations = { battery: false, specialCargo: false };
  const priced = p.price === undefined ? 2 : p.price;
  d.products = [{ id: "p1", name: "Taza", nameZh: "", code: "T-1", brand: "", material: "", quantity: 10, unitPrice: priced, currency: priced === null ? null : "USD", unit: "pcs" }];
  d.groups = [{ id: "g1", label: "CTN1", cartons: p.cartons, grossWeightKg: p.weight, cbm: p.cbm, items: [{ productId: "p1", quantity: 10 }] }];
  if (p.declaredCbm !== undefined) d.declaredTotals.cbm = p.declaredCbm;
  return d;
}
/** Compra con totales globales del documento y SIN desglose de cajas. */
function declaredOnly(p: { cbm: number | null; weight: number | null; cartons: number | null; amount?: number }): DocumentDraft {
  const d = emptyDocumentDraft(); d.transportDeclarations = { battery: false, specialCargo: false };
  d.products = [{ id: "p1", name: "Taza", nameZh: "", code: "T-1", brand: "", material: "", quantity: 10, unitPrice: p.amount === undefined ? 2 : p.amount / 10, currency: "USD", unit: "pcs" }];
  d.declaredTotals = { cartons: p.cartons, grossWeightKg: p.weight, cbm: p.cbm, amount: p.amount ?? null };
  return d;
}
function workspace(draft: DocumentDraft, over: Partial<WorkspaceRow> = {}): WorkspaceRow {
  seq += 1;
  return { id: uuid(seq), tenant_id: PRINCIPAL.tenantId, client_id: PRINCIPAL.client.id, prealerta_id: null, anonymous_hash: null, expires_at: null, draft, revision: 3, confirmed_revision: 3, confirmed_submission_id: null, ...over };
}
/** `getWorkspace` responde como Postgres: el UUID no distingue mayúsculas. */
function serve(rows: WorkspaceRow[]) {
  const byId = new Map(rows.map((r) => [r.id.toLowerCase(), r]));
  mocks.getWorkspace.mockImplementation(async (_db: unknown, id: string) => {
    const row = byId.get(String(id).toLowerCase());
    if (!row) throw new ImportHttpError(404, "not_found", "Documento no disponible.");
    return row;
  });
}
function expectFail(fn: () => unknown, status: number, code: string): ImportHttpError {
  let error: unknown;
  try { fn(); } catch (e) { error = e; }
  expect(error).toBeInstanceOf(ImportHttpError);
  expect(error).toMatchObject({ status, code });
  return error as ImportHttpError;
}
async function expectFailAsync(fn: () => Promise<unknown>, status: number, code: string): Promise<ImportHttpError> {
  let error: unknown;
  try { await fn(); } catch (e) { error = e; }
  expect(error).toBeInstanceOf(ImportHttpError);
  expect(error).toMatchObject({ status, code });
  return error as ImportHttpError;
}
const session = {} as SupabaseClient;
const admin = {} as SupabaseClient;

beforeEach(() => {
  // Combinar compras y guardar el estimado son del portal: estas pruebas lo
  // describen ENCENDIDO. El cotizador solo tiene su propio caso abajo.
  vi.stubEnv("DOCUMENT_IMPORT_ENABLED", "true");
  vi.stubEnv("DOCUMENT_IMPORT_PORTAL_ENABLED", "true");
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.cbmRate.mockResolvedValue({ per_cbm: 100, min_charge: 380, valid_until: null });
  mocks.calcConfig.mockResolvedValue(PARAMS);
  mocks.calcCities.mockResolvedValue([MARACAIBO]);
  mocks.carrierTariffs.mockResolvedValue([]);
  mocks.combinar.mockReturnValue([MARACAIBO]);
  mocks.requirePortal.mockResolvedValue(PRINCIPAL);
  mocks.authorizeWorkspace.mockResolvedValue({ kind: "client", id: PRINCIPAL.userId, principal: PRINCIPAL });
});

afterEach(() => vi.unstubAllEnvs());

describe("Estimado de transporte: varias compras, un solo envío", () => {
  it("cobra el mínimo facturable y el piso del transportista una vez por envío, no una vez por compra", () => {
    const rows = [0, 1, 2].map(() => workspace(packed({ cbm: 0.5, weight: 100, cartons: 2 })));
    const juntas = estimateDocuments(rows, { cityId: "maracaibo" }, rates());
    const porSeparado = rows.map((r) => estimateDocuments([r], { cityId: "maracaibo" }, rates()).result.total);

    // 1,5 m³ × $100 = $150 + piso de entrega $200 = $350 → piso comercial $380.
    expect(juntas.totals).toEqual({ cbm: 1.5, grossWeightKg: 300, cartons: 6 });
    expect(juntas.result.total).toBe(380);
    expect(juntas.result.recargoCiudad).toBe(200);
    expect(juntas.result.ajusteMinimo).toBe(30);
    // Cada compra suelta pagaría el mínimo completa: 3 × $380.
    expect(porSeparado).toEqual([380, 380, 380]);
    expect(juntas.result.total).toBeLessThan(porSeparado.reduce((a, b) => a + b, 0));
  });

  it("aplica batería sobre el mínimo del envío compartido usando los params del ERP", () => {
    const rows = [workspace(packed({ cbm: 0.5, weight: 100, cartons: 2 }))];
    rows[0].draft = { ...rows[0].draft as DocumentDraft, transportDeclarations: { battery: true, specialCargo: false } };
    const estimado = estimateDocuments(rows, { cityId: "maracaibo", battery: false }, rates());

    // Flete previo: $50 de volumen + $200 del piso del tramo = $250.
    // El mínimo comercial lo completa a $380; batería ×1,5 cobra $190 sobre ese piso.
    expect(estimado.result.precioBase).toBe(50);
    expect(estimado.result.recargoCiudad).toBe(200);
    expect(estimado.result.ajusteMinimo).toBe(130);
    expect(estimado.result.recargoBateria).toBe(190);
    expect(estimado.result.total).toBe(570);
  });

  it("aplica el embalaje especial y el multiplicador de baterías sobre el envío, no sobre cada compra", () => {
    const rows = [0, 1, 2].map(() => workspace(packed({ cbm: 2, weight: 300, cartons: 2 })));
    for (const row of rows) (row.draft as DocumentDraft).transportDeclarations = { battery: true, specialCargo: false };
    const body = { cityId: "maracaibo", packaging: "especial", battery: false };
    const juntas = estimateDocuments(rows, body, rates());
    const sueltas = rows.map((r) => estimateDocuments([r], body, rates()).result.total).reduce((a, b) => a + b, 0);

    expect(juntas.result.recargoEmbalaje).toBe(75);
    // (6 m³ × $100 + $600 entrega + $75 embalaje) × 1,5 batería.
    expect(juntas.result.total).toBe(1912.5);
    expect(sueltas).toBe(2137.5);
    // La diferencia son exactamente los dos embalajes de más, multiplicados.
    expect(sueltas - juntas.result.total).toBe(225);
  });

  it("mide el exceso de peso contra la densidad del envío completo, no compra por compra", () => {
    const densa = workspace(packed({ cbm: 1, weight: 1500, cartons: 2 }));
    const liviana = workspace(packed({ cbm: 1, weight: 100, cartons: 2 }));
    const juntas = estimateDocuments([densa, liviana], { cityId: "maracaibo" }, rates());
    const densaSola = estimateDocuments([densa], { cityId: "maracaibo" }, rates());

    // 1.600 kg en 2 m³ = 800 kg/m³: por debajo de la gracia de 1.000 kg/m³.
    expect(juntas.result.densidadKgM3).toBe(800);
    expect(juntas.result.recargoExcedente).toBe(0);
    // Sola, la compra densa sí paga 500 kg de exceso a $2.
    expect(densaSola.result.recargoExcedente).toBe(1000);
    expect(juntas.result.total).toBeLessThan(densaSola.result.total);
  });

  it("no estima nada si a UNA sola compra le falta el CBM o el peso bruto", () => {
    const completa = workspace(packed({ cbm: 0.5, weight: 100, cartons: 2 }));
    expect(combinedLogistics([completa]).cbm).toBe(0.5);

    const sinCbm = workspace(packed({ cbm: null, weight: 100, cartons: 2 }));
    const sinPeso = workspace(packed({ cbm: 0.5, weight: null, cartons: 2 }));
    const pesoCero = workspace(packed({ cbm: 0.5, weight: 0, cartons: 2 }));
    expectFail(() => combinedLogistics([completa, sinCbm]), 422, "missing_logistics");
    expectFail(() => combinedLogistics([sinPeso, completa]), 422, "missing_logistics");
    // Cero no es un peso: es un dato que falta.
    expectFail(() => combinedLogistics([pesoCero]), 422, "missing_logistics");
  });

  it("estima el transporte con el precio de la mercancía pendiente, pero no con una diferencia logística", () => {
    const sinPrecio = workspace(packed({ cbm: 2, weight: 300, cartons: 2, price: null }));
    const estimado = estimateDocuments([sinPrecio], { cityId: "maracaibo" }, rates());
    expect(estimado.result.total).toBe(400);

    // El CBM declarado del documento no coincide con las cajas: eso sí bloquea.
    const enConflicto = workspace(packed({ cbm: 2, weight: 300, cartons: 2, declaredCbm: 9 }));
    expectFail(() => combinedLogistics([enConflicto]), 422, "review_required");
  });

  it("no cotiza un documento que la lectura asistida dejó marcado para revisión humana", () => {
    const draft = packed({ cbm: 2, weight: 300, cartons: 2 });
    draft.issues = [{ id: "ai_review_required:document", code: "ai_review_required", message: "Revisa la lectura asistida.", severity: "error", path: "document", blocking: true }];
    expectFail(() => combinedLogistics([workspace(draft)]), 422, "review_required");

    const revisado = packed({ cbm: 2, weight: 300, cartons: 2 });
    revisado.issues = [{ ...draft.issues[0], resolved: true }];
    expect(combinedLogistics([workspace(revisado)]).cbm).toBe(2);
  });

  it("acepta los totales globales de un documento sin desglose de cajas", () => {
    const rows = [workspace(declaredOnly({ cbm: 2, weight: 300, cartons: 5 }))];
    expect(combinedLogistics(rows)).toEqual({ cbm: 2, grossWeightKg: 300, cartons: 5 });
  });

  it("no reporta cajas que el documento nunca declaró", () => {
    const conCajas = workspace(packed({ cbm: 1, weight: 200, cartons: 10 }));
    const sinCajas = workspace(declaredOnly({ cbm: 2, weight: 300, cartons: null }));
    // Devolvía 10 —el total de la primera compra— como si fuera el de las dos.
    // Lo desconocido sale null, nunca suma como cero.
    expect(combinedLogistics([conCajas, sinCajas]).cartons).toBeNull();
  });

  it("rechaza la selección vacía, la compra repetida y el lote mayor a 50", () => {
    const row = workspace(packed({ cbm: 0.5, weight: 100, cartons: 2 }));
    expectFail(() => combinedLogistics([]), 400, "invalid_selection");
    // La misma compra dos veces duplicaría cajas, peso y CBM de un envío real.
    expectFail(() => combinedLogistics([row, row]), 400, "invalid_selection");
    const muchas = Array.from({ length: 51 }, () => workspace(packed({ cbm: 0.5, weight: 100, cartons: 2 })));
    expectFail(() => combinedLogistics(muchas), 400, "invalid_selection");
    expect(combinedLogistics(muchas.slice(0, 50)).cbm).toBe(25);
  });

  it("exige un destino de la lista viva: sin él no hay estimado", () => {
    const rows = [workspace(packed({ cbm: 2, weight: 300, cartons: 2 }))];
    expectFail(() => estimateDocuments(rows, {}, rates()), 422, "destination_required");
    expectFail(() => estimateDocuments(rows, { cityId: "marte" }, rates()), 422, "destination_required");
  });

  it("entrega el resultado como estimado de transporte, sin el valor de la mercancía adentro", () => {
    const rows = [workspace(declaredOnly({ cbm: 2, weight: 300, cartons: 5, amount: 98765.43 }), { revision: 4, confirmed_revision: 3 })];
    const estimado = estimateDocuments(rows, { cityId: "maracaibo" }, rates());

    expect(estimado.kind).toBe("transport_estimate");
    expect(estimado.currency).toBe("USD");
    expect(estimado.notice).toMatch(/transporte/i);
    expect(estimado.notice).toMatch(/mercanc/i);
    expect(Object.keys(estimado.totals).sort()).toEqual(["cartons", "cbm", "grossWeightKg"]);
    // El importe comercial del documento no viaja dentro del estimado de flete.
    expect(JSON.stringify(estimado)).not.toContain("98765.43");
    // Y el estimado dice a la cara que el documento todavía no está confirmado.
    expect(estimado.documentRevisions).toEqual([{ workspaceId: rows[0].id, revision: 4, confirmed: false }]);
  });

  it("cuando el motor deriva al asesor no devuelve un precio: devuelve la alerta", () => {
    const rows = [workspace(packed({ cbm: 2, weight: 300, cartons: 2 }))];
    (rows[0].draft as DocumentDraft).transportDeclarations = { battery: false, specialCargo: true };
    const especial = estimateDocuments(rows, { cityId: "maracaibo", specialCargo: false }, rates());
    expect(especial.result.alerta?.tipo).toBe("carga_especial");
    expect(especial.result.total).toBe(0);

    // Destino sin tarifa confirmada: nunca se inventa el tramo nacional.
    (rows[0].draft as DocumentDraft).transportDeclarations = { battery: false, specialCargo: false };
    const sinTarifa = estimateDocuments(rows, { cityId: "maracaibo" }, rates({}, [{ ...MARACAIBO, ventaCbm: null, minCharge: null }]));
    expect(sinTarifa.result.alerta?.tipo).toBe("ciudad_sin_tarifa");
    expect(sinTarifa.result.total).toBe(0);
  });

  it("sólo el valor exacto enciende un recargo: una opción del request que no lo pide no cobra ni deriva", () => {
    const rows = [workspace(packed({ cbm: 2, weight: 300, cartons: 2 }))];
    // El cuerpo viene del cliente sin tipar: "estandar", "false" y "no" son
    // verdaderos en JS, pero ninguno pide madera, baterías ni carga especial.
    const laxo = estimateDocuments(rows, { cityId: "maracaibo", packaging: "estandar", battery: "false", specialCargo: "no" }, rates());
    expect(laxo.input).toMatchObject({ embalaje: "estandar", bateria: false, cargaEspecial: false });
    expect(laxo.result.recargoEmbalaje).toBe(0);
    expect(laxo.result.recargoBateria).toBe(0);
    // Ni deriva al asesor por una cadena: el cliente recibe su precio.
    expect(laxo.result.alerta).toBeUndefined();
    expect(laxo.result.total).toBe(400);

    // Y el valor exacto sí los enciende: ($200 + $200 + $75) × 1,5.
    (rows[0].draft as DocumentDraft).transportDeclarations = { battery: true, specialCargo: false };
    const exacto = estimateDocuments(rows, { cityId: "maracaibo", packaging: "especial", battery: true }, rates());
    expect(exacto.result.recargoEmbalaje).toBe(75);
    expect(exacto.result.total).toBe(712.5);
  });
});

describe("Tarifa vigente", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-16T12:00:00Z")); });
  afterEach(() => vi.useRealTimers());

  it("no cotiza con una tarifa vencida: corta en 503 en vez de usar el precio viejo", async () => {
    mocks.cbmRate.mockResolvedValue({ per_cbm: 640, min_charge: 380, valid_until: "2026-09-15" });
    await expectFailAsync(() => getEstimateRates(), 503, "tariff_unavailable");

    // El último día de vigencia todavía cotiza, y con el precio de la DB.
    mocks.cbmRate.mockResolvedValue({ per_cbm: 640, min_charge: 380, valid_until: "2026-09-16" });
    expect((await getEstimateRates()).rate.per_cbm).toBe(640);
  });

  it("sin tarifa ni parámetros no cae al precio de respaldo del código", async () => {
    mocks.cbmRate.mockResolvedValue(null);
    await expectFailAsync(() => getEstimateRates(), 503, "tariff_unavailable");
    mocks.cbmRate.mockResolvedValue({ per_cbm: 0, min_charge: null, valid_until: null });
    await expectFailAsync(() => getEstimateRates(), 503, "tariff_unavailable");
    mocks.cbmRate.mockResolvedValue({ per_cbm: Number.NaN, min_charge: null, valid_until: null });
    await expectFailAsync(() => getEstimateRates(), 503, "tariff_unavailable");
    mocks.cbmRate.mockResolvedValue({ per_cbm: 640, min_charge: null, valid_until: null });
    mocks.calcConfig.mockResolvedValue(null);
    await expectFailAsync(() => getEstimateRates(), 503, "tariff_unavailable");
  });
});

describe("S2: revisiones y declaraciones autoritativas", () => {
  const requestBody = (rows: WorkspaceRow[]) => ({ workspaceIds: rows.map(w => w.id), expectedRevisions: rows.map(w => ({ workspaceId: w.id, revision: w.revision })), cityId: "maracaibo" });
  it("estima globales revisados con grupos parcialmente pesados sin repartir ni confirmar cajas", () => {
    const d = packed({ cbm: null, weight: null, cartons: 2 });
    d.declaredTotals = { cartons: 2, grossWeightKg: 300, cbm: 2, amount: null };
    const before = JSON.stringify(d);
    const result = estimateDocuments([workspace(d)], { cityId: "maracaibo" }, rates());
    expect(result.totals).toEqual({ cartons: 2, grossWeightKg: 300, cbm: 2 });
    expect(result.result.total).toBe(400); expect(JSON.stringify(d)).toBe(before);
    d.groups.push({ id: "g2", label: "B", cartons: null, grossWeightKg: 301, cbm: null, items: [] });
    expectFail(() => combinedLogistics([workspace(d)]), 422, "review_required");
  });
  it("no transforma una declaración ausente en no, ni oculta un sí de otra compra", () => {
    const a = packed({ cbm: 1, weight: 200, cartons: 2 }), b = packed({ cbm: 1, weight: 200, cartons: 2 });
    a.transportDeclarations = { battery: true, specialCargo: false }; delete b.transportDeclarations;
    const error = expectFail(() => estimateDocuments([workspace(a), workspace(b)], { cityId: "maracaibo", battery: false, specialCargo: false }, rates()), 422, "transport_review_required");
    expect(error.message).toContain("incluye baterías");
    b.transportDeclarations = { battery: false, specialCargo: false };
    const result = estimateDocuments([workspace(a), workspace(b)], { cityId: "maracaibo", battery: false }, rates());
    expect(result.input.bateria).toBe(true); expect(result.result.recargoBateria).toBeGreaterThan(0);
  });
  it("mantiene los desacuerdos monetarios y logísticos bloqueantes aunque no falte peso", () => {
    const d = packed({ cbm: 2, weight: 300, cartons: 2 }); d.currency = "USD"; d.declaredTotals.amount = 99;
    expectFail(() => combinedLogistics([workspace(d)]), 422, "review_required");
  });
  it("cruza la misma entrada explícita al motor vigente: mínimo, densidad, batería y embalaje del conjunto", () => {
    const a = packed({ cbm: 0.5, weight: 750, cartons: 2 }); a.transportDeclarations = { battery: true, specialCargo: false };
    const result = estimateDocuments([workspace(a), workspace(a)], { cityId: "maracaibo", packaging: "especial" }, rates());
    expect(result.input).toEqual({ modo: "ddp", cbmTotal: 1, pesoKg: 1500, ciudadId: "maracaibo", embalaje: "especial", bateria: true, cargaEspecial: false, tarifaCBMOverride: 100, minChargeOverride: 380 });
    expect(result.result).toEqual(calcularEnvioLCL({ modo: "ddp", cbmTotal: 1, pesoKg: 1500, ciudadId: "maracaibo", embalaje: "especial", bateria: true, cargaEspecial: false, tarifaCBMOverride: 100, minChargeOverride: 380 }, PARAMS, [MARACAIBO]));
  });
  it("rechaza revisión ausente o vieja antes de obtener tarifa", async () => {
    const rows = [workspace(packed({ cbm: 2, weight: 300, cartons: 2 }))]; serve(rows);
    await expectFailAsync(() => estimateForRequest(admin, session, new Headers(), { workspaceIds: [rows[0].id], cityId: "maracaibo" }), 400, "invalid_revision");
    await expectFailAsync(() => estimateForRequest(admin, session, new Headers(), { ...requestBody(rows), expectedRevisions: [{ workspaceId: rows[0].id, revision: 2 }] }), 409, "revision_conflict");
    expect(mocks.cbmRate).not.toHaveBeenCalled();
  });
  it.each(["revision", "authorization"])("revalida %s después de esperar la tarifa y nunca devuelve un precio obsoleto", async mode => {
    const rows = [workspace(packed({ cbm: 2, weight: 300, cartons: 2 }))]; serve(rows);
    mocks.cbmRate.mockImplementationOnce(async () => {
      if (mode === "revision") mocks.getWorkspace.mockResolvedValue({ ...rows[0], revision: 4 });
      else mocks.authorizeWorkspace.mockRejectedValue(new ImportHttpError(404, "not_found", "No disponible."));
      return { per_cbm: 100, min_charge: 380, valid_until: null };
    });
    await expect(estimateForRequest(admin, session, new Headers(), requestBody(rows))).rejects.toMatchObject({ status: mode === "revision" ? 409 : 404 });
  });
  it("si cambia mientras se guarda, el snapshot no se anuncia como vigente", async () => {
    const rows = [workspace(packed({ cbm: 2, weight: 300, cartons: 2 }))]; serve(rows);
    const single = vi.fn(async () => { mocks.getWorkspace.mockResolvedValue({ ...rows[0], revision: 4 }); return { data: { id: "snapshot-synthetic" }, error: null }; });
    const db = { from: () => ({ insert: () => ({ select: () => ({ single }) }) }) } as unknown as SupabaseClient;
    await expect(estimateForRequest(db, session, new Headers(), { ...requestBody(rows), save: true })).rejects.toMatchObject({ status: 409, code: "revision_conflict" });
    expect(single).toHaveBeenCalledOnce();
  });
});

describe("S2: cobertura logística independiente por campo", () => {
  function byField(globalField: "grossWeightKg" | "cbm") {
    const d = packed({ cbm: null, weight: null, cartons: 1 });
    d.supplier.email = "supplier@synthetic.example";
    d.groups = [
      { id: "g1", label: "A", cartons: 1, grossWeightKg: globalField === "cbm" ? 60 : null, cbm: globalField === "grossWeightKg" ? 0.3 : null, items: [{ productId: "p1", quantity: 5 }] },
      { id: "g2", label: "B", cartons: 1, grossWeightKg: globalField === "cbm" ? 80 : null, cbm: globalField === "grossWeightKg" ? 0.5 : null, items: [{ productId: "p1", quantity: 5 }] },
    ];
    d.declaredTotals = { cartons: 2, grossWeightKg: globalField === "grossWeightKg" ? 140 : null, cbm: globalField === "cbm" ? 0.8 : null, amount: null };
    return d;
  }
  function expectExistingEngine(drafts: DocumentDraft[], cbm: number, pesoKg: number, bateria = false, cargaEspecial = false) {
    const rows = drafts.map(d => workspace(d));
    const snapshot = rates();
    const actual = estimateDocuments(rows, { cityId: "maracaibo" }, snapshot);
    const input = { modo: "ddp" as const, cbmTotal: cbm, pesoKg, ciudadId: "maracaibo", embalaje: "estandar" as const, bateria, cargaEspecial, tarifaCBMOverride: snapshot.rate.per_cbm, minChargeOverride: snapshot.rate.min_charge ?? undefined };
    expect(actual.input).toEqual(input);
    expect(actual.totals).toMatchObject({ cbm, grossWeightKg: pesoKg });
    expect(actual.result).toEqual(calcularEnvioLCL(input, PARAMS, [MARACAIBO]));
    expect(actual.rates).toEqual({ rate: snapshot.rate, params: PARAMS, city: MARACAIBO });
    return actual;
  }
  it.each(["cbm", "grossWeightKg"] as const)("usa %s global y el otro campo completo de grupos una vez, conservando el despacho pendiente", field => {
    const d = byField(field), before = JSON.stringify(d);
    expectExistingEngine([d], 0.8, 140);
    expect(JSON.stringify(d)).toBe(before);
    expect(d.declaredTotals[field === "cbm" ? "grossWeightKg" : "cbm"]).toBeNull();
    expect(confirmationIssues(d).some(i => i.code === `${field}_missing` && i.blocking)).toBe(true);
    expect(() => toPackingPayload(d)).toThrow();
  });
  it.each(["empty", "partial"])("conserva ambos globales con grupos %s sin fabricar reparto", mode => {
    const d = byField("cbm"); d.declaredTotals.grossWeightKg = 140;
    if (mode === "empty") d.groups = [];
    else d.groups.forEach(g => { g.grossWeightKg = null; g.cbm = null; });
    const before = JSON.stringify(d); expectExistingEngine([d], 0.8, 140);
    expect(JSON.stringify(d)).toBe(before); expect(() => toPackingPayload(d)).toThrow();
  });
  it.each(["cbm", "grossWeightKg"] as const)("un %s realmente faltante o cero sigue sin cotizar", field => {
    for (const value of [null, 0]) {
      const d = byField(field); d.declaredTotals[field] = value;
      expectFail(() => estimateDocuments([workspace(d)], { cityId: "maracaibo" }, rates()), 422, "missing_logistics");
    }
  });
  it.each(["cbm", "grossWeightKg"] as const)("un subtotal %s conocido que supera el global nunca se oculta por otro grupo incompleto", field => {
    const d = byField(field); d.groups[0][field] = field === "cbm" ? 0.9 : 141;
    expect(confirmationIssues(d).some(i => i.code === "declared_total_mismatch")).toBe(true);
    expectFail(() => estimateDocuments([workspace(d)], { cityId: "maracaibo" }, rates()), 422, "review_required");
  });
  it.each(["cbm", "grossWeightKg"] as const)("la suma %s completa distinta del global conserva el bloqueo numérico", field => {
    const d = byField(field);
    d.groups[0][field] = field === "cbm" ? 0.2 : 50;
    d.groups[1][field] = field === "cbm" ? 0.4 : 70;
    expectFail(() => combinedLogistics([workspace(d)]), 422, "review_required");
  });
  it("un conflicto explícito de fuente sigue bloqueando aunque ambos totales del motor estén disponibles", () => {
    const d = byField("cbm");
    d.issues = [{ id: "source-conflict", code: "source_conflict", path: "declaredTotals.cbm", message: "Valores distintos por revisar.", blocking: true, severity: "error" }];
    expectFail(() => combinedLogistics([workspace(d)]), 422, "review_required");
  });
  it.each(["battery", "specialCargo"] as const)("no oculta %s=true con otra compra pendiente y recupera sólo tras declaración humana", key => {
    const a = byField("cbm"), b = byField("grossWeightKg");
    a.transportDeclarations![key] = true; b.transportDeclarations![key] = null;
    const error = expectFail(() => estimateDocuments([workspace(a), workspace(b)], { cityId: "maracaibo", battery: false, specialCargo: false }, rates()), 422, "transport_review_required");
    expect(error.message).toContain(key === "battery" ? "incluye baterías" : "incluye carga especial");
    b.transportDeclarations![key] = false;
    const result = expectExistingEngine([a, b], 1.6, 280, key === "battery", key === "specialCargo");
    if (key === "specialCargo") expect(result.result.alerta?.tipo).toBe("carga_especial");
  });
  it("la lectura IA pendiente permanece bloqueante; revisar no fabrica la distribución", () => {
    const d = byField("cbm");
    d.issues = [{ id: "ai_review_required:document", code: "ai_review_required", path: "document", message: "Revisa la lectura.", blocking: true, severity: "error" }];
    expectFail(() => estimateDocuments([workspace(d)], { cityId: "maracaibo" }, rates()), 422, "review_required");
    d.issues[0].resolved = true; expectExistingEngine([d], 0.8, 140);
    expect(() => toPackingPayload(d)).toThrow();
  });
});

describe("Quién puede pedir un estimado combinado", () => {
  it("sin el portal sólo se cotiza el documento del cotizador: combinar o guardar se niega antes de leer nada", async () => {
    vi.stubEnv("DOCUMENT_IMPORT_PORTAL_ENABLED", "false");
    const rows = [workspace(packed({ cbm: 1, weight: 200, cartons: 2 })), workspace(packed({ cbm: 1, weight: 200, cartons: 2 }))];
    serve(rows);
    await expectFailAsync(() => estimateForRequest(admin, session, new Headers(), { workspaceIds: rows.map((r) => r.id), expectedRevisions: rows.map(r => ({ workspaceId: r.id, revision: r.revision })), cityId: "maracaibo" }), 503, "portal_not_enabled");
    await expectFailAsync(() => estimateForRequest(admin, session, new Headers(), { workspaceIds: [rows[0].id], expectedRevisions: [{ workspaceId: rows[0].id, revision: rows[0].revision }], cityId: "maracaibo", save: true }), 503, "portal_not_enabled");
    expect(mocks.requirePortal).not.toHaveBeenCalled();
    expect(mocks.getWorkspace).not.toHaveBeenCalled();

    mocks.authorizeWorkspace.mockResolvedValue({ kind: "anonymous", id: rows[0].id });
    expect(await estimateForRequest(admin, session, new Headers(), { workspaceIds: [rows[0].id], expectedRevisions: [{ workspaceId: rows[0].id, revision: rows[0].revision }], cityId: "maracaibo" })).toMatchObject({ kind: "transport_estimate" });
  });


  it("varias compras sólo desde el portal: sin sesión ni siquiera se leen los documentos", async () => {
    const rows = [workspace(packed({ cbm: 1, weight: 200, cartons: 2 })), workspace(packed({ cbm: 1, weight: 200, cartons: 2 }))];
    serve(rows);
    mocks.requirePortal.mockRejectedValue(new ImportHttpError(401, "login_required", "Inicia sesión."));
    await expectFailAsync(() => estimateForRequest(admin, session, new Headers(), { workspaceIds: rows.map((r) => r.id), expectedRevisions: rows.map(r => ({ workspaceId: r.id, revision: r.revision })), cityId: "maracaibo" }), 401, "login_required");
    expect(mocks.getWorkspace).not.toHaveBeenCalled();
  });

  it("un proveedor nunca estima, ni una compra ni varias", async () => {
    const rows = [workspace(packed({ cbm: 1, weight: 200, cartons: 2 })), workspace(packed({ cbm: 1, weight: 200, cartons: 2 }))];
    serve(rows);
    mocks.authorizeWorkspace.mockResolvedValue({ kind: "supplier", id: "supplier:abc" });
    await expectFailAsync(() => estimateForRequest(admin, session, new Headers(), { workspaceIds: [rows[0].id], expectedRevisions: [{ workspaceId: rows[0].id, revision: rows[0].revision }], cityId: "maracaibo" }), 403, "not_allowed");
    await expectFailAsync(() => estimateForRequest(admin, session, new Headers(), { workspaceIds: rows.map((r) => r.id), expectedRevisions: rows.map(r => ({ workspaceId: r.id, revision: r.revision })), cityId: "maracaibo" }), 403, "not_allowed");

    // El enlace anónimo cotiza SU compra, pero no puede combinarla con otra.
    mocks.authorizeWorkspace.mockResolvedValue({ kind: "anonymous", id: rows[0].id });
    await expectFailAsync(() => estimateForRequest(admin, session, new Headers(), { workspaceIds: rows.map((r) => r.id), expectedRevisions: rows.map(r => ({ workspaceId: r.id, revision: r.revision })), cityId: "maracaibo" }), 403, "not_allowed");
    mocks.authorizeWorkspace.mockResolvedValue({ kind: "client", id: PRINCIPAL.userId, principal: PRINCIPAL });
    expect(await estimateForRequest(admin, session, new Headers(), { workspaceIds: rows.map((r) => r.id), expectedRevisions: rows.map(r => ({ workspaceId: r.id, revision: r.revision })), cityId: "maracaibo" })).toMatchObject({ kind: "transport_estimate" });
  });

  it("no deja contar dos veces la misma compra ni pedir más de 50 a la base", async () => {
    const row = workspace(packed({ cbm: 1, weight: 200, cartons: 2 }));
    serve([row]);
    await expectFailAsync(() => estimateForRequest(admin, session, new Headers(), { workspaceIds: [row.id, row.id], cityId: "maracaibo" }), 400, "duplicate_selection");
    // Mismo UUID en otra caja de letras: Postgres devuelve la misma fila.
    await expectFailAsync(() => estimateForRequest(admin, session, new Headers(), { workspaceIds: [row.id, row.id.toUpperCase()], cityId: "maracaibo" }), 400, "invalid_selection");
    await expectFailAsync(() => estimateForRequest(admin, session, new Headers(), { workspaceIds: row.id, cityId: "maracaibo" }), 400, "invalid_selection");

    mocks.getWorkspace.mockClear();
    await expectFailAsync(() => estimateForRequest(admin, session, new Headers(), { workspaceIds: Array.from({ length: 51 }, (_, i) => uuid(900 + i)), cityId: "maracaibo" }), 400, "invalid_selection");
    expect(mocks.getWorkspace).not.toHaveBeenCalled();
  });

  it("el estimado guardado se atribuye al principal vivo, y un fallo de guardado no se reporta como guardado", async () => {
    const rows = [workspace(packed({ cbm: 1, weight: 200, cartons: 2 })), workspace(packed({ cbm: 1, weight: 200, cartons: 2 }))];
    serve(rows);
    const single = vi.fn().mockResolvedValue({ data: { id: "snap-1" }, error: null });
    const guardado: Record<string, unknown>[] = [];
    const insert = vi.fn((payload: Record<string, unknown>) => { guardado.push(payload); return { select: () => ({ single }) }; });
    const db = { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient;
    const body = { workspaceIds: rows.map((r) => r.id), expectedRevisions: rows.map(r => ({ workspaceId: r.id, revision: r.revision })), cityId: "maracaibo", save: true, tenant_id: "tenant-ajeno", client_id: "cliente-ajeno", created_by: "usuario-ajeno" };

    expect(await estimateForRequest(db, session, new Headers(), body)).toMatchObject({ savedId: "snap-1" });
    // El dueño del estimado sale del principal vivo, nunca del cuerpo del request.
    expect(guardado[0]).toMatchObject({ tenant_id: PRINCIPAL.tenantId, client_id: PRINCIPAL.client.id, created_by: PRINCIPAL.userId });
    expect(JSON.stringify(guardado[0])).not.toContain("ajeno");
    // Lo guardado es el envío combinado, no una compra suelta.
    expect(guardado[0]).toMatchObject({ inputs: { cbmTotal: 2, pesoKg: 400, ciudadId: "maracaibo" } });

    single.mockResolvedValue({ data: null, error: { message: "duplicate key value violates unique constraint" } });
    const error = await expectFailAsync(() => estimateForRequest(db, session, new Headers(), body), 503, "save_failed");
    expect(error.message).not.toContain("constraint");
  });
});
