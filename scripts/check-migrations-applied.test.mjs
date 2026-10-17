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
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  clasificarDestino,
  collectMigrationFiles,
  findMissing,
  findOrphans,
  migrationNumber,
  motivoSinMedir,
  ORIGEN_PRODUCCION,
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

/**
 * SDD-0548 · DÓNDE MIDE. Desde el corte del 2026-10-14 producción es el servidor
 * propio y Supabase Cloud quedó como copia congelada que sigue respondiendo. Con
 * la URL de Cloud en `.env.local` el gate leía ese ledger viejo, lo llamaba «prod»
 * y no decía el host. Estas pruebas fijan que solo mide en producción.
 */
describe("clasificarDestino · SDD-0548", () => {
  it("reconoce producción, con o sin barra, ruta o mayúsculas", () => {
    for (const url of [
      "https://supabase.dtdcargo.com",
      "https://supabase.dtdcargo.com/",
      "https://SUPABASE.dtdcargo.com/rest/v1?x=1",
      "  https://supabase.dtdcargo.com:443  ",
      "https://supabase.dtdcargo.com./",
    ]) {
      expect(clasificarDestino(url), url).toEqual({ tipo: "produccion", origen: ORIGEN_PRODUCCION });
    }
  });

  it("⭐ el proyecto de Cloud del corte es Cloud, no producción", () => {
    expect(clasificarDestino("https://xpfuzqombmjmxvprjgmi.supabase.co")).toEqual({
      tipo: "cloud",
      origen: "https://xpfuzqombmjmxvprjgmi.supabase.co",
    });
  });

  it("cualquier proyecto de Cloud es Cloud, también con punto final o mayúsculas", () => {
    expect(clasificarDestino("https://otro-ref.supabase.co/").tipo).toBe("cloud");
    expect(clasificarDestino("https://XPFUZQOMBMJMXVPRJGMI.SUPABASE.CO.").tipo).toBe("cloud");
    expect(clasificarDestino("http://xpfuzqombmjmxvprjgmi.supabase.co:8443").tipo).toBe("cloud");
  });

  it("un host que solo se parece a producción no es producción", () => {
    for (const url of [
      "http://supabase.dtdcargo.com",
      "https://supabase.dtdcargo.com:8443",
      "https://supabase-prueba.dtdcargo.com",
      "https://supabase.dtdcargo.com.evil.example",
      "https://evilsupabase.dtdcargo.com",
      "http://127.0.0.1:54321",
    ]) {
      expect(clasificarDestino(url).tipo, url).toBe("otro");
    }
  });

  it("una URL con usuario o clave no se mide, y su origen no los lleva", () => {
    const d = clasificarDestino("https://u-prueba-7c1:p-prueba-4e2@supabase.dtdcargo.com/");
    expect(d.tipo).toBe("con-credenciales");
    expect(d.origen).toBe("https://supabase.dtdcargo.com");
    expect(clasificarDestino("https://solo-usuario@xpfuzqombmjmxvprjgmi.supabase.co").tipo).toBe(
      "con-credenciales",
    );
  });

  it("una URL ilegible no expone nada de su valor", () => {
    expect(clasificarDestino("no-soy-una-url")).toEqual({ tipo: "ilegible", origen: null });
    expect(clasificarDestino("")).toEqual({ tipo: "ilegible", origen: null });
    expect(clasificarDestino(undefined)).toEqual({ tipo: "ilegible", origen: null });
  });
});

describe("motivoSinMedir · SDD-0548", () => {
  it("producción no tiene motivo para no medir", () => {
    expect(motivoSinMedir(clasificarDestino(ORIGEN_PRODUCCION))).toBeNull();
  });

  it("todo lo demás tiene motivo, y el motivo nombra el origen configurado", () => {
    const cloud = motivoSinMedir(clasificarDestino("https://xpfuzqombmjmxvprjgmi.supabase.co"));
    expect(cloud).toContain("https://xpfuzqombmjmxvprjgmi.supabase.co");
    expect(cloud).toContain("copia congelada");
    expect(cloud).toContain(ORIGEN_PRODUCCION);

    const otro = motivoSinMedir(clasificarDestino("https://supabase-prueba.dtdcargo.com"));
    expect(otro).toContain("https://supabase-prueba.dtdcargo.com");
    expect(otro).toContain("no es producción");

    const cred = motivoSinMedir(clasificarDestino("https://u-prueba-7c1:p-prueba-4e2@supabase.dtdcargo.com"));
    expect(cred).not.toMatch(/u-prueba-7c1|p-prueba-4e2/);

    const ilegible = motivoSinMedir(clasificarDestino("sb_secret_pegada_por_error"));
    expect(ilegible).not.toContain("sb_secret_pegada_por_error");
  });
});

/**
 * El gate entero, como lo corre verify.mjs (`node <entry>`), en un proyecto de
 * mentira y con `fetch` reemplazado por un doble (`--import`). Ninguna llamada sale
 * a la red ni a una base: el doble registra la URL que le pidieron y responde lo
 * que dice DOBLE_RESPUESTA. git queda apuntando a un GIT_DIR que no existe, así
 * que el `git fetch` falla al instante sin tocar el remoto.
 */
