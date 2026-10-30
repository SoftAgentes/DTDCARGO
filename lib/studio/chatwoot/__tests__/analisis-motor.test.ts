// @vitest-environment node
/**
 * SDD-0588 · paso 3.4 · motor del análisis con un DOBLE del motor GLM y de GitHub:
 * configuración, diff, llamada (la llave solo en la cabecera), respaldo sin IA,
 * caché por salto, tope diario y uno a la vez. El doble de Supabase APLICA `eq`,
 * `gte`, el orden y el conteo: sin eso no se prueba que la caché o el tope miren el
 * tenant y el salto correctos.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { PIEZAS, type ArchivoFuente } from "../analisis";
import {
  MAX_ANALISIS_DIA,
  MODELO_POR_DEFECTO,
  URL_MOTOR_POR_DEFECTO,
  analizarSalto,
  compareUrl,
  configMotor,
  leerDiffChatwoot,
  llamarMotor,
} from "../analisis-motor";
import { armarPaquete } from "../analisis";

type Fila = Record<string, unknown>;

function doble(filas: Fila[] = [], fallar: { insertar?: boolean; contar?: boolean } = {}) {
  let siguiente = 1;
  const insertadas: Fila[] = [];
  const from = (tabla: string) => {
    expect(tabla).toBe("chatwoot_version_analyses");
    const filtros: ((f: Fila) => boolean)[] = [];
    const orden: [string, boolean][] = [];
    let limite = Infinity;
    let conteo = false;
    let nueva: Fila | null = null;
    const vistas = () => {
      const out = filas.filter((f) => filtros.every((p) => p(f)));
      for (const [col, asc] of orden) out.sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1));
      return out.slice(0, limite).map((f) => ({ ...f }));
    };
    const resolver = () => {
      if (nueva) {
        if (fallar.insertar) return { data: null, error: { code: "42P01" } };
        const fila = { id: siguiente++, created_at: new Date().toISOString(), ...nueva };
        filas.push(fila);
        insertadas.push(fila);
        return { data: null, error: null };
      }
      if (conteo) return fallar.contar ? { count: null, error: { code: "42P01" } } : { count: vistas().length, error: null };
      return { data: vistas(), error: null };
    };
    const b = {
      select: (_c: string, o?: { count?: string; head?: boolean }) => ((conteo = Boolean(o?.head)), b),
      insert: (v: Fila) => ((nueva = v), b),
      eq: (c: string, v: unknown) => (filtros.push((f) => f[c] === v), b),
      gte: (c: string, v: string) => (filtros.push((f) => String(f[c]) >= v), b),
      order: (c: string, o: { ascending: boolean }) => (orden.push([c, o.ascending]), b),
      limit: (n: number) => ((limite = n), b),
      maybeSingle: () => {
        const r = resolver() as { data: Fila[] | null; error: unknown };
        return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error });
      },
      then: (fin: (v: unknown) => unknown) => Promise.resolve(fin(resolver())),
    };
    return b;
  };
  return { db: { from } as never, filas, insertadas };
}

const T1 = "10000000-0000-4000-8000-000000000001";
const T2 = "10000000-0000-4000-8000-000000000002";
const SAM = "20000000-0000-4000-8000-000000000001";
const AHORA = new Date("2026-10-30T20:00:00Z");
const LLAVE = "0123456789abcdef0123456789abcdef.LlaveDePruebaGLM";
const ENV = { DTD_CHATWOOT_IA_GLM_KEY: LLAVE };
const SUPERFICIE: ArchivoFuente[] = [{ ruta: "infra/chatwoot/rails/zz_dtd_revocar_sesiones.rb", contenido: "module DtdRevocarSesiones; end" }];

const COMPARE = {
  files: [
    { filename: "app/channels/room_channel.rb", status: "modified", patch: "@@ -1 +1 @@\n-def subscribed\n+def subscribed(x)" },
    { filename: "app/javascript/widget.vue", status: "modified", patch: "+<div/>" },
    { filename: ".env.example", status: "modified", patch: "+SECRET_KEY_BASE=replace_with_lengthy_secure_hex" },
  ],
};

const informeMotor = (recomendacion = "revisar") =>
  JSON.stringify({
    recomendacion,
    resumen: "RoomChannel cambia la firma de subscribed.",
    piezas: PIEZAS.map((p) => ({
      id: p.id,
      riesgo: p.id === "revocar_sesiones" ? "alto" : "bajo",
      motivo: p.id === "revocar_sesiones" ? "subscribed recibe un argumento." : "Sin cambios.",
      archivos: p.id === "revocar_sesiones" ? ["app/channels/room_channel.rb"] : [],
    })),
  });

/** Doble de fetch: GitHub (compare) y el motor GLM. */
function red(opciones: { github?: unknown; githubStatus?: number; motor?: unknown; motorStatus?: number; motorLanza?: boolean } = {}) {
  const llamadas: { url: string; init?: RequestInit }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    llamadas.push({ url: u, init });
    if (u.startsWith("https://api.github.com/")) {
      return new Response(JSON.stringify(opciones.github ?? COMPARE), { status: opciones.githubStatus ?? 200 });
    }
    if (opciones.motorLanza) throw new DOMException("tiempo agotado", "TimeoutError");
    const cuerpo = opciones.motor ?? { choices: [{ message: { content: informeMotor() } }] };
    return new Response(JSON.stringify(cuerpo), { status: opciones.motorStatus ?? 200 });
  });
  return { impl: impl as unknown as typeof fetch, llamadas };
}

