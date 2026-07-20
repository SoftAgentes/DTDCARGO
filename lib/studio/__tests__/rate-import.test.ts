import { describe, it, expect } from "vitest";
import {
  parseRatesCsv,
  rateDedupKey,
} from "@/lib/studio/rate-import";

/**
 * Importador masivo de tarifas (Fase 3 Slice C, SDD-0055). Parser propio
 * (sin libs): valida cada fila + dedup interno por (service, origin, destination)
 * + preview. Las válidas entran como draft (no van live).
 */
describe("parseRatesCsv", () => {
  const HEADER =
    "service,origin,destination,per_cbm,flat_rate,min_charge,transit_days,valid_from,valid_until,notes";

  it("parsea una fila per_cbm válida", () => {
    const csv = `${HEADER}\nconsolidado_lcl,Yiwu,Valencia,800,,380,38,2026-01-01,2026-12-31,Q1`;
    const p = parseRatesCsv(csv);
    expect(p.error).toBeUndefined();
    expect(p.validCount).toBe(1);
    expect(p.invalidCount).toBe(0);
    const input = p.rows[0].input;
    expect(input).toBeTruthy();
    expect(input!.service).toBe("consolidado_lcl");
    expect(input!.origin).toBe("Yiwu");
    expect(input!.destination).toBe("Valencia");
    expect(input!.per_cbm).toBe(800);
    expect(input!.flat_rate).toBeNull();
    expect(input!.min_charge).toBe(380);
    expect(input!.transit_days).toBe(38);
    expect(input!.valid_from).toBe("2026-01-01");
    expect(input!.valid_until).toBe("2026-12-31");
    expect(input!.notes).toBe("Q1");
    expect(input!.is_public).toBe(false);
  });

  it("parsea una fila flat_rate válida (FCL)", () => {
    const csv = `${HEADER}\nfcl_directo,Shenzhen,La Guaira,,8500,,40,,,Contrato`;
    const p = parseRatesCsv(csv);
    expect(p.validCount).toBe(1);
    const input = p.rows[0].input!;
    expect(input.per_cbm).toBeNull();
    expect(input.flat_rate).toBe(8500);
    expect(input.valid_from).toBeNull();
  });

  it("acepta encabezado en cualquier orden e ignora columnas desconocidas", () => {
    const csv = `destination,origin,service,extra,per_cbm\nValencia,Yiwu,consolidado_lcl,basura,650`;
    const p = parseRatesCsv(csv);
    expect(p.validCount).toBe(1);
    const input = p.rows[0].input!;
    expect(input.origin).toBe("Yiwu");
    expect(input.destination).toBe("Valencia");
    expect(input.per_cbm).toBe(650);
  });

  it("respeta comillas dobles en celdas con comas", () => {
    const csv = `${HEADER}\nconsolidado_lcl,Yiwu,Valencia,800,,,,,,"Nota, con coma"`;
    const p = parseRatesCsv(csv);
    expect(p.validCount).toBe(1);
    expect(p.rows[0].input!.notes).toBe("Nota, con coma");
  });

  // ── Inválidas ──────────────────────────────────────────────

  it("rechaza servicio inválido", () => {
    const csv = `${HEADER}\nbarco_pirata,Yiwu,Valencia,800,,,,,,`;
    const p = parseRatesCsv(csv);
    expect(p.validCount).toBe(0);
    expect(p.invalidCount).toBe(1);
    expect(p.rows[0].error).toContain("Servicio inválido");
  });

  it("rechaza fila sin per_cbm ni flat_rate", () => {
    const csv = `${HEADER}\nconsolidado_lcl,Yiwu,Valencia,,,,,,,`;
    const p = parseRatesCsv(csv);
    expect(p.invalidCount).toBe(1);
    expect(p.rows[0].error).toContain("per_cbm o flat_rate");
  });

  it("rechaza fila sin origin o destination", () => {
    const csv = `${HEADER}\nconsolidado_lcl,,Valencia,800,,,,,,`;
    const p = parseRatesCsv(csv);
    expect(p.invalidCount).toBe(1);
    expect(p.rows[0].error).toContain("origin o destination");
  });

  it("rechaza valores negativos", () => {
    const csv = `${HEADER}\nconsolidado_lcl,Yiwu,Valencia,-5,,,,,,`;
    const p = parseRatesCsv(csv);
    expect(p.invalidCount).toBe(1);
  });

  it("rechaza fechas inválidas y valid_from > valid_until", () => {
    const bad = parseRatesCsv(
      `${HEADER}\nconsolidado_lcl,Yiwu,Valencia,800,,,,no-fecha,,`,
    );
    expect(bad.invalidCount).toBe(1);
    expect(bad.rows[0].error).toContain("valid_from");

    const inverted = parseRatesCsv(
      `${HEADER}\nconsolidado_lcl,Yiwu,Valencia,800,,,,2026-12-31,2026-01-01,`,
    );
    expect(inverted.invalidCount).toBe(1);
    expect(inverted.rows[0].error).toContain("posterior");
  });

  // ── Dedup interno ──────────────────────────────────────────

  it("marca como duplicada la 2ª fila con mismo service/origin/destination", () => {
    const csv =
      `${HEADER}\n` +
      `consolidado_lcl,Yiwu,Valencia,800,,,,,,\n` +
      `consolidado_lcl,Yiwu,Valencia,900,,,,,,`;
    const p = parseRatesCsv(csv);
    expect(p.validCount).toBe(1); // la 1ª gana
    expect(p.duplicateCount).toBe(1);
    expect(p.invalidCount).toBe(1);
    expect(p.rows[1].error).toContain("Duplicada");
  });

  it("el dedup es case-insensitive en origin/destination", () => {
    const csv =
      `${HEADER}\n` +
      `consolidado_lcl,Yiwu,Valencia,800,,,,,,\n` +
      `consolidado_lcl,YIWU,valencia,900,,,,,,`;
    const p = parseRatesCsv(csv);
    expect(p.validCount).toBe(1);
    expect(p.duplicateCount).toBe(1);
  });

  it("distinto servicio NO es duplicado", () => {
    const csv =
      `${HEADER}\n` +
      `consolidado_lcl,Yiwu,Valencia,800,,,,,,\n` +
      `puerta_a_puerta_DDP,Yiwu,Valencia,900,,,,,,`;
    const p = parseRatesCsv(csv);
    expect(p.validCount).toBe(2);
    expect(p.duplicateCount).toBe(0);
  });

  // ── Errores globales ───────────────────────────────────────

  it("error si el CSV está vacío", () => {
    expect(parseRatesCsv("").error).toContain("vacío");
    expect(parseRatesCsv("   \n  ").error).toContain("vacío");
  });

  it("error si falta una columna obligatoria en el encabezado", () => {
    const p = parseRatesCsv(`service,origin,per_cbm\nconsolidado_lcl,Yiwu,800`);
    expect(p.error).toContain("service, origin, destination");
  });

  it("error si solo hay encabezado sin filas", () => {
    expect(parseRatesCsv(HEADER).error).toContain("sin filas");
  });
});

describe("rateDedupKey", () => {
  it("normaliza a minúsculas y trim", () => {
    expect(
      rateDedupKey({
        service: "consolidado_lcl",
        origin: " Yiwu ",
        destination: "Valencia",
      }),
    ).toBe("consolidado_lcl|yiwu|valencia");
  });

  it("distingue por servicio", () => {
    const a = rateDedupKey({
      service: "consolidado_lcl",
      origin: "x",
      destination: "y",
    });
    const b = rateDedupKey({
      service: "fcl_directo",
      origin: "x",
      destination: "y",
    });
    expect(a).not.toBe(b);
  });
});