describe("el gate de punta a punta, con fetch doble · SDD-0548", () => {
  const SCRIPT = path.resolve(import.meta.dirname, "check-migrations-applied.mjs");
  const CLAVE = "clave-de-prueba-no-real";
  let dir;
  let doble;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "gate-migraciones-0548-"));
    fs.mkdirSync(path.join(dir, "supabase", "migrations"), { recursive: true });
    for (const f of ["0238_historica", "0239_applied_migrations_rpc", "0240_nueva"]) {
      fs.writeFileSync(path.join(dir, "supabase", "migrations", `${f}.sql`), "select 1;\n");
    }
    fs.writeFileSync(
      path.join(dir, "supabase", "migrations-baseline.json"),
      JSON.stringify({ cutoff: 238, pendingBelowCutoff: {} }),
    );
    doble = path.join(dir, "fetch-doble.mjs");
    fs.writeFileSync(
      doble,
      [
        'import fs from "node:fs";',
        "globalThis.fetch = async (url, init = {}) => {",
        "  const h = init.headers ?? {};",
        "  fs.appendFileSync(process.env.DOBLE_REGISTRO, JSON.stringify({",
        "    url: String(url), method: init.method, redirect: init.redirect,",
        "    conClave: h.apikey === process.env.SUPABASE_SERVICE_ROLE_KEY,",
        '  }) + "\\n");',
        "  const r = JSON.parse(process.env.DOBLE_RESPUESTA);",
        "  return new Response(JSON.stringify(r.body), { status: r.status });",
        "};",
        "",
      ].join("\n"),
    );
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  let corrida = 0;
  function correr(url, respuesta = { status: 200, body: [] }) {
    corrida += 1;
    const registro = path.join(dir, `llamadas-${corrida}.jsonl`);
    const env = { ...process.env };
    delete env.NEXT_PUBLIC_SUPABASE_URL;
    delete env.SUPABASE_SERVICE_ROLE_KEY;
    Object.assign(env, {
      NEXT_PUBLIC_SUPABASE_URL: url,
      SUPABASE_SERVICE_ROLE_KEY: CLAVE,
      DOBLE_REGISTRO: registro,
      DOBLE_RESPUESTA: JSON.stringify(respuesta),
      GIT_DIR: path.join(dir, "no-es-un-repo"),
    });
    const r = spawnSync(process.execPath, ["--import", pathToFileURL(doble).href, SCRIPT], {
      cwd: dir,
      env,
      encoding: "utf8",
      timeout: 60_000,
    });
    const llamadas = fs.existsSync(registro)
      ? fs.readFileSync(registro, "utf8").trim().split("\n").map((l) => JSON.parse(l))
      : [];
    const salida = `${r.stdout}${r.stderr}`;
    expect(salida, "la clave no se imprime nunca").not.toContain(CLAVE);
    return { code: r.status, salida, llamadas };
  }

  const ledgerCompleto = [
    { version: "20260801000000", name: "0239_applied_migrations_rpc" },
    { version: "20260801000100", name: "0240_nueva" },
  ];

  it("⭐ con la URL de Cloud da SKIP, lo dice y NO consulta nada", { timeout: 60_000 }, () => {
    const r = correr("https://xpfuzqombmjmxvprjgmi.supabase.co", { status: 200, body: ledgerCompleto });
    expect(r.code).toBe(3);
    expect(r.salida).toContain("[SKIP]");
    expect(r.salida).toContain("https://xpfuzqombmjmxvprjgmi.supabase.co");
    expect(r.salida).toContain("copia congelada");
    expect(r.salida).not.toContain("[OK]");
    expect(r.llamadas).toEqual([]);
  });

  it("con otro host da SKIP sin consultarlo", { timeout: 60_000 }, () => {
    const r = correr("https://supabase-prueba.dtdcargo.com", { status: 200, body: ledgerCompleto });
    expect(r.code).toBe(3);
    expect(r.salida).toContain("https://supabase-prueba.dtdcargo.com");
    expect(r.salida).toContain("no es producción");
    expect(r.llamadas).toEqual([]);
  });

  it("con usuario y clave en la URL da SKIP sin imprimirlos ni consultar", { timeout: 60_000 }, () => {
    const r = correr("https://u-prueba-7c1:p-prueba-4e2@supabase.dtdcargo.com", {
      status: 200,
      body: ledgerCompleto,
    });
    expect(r.code).toBe(3);
    expect(r.salida).toContain("trae usuario o clave");
    expect(r.salida).not.toMatch(/u-prueba-7c1|p-prueba-4e2/);
    expect(r.llamadas).toEqual([]);
  });

  it("en producción mide, dice dónde midió y da OK si está al día", { timeout: 60_000 }, () => {
    const r = correr("https://supabase.dtdcargo.com/", { status: 200, body: ledgerCompleto });
    expect(r.code).toBe(0);
    expect(r.salida).toContain(`no hay migraciones nuevas sin aplicar en producción (${ORIGEN_PRODUCCION})`);
    expect(r.llamadas).toEqual([
      {
        url: `${ORIGEN_PRODUCCION}/rest/v1/rpc/applied_migration_names`,
        method: "POST",
        redirect: "manual",
        conClave: true,
      },
    ]);
  });

  it("en producción sigue cazando la migración sin aplicar, con el host en el rojo", { timeout: 60_000 }, () => {
    const r = correr(ORIGEN_PRODUCCION, { status: 200, body: ledgerCompleto.slice(0, 1) });
    expect(r.code).toBe(1);
    expect(r.salida).toContain(`NO están en producción (${ORIGEN_PRODUCCION})`);
    expect(r.salida).toContain("0240_nueva");
  });

  it("una redirección de producción no se sigue: SKIP con motivo", { timeout: 60_000 }, () => {
    const r = correr(ORIGEN_PRODUCCION, { status: 302, body: {} });
    expect(r.code).toBe(3);
    expect(r.salida).toContain("redirección (HTTP 302)");
    expect(r.llamadas).toHaveLength(1);
  });
});