const contexto = (db: never, fetchImpl: typeof fetch, extra: Partial<Parameters<typeof analizarSalto>[0]> = {}) => ({
  admin: db,
  tenantId: T1,
  usuarioId: SAM,
  desde: "4.19.1",
  hasta: "4.20.0",
  checkId: 7,
  superficie: () => SUPERFICIE,
  env: ENV,
  fetchImpl,
  ahora: AHORA,
  ...extra,
});

describe("configMotor", () => {
  it("apagado sin llave o con la línea vacía del .env", () => {
    expect(configMotor({})).toBeNull();
    expect(configMotor({ DTD_CHATWOOT_IA_GLM_KEY: "" })).toBeNull();
    expect(configMotor({ DTD_CHATWOOT_IA_GLM_KEY: "   " })).toBeNull();
  });
  it("con llave usa la URL y el modelo por defecto", () => {
    expect(configMotor(ENV)).toEqual({ llave: LLAVE, url: URL_MOTOR_POR_DEFECTO, modelo: MODELO_POR_DEFECTO });
  });
  it("rechaza una URL sin https o un modelo con forma rara", () => {
    expect(configMotor({ ...ENV, DTD_CHATWOOT_IA_GLM_URL: "http://x.test" })).toBeNull();
    expect(configMotor({ ...ENV, DTD_CHATWOOT_IA_GLM_MODELO: "glm 4.6; rm" })).toBeNull();
  });
  it("no reutiliza variables de otros servicios", () => {
    expect(configMotor({ ZAI_API_KEY: LLAVE, GLM_API_KEY: LLAVE, ANTHROPIC_AUTH_TOKEN: LLAVE })).toBeNull();
  });
});

describe("leerDiffChatwoot", () => {
  it("pide compare entre las dos etiquetas y lee los archivos", async () => {
    const r = red();
    const out = await leerDiffChatwoot("4.19.1", "4.20.0", r.impl);
    expect(r.llamadas[0].url).toBe(compareUrl("4.19.1", "4.20.0"));
    expect(r.llamadas[0].url).toBe("https://api.github.com/repos/chatwoot/chatwoot/compare/v4.19.1...v4.20.0");
    expect(out).toMatchObject({ ok: true, total: 3 });
  });
  it("no arma la URL con versiones sin forma", async () => {
    const r = red();
    expect(await leerDiffChatwoot("4.19.1/../x", "4.20.0", r.impl)).toEqual({ ok: false, error: "diff_formato" });
    expect(r.llamadas).toHaveLength(0);
  });
  it("GitHub caído o con otra forma", async () => {
    expect(await leerDiffChatwoot("4.19.1", "4.20.0", red({ githubStatus: 403 }).impl)).toEqual({ ok: false, error: "diff_no_responde" });
    expect(await leerDiffChatwoot("4.19.1", "4.20.0", red({ github: { message: "x" } }).impl)).toEqual({ ok: false, error: "diff_formato" });
  });
});

