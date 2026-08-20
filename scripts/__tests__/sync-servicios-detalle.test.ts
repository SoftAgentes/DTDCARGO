import { describe, it, expect } from "vitest";

import {
  fichaToColumns,
  buildSyncPlan,
  diffColumns,
  pickSyncColumns,
  parseArgs,
  SYNC_COLUMN_KEYS,
  type SyncColumns,
  type PriceTable,
} from "../sync-servicios-detalle";
import { SERVICE_CATALOG } from "@/lib/shared/service-catalog";
import {
  SERVICIOS_DETALLE_BY_SLUG,
  type ServicioDetalle,
} from "@/lib/servicios-detalle";

function ficha(over: Partial<ServicioDetalle> = {}): ServicioDetalle {
  return {
    slug: "x",
    titulo: "Título",
    sede: "cn",
    resumen: "Resumen.",
    incluye: ["uno"],
    noIncluye: [],
    precio: "Precio.",
    comoSolicitar: "Por WhatsApp.",
    tiempos: "5 días.",
    ...over,
  };
}

describe("fichaToColumns", () => {
  it("mapea los campos del estático a las columnas de la DB", () => {
    const cols = fichaToColumns(
      ficha({
        titulo: "T",
        resumen: "R",
        incluye: ["a", "b"],
        noIncluye: ["c"],
        precio: "P",
        comoSolicitar: "C",
        tiempos: "TI",
      }),
    );
    expect(cols.title_public).toBe("T");
    expect(cols.description_public).toBe("R");
    expect(cols.includes_public).toEqual(["a", "b"]);
    expect(cols.excludes_public).toEqual(["c"]);
    expect(cols.price_text).toBe("P");
    expect(cols.how_to_request).toBe("C");
    expect(cols.timelines_public).toBe("TI");
  });

  it("usa defaults: estado→activo, sin precioTabla→null, sin nota→null", () => {
    const cols = fichaToColumns(ficha());
    expect(cols.service_state).toBe("activo");
    expect(cols.price_table).toBeNull();
    expect(cols.note_public).toBeNull();
  });

  it("conserva precioTabla, nota y estado cuando vienen", () => {
    const tabla = { columnas: ["A"], filas: [["1"]], nota: "n" };
    const cols = fichaToColumns(
      ficha({ precioTabla: tabla, nota: "Una nota.", estado: "proximamente" }),
    );
    expect(cols.price_table).toEqual(tabla);
    expect(cols.note_public).toBe("Una nota.");
    expect(cols.service_state).toBe("proximamente");
  });
});

describe("buildSyncPlan (datos reales — guard de drift)", () => {
  const plan = buildSyncPlan(SERVICE_CATALOG, SERVICIOS_DETALLE_BY_SLUG);

  it("arma una fila por cada entrada del catálogo con legacySlug y ficha", () => {
    const conLegacy = SERVICE_CATALOG.filter((c) => c.legacySlug).length;
    expect(plan.rows.length).toBe(conLegacy);
    expect(plan.rows.length).toBe(18);
  });

  it("no hay legacySlug huérfano (todo legacySlug resuelve a una ficha)", () => {
    expect(plan.missingFicha).toEqual([]);
  });

  it("salta exactamente las entradas sin ficha estática (documentos fusionado + cursos)", () => {
    expect(plan.skippedNoLegacy).toEqual([
      "documentos-importacion",
      "cursos-importacion",
    ]);
  });

  it("la clave de la fila es el id del catálogo, no el slug del estático", () => {
    const ddp = plan.rows.find((r) => r.serviceKey === "puerta-a-puerta-ddp");
    expect(ddp).toBeDefined();
    expect(ddp?.legacySlug).toBe("dtd-services-lcl");
    expect(ddp?.columns.title_public).toContain("Puerta a puerta");
  });

  // Decisión del founder (2026-07-17): "DDP" NO se usa como nombre de servicio
  // de cara al cliente — el servicio se llama "Puerta a puerta". La sigla sólo
  // vale entre paréntesis, en el glosario y en keywords SEO. Este título viaja
  // a la DB y de ahí a /servicios, así que si vuelve a traer la sigla, pisa el
  // copy público sin que nadie lo note.
  it("el título público del servicio principal no lleva la sigla DDP", () => {
    const ddp = plan.rows.find((r) => r.serviceKey === "puerta-a-puerta-ddp");
    expect(ddp?.columns.title_public).not.toMatch(/\bDDP\b/);
  });

  it("cada fila trae título y un service_state válido", () => {
    const validos = new Set(["activo", "suspendido", "a-pedido", "proximamente"]);
    for (const row of plan.rows) {
      expect(row.columns.title_public.length).toBeGreaterThan(0);
      expect(validos.has(row.columns.service_state)).toBe(true);
    }
  });
});

