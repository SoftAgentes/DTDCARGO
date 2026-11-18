// @vitest-environment node
/**
 * SDD-0588 · paso 3.2 · las lecturas (`/api` y GitHub) y el vigilante: guarda,
 * purga y avisa una sola vez por versión. El doble de Supabase APLICA los filtros
 * (`eq`, `neq`, `lt`, `is`) y el orden: sin eso no se prueba que la purga toque
 * solo el tenant ni que el aviso compare contra la revisión correcta.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Fila = Record<string, unknown>;
type Tablas = Record<string, Fila[]>;

function doble(tablas: Tablas, fallar: { insertar?: boolean } = {}) {
  let siguiente = 100;
  const from = (tabla: string) => {
    const filtros: ((f: Fila) => boolean)[] = [];
    const orden: [string, boolean][] = [];
    let limite = Infinity;
    let modo: "select" | "delete" | "insert" = "select";
    let nueva: Fila | null = null;
    const filas = () => {
      const out = (tablas[tabla] ?? []).filter((f) => filtros.every((p) => p(f)));
      for (const [col, asc] of [...orden].reverse()) {
        out.sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (asc ? 1 : -1));
      }
      return out.slice(0, limite).map((f) => ({ ...f }));
    };
    const resolver = () => {
      if (modo === "insert") {
        if (fallar.insertar || !nueva) return { data: null, error: { code: "42P01" } };
        const fila = { id: siguiente++, checked_at: new Date().toISOString(), ...nueva };
        (tablas[tabla] ??= []).push(fila);
        return { data: { ...fila }, error: null };
      }
      if (modo === "delete") {
        const quitar = new Set((tablas[tabla] ?? []).filter((f) => filtros.every((p) => p(f))));
        tablas[tabla] = (tablas[tabla] ?? []).filter((f) => !quitar.has(f));
        return { data: null, error: null };
      }
      return { data: filas(), error: null };
    };
    const builder = {
      select: () => builder,
      insert: (v: Fila) => ((modo = "insert"), (nueva = v), builder),
      delete: () => ((modo = "delete"), builder),
      eq: (c: string, v: unknown) => (filtros.push((f) => f[c] === v), builder),
      neq: (c: string, v: unknown) => (filtros.push((f) => f[c] !== v), builder),
      lt: (c: string, v: string) => (filtros.push((f) => String(f[c]) < v), builder),
      is: (c: string, v: unknown) => (filtros.push((f) => (f[c] ?? null) === v), builder),
      order: (c: string, o: { ascending: boolean }) => (orden.push([c, o.ascending]), builder),
      limit: (n: number) => ((limite = n), builder),
      maybeSingle: () => {
        const r = resolver();
        const lista = r.data as Fila[] | null;
        return Promise.resolve({ data: lista?.[0] ?? null, error: r.error });
      },
      single: () => Promise.resolve(resolver()),
      then: (fin: (v: unknown) => unknown) => Promise.resolve(fin(resolver())),
    };
    return builder;
  };
  return { from };
}

const m = vi.hoisted(() => ({ encolar: vi.fn(), drenar: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/studio/notify/operario-push-outbox", () => ({ enqueueUserPush: m.encolar, drainOperarioPushOutbox: m.drenar }));

import { RELEASES_URL, leerReleases, leerVersionInstalada } from "../versiones-fuentes";
import { REUSO_MS, revisarAhora, vigilarVersiones } from "../versiones-vigilante";

const T1 = "10000000-0000-4000-8000-000000000001";
const T2 = "10000000-0000-4000-8000-000000000002";
const SAM = "20000000-0000-4000-8000-000000000001";
const ANA = "20000000-0000-4000-8000-000000000003";
const ORIGEN = "https://chat.ejemplo.test";

const release = (tag: string, body = "* fix: algo") => ({
  tag_name: tag,
  name: tag,
  draft: false,
  prerelease: false,
  published_at: "2026-10-20T10:00:00Z",
  html_url: `https://github.com/chatwoot/chatwoot/releases/tag/${tag}`,
  body,
});

function fetchFalso(instalada: string | null, releases: unknown[] | null) {
  const llamadas: { url: string; headers: Record<string, string> }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    llamadas.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string> });
    if (String(url) === `${ORIGEN}/api`) {
      if (instalada === null) return new Response("caído", { status: 502 });
      return Response.json({ version: instalada, queue_services: "ok", data_services: "ok" });
    }
    if (String(url) === RELEASES_URL) {
      if (releases === null) return new Response("{}", { status: 403 });
      return Response.json(releases);
    }
    throw new Error(`url inesperada ${String(url)}`);
  });
  return { impl: impl as unknown as typeof fetch, llamadas };
}

let tablas: Tablas;
beforeEach(() => {
  m.encolar.mockReset().mockResolvedValue("push-1");
  m.drenar.mockReset().mockResolvedValue(undefined);
  tablas = {
    chatwoot_version_checks: [],
    user_tenants: [
      { tenant_id: T1, user_id: SAM, role: "admin", disabled_at: null },
      { tenant_id: T1, user_id: ANA, role: "commercial", disabled_at: null },
      { tenant_id: T2, user_id: ANA, role: "admin", disabled_at: null },
    ],
  };
});

describe("lecturas (versiones-fuentes)", () => {
  it("GET /api sin credenciales; la versión sale del cuerpo", async () => {
    const f = fetchFalso("4.19.1", []);
    expect(await leerVersionInstalada(ORIGEN, f.impl)).toEqual({ ok: true, version: "4.19.1" });
    expect(Object.keys(f.llamadas[0].headers).map((h) => h.toLowerCase())).not.toContain("authorization");
  });

  it("/api caído, con otro formato o que lanza → error con su código", async () => {
    expect(await leerVersionInstalada(ORIGEN, fetchFalso(null, []).impl)).toEqual({ ok: false, error: "instalada_no_responde" });
    expect(await leerVersionInstalada(ORIGEN, fetchFalso("4.19", []).impl)).toEqual({ ok: false, error: "instalada_formato" });
    const lanza = vi.fn(async () => {
      throw new Error("timeout");
    }) as unknown as typeof fetch;
    expect(await leerVersionInstalada(ORIGEN, lanza)).toEqual({ ok: false, error: "instalada_no_responde" });
  });

  it("GitHub: pedido público con user-agent propio; 403 por límite → no responde", async () => {
    const f = fetchFalso("4.19.1", [release("v4.20.0")]);
    const r = await leerReleases(f.impl);
    expect(r.ok && r.lista.map((x) => x.version)).toEqual(["4.20.0"]);
    expect(f.llamadas[0].headers["user-agent"]).toBe("dtd-studio-vigilante-chatwoot");
    expect(Object.keys(f.llamadas[0].headers)).not.toContain("authorization");
    expect(await leerReleases(fetchFalso("4.19.1", null).impl)).toEqual({ ok: false, error: "releases_no_responde" });
  });
});

describe("vigilarVersiones", () => {
  const ctx = (f: ReturnType<typeof fetchFalso>, extra: Partial<Parameters<typeof vigilarVersiones>[0]> = {}) => ({
    admin: doble(tablas) as never,
    tenantId: T1,
    origen: ORIGEN,
    fetchImpl: f.impl,
    ...extra,
  });

  it("versión nueva: guarda la revisión y avisa a los admins de SU tenant", async () => {
    const r = await vigilarVersiones(ctx(fetchFalso("4.19.1", [release("v4.20.0"), release("v4.19.1")])));
    expect(r.revision).toMatchObject({ estado: "hay_nueva", instalada: "4.19.1", disponible: "4.20.0" });
    expect(tablas.chatwoot_version_checks).toHaveLength(1);
    expect(tablas.chatwoot_version_checks[0]).toMatchObject({ tenant_id: T1, status: "hay_nueva", latest_version: "4.20.0", error_code: null });
    expect(r.avisados).toBe(1);
    expect(m.encolar).toHaveBeenCalledTimes(1);
    expect(m.encolar).toHaveBeenCalledWith(expect.anything(), T1, SAM, expect.objectContaining({ url: "/studio/admin/actualizaciones", tag: "chatwoot-version" }));
    expect(m.drenar).toHaveBeenCalledTimes(1);
  });

  it("no avisa dos veces la misma versión, ni con un error en medio", async () => {
    const hayNueva = fetchFalso("4.19.1", [release("v4.20.0")]);
    await vigilarVersiones(ctx(hayNueva));
    await vigilarVersiones(ctx(fetchFalso(null, [release("v4.20.0")])));
    const r = await vigilarVersiones(ctx(hayNueva));
    expect(tablas.chatwoot_version_checks.map((f) => f.status)).toEqual(["hay_nueva", "error", "hay_nueva"]);
    expect(r.avisados).toBe(0);
    expect(m.encolar).toHaveBeenCalledTimes(1);
  });

  it("vuelve a avisar cuando sale otra versión más nueva", async () => {
    await vigilarVersiones(ctx(fetchFalso("4.19.1", [release("v4.20.0")])));
    const r = await vigilarVersiones(ctx(fetchFalso("4.19.1", [release("v4.21.0"), release("v4.20.0")])));
    expect(r.avisados).toBe(1);
    expect(m.encolar).toHaveBeenCalledTimes(2);
  });

  it("al día o con error no avisa", async () => {
    await vigilarVersiones(ctx(fetchFalso("4.20.0", [release("v4.20.0")])));
    await vigilarVersiones(ctx(fetchFalso("4.19.1", null)));
    expect(tablas.chatwoot_version_checks.map((f) => [f.status, f.error_code])).toEqual([
      ["al_dia", null],
      ["error", "releases_no_responde"],
    ]);
    expect(m.encolar).not.toHaveBeenCalled();
  });

  it("purga solo las revisiones viejas de su tenant", async () => {
    tablas.chatwoot_version_checks.push(
      { id: 1, tenant_id: T1, checked_at: "2026-01-01T00:00:00.000Z", status: "al_dia" },
      { id: 2, tenant_id: T1, checked_at: "2026-10-01T00:00:00.000Z", status: "al_dia" },
      { id: 3, tenant_id: T2, checked_at: "2026-01-01T00:00:00.000Z", status: "al_dia" },
    );
    await vigilarVersiones(ctx(fetchFalso("4.20.0", [release("v4.20.0")]), { ahora: new Date("2026-10-30T12:00:00Z") }));
    expect(tablas.chatwoot_version_checks.map((f) => f.id).sort()).toEqual([100, 2, 3].sort());
  });

  it("sin la 0507 (no guarda): omitido, sin avisar", async () => {
    const r = await vigilarVersiones({ ...ctx(fetchFalso("4.19.1", [release("v4.20.0")])), admin: doble(tablas, { insertar: true }) as never });
    expect(r).toEqual({ omitido: true, revision: null, avisados: 0 });
    expect(m.encolar).not.toHaveBeenCalled();
  });
});

describe("revisarAhora", () => {
  it(`reutiliza una revisión de menos de ${REUSO_MS / 60_000} min sin salir a la red`, async () => {
    tablas.chatwoot_version_checks.push({ id: 7, tenant_id: T1, checked_at: "2026-10-30T11:55:00.000Z", status: "al_dia", installed_version: "4.20.0", latest_version: "4.20.0", releases: [], truncated: false, error_code: null });
    const f = fetchFalso("4.20.0", [release("v4.20.0")]);
    const r = await revisarAhora({ admin: doble(tablas) as never, tenantId: T1, origen: ORIGEN, fetchImpl: f.impl, ahora: new Date("2026-10-30T12:00:00Z") });
    expect(r.revision?.id).toBe(7);
    expect(f.llamadas).toHaveLength(0);
  });

  it("con una revisión vieja o con error, revisa de nuevo", async () => {
    tablas.chatwoot_version_checks.push({ id: 7, tenant_id: T1, checked_at: "2026-10-30T11:58:00.000Z", status: "error", installed_version: null, latest_version: null, releases: [], truncated: false, error_code: "instalada_no_responde" });
    const f = fetchFalso("4.20.0", [release("v4.20.0")]);
    const r = await revisarAhora({ admin: doble(tablas) as never, tenantId: T1, origen: ORIGEN, fetchImpl: f.impl, ahora: new Date("2026-10-30T12:00:00Z") });
    expect(r.revision?.estado).toBe("al_dia");
    expect(f.llamadas).toHaveLength(2);
  });
});
