// @vitest-environment node
/**
 * SDD-0157 — Tests de la lógica pura de la campaña de recuperación Kommo:
 * clasificación contacto×cliente (teléfono/email), dedupe por teléfono,
 * filtros, plantilla del guion, link wa.me y CSV de SMS.
 */
import { describe, it, expect } from "vitest";
import {
  buildRecoveryMessage,
  buildRecoverySmsCsv,
  buildRecoveryWaLink,
  classifyRecoveryContacts,
  filterRecoveryRows,
  parseRecoveryFilters,
  RECOVERY_TEMPLATES,
  type RecoveryRow,
} from "@/lib/studio/kommo-recovery";

const NOW = Date.parse("2026-07-17T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

/** custom_fields con la forma real del espejo ({field_code, values:[{value}]}). */
function cf(phone?: string | null, email?: string | null): unknown {
  const out: unknown[] = [];
  if (phone) out.push({ field_code: "PHONE", values: [{ value: phone }] });
  if (email) out.push({ field_code: "EMAIL", values: [{ value: email }] });
  return out;
}

const CLIENTS = [
  { markbox: "DTD-0001", name: "Ferretería El Tornillo", phone: "+58 412 1234567", email: null },
  { markbox: "DTD-0002", name: "Repuestos Lara", phone: null, email: "lara@mail.com" },
];

describe("classifyRecoveryContacts", () => {
  it("clasifica cliente por teléfono aunque el formato difiera (0412 vs +58412)", () => {
    const r = classifyRecoveryContacts(
      [{ id: 1, name: "Carlos", custom_fields: cf("0412-123.45.67"), kommo_updated_at: daysAgo(200) }],
      CLIENTS,
      NOW,
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].segment).toBe("cliente");
    expect(r.rows[0].markbox).toBe("DTD-0001");
    expect(r.rows[0].days).toBe(200);
  });

  it("clasifica cliente por email cuando el teléfono no matchea", () => {
    const r = classifyRecoveryContacts(
      [{ id: 2, name: "Ana", custom_fields: cf("0414 999 8877", "LARA@mail.com"), kommo_updated_at: daysAgo(30) }],
      CLIENTS,
      NOW,
    );
    expect(r.rows[0].segment).toBe("cliente");
    expect(r.rows[0].markbox).toBe("DTD-0002");
  });

  it("sin match → interesado; sin teléfono usable → fuera (contadores)", () => {
    const r = classifyRecoveryContacts(
      [
        { id: 3, name: "Pedro", custom_fields: cf("0426 555 1122"), kommo_updated_at: daysAgo(400) },
        { id: 4, name: "SinTel", custom_fields: cf(null, "solo@mail.com"), kommo_updated_at: daysAgo(10) },
        { id: 5, name: "Nada", custom_fields: [], kommo_updated_at: null },
      ],
      CLIENTS,
      NOW,
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].segment).toBe("interesado");
    expect(r.noPhone).toBe(2);
    expect(r.noPhoneWithEmail).toBe(1);
  });

  it("dedupe por teléfono: queda el contacto con actividad más reciente", () => {
    const r = classifyRecoveryContacts(
      [
        { id: 6, name: "Viejo", custom_fields: cf("+584121234567"), kommo_updated_at: daysAgo(300) },
        { id: 7, name: "Nuevo", custom_fields: cf("0412 123 4567"), kommo_updated_at: daysAgo(5) },
      ],
      CLIENTS,
      NOW,
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].name).toBe("Nuevo");
    expect(r.deduped).toBe(1);
  });
});

const ROWS: RecoveryRow[] = [
  { contactId: 1, name: "Frío Cliente", phone: "04121234567", email: null, lastActivity: daysAgo(400), days: 400, segment: "cliente", markbox: "DTD-0001", clientName: "X" },
  { contactId: 2, name: "Tibio Interesado", phone: "04140000000", email: null, lastActivity: daysAgo(60), days: 60, segment: "interesado", markbox: null, clientName: null },
  { contactId: 3, name: "Sin Fecha", phone: "04160000000", email: null, lastActivity: null, days: null, segment: "interesado", markbox: null, clientName: null },
];

describe("filterRecoveryRows", () => {
  it("filtra por segmento y antigüedad mínima", () => {
    expect(filterRecoveryRows(ROWS, { segment: "cliente" })).toHaveLength(1);
    const aged = filterRecoveryRows(ROWS, { agedDays: 90 });
    expect(aged.map((r) => r.contactId)).toEqual([1]);
  });

  it("busca por nombre, por dígitos del teléfono y por markbox", () => {
    expect(filterRecoveryRows(ROWS, { q: "tibio" })[0].contactId).toBe(2);
    expect(filterRecoveryRows(ROWS, { q: "1234567" })[0].contactId).toBe(1);
    expect(filterRecoveryRows(ROWS, { q: "dtd-0001" })[0].contactId).toBe(1);
  });

  it("orden default = más fríos primero; 'recent' = recientes primero, sin fecha al final", () => {
    expect(filterRecoveryRows(ROWS, {}).map((r) => r.contactId)).toEqual([1, 2, 3]);
    expect(filterRecoveryRows(ROWS, { sort: "recent" }).map((r) => r.contactId)).toEqual([2, 1, 3]);
  });
});

describe("guion + wa.me + CSV", () => {
  it("interpola el primer nombre en la plantilla", () => {
    const msg = buildRecoveryMessage(RECOVERY_TEMPLATES.cliente, "Carlos Pérez");
    expect(msg).toContain("¡Hola Carlos!");
    expect(msg).not.toContain("{nombre}");
  });

  it("arma wa.me con el guion urlencoded; número local 04xx → 58", () => {
    const link = buildRecoveryWaLink({ phone: "0412-1234567", name: "Ana María" }, "Hola {nombre}");
    expect(link).toMatch(/^https:\/\/wa\.me\/584121234567\?text=/);
    expect(decodeURIComponent(link!.split("text=")[1])).toBe("Hola Ana");
  });

  it("CSV: header + teléfono internacional + escaping de comas", () => {
    const csv = buildRecoverySmsCsv([
      { ...ROWS[0], name: "Ferretería, La Grande" },
      ROWS[2],
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("nombre,telefono,segmento,dias_inactivo,shipping_mark");
    expect(lines[1]).toBe('"Ferretería, La Grande",584121234567,cliente,400,DTD-0001');
    expect(lines[2]).toBe("Sin Fecha,584160000000,interesado,,");
  });
});

describe("parseRecoveryFilters", () => {
  it("parsea rseg/raged/rq/rsort y descarta valores inválidos", () => {
    expect(
      parseRecoveryFilters({ rseg: "cliente", raged: "180", rq: " torn ", rsort: "recent" }),
    ).toEqual({ segment: "cliente", agedDays: 180, q: "torn", sort: "recent" });
    expect(parseRecoveryFilters({ rseg: "x", raged: "-5" })).toEqual({
      segment: undefined,
      agedDays: undefined,
      q: undefined,
      sort: "oldest",
    });
  });
});
