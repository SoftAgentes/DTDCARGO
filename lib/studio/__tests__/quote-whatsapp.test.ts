// @vitest-environment node
/**
 * Tests de la salida por WhatsApp del estimado (F1-T11) — helpers puros de
 * quote-types: normalizeWhatsappPhone, buildQuoteWhatsappText, quoteWhatsappHref.
 */

import { describe, it, expect } from "vitest";
import {
  buildQuoteWhatsappText,
  normalizeWhatsappPhone,
  quoteWhatsappHref,
  type Quote,
} from "../quote-types";

const mkQuote = (o: Partial<Quote> = {}): Quote => ({
  id: "q1",
  tenant_id: "t1",
  quote_code: "Q-2026-0001",
  client_markbox: "DTD-0001",
  client_name: "Cliente Uno",
  service: "consolidado_lcl",
  origin: "Yiwu",
  destination: "Puerto Cabello",
  cbm: 3.4,
  weight_kg: 500,
  boxes: 10,
  packaging: "carton",
  rate_per_cbm: 800,
  flat_rate: null,
  rate_used_id: null,
  subtotal_usd: 2720,
  packaging_cost: 0,
  total_usd: 2720,
  status: "draft",
  valid_until: "2026-08-01",
  sent_at: null,
  accepted_at: null,
  converted_to_shipment_id: null,
  sales_order_id: null,
  notes: null,
  prospect_name: null,
  prospect_email: null,
  prospect_whatsapp: null,
  nota: null,
  source: "studio",
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
  deleted_at: null,
  ...o,
});

// ── normalizeWhatsappPhone ────────────────────────────────────
describe("normalizeWhatsappPhone", () => {
  it("local con 0 (VE) → 58 + resto sin el 0", () => {
    expect(normalizeWhatsappPhone("0412-123-4567")).toBe("584121234567");
  });
  it("con +58 y separadores → solo dígitos", () => {
    expect(normalizeWhatsappPhone("+58 412 123 4567")).toBe("584121234567");
  });
  it("local de 10 dígitos sin 0 → antepone 58", () => {
    expect(normalizeWhatsappPhone("4121234567")).toBe("584121234567");
  });
  it("ya con código país 58 → se respeta", () => {
    expect(normalizeWhatsappPhone("584121234567")).toBe("584121234567");
  });
  it("null / vacío → ''", () => {
    expect(normalizeWhatsappPhone(null)).toBe("");
    expect(normalizeWhatsappPhone("   ")).toBe("");
  });
});

// ── buildQuoteWhatsappText ────────────────────────────────────
describe("buildQuoteWhatsappText", () => {
  it("LCL (per_cbm): muestra volumen, tarifa/CBM, total y vigencia", () => {
    const t = buildQuoteWhatsappText(mkQuote());
    expect(t).toContain("Q-2026-0001");
    expect(t).toContain("Cliente Uno");
    expect(t).toContain("Yiwu → Puerto Cabello");
    expect(t).toContain("3.400 m³");
    expect(t).toContain("$800.00/CBM");
    expect(t).toContain("*Total: $2,720.00 USD*");
    expect(t).toContain("Vigencia hasta: 2026-08-01");
    expect(t).not.toContain("Embalaje");
  });

  it("FCL (flat): muestra tarifa fija y no CBM", () => {
    const t = buildQuoteWhatsappText(
      mkQuote({
        service: "fcl_directo",
        cbm: null,
        rate_per_cbm: null,
        flat_rate: 5000,
        subtotal_usd: 5000,
        total_usd: 5000,
      }),
    );
    expect(t).toContain("$5,000.00 (tarifa fija)");
    expect(t).not.toContain("/CBM");
    expect(t).not.toContain("m³");
  });

  it("con embalaje cobrado → agrega la línea", () => {
    const t = buildQuoteWhatsappText(
      mkQuote({ packaging: "paleta", packaging_cost: 60, total_usd: 2780 }),
    );
    expect(t).toContain("Embalaje");
    expect(t).toContain("+$60.00");
    expect(t).toContain("*Total: $2,780.00 USD*");
  });
});

// ── quoteWhatsappHref ─────────────────────────────────────────
describe("quoteWhatsappHref", () => {
  it("con teléfono → wa.me/<digits> y texto encodeado", () => {
    const href = quoteWhatsappHref("0412-1234567", "hola mundo");
    expect(href.startsWith("https://wa.me/584121234567?text=")).toBe(true);
    const encoded = href.split("text=")[1];
    expect(decodeURIComponent(encoded)).toBe("hola mundo");
  });
  it("sin teléfono → wa.me/ (el asesor elige contacto)", () => {
    const href = quoteWhatsappHref(null, "texto");
    expect(href.startsWith("https://wa.me/?text=")).toBe(true);
  });
  it("preserva saltos de línea del desglose al encodear", () => {
    const text = buildQuoteWhatsappText(mkQuote());
    const href = quoteWhatsappHref("584121234567", text);
    expect(decodeURIComponent(href.split("text=")[1])).toBe(text);
  });
});