describe("llamarMotor", () => {
  const paquete = armarPaquete({ desde: "4.19.1", hasta: "4.20.0", superficie: SUPERFICIE, cambios: [{ ruta: "app/channels/room_channel.rb", estado: "modified", parche: "+x" }] });
  const config = configMotor(ENV)!;

  it("la llave va solo en la cabecera; el cuerpo lleva el paquete y el modelo", async () => {
    const r = red();
    const out = await llamarMotor(paquete, config, r.impl);
    expect(out.ok).toBe(true);
    const { init } = r.llamadas[0];
    expect((init?.headers as Record<string, string>).authorization).toBe(`Bearer ${LLAVE}`);
    expect(String(init?.body)).not.toContain(LLAVE);
    const cuerpo = JSON.parse(String(init?.body));
    expect(cuerpo.model).toBe(MODELO_POR_DEFECTO);
    expect(cuerpo.max_tokens).toBeGreaterThan(0);
    expect(cuerpo.messages[1].content).toContain("app/channels/room_channel.rb");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("timeout, error HTTP o respuesta sin la forma → motivo del respaldo", async () => {
    expect(await llamarMotor(paquete, config, red({ motorLanza: true }).impl)).toEqual({ ok: false, error: "motor_no_responde" });
    expect(await llamarMotor(paquete, config, red({ motorStatus: 429 }).impl)).toEqual({ ok: false, error: "motor_no_responde" });
    expect(await llamarMotor(paquete, config, red({ motor: { choices: [] } }).impl)).toEqual({ ok: false, error: "motor_formato" });
    expect(await llamarMotor(paquete, config, red({ motor: { choices: [{ message: { content: "actualiza tranquilo" } }] } }).impl)).toEqual({
      ok: false,
      error: "motor_formato",
    });
  });
});

describe("analizarSalto", () => {
  it("con IA: guarda el informe del motor, sin el .env del diff en el paquete", async () => {
    const d = doble();
    const r = red();
    const out = await analizarSalto(contexto(d.db, r.impl));
    expect(out).toEqual({ ok: true, reutilizado: false, analisis: null, motor: "glm" });
    expect(d.insertadas).toHaveLength(1);
    expect(d.insertadas[0]).toMatchObject({
      tenant_id: T1,
      from_version: "4.19.1",
      to_version: "4.20.0",
      check_id: 7,
      requested_by: SAM,
      engine: "glm",
      model: MODELO_POR_DEFECTO,
      recommendation: "revisar",
      fallback_reason: null,
    });
    const alMotor = String(r.llamadas.find((l) => !l.url.startsWith("https://api.github.com/"))?.init?.body);
    expect(alMotor).not.toContain(".env.example");
    expect(alMotor).not.toContain("SECRET_KEY_BASE=");
    expect(JSON.stringify(d.insertadas[0])).not.toContain(LLAVE);
  });

  it("motor apagado: informe sin IA, sin llamar al motor", async () => {
    const d = doble();
    const r = red();
    const out = await analizarSalto(contexto(d.db, r.impl, { env: {} }));
    expect(out).toMatchObject({ ok: true, motor: "sin_ia" });
    expect(r.llamadas.every((l) => l.url.startsWith("https://api.github.com/"))).toBe(true);
    expect(d.insertadas[0]).toMatchObject({ engine: "sin_ia", model: null, fallback_reason: "motor_apagado", recommendation: "revisar" });
  });

  it("motor caído: respaldo sin IA con su motivo", async () => {
    const d = doble();
    await analizarSalto(contexto(d.db, red({ motorStatus: 500 }).impl));
    expect(d.insertadas[0]).toMatchObject({ engine: "sin_ia", fallback_reason: "motor_no_responde" });
  });

  it("GitHub caído: respaldo sin IA y sin llamar al motor", async () => {
    const d = doble();
    const r = red({ githubStatus: 502 });
    await analizarSalto(contexto(d.db, r.impl));
    expect(r.llamadas).toHaveLength(1);
    expect(d.insertadas[0]).toMatchObject({ engine: "sin_ia", fallback_reason: "diff_no_responde", recommendation: "revisar", package_files: 0 });
  });

  it("CACHÉ: un análisis con IA del mismo salto y tenant se reutiliza sin llamar a nadie", async () => {
    const previo = { id: 9, tenant_id: T1, from_version: "4.19.1", to_version: "4.20.0", engine: "glm", model: "glm-4.6", recommendation: "seguro", report: { resumen: "ok", piezas: [] }, package_files: 2, package_chars: 10, truncated: false, fallback_reason: null, created_at: "2026-10-29T20:00:00Z" };
    const d = doble([previo]);
    const r = red();
    const out = await analizarSalto(contexto(d.db, r.impl));
    expect(out).toMatchObject({ ok: true, reutilizado: true, motor: "glm" });
    expect(r.llamadas).toHaveLength(0);
    expect(d.insertadas).toHaveLength(0);
  });

  it("la caché no cruza tenants, saltos, análisis sin IA ni los de más de 30 días", async () => {
    const base = { from_version: "4.19.1", to_version: "4.20.0", engine: "glm", model: "glm-4.6", recommendation: "seguro", report: {}, package_files: 1, package_chars: 1, truncated: false, fallback_reason: null };
    const d = doble([
      { ...base, id: 1, tenant_id: T2, created_at: "2026-10-30T10:00:00Z" },
      { ...base, id: 2, tenant_id: T1, to_version: "4.21.0", created_at: "2026-10-30T10:00:00Z" },
      { ...base, id: 3, tenant_id: T1, engine: "sin_ia", model: null, fallback_reason: "motor_apagado", created_at: "2026-10-30T10:00:00Z" },
      { ...base, id: 4, tenant_id: T1, created_at: "2026-09-01T10:00:00Z" },
    ]);
    const r = red();
    const out = await analizarSalto(contexto(d.db, r.impl));
    expect(out).toMatchObject({ ok: true, reutilizado: false });
    expect(d.insertadas).toHaveLength(1);
  });

  it(`TOPE: ${MAX_ANALISIS_DIA} análisis en 24 h por tenant; los de otro tenant o de ayer no cuentan`, async () => {
    const fila = (id: number, tenant: string, cuando: string) => ({ id, tenant_id: tenant, from_version: "4.18.0", to_version: "4.19.0", engine: "sin_ia", model: null, recommendation: "revisar", report: {}, package_files: 0, package_chars: 0, truncated: false, fallback_reason: "motor_apagado", created_at: cuando });
    const hoy = Array.from({ length: MAX_ANALISIS_DIA }, (_, i) => fila(i + 1, T1, "2026-10-30T12:00:00Z"));
    const r = red();
    expect(await analizarSalto(contexto(doble([...hoy]).db, r.impl))).toEqual({ ok: false, error: "tope" });
    expect(r.llamadas).toHaveLength(0);

    const otros = [...hoy.slice(1), fila(50, T2, "2026-10-30T12:00:00Z"), fila(51, T1, "2026-10-29T12:00:00Z")];
    expect(await analizarSalto(contexto(doble(otros).db, red().impl))).toMatchObject({ ok: true });
  });

  it("uno a la vez por tenant: el segundo pedido simultáneo no llama", async () => {
    const d = doble();
    let soltar!: () => void;
    const espera = new Promise<void>((ok) => (soltar = ok));
    const base = red();
    const lento = (async (url: string | URL | Request, init?: RequestInit) => {
      if (!String(url).startsWith("https://api.github.com/")) await espera;
      return base.impl(url, init);
    }) as typeof fetch;
    const primero = analizarSalto(contexto(d.db, lento));
    await new Promise((ok) => setTimeout(ok, 0));
    expect(await analizarSalto(contexto(d.db, lento))).toEqual({ ok: false, error: "en_curso" });
    soltar();
    expect(await primero).toMatchObject({ ok: true, motor: "glm" });
    expect(d.insertadas).toHaveLength(1);
  });

  it("sin la 0509 (no se puede contar ni guardar) responde service", async () => {
    expect(await analizarSalto(contexto(doble([], { contar: true }).db, red().impl))).toEqual({ ok: false, error: "service" });
    expect(await analizarSalto(contexto(doble([], { insertar: true }).db, red().impl))).toEqual({ ok: false, error: "service" });
  });
});
