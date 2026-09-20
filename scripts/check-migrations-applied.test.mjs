// @vitest-environment node
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
import {
  collectMigrationFiles,
  findMissing,
  findOrphans,
  migrationNumber,
  parseLedgerVersion,
} from "./check-migrations-applied.mjs";

const CUTOFF = 238;
/** 2026-08-05 12:00 UTC — el "ahora" fijo de los tests de huérfanas. */
const NOW = Date.UTC(2026, 7, 5, 12, 0, 0);
/** Ledger row aplicada `h` horas antes de NOW. */
function aplicadaHace(name, h) {
  const d = new Date(NOW - h * 3_600_000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  const version = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
  return { version, name };
}

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

describe("parseLedgerVersion", () => {
  it("lee el timestamp UTC del ledger", () => {
    expect(parseLedgerVersion("20260802225220")).toBe(Date.UTC(2026, 7, 2, 22, 52, 20));
  });

  it("devuelve null si no tiene la forma YYYYMMDDHHMMSS", () => {
    expect(parseLedgerVersion("2026080222")).toBeNull();
    expect(parseLedgerVersion(undefined)).toBeNull();
  });
});

describe("findOrphans · la dirección que faltaba (prod → repo)", () => {
  it("⭐ caza la migración aplicada cuyo archivo no está en el repo — el caso 0336/0337/0338", () => {
    // Aplicadas hace 3 días, archivos colgando de un worktree sin pushear.
    const ledger = [
      aplicadaHace("0336_pod_closes_shipment", 72),
      aplicadaHace("0337_feature_flags_seed_and_trigger", 72),
    ];
    const { olvidadas, enVuelo } = findOrphans(ledger, ["0239_rpc"], CUTOFF, NOW);

    expect(olvidadas.map((o) => o.name)).toEqual([
      "0336_pod_closes_shipment",
      "0337_feature_flags_seed_and_trigger",
    ]);
    expect(enVuelo).toEqual([]);
  });

  it("NO grita por una recién aplicada: con 38 worktrees, pushear después es lo normal", () => {
    // Si esto fuera rojo, el gate de TODAS las demás ventanas se pondría rojo por
    // algo ajeno y transitorio — el camino más corto a que el rojo se ignore.
    const ledger = [aplicadaHace("0350_recien_aplicada", 2)];
    const { olvidadas, enVuelo } = findOrphans(ledger, [], CUTOFF, NOW);

    expect(olvidadas).toEqual([]);
    expect(enVuelo.map((o) => o.name)).toEqual(["0350_recien_aplicada"]);
  });

  it("respeta el borde exacto de la gracia", () => {
    const ledger = [aplicadaHace("0350_justo", 24), aplicadaHace("0351_casi", 23)];
    const { olvidadas, enVuelo } = findOrphans(ledger, [], CUTOFF, NOW);

    expect(olvidadas.map((o) => o.name)).toEqual(["0350_justo"]);
    expect(enVuelo.map((o) => o.name)).toEqual(["0351_casi"]);
  });

  it("calla cuando el archivo SÍ está en el repo", () => {
    const ledger = [aplicadaHace("0336_pod_closes_shipment", 72)];
    const r = findOrphans(ledger, ["0336_pod_closes_shipment"], CUTOFF, NOW);
    expect(r.olvidadas).toEqual([]);
    expect(r.enVuelo).toEqual([]);
  });

  it("ignora lo histórico: por debajo del corte el name diverge y sería puro ruido", () => {
    // 'init_tenancy' vive en prod bajo ese nombre y en el repo como
    // 0001_init_tenancy. Mirar ahí abajo devolvería decenas de falsos positivos.
    const ledger = [aplicadaHace("0001_init_tenancy", 9999), { version: "x", name: "init_tenancy" }];
    expect(findOrphans(ledger, [], CUTOFF, NOW).olvidadas).toEqual([]);
  });

  it("una fecha ilegible cuenta como olvidada — ante la duda, que grite", () => {
    const ledger = [{ version: "no-es-fecha", name: "0350_sin_fecha" }];
    const { olvidadas } = findOrphans(ledger, [], CUTOFF, NOW);
    expect(olvidadas.map((o) => o.name)).toEqual(["0350_sin_fecha"]);
  });
});

describe("collectMigrationFiles", () => {
  it("⭐ ve una migración que está en origin/main y NO en el disco — el punto ciego 0317-0324", () => {
    // El caso real: un worktree atrasado. El archivo existe en main (y su código
    // ya desplegado en prod) pero no en disco, así que antes no se comparaba
    // contra nada y el gate salía VERDE por omisión.
    const { files, sawMain } = collectMigrationFiles(
      ["0317_en_main", "0318_en_main"],
      ["0001_vieja"],
    );

    expect(files).toEqual(["0001_vieja", "0317_en_main", "0318_en_main"]);
    expect(sawMain).toBe(true);
    // Y llega entera hasta la decisión: sin la unión, esto daría [].
    expect(findMissing(files, new Set(), CUTOFF)).toEqual([
      "0317_en_main",
      "0318_en_main",
    ]);
  });

  it("sigue viendo lo que está en disco y todavía no se pusheó", () => {
    const { files } = collectMigrationFiles(["0240_publicada"], ["0241_local_sin_pushear"]);
    expect(files).toEqual(["0240_publicada", "0241_local_sin_pushear"]);
  });

  it("no duplica lo que está en los dos lados", () => {
    const { files } = collectMigrationFiles(["0240_x"], ["0240_x"]);
    expect(files).toEqual(["0240_x"]);
  });

  it("sin git (null) mide sólo el disco y lo marca — no finge que main está vacío", () => {
    // `null` ≠ `[]`. Si mainMigrations() devolviera [] estaríamos afirmando "main
    // no tiene migraciones", que es falso y reabre el verde por omisión.
    const { files, sawMain } = collectMigrationFiles(null, ["0001_vieja"]);
    expect(files).toEqual(["0001_vieja"]);
    expect(sawMain).toBe(false);
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
