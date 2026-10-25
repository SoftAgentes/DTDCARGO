// @vitest-environment node
/**
 * SDD-0547 · contrato del archivo de estado de publicaciones del servidor.
 *
 * El ejemplo canónico vive con la spec
 * (`docs/specs/0547-panel-publicaciones-servidor/ejemplo-publicaciones.v1.json`):
 * el vigilante del servidor tiene que producir algo con esa forma, y esta
 * prueba garantiza que el panel lo acepta completo. Lo demás mide la defensa:
 * ningún texto libre del archivo llega a la salida.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_FALTAN,
  MAX_HISTORIAL,
  MINUTOS_VIGILANTE_DETENIDO,
  etiquetaResultado,
  etiquetaVigilante,
  parseEstadoPublicaciones,
  shaCorto,
  textoMotivo,
  tiempoRelativo,
  tonoResultado,
  tonoVigilante,
  urlCommit,
  vigilanteSinVueltas,
  type EstadoPublicaciones,
  type MotivoPublicacion,
  type ResultadoPublicacion,
} from "../publicaciones-types";

const EJEMPLO = JSON.parse(
  readFileSync(
    join(process.cwd(), "docs/specs/0547-panel-publicaciones-servidor/ejemplo-publicaciones.v1.json"),
    "utf8",
  ),
) as Record<string, unknown>;

const A = "c2fabdcc17e3ca28c62238764a82aa46ca515cca";
const B = "03e0e078ef18b0c2c1a217a07c8d4e0eeb14d1c7";

function base(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { version: 1, actualizado: "2026-10-17T17:40:02Z", ...extra };
}

function ok(raw: unknown): EstadoPublicaciones {
  const r = parseEstadoPublicaciones(raw);
  if (!r.ok) throw new Error(`se esperaba ok y salió ${r.motivo}`);
  return r.estado;
}

describe("SDD-0547 · ejemplo canónico de la spec", () => {
  it("se acepta completo, sin descartar nada", () => {
    const e = ok(EJEMPLO);
    expect(e.actualizado).toBe(Date.parse("2026-10-17T17:40:02Z"));
    expect(e.corre).toBe(B);
    expect(e.publicable).toBe(A);
    expect(e.anterior).toBe("8761618d5c0a4e2f9b7d3c1a0e9f8d7c6b5a4f3e");
    expect(e.congelado).toBeNull();
    expect(e.vigilante).toEqual({
      estado: "retenida",
      motivo: "migraciones",
      faltan: ["0492_ejemplo_de_migracion"],
    });
    expect(e.descartados).toBe(0);
    expect(e.historial).toHaveLength((EJEMPLO.historial as unknown[]).length);
    expect(e.historial[0]).toEqual({
      hora: Date.parse("2026-10-17T17:39:02Z"),
      sha: A,
      origen: "vigilante",
      resultado: "retenida",
      motivo: "migraciones",
      faltan: ["0492_ejemplo_de_migracion"],
    });
  });
});

describe("parseEstadoPublicaciones · el sobre", () => {
  it.each([
    ["null", null],
    ["un arreglo", [base()]],
    ["un texto", "{}"],
    ["sin versión", { actualizado: "2026-10-17T17:40:02Z" }],
    ["versión como texto", { version: "1", actualizado: "2026-10-17T17:40:02Z" }],
  ])("%s → formato", (_n, raw) => {
    expect(parseEstadoPublicaciones(raw)).toEqual({ ok: false, motivo: "formato" });
  });

  it("otra versión → version (no se intenta leer)", () => {
    expect(parseEstadoPublicaciones(base({ version: 2 }))).toEqual({ ok: false, motivo: "version" });
  });

  it.each([
    ["ausente", undefined],
    ["sin zona", "2026-10-17T17:40:02"],
    ["con desfase en vez de Z", "2026-10-17T17:40:02-04:00"],
    ["fecha imposible", "2026-13-45T99:99:99Z"],
    ["número", 1760722802000],
  ])("actualizado %s → formato", (_n, actualizado) => {
    expect(parseEstadoPublicaciones(base({ actualizado }))).toEqual({ ok: false, motivo: "formato" });
  });

  it("con milisegundos se acepta", () => {
    expect(ok(base({ actualizado: "2026-10-17T17:40:02.123Z" })).actualizado).toBe(
      Date.parse("2026-10-17T17:40:02.123Z"),
    );
  });

  it("solo el sobre: todo lo demás vacío, sin caerse", () => {
    expect(ok(base())).toEqual({
      actualizado: Date.parse("2026-10-17T17:40:02Z"),
      corre: null,
      anterior: null,
      publicable: null,
      vigilante: null,
      congelado: null,
      historial: [],
      descartados: 0,
    });
  });
});

describe("parseEstadoPublicaciones · campos", () => {
  it.each([
    ["corto", "c2fabdcc"],
    ["mayúsculas", A.toUpperCase()],
    ["con prefijo", `sha-${A}`],
    ["41 caracteres", `${A}0`],
    ["número", 123],
  ])("un SHA %s queda en null", (_n, v) => {
    const e = ok(base({ corre: v, anterior: v, publicable: v }));
    expect([e.corre, e.anterior, e.publicable]).toEqual([null, null, null]);
  });

  it("vigilante con estado desconocido queda en null", () => {
    expect(ok(base({ vigilante: { estado: "publicando" } })).vigilante).toBeNull();
  });

  it("el motivo del vigilante solo se conserva retenido o detenido", () => {
    expect(ok(base({ vigilante: { estado: "al-dia", motivo: "disco" } })).vigilante).toEqual({
      estado: "al-dia",
      motivo: null,
      faltan: [],
    });
    expect(ok(base({ vigilante: { estado: "detenido", motivo: "disco" } })).vigilante).toEqual({
      estado: "detenido",
      motivo: "disco",
      faltan: [],
    });
  });

  it("congelado: automático solo con true literal; hora inválida en null", () => {
    expect(ok(base({ congelado: { desde: "2026-10-17T10:00:00Z", automatico: true } })).congelado).toEqual({
      desde: Date.parse("2026-10-17T10:00:00Z"),
      automatico: true,
    });
    expect(ok(base({ congelado: { desde: "ayer", automatico: "true" } })).congelado).toEqual({
      desde: null,
      automatico: false,
    });
    expect(ok(base({ congelado: "corte de la base" })).congelado).toBeNull();
  });
});

describe("parseEstadoPublicaciones · historial", () => {
  const evento = (extra: Record<string, unknown> = {}) => ({
    hora: "2026-10-17T12:00:00Z",
    sha: A,
    origen: "vigilante",
    resultado: "publicada",
    ...extra,
  });

  it("descarta y cuenta las entradas sin hora, SHA, origen o resultado válidos", () => {
    const e = ok(
      base({
        historial: [
          evento(),
          evento({ hora: "hoy" }),
          evento({ sha: "abc" }),
          evento({ origen: "cron" }),
          evento({ resultado: "desplegada" }),
          "publicada",
          null,
        ],
      }),
    );
    expect(e.historial).toHaveLength(1);
    expect(e.descartados).toBe(6);
  });

  it("ordena del más nuevo al más viejo aunque el archivo venga desordenado", () => {
    const e = ok(
      base({
        historial: [
          evento({ hora: "2026-10-15T00:00:00Z", sha: B }),
          evento({ hora: "2026-10-17T00:00:00Z", sha: A }),
          evento({ hora: "2026-10-16T00:00:00Z", resultado: "retenida" }),
        ],
      }),
    );
    expect(e.historial.map((x) => x.hora)).toEqual([
      Date.parse("2026-10-17T00:00:00Z"),
      Date.parse("2026-10-16T00:00:00Z"),
      Date.parse("2026-10-15T00:00:00Z"),
    ]);
  });

  it(`muestra como máximo ${MAX_HISTORIAL}: los más nuevos`, () => {
    const historial = Array.from({ length: MAX_HISTORIAL + 5 }, (_, i) =>
      evento({ hora: `2026-10-${String(1 + i).padStart(2, "0")}T00:00:00Z` }),
    );
    const e = ok(base({ historial }));
    expect(e.historial).toHaveLength(MAX_HISTORIAL);
    expect(e.historial[0].hora).toBe(Date.parse("2026-10-25T00:00:00Z"));
    expect(e.historial[MAX_HISTORIAL - 1].hora).toBe(Date.parse("2026-10-06T00:00:00Z"));
    expect(e.descartados).toBe(0);
  });

  it("un motivo desconocido se muestra como «otro»; uno que no es texto, como nada", () => {
    const e = ok(
      base({
        historial: [
          evento({ hora: "2026-10-17T02:00:00Z", resultado: "retenida", motivo: "nuevo-motivo" }),
          evento({ hora: "2026-10-17T01:00:00Z", resultado: "retenida", motivo: 7 }),
        ],
      }),
    );
    expect(e.historial.map((x) => x.motivo)).toEqual(["otro", null]);
  });

  it(`faltan: solo nombres de migración, sin repetir, como máximo ${MAX_FALTAN}, y solo con motivo migraciones`, () => {
    const muchas = Array.from({ length: MAX_FALTAN + 10 }, (_, i) => `0${String(500 + i)}_migracion_${i}`);
    const e = ok(
      base({
        historial: [
          evento({
            hora: "2026-10-17T02:00:00Z",
            resultado: "retenida",
            motivo: "migraciones",
            faltan: ["0492_buena", "0492_buena", "../etc/passwd", "0493_Con_Mayusculas", 42, ...muchas],
          }),
          evento({
            hora: "2026-10-17T01:00:00Z",
            resultado: "retenida",
            motivo: "huellas",
            faltan: ["0492_buena"],
          }),
        ],
      }),
    );
    expect(e.historial[0].faltan[0]).toBe("0492_buena");
    expect(e.historial[0].faltan).toHaveLength(MAX_FALTAN);
    expect(e.historial[0].faltan).not.toContain("../etc/passwd");
    expect(e.historial[0].faltan).not.toContain("0493_Con_Mayusculas");
    expect(e.historial[1].faltan).toEqual([]);
  });
});

describe("parseEstadoPublicaciones · ningún texto libre llega a la salida", () => {
  it("un secreto puesto en cualquier campo no aparece en el resultado", () => {
    const SECRETO = "postgres://postgres:CLAVE-CANARIO-9f3@db:5432/postgres";
    const RUTA = "/srv/ops/evidencias/publicar-web-20261017T174002Z-publicar-c2fabdcc";
    const veneno = {
      version: 1,
      actualizado: "2026-10-17T17:40:02Z",
      corre: SECRETO,
      anterior: RUTA,
      publicable: A,
      motivo: SECRETO,
      congelado: { desde: SECRETO, automatico: SECRETO, motivo: SECRETO },
      vigilante: { estado: "retenida", motivo: SECRETO, faltan: [SECRETO, RUTA], detalle: SECRETO },
      historial: [
        {
          hora: "2026-10-17T17:39:02Z",
          sha: A,
          origen: "vigilante",
          resultado: "retenida",
          motivo: "migraciones",
          faltan: [SECRETO, RUTA, "0492_ok"],
          detalle: SECRETO,
          evidencia: RUTA,
        },
        { hora: SECRETO, sha: A, origen: "vigilante", resultado: "publicada" },
      ],
      extra: SECRETO,
    };
    const salida = JSON.stringify(parseEstadoPublicaciones(veneno));
    expect(salida).not.toContain("CANARIO");
    expect(salida).not.toContain("/srv/");
    // Y lo válido sí pasó: el control de que la prueba no está vacía.
    expect(salida).toContain(A);
    expect(salida).toContain("0492_ok");
  });
});

describe("textos y tonos", () => {
  const RESULTADOS: ResultadoPublicacion[] = [
    "publicada",
    "retenida",
    "vuelta-atras",
    "vuelta-atras-fallida",
    "vuelta-atras-a-mano",
  ];
  const MOTIVOS: MotivoPublicacion[] = [
    "migraciones",
    "ledger",
    "huellas",
    "sharp",
    "etiquetas",
    "imagen",
    "descarga",
    "disco",
    "ensayo",
    "env",
    "sin-vuelta-atras",
    "salud",
    "prueba-rapida",
    "compose",
    "rechazada",
    "otro",
  ];

  it("cada resultado tiene etiqueta propia", () => {
    const etiquetas = RESULTADOS.map(etiquetaResultado);
    expect(new Set(etiquetas).size).toBe(RESULTADOS.length);
  });

  it("tonos: publicada éxito, retenida atención, vuelta atrás error, a mano información", () => {
    expect(RESULTADOS.map(tonoResultado)).toEqual(["success", "warning", "danger", "danger", "info"]);
  });

  it("cada motivo tiene su texto, sin rutas internas", () => {
    const textos = MOTIVOS.map(textoMotivo);
    expect(new Set(textos).size).toBe(MOTIVOS.length);
    for (const t of textos) expect(t).not.toMatch(/\/srv|\/var|\.sh\b/);
  });

  it("vigilante: al día éxito; congelado solo es error si fue automático", () => {
    expect(etiquetaVigilante("al-dia")).toBe("Al día");
    expect(tonoVigilante("al-dia")).toBe("success");
    expect(tonoVigilante("retenida")).toBe("warning");
    expect(tonoVigilante("detenido")).toBe("warning");
    expect(tonoVigilante("congelado")).toBe("warning");
    expect(tonoVigilante("congelado", true)).toBe("danger");
  });
});

describe("utilidades", () => {
  it("shaCorto da los 8 caracteres de los avisos del vigilante", () => {
    expect(shaCorto(A)).toBe("c2fabdcc");
  });

  it("urlCommit apunta al commit en el repo", () => {
    expect(urlCommit(A)).toBe(`https://github.com/hailuwaycom-sketch/DTDCARGO/commit/${A}`);
  });

  it(`vigilanteSinVueltas: más de ${MINUTOS_VIGILANTE_DETENIDO} min sin escribir`, () => {
    const t = Date.parse("2026-10-17T17:00:00Z");
    expect(vigilanteSinVueltas(t, t + MINUTOS_VIGILANTE_DETENIDO * 60_000)).toBe(false);
    expect(vigilanteSinVueltas(t, t + MINUTOS_VIGILANTE_DETENIDO * 60_000 + 1)).toBe(true);
    expect(vigilanteSinVueltas(t, t + 60_000)).toBe(false);
  });

  it.each([
    [0, "ahora"],
    [-5 * 60_000, "ahora"],
    [3 * 60_000, "hace 3 min"],
    [59 * 60_000, "hace 59 min"],
    [2 * 3_600_000, "hace 2 h"],
    [5 * 86_400_000, "hace 5 d"],
    [31 * 86_400_000, "hace 1 mes"],
    [65 * 86_400_000, "hace 2 meses"],
  ])("tiempoRelativo(%i ms atrás) = %s", (atras, texto) => {
    const ahora = Date.parse("2026-10-17T17:00:00Z");
    expect(tiempoRelativo(ahora - atras, ahora)).toBe(texto);
  });
});
