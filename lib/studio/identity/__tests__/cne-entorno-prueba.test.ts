// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCneProvider, proveedorCneSimulado, verifyIdentity } from "..";

/**
 * SDD-0544 · el entorno de prueba no consulta cédulas en servicios externos.
 *
 * Hallazgo de la Fase 1 de la SDD-0540: sin `IDENTITY_CNE_PROVIDER` la app usa
 * `cedulave`. Medido en el código: `cedulave` sin `IDENTITY_CNE_URL` ya devuelve
 * `null` sin `fetch` (`providers/cne-cedulave.ts`); con la URL puesta, consulta
 * el servicio externo con la cédula. Prueba va a tener consolidados reales, así
 * que con `APP_ENV=staging` el provider es siempre el simulado, aunque haya URL
 * o se elija otro provider. Producción no cambia.
 *
 * La URL y la cédula son sintéticas; `fetch` es un doble.
 */

const URL_SINTETICA = "https://cne.example.test/consulta";
const fetchDoble = vi.fn();

beforeEach(() => {
  fetchDoble.mockReset();
  fetchDoble.mockImplementation(async () =>
    new Response(
      JSON.stringify({ status: 200, data: { fullname: "PERSONA SINTETICA PRUEBA" } }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
  vi.stubGlobal("fetch", fetchDoble);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const CLIENTE = { rif: "V-12345678", name: "Persona Sintetica Prueba", docKind: "persona" as const };

describe("SDD-0544 · CNE en el entorno de prueba", () => {
  it("staging con IDENTITY_CNE_URL: el provider es el simulado y no hay red", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("IDENTITY_CNE_URL", URL_SINTETICA);
    expect(await getCneProvider()).toBe(proveedorCneSimulado);
    expect(await verifyIdentity(CLIENTE)).toEqual({ status: "unavailable", source: "cne" });
    expect(fetchDoble).not.toHaveBeenCalled();
  });

  it.each(["cedulave", "verifik", ""])(
    "staging con IDENTITY_CNE_PROVIDER=%s: también el simulado",
    async (choice) => {
      vi.stubEnv("APP_ENV", "staging");
      vi.stubEnv("IDENTITY_CNE_URL", URL_SINTETICA);
      vi.stubEnv("IDENTITY_CNE_PROVIDER", choice);
      expect(await getCneProvider()).toBe(proveedorCneSimulado);
      expect(await verifyIdentity(CLIENTE)).toEqual({ status: "unavailable", source: "cne" });
      expect(fetchDoble).not.toHaveBeenCalled();
    },
  );

  it("el provider simulado responde «no encontrado» sin consultar nada", async () => {
    expect(await proveedorCneSimulado.lookup("12345678")).toBeNull();
    expect(fetchDoble).not.toHaveBeenCalled();
  });

  it("producción sin cambios: con IDENTITY_CNE_URL, cedulave consulta y compara", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("IDENTITY_CNE_URL", URL_SINTETICA);
    const r = await verifyIdentity(CLIENTE);
    expect(fetchDoble).toHaveBeenCalledTimes(1);
    expect(String(fetchDoble.mock.calls[0][0])).toContain("cne.example.test");
    expect(r.status).toBe("ok");
    expect(r.registryName).toBe("PERSONA SINTETICA PRUEBA");
  });

  it("producción sin IDENTITY_CNE_URL: no hay red, como antes", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("IDENTITY_CNE_URL", "");
    expect(await verifyIdentity(CLIENTE)).toEqual({ status: "unavailable", source: "cne" });
    expect(fetchDoble).not.toHaveBeenCalled();
  });
});
