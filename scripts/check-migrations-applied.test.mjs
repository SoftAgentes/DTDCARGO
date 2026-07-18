/**
 * Tests de la decisión del gate `migrations-applied` (scripts/check-migrations-applied.mjs).
 *
 * QUÉ PROTEGEN: que el check siga cazando el caso 0228 (archivo en el repo, nunca
 * aplicado en prod) SIN volver a gritar por los históricos. Las dos mitades importan
 * igual: un check que no caza no sirve, y un check ruidoso se ignora — que es
 * exactamente cómo la 0228 estuvo dos rondas perdida.
 *
 * El caso `no grita por un histórico con nombre divergente` es una REGRESIÓN real:
 * el primer diseño matcheaba por basename exacto contra el ledger y sacaba 45
 * falsos positivos (0001_init_tenancy vive en prod como 'init_tenancy',
 * 0067_warehouse_receipts_ve como 'warehouse_receipts_ve_sprint_e'…). De ahí salió
 * la línea de corte.
 */
import { describe, expect, it } from "vitest";
import { findMissing, migrationNumber } from "./check-migrations-applied.mjs";

const CUTOFF = 238;

describe("migrationNumber", () => {
  it("saca el prefijo numérico del basename", () => {
    expect(migrationNumber("0239_applied_migrations_rpc")).toBe(239);
    expect(migrationNumber("0001_init_tenancy")).toBe(1);
  });

  it("tolera el sufijo de letra (0006b, 0020e) — son parches del mismo número", () => {
    expect(migrationNumber("0006b_clients_seed_align")).toBe(6);
    expect(migrationNumber("0020e_operario_receipt_drop_and_recreate")).toBe(20);
  });

  it("devuelve null si no arranca con NNNN", () => {
    expect(migrationNumber("init_tenancy")).toBeNull();
  });
});

describe("findMissing", () => {
  it("caza una migración NUEVA que no está en prod — el caso 0228/0169", () => {
    const missing = findMissing(["0240_ghost"], new Set(), CUTOFF);
    expect(missing).toEqual(["0240_ghost"]);
  });

  it("no dice nada de una migración nueva que SÍ está aplicada", () => {
    const missing = findMissing(["0239_rpc"], new Set(["0239_rpc"]), CUTOFF);
    expect(missing).toEqual([]);
  });

  it("no grita por un histórico con nombre divergente en prod (la regresión de los 45)", () => {
    // El ledger los tiene bajo OTRO name; por debajo del corte no se exige match.
    const historicos = [
      "0001_init_tenancy", // prod: 'init_tenancy'
      "0067_warehouse_receipts_ve", // prod: 'warehouse_receipts_ve_sprint_e'
      "0106_conversaciones", // prod: 'sdd0056_conversaciones_fase1'
      "0085_portal_invoices_rls", // aplicada fuera de banda: sin fila propia
    ];
    expect(findMissing(historicos, new Set(), CUTOFF)).toEqual([]);
  });

  it("respeta el corte en el borde exacto", () => {
    // 0238 es el corte → histórico. 0239 es lo nuevo → se exige.
    const missing = findMissing(["0238_borde", "0239_nueva"], new Set(), CUTOFF);
    expect(missing).toEqual(["0239_nueva"]);
  });

  it("no grita por una espera declarada, aunque esté por encima del corte", () => {
    const missing = findMissing(["0240_gated"], new Set(), CUTOFF, {
      "0240_gated": "esperando decisión del founder",
    });
    expect(missing).toEqual([]);
  });

  it("ignora archivos sin prefijo numérico en vez de romperse", () => {
    expect(findMissing(["README", "seed_data"], new Set(), CUTOFF)).toEqual([]);
  });

  it("separa lo nuevo-sin-aplicar de lo nuevo-aplicado en la misma tanda", () => {
    const files = ["0239_aplicada", "0240_olvidada", "0241_aplicada"];
    const applied = new Set(["0239_aplicada", "0241_aplicada"]);
    expect(findMissing(files, applied, CUTOFF)).toEqual(["0240_olvidada"]);
  });
});