describe("diffColumns", () => {
  const base: SyncColumns = fichaToColumns(ficha());

  it("filas idénticas → sin diferencias", () => {
    expect(diffColumns({ ...base }, base)).toEqual([]);
  });

  it("trata undefined (columna ausente) ≡ null", () => {
    const desired: SyncColumns = { ...base, note_public: null };
    // current sin note_public (undefined) no debe contar como cambio vs null.
    const cur = { ...base };
    delete (cur as Partial<SyncColumns>).note_public;
    expect(diffColumns(cur, desired)).toEqual([]);
  });

  it("distingue null de cadena vacía (note_public)", () => {
    const desired: SyncColumns = { ...base, note_public: "" };
    const cur: Partial<SyncColumns> = { ...base, note_public: null };
    const diffs = diffColumns(cur, desired);
    expect(diffs.map((d) => d.column)).toEqual(["note_public"]);
  });

  it("no marca diff por orden de claves de price_table (roundtrip jsonb)", () => {
    const tabla: PriceTable = { columnas: ["M", "A"], filas: [["1", "2"]], nota: "n" };
    const desired = fichaToColumns(ficha({ precioTabla: tabla }));
    // Postgres jsonb reordena las claves por longitud: nota, filas, columnas.
    const fromDb = { nota: "n", filas: [["1", "2"]], columnas: ["M", "A"] } as PriceTable;
    const cur: Partial<SyncColumns> = { ...desired, price_table: fromDb };
    expect(diffColumns(cur, desired)).toEqual([]);
  });

  it("sí detecta un cambio real en price_table (no enmascarado)", () => {
    const desired = fichaToColumns(
      ficha({ precioTabla: { columnas: ["A"], filas: [["1"]], nota: "n" } }),
    );
    const cur: Partial<SyncColumns> = {
      ...desired,
      price_table: { columnas: ["A"], filas: [["2"]], nota: "n" },
    };
    expect(diffColumns(cur, desired).map((d) => d.column)).toEqual(["price_table"]);
  });

  it("detecta prosa acortada y reordenamiento de arrays", () => {
    const desired: SyncColumns = {
      ...base,
      description_public: "Versión rica y completa.",
      includes_public: ["a", "b"],
    };
    const cur: Partial<SyncColumns> = {
      ...base,
      description_public: "Versión corta.",
      includes_public: ["b", "a"],
    };
    const cols = diffColumns(cur, desired).map((d) => d.column);
    expect(cols).toContain("description_public");
    expect(cols).toContain("includes_public");
  });
});

describe("pickSyncColumns", () => {
  it("extrae todas las columnas de sync, con null donde falten", () => {
    const picked = pickSyncColumns({ title_public: "T" });
    expect(Object.keys(picked).sort()).toEqual([...SYNC_COLUMN_KEYS].sort());
    expect(picked.title_public).toBe("T");
    expect(picked.description_public).toBeNull();
  });
});

describe("parseArgs", () => {
  it("default = dry-run, tenant dtd", () => {
    const a = parseArgs([]);
    expect(a.mode).toBe("dry-run");
    expect(a.tenant).toBe("dtd");
  });

  it("--apply", () => {
    expect(parseArgs(["--apply"]).mode).toBe("apply");
  });

  it("--restore <file>", () => {
    const a = parseArgs(["--restore", "/tmp/b.json"]);
    expect(a.mode).toBe("restore");
    expect(a.restoreFile).toBe("/tmp/b.json");
  });

  it("--tenant y --backup", () => {
    const a = parseArgs(["--tenant", "otro", "--backup", "/tmp/x.json"]);
    expect(a.tenant).toBe("otro");
    expect(a.backupPath).toBe("/tmp/x.json");
  });

  it("-h → help", () => {
    expect(parseArgs(["-h"]).help).toBe(true);
  });
});
