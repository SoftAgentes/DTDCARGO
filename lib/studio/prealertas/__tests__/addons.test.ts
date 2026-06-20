/**
 * Tests del menú de servicios de recepción (SDD-0098 · add-ons sobre la prealerta).
 * Cubre: los 7 defaults, merge "DB pisa, código respalda", filtro de inactivos,
 * limpieza de trackings, validación de la solicitud y el ANTI-DRIFT código↔CHECK de
 * la migración 0150 (la constante TS y el allowlist del SQL no se pueden desfasar).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import {
  PREALERTA_ADDON_CODES,
  PREALERTA_ADDON_DEFAULTS,
  MAX_REQUEST_TRACKINGS,
  isPrealertaAddonCode,
  mergePrealertaAddons,
  cleanTrackings,
  validateServiceRequestInput,
  type PrealertaAddonRow,
} from "../addons";

const ALL_CODES = new Set<string>(PREALERTA_ADDON_CODES);

describe("PREALERTA_ADDON_DEFAULTS", () => {
  it("tiene exactamente los 7 códigos, sin duplicados", () => {
    expect(PREALERTA_ADDON_CODES).toHaveLength(7);
    expect(new Set(PREALERTA_ADDON_CODES).size).toBe(7);
    const defCodes = PREALERTA_ADDON_DEFAULTS.map((a) => a.code);
    expect(new Set(defCodes)).toEqual(ALL_CODES);
  });

  it("reempaque y hold son multi-tracking; el resto mono", () => {
    const multi = PREALERTA_ADDON_DEFAULTS.filter((a) => a.multiTracking).map(
      (a) => a.code,
    );
    expect(new Set(multi)).toEqual(
      new Set(["reempaque_unificar", "hold_consolidar"]),
    );
  });

  it("todos arrancan activos, con consentimiento y sin video (config vacía)", () => {
    for (const a of PREALERTA_ADDON_DEFAULTS) {
      expect(a.isActive).toBe(true);
      expect(a.consentText).toBeTruthy();
      expect(a.videoUrl).toBeNull();
    }
  });

  it("isPrealertaAddonCode discrimina", () => {
    expect(isPrealertaAddonCode("verificacion")).toBe(true);
    expect(isPrealertaAddonCode("no_existe")).toBe(false);
    expect(isPrealertaAddonCode(42)).toBe(false);
  });
});

describe("mergePrealertaAddons (DB pisa, código respalda)", () => {
  it("sin filas DB → los 7 defaults, ordenados por sort", () => {
    const merged = mergePrealertaAddons([]);
    expect(merged).toHaveLength(7);
    expect(merged.map((a) => a.code)).toEqual([...PREALERTA_ADDON_CODES]);
    const sorts = merged.map((a) => a.sort);
    expect([...sorts]).toEqual([...sorts].sort((x, y) => x - y));
  });

  it("la DB pisa label, video, is_active; lo que deja en null cae al default", () => {
    const rows: PrealertaAddonRow[] = [
      {
        code: "verificacion",
        label: "Mi verificación",
        video_url: "https://youtube.com/shorts/abc",
        is_active: false,
        // description/notas/consent omitidos → caen al default
      },
    ];
    const merged = mergePrealertaAddons(rows);
    const v = merged.find((a) => a.code === "verificacion")!;
    expect(v.label).toBe("Mi verificación");
    expect(v.videoUrl).toBe("https://youtube.com/shorts/abc");
    expect(v.isActive).toBe(false);
    // description NO pisada → default
    const def = PREALERTA_ADDON_DEFAULTS.find((a) => a.code === "verificacion")!;
    expect(v.description).toBe(def.description);
  });

  it("ignora códigos de la DB fuera de los 7", () => {
    const rows = [{ code: "inventado", label: "x" }] as PrealertaAddonRow[];
    const merged = mergePrealertaAddons(rows);
    expect(merged).toHaveLength(7);
    expect(merged.some((a) => (a.code as string) === "inventado")).toBe(false);
  });
});

describe("cleanTrackings", () => {
  it("recorta, valida alfanum+guiones, dedupe (case-insensitive) y respeta el tope", () => {
    expect(cleanTrackings([" 1ZAB-99 ", "1zab-99", "bad space", "OK-1", ""])).toEqual([
      "1ZAB-99",
      "OK-1",
    ]);
    const many = Array.from({ length: MAX_REQUEST_TRACKINGS + 5 }, (_, i) => `T${i}`);
    expect(cleanTrackings(many)).toHaveLength(MAX_REQUEST_TRACKINGS);
  });
});

describe("validateServiceRequestInput", () => {
  it("rechaza código desconocido o inactivo", () => {
    expect(
      validateServiceRequestInput({ addonCode: "no_existe" }, ALL_CODES),
    ).toBeNull();
    const onlyVerif = new Set(["verificacion"]);
    expect(
      validateServiceRequestInput({ addonCode: "compactar" }, onlyVerif),
    ).toBeNull();
  });

  it("acepta válido; trackings solo en multi", () => {
    const multi = validateServiceRequestInput(
      { addonCode: "reempaque_unificar", notes: " unir ", trackings: ["A-1", "A-1"] },
      ALL_CODES,
    );
    expect(multi).toEqual({
      addonCode: "reempaque_unificar",
      notes: "unir",
      trackings: ["A-1"],
    });

    const mono = validateServiceRequestInput(
      { addonCode: "verificacion", trackings: ["A-1"] },
      ALL_CODES,
    );
    // mono ignora los trackings extra
    expect(mono?.trackings).toEqual([]);
  });
});

describe("anti-drift: PREALERTA_ADDON_CODES == CHECK de la migración 0150", () => {
  it("el allowlist del SQL coincide con la constante TS", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/0150_prealerta_addons.sql"),
      "utf8",
    );
    // Ambos CHECK (code in (...) y addon_code in (...)) deben listar los 7 mismos.
    const checks = [...sql.matchAll(/in \(\s*((?:'[a-z_]+'\s*,?\s*)+)\)/g)].map(
      (m) =>
        [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort().join(","),
    );
    const expected = [...PREALERTA_ADDON_CODES].sort().join(",");
    // al menos dos CHECK (addons.code + service_requests.addon_code) y todos == los 7
    const addonChecks = checks.filter((c) => c === expected);
    expect(addonChecks.length).toBeGreaterThanOrEqual(2);
  });
});
