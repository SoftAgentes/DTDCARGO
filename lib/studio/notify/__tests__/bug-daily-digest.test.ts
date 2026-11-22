// @vitest-environment node
/**
 * Resumen diario de reportes a Discord `#bugs` · SDD-0036 §11 (enmienda D-13).
 *
 * Lo que se mide: el texto que sale a Discord trae conteos, folios y módulos,
 * y NUNCA el título, la descripción, la URL del reporte ni nombres de personas
 * o clientes, aunque la fila que llegue los traiga.
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildBugDailyDigest,
  entraAlResumen,
  fetchBugDigestRows,
  runBugDailyDigest,
  ventanaDelResumen,
  type BugDigestRow,
} from "../bug-daily-digest";
import { fakeWebhook } from "@/lib/studio/discord/__tests__/webhook-fixture";
import { buildDiscordContent } from "@/lib/studio/discord/minimal-alert";
import { minimalFromPayload } from "@/lib/studio/alerts/alert-outbox";

const URL = "https://dtdcargo.com/studio/bugs";
const FECHA = "2026-11-15";

/** Datos sensibles que nunca pueden salir a Discord. */
const SENSIBLES = [
  "La factura de Inversiones Pérez no carga",
  "María González",
  "0414-555-1234",
  "maria@example.com",
  "J-12345678-9",
  "/studio/clientes/DTD-0042",
];

/** Una fila como la devolvería un `select *` descuidado: con título, texto y nombre. */
function fila(
  folio: string,
  category: BugDigestRow["category"],
  severity: BugDigestRow["severity"],
  module: string,
): BugDigestRow {
  return {
    folio,
    category,
    severity,
    module,
    title: SENSIBLES[0],
    description: `Lo reportó ${SENSIBLES[1]}, tel ${SENSIBLES[2]}, ${SENSIBLES[3]}, RIF ${SENSIBLES[4]}`,
    url: SENSIBLES[5],
    reporter_name: SENSIBLES[1],
  } as BugDigestRow;
}

const FILAS: BugDigestRow[] = [
  fila("BUG-00012", "improve", null, "clientes"),
  fila("BUG-00013", "suggest", null, "tarifas"),
  fila("BUG-00014", "question", "baja", "clientes"),
  fila("BUG-00015", "error", "media", "embarques"),
  fila("BUG-00016", "error", "baja", "clientes"),
  // Ya avisaron al momento: no entran.
  fila("BUG-00017", "error", "alta", "clientes"),
  fila("BUG-00018", "error", "critica", "tarifas"),
];

function textoDiscord(filas: BugDigestRow[]): string {
  const aviso = buildBugDailyDigest(filas, { fecha: FECHA, url: URL });
  expect(aviso).not.toBeNull();
  return buildDiscordContent(aviso!);
}

