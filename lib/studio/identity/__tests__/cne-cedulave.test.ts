/**
 * Tests del provider CNE gratis (SDD-0046 · V1 manual-only, swap-ready).
 *
 * Cubre:
 *   - `parseRegistryName` contra el shape REAL megacreativo/cedula.com.ve:
 *       · data.fullname → nombre
 *       · data.name + data.lastname → nombre
 *       · status 404 / 303 / 306 → null (no encontrado / CNE offline)
 *       · fallbacks defensivos de otros wrappers
 *   - `lookup` SIN `IDENTITY_CNE_URL` → null inmediato y **sin fetch** (no
 *     malgasta el timeout): el wrapper hosteado está caído/geo-restringido.
 *   - `lookup` CON `IDENTITY_CNE_URL` → arma el request al contrato megacreativo
 *     (`?nac=&dni=`) y parsea la respuesta.
 *
 * `cne-cedulave.ts` importa `server-only`; vitest lo resuelve a un stub vacío vía
 * `resolve.alias` en `vitest.config.mts` (ese módulo lo provee el bundler de Next,
 * no existe en disco).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  parseRegistryName,
  createCedulaVeProvider,
} from "../providers/cne-cedulave";

describe("parseRegistryName · shape megacreativo (primario)", () => {
  it("data.fullname → nombre", () => {
    const body = {
      status: 200,
      data: { nac: "V", dni: "12345678", fullname: "MARIA ACOSTA PEREZ" },
    };
    expect(parseRegistryName(body)).toBe("MARIA ACOSTA PEREZ");
  });

  it("data.name + data.lastname (sin fullname) → juntos", () => {
    const body = {
      status: 200,
      data: { nac: "V", dni: "9999999", name: "JOSE", lastname: "PEREZ GOMEZ" },
    };
    expect(parseRegistryName(body)).toBe("JOSE PEREZ GOMEZ");
  });

  it("status 404 → null (cédula no encontrada)", () => {
    expect(parseRegistryName({ status: 404, data: {} })).toBeNull();
  });

  it("status 303 → null (no encontrado, variante)", () => {
    expect(parseRegistryName({ status: 303 })).toBeNull();
  });

  it("status 306 → null (CNE offline)", () => {
    // Aunque viniera data, el 306 (CNE caído) manda → null.
    expect(
      parseRegistryName({ status: 306, data: { fullname: "X Y" } }),
    ).toBeNull();
  });

  it("status como string '200' + fullname → ok (coerce)", () => {
    const body = { status: "200", data: { fullname: "ANA LOPEZ" } };
    expect(parseRegistryName(body)).toBe("ANA LOPEZ");
  });

  it("body vacío / no-objeto → null", () => {
    expect(parseRegistryName(null)).toBeNull();
    expect(parseRegistryName("nope")).toBeNull();
    expect(parseRegistryName({})).toBeNull();
  });
});

describe("parseRegistryName · fallbacks defensivos (otros wrappers)", () => {
  it("campo único `nombre` en la raíz", () => {
    expect(parseRegistryName({ nombre: "PEDRO RAMIREZ" })).toBe("PEDRO RAMIREZ");
  });

  it("`fullName` camelCase en data", () => {
    expect(parseRegistryName({ data: { fullName: "LUIS DIAZ" } })).toBe(
      "LUIS DIAZ",
    );
  });

  it("primer_nombre + primer_apellido (esquema español viejo)", () => {
    const body = {
      data: {
        primer_nombre: "CARLOS",
        segundo_nombre: "JOSE",
        primer_apellido: "MENDEZ",
      },
    };
    expect(parseRegistryName(body)).toBe("CARLOS JOSE MENDEZ");
  });
});

describe("createCedulaVeProvider · sin IDENTITY_CNE_URL", () => {
  const prev = process.env.IDENTITY_CNE_URL;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    delete process.env.IDENTITY_CNE_URL;
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.IDENTITY_CNE_URL;
    else process.env.IDENTITY_CNE_URL = prev;
    vi.restoreAllMocks();
  });

  it("lookup → null INMEDIATO y NO llama a fetch (no malgasta el timeout)", async () => {
    const provider = createCedulaVeProvider();
    const r = await provider.lookup("12345678");
    expect(r).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("IDENTITY_CNE_URL vacía / whitespace también degrada a null sin fetch", async () => {
    process.env.IDENTITY_CNE_URL = "   ";
    const provider = createCedulaVeProvider();
    const r = await provider.lookup("V12345678");
    expect(r).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("createCedulaVeProvider · con IDENTITY_CNE_URL", () => {
  const prev = process.env.IDENTITY_CNE_URL;

  beforeEach(() => {
    process.env.IDENTITY_CNE_URL = "https://example.test/cedula";
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.IDENTITY_CNE_URL;
    else process.env.IDENTITY_CNE_URL = prev;
    vi.restoreAllMocks();
  });

  it("arma el request al contrato megacreativo (?nac=&dni=) y parsea fullname", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ status: 200, data: { fullname: "MARIA ACOSTA" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const provider = createCedulaVeProvider();
    const r = await provider.lookup("V-12.345.678");

    expect(r).toEqual({ registryName: "MARIA ACOSTA" });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const calledUrl = String(fetchSpy.mock.calls[0]![0]);
    // Query params (NO el path /{nac}/{num}).
    expect(calledUrl).toContain("nac=V");
    expect(calledUrl).toContain("dni=12345678");
    expect(calledUrl).not.toMatch(/\/V\/12345678$/);
  });

  it("status de no-encontrado en el body (404) → null aunque el HTTP sea 200", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: 404, data: {} }), { status: 200 }),
    );
    const provider = createCedulaVeProvider();
    expect(await provider.lookup("12345678")).toBeNull();
  });

  it("HTTP != 2xx → null (degrada a manual)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("err", { status: 503 }),
    );
    const provider = createCedulaVeProvider();
    expect(await provider.lookup("12345678")).toBeNull();
  });

  it("fetch tira (red caída) → null (no propaga)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const provider = createCedulaVeProvider();
    await expect(provider.lookup("12345678")).resolves.toBeNull();
  });

  it("body no-JSON → null", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html>not json</html>", { status: 200 }),
    );
    const provider = createCedulaVeProvider();
    expect(await provider.lookup("12345678")).toBeNull();
  });
});