describe("resumen diario de reportes", () => {
  it("cuenta por tipo y por módulo, y lista los folios", () => {
    const aviso = buildBugDailyDigest(FILAS, { fecha: FECHA, url: URL })!;
    expect(aviso.titulo).toBe("Resumen diario de reportes · 2026-11-15 · 5 nuevos");
    expect(aviso.conteos).toEqual([
      { etiqueta: "Errores leves", valor: 2 },
      { etiqueta: "Mejoras", valor: 1 },
      { etiqueta: "Sugerencias", valor: 1 },
      { etiqueta: "Preguntas", valor: 1 },
      { etiqueta: "Módulo · Clientes", valor: 3 },
      { etiqueta: "Módulo · Embarques", valor: 1 },
      { etiqueta: "Módulo · Tarifas", valor: 1 },
    ]);
    expect(aviso.codigos).toEqual([
      "BUG-00012",
      "BUG-00013",
      "BUG-00014",
      "BUG-00015",
      "BUG-00016",
    ]);
    expect(aviso.url).toBe(URL);
  });

  it("deja fuera alta y crítica: esas ya salieron al momento", () => {
    const texto = textoDiscord(FILAS);
    expect(texto).not.toContain("BUG-00017");
    expect(texto).not.toContain("BUG-00018");
    expect(entraAlResumen({ severity: "alta" })).toBe(false);
    expect(entraAlResumen({ severity: "critica" })).toBe(false);
    expect(entraAlResumen({ severity: "media" })).toBe(true);
    expect(entraAlResumen({ severity: null })).toBe(true);
  });

  it("no saca títulos, textos, URLs del reporte ni nombres, aunque la fila los traiga", () => {
    const texto = textoDiscord(FILAS);
    for (const s of SENSIBLES) expect(texto).not.toContain(s);
    // Y el aviso mínimo tampoco los guarda en ningún campo (lo que entra a la cola).
    const aviso = buildBugDailyDigest(FILAS, { fecha: FECHA, url: URL })!;
    const serializado = JSON.stringify(aviso);
    for (const s of SENSIBLES) expect(serializado).not.toContain(s);
    expect(Object.keys(aviso).sort()).toEqual(["codigos", "conteos", "titulo", "url"]);
  });

  it("el texto completo que sale a Discord", () => {
    expect(textoDiscord(FILAS)).toBe(
      [
        "**Resumen diario de reportes · 2026-11-15 · 5 nuevos**",
        "• Errores leves: 2",
        "• Mejoras: 1",
        "• Sugerencias: 1",
        "• Preguntas: 1",
        "• Módulo · Clientes: 3",
        "• Módulo · Embarques: 1",
        "• Módulo · Tarifas: 1",
        "`BUG-00012` `BUG-00013` `BUG-00014` `BUG-00015` `BUG-00016`",
        `<${URL}>`,
      ].join("\n"),
    );
  });

  it("un módulo fuera de la lista cerrada no se nombra: cuenta como «Otro módulo»", () => {
    const texto = textoDiscord([
      fila("BUG-00020", "improve", null, "inversiones-perez-c-a"),
      fila("BUG-00021", "improve", null, "clientes"),
    ]);
    expect(texto).not.toContain("inversiones");
    expect(texto).toContain("• Módulo · Otro módulo: 1");
    expect(texto).toContain("• Módulo · Clientes: 1");
  });

  it("un folio sin forma de folio no sale", () => {
    const texto = textoDiscord([
      fila("BUG-00030", "improve", null, "clientes"),
      fila("María González", "improve", null, "clientes"),
    ]);
    expect(texto).toContain("`BUG-00030`");
    expect(texto).not.toContain("María");
  });

  it("con muchos módulos no pasa de 12 líneas y junta el resto en «otros»", () => {
    const modulos = [
      "dashboard", "embarques", "tracking", "calendario", "almacen-cn", "almacen-ve",
      "cola-qr", "tms", "despacho", "cotizador", "clientes", "proveedores", "tarifas",
    ];
    const filas = modulos.map((m, i) =>
      fila(`BUG-${String(100 + i).padStart(5, "0")}`, "improve", null, m),
    );
    const aviso = buildBugDailyDigest(filas, { fecha: FECHA, url: URL })!;
    expect(aviso.conteos!.length).toBeLessThanOrEqual(12);
    const total = aviso.conteos!
      .filter((c) => c.etiqueta.startsWith("Módulo"))
      .reduce((s, c) => s + c.valor, 0);
    expect(total).toBe(modulos.length);
    expect(aviso.conteos!.at(-1)!.etiqueta).toBe("Módulo · otros");
  });

  it("con más de 25 folios lista 25 y resume el resto", () => {
    const filas = Array.from({ length: 30 }, (_, i) =>
      fila(`BUG-${String(i + 1).padStart(5, "0")}`, "question", null, "clientes"),
    );
    const texto = textoDiscord(filas);
    expect(texto).toContain("`BUG-00025` y 5 más");
    expect(texto).not.toContain("BUG-00026");
  });

  it("sin reportes del día no hay resumen", () => {
    expect(buildBugDailyDigest([], { fecha: FECHA, url: URL })).toBeNull();
    expect(
      buildBugDailyDigest([fila("BUG-00040", "error", "alta", "clientes")], {
        fecha: FECHA,
        url: URL,
      }),
    ).toBeNull();
  });

  it("un solo reporte dice «1 nuevo»", () => {
    const aviso = buildBugDailyDigest([fila("BUG-00050", "suggest", null, "crm")], {
      fecha: FECHA,
      url: URL,
    })!;
    expect(aviso.titulo).toBe("Resumen diario de reportes · 2026-11-15 · 1 nuevo");
  });

  it("los folios sobreviven a la cola durable y lo demás no", () => {
    const aviso = buildBugDailyDigest(FILAS, { fecha: FECHA, url: URL })!;
    const deLaCola = minimalFromPayload({
      ...JSON.parse(JSON.stringify(aviso)),
      title: SENSIBLES[0],
      codigos: [...aviso.codigos!, SENSIBLES[1]],
    });
    expect(deLaCola!.codigos).toEqual(aviso.codigos);
    expect(buildDiscordContent(deLaCola!)).toBe(buildDiscordContent(aviso));
  });
});

describe("ventana del resumen", () => {
  it("es el día anterior completo en hora de Caracas", () => {
    expect(ventanaDelResumen(new Date("2026-11-16T12:05:00Z"))).toEqual({
      fecha: "2026-11-15",
      desde: "2026-11-15T04:00:00.000Z",
      hasta: "2026-11-16T04:00:00.000Z",
    });
  });

  it("antes de la medianoche de Caracas todavía cuenta el día de ayer de allá", () => {
    // 2026-11-16 02:00Z = 2026-11-15 22:00 en Caracas → resume el 14.
    expect(ventanaDelResumen(new Date("2026-11-16T02:00:00Z")).fecha).toBe("2026-11-14");
  });
});

const TENANT = "00000000-0000-4000-8000-000000000001";

/**
 * Doble de PostgREST: anota la tabla, las columnas pedidas y cada filtro, y
 * devuelve `rows` al final de la cadena (`.limit`).
 */
function postgrestDoble(rows: unknown[] = []) {
  const llamadas: { tabla: string[]; select: string[]; filtros: string[] } = {
    tabla: [],
    select: [],
    filtros: [],
  };
  const cadena = {
    select(cols: string) {
      llamadas.select.push(cols);
      return cadena;
    },
    eq(col: string, v: unknown) {
      llamadas.filtros.push(`eq:${col}=${String(v)}`);
      return cadena;
    },
    gte(col: string, v: unknown) {
      llamadas.filtros.push(`gte:${col}=${String(v)}`);
      return cadena;
    },
    lt(col: string, v: unknown) {
      llamadas.filtros.push(`lt:${col}=${String(v)}`);
      return cadena;
    },
    or(expr: string) {
      llamadas.filtros.push(`or:${expr}`);
      return cadena;
    },
    order() {
      return cadena;
    },
    limit(n: number) {
      llamadas.filtros.push(`limit:${n}`);
      return Promise.resolve({ data: rows, error: null });
    },
  };
  const admin = {
    from(tabla: string) {
      llamadas.tabla.push(tabla);
      return cadena;
    },
  } as unknown as SupabaseClient;
  return { admin, llamadas };
}

describe("consulta del resumen (barrera 1 de §11.2)", () => {
  it("pide exactamente folio, category, severity y module: ni título, ni texto, ni quién reportó", async () => {
    const { admin, llamadas } = postgrestDoble();
    await fetchBugDigestRows(admin, TENANT, "2026-11-15T04:00:00.000Z", "2026-11-16T04:00:00.000Z");
    expect(llamadas.tabla).toEqual(["bug_reports"]);
    expect(llamadas.select).toEqual(["folio, category, severity, module"]);
    expect(llamadas.filtros).toEqual([
      `eq:tenant_id=${TENANT}`,
      "gte:created_at=2026-11-15T04:00:00.000Z",
      "lt:created_at=2026-11-16T04:00:00.000Z",
      "or:severity.is.null,severity.in.(baja,media)",
      "limit:500",
    ]);
  });
});

describe("canal del resumen", () => {
  const NOW = new Date("2026-11-16T12:05:00Z");
  const SITE = "https://dtdcargo.com";

  it("con sólo el canal de respaldo (#avisos-equipo) no sale y no lee bug_reports", async () => {
    const { admin, llamadas } = postgrestDoble();
    const env = { DISCORD_TENANT_ID: TENANT, DISCORD_WEBHOOK_EQUIPO: fakeWebhook(2) };
    const res = await runBugDailyDigest(admin, TENANT, { now: NOW, siteUrl: SITE, env });
    expect(res).toEqual({ estado: "discord-apagado", fecha: "2026-11-15", reportes: 0 });
    expect(llamadas.tabla).toEqual([]);
  });

  it("sin Discord para el tenant tampoco lee la base", async () => {
    const { admin, llamadas } = postgrestDoble();
    const env = { DISCORD_TENANT_ID: TENANT, DISCORD_WEBHOOK_BUGS: fakeWebhook(1) };
    const otro = "00000000-0000-4000-8000-000000000002";
    const res = await runBugDailyDigest(admin, otro, { now: NOW, siteUrl: SITE, env });
    expect(res.estado).toBe("discord-apagado");
    expect(llamadas.tabla).toEqual([]);
  });

  it("con el canal propio de #bugs sí lee el día (y un día vacío no manda nada)", async () => {
    const { admin, llamadas } = postgrestDoble([]);
    const env = { DISCORD_TENANT_ID: TENANT, DISCORD_WEBHOOK_BUGS: fakeWebhook(1) };
    const res = await runBugDailyDigest(admin, TENANT, { now: NOW, siteUrl: SITE, env });
    expect(res).toEqual({ estado: "sin-reportes", fecha: "2026-11-15", reportes: 0 });
    expect(llamadas.tabla).toEqual(["bug_reports"]);
  });
});
