/**
 * Contrato del modo barato de `checkAllIntegrations` (SDD-0247).
 *
 * Por qué existe: la torre de control externa sondea `/api/debug/health?cheap=1`
 * cada 15 minutos. El chequeo completo pinga SeaRates en CADA llamada, y esa
 * cuota es de 100 al MES compartida con el cotizador FCL — ~96 sondeos al día
 * la agotan el primer día. Si alguien quita el skip, la cuota se muere en
 * silencio y el síntoma aparece días después en /tarifas, lejísimos de la causa.
 *
 * El test se ancla en la LLAMADA, no en el nombre: stubea `fetch` y mira a qué
 * host se pegó de verdad. Y trae la prueba de fondo — sin `skipMetered` las tres
 * SÍ se consultan — porque si no, un skip que apague todo pasaría igual.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkAllIntegrations,
  METERED_INTEGRATIONS,
  __checkSeaRatesForTests,
} from "../integration-health";

/** Host que delata a cada integración medida en la URL consultada. */
const HOST_DE_LA_MEDIDA: Record<(typeof METERED_INTEGRATIONS)[number], string> = {
  anthropic: "api.anthropic.com",
  openrouter: "openrouter.ai",
  searates: "searates.com",
};

/** Stubea `fetch` y devuelve el arreglo donde se van acumulando las URLs. */
function espiarFetch(): string[] {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      urls.push(String(input));
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return urls;
}

const consultado = (urls: string[], host: string) => urls.some((u) => u.includes(host));

beforeEach(() => {
  // Con las keys puestas, las guardas `if (!key) return skipped()` no aplican:
  // así el único motivo posible para NO consultarlas es el modo barato.
  vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic");
  vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter");
  vi.stubEnv("SEARATES_PLATFORM_ID", "test-platform");
  vi.stubEnv("SEARATES_API_KEY", "test-searates");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://stub.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "stub-anon-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("checkAllIntegrations · modo barato", () => {
  it("PRUEBA DE FONDO: sin skipMetered consulta las tres medidas", async () => {
    const urls = espiarFetch();
    await checkAllIntegrations();

    for (const clave of METERED_INTEGRATIONS) {
      expect(
        consultado(urls, HOST_DE_LA_MEDIDA[clave]),
        `${clave} debería consultarse en el modo completo; si no, este test no prueba nada`,
      ).toBe(true);
    }
  });

  it("con skipMetered NO pega a ninguna de las medidas", async () => {
    const urls = espiarFetch();
    await checkAllIntegrations({ skipMetered: true });

    for (const clave of METERED_INTEGRATIONS) {
      expect(
        consultado(urls, HOST_DE_LA_MEDIDA[clave]),
        `${clave} NO debe consultarse en modo barato: consume cuota`,
      ).toBe(false);
    }
  });

  it("las medidas vuelven skipped con el motivo, distinguible de 'no configurada'", async () => {
    espiarFetch();
    const salud = await checkAllIntegrations({ skipMetered: true });

    for (const clave of METERED_INTEGRATIONS) {
      expect(salud[clave].status).toBe("skipped");
      // `detail` es lo que separa "no la consulté a propósito" de "no está
      // configurada" (que sale con detail null). El vigía necesita esa diferencia.
      expect(salud[clave].detail).toBeTruthy();
      expect(salud[clave].detail).toContain("cuota");
    }
  });

  it("el modo barato NO apaga las integraciones que no cuestan", async () => {
    const urls = espiarFetch();
    const salud = await checkAllIntegrations({ skipMetered: true });

    // Supabase está configurada en este test y no es medida: tiene que consultarse.
    expect(consultado(urls, "stub.supabase.co")).toBe(true);
    expect(salud.supabase.status).not.toBe("skipped");
  });

  it("sin argumentos se comporta igual que siempre (retrocompatible)", async () => {
    espiarFetch();
    const salud = await checkAllIntegrations();

    for (const clave of METERED_INTEGRATIONS) {
      expect(salud[clave].status).not.toBe("skipped");
    }
  });
});

/**
 * 🔴 SDD-0287 · el falso verde.
 *
 * El endpoint de auth de SeaRates emite el token con sólo mirar que la cuenta
 * exista. Medido en vivo el 24-ago-2026: devolvía 200 con token mientras rates
 * FCL, rates LCL y tracking respondían los tres 403 ACCESS_DENIED — o sea que
 * /studio/debug pintaba SeaRates en VERDE con todo muerto. Estos casos fijan que
 * un 200 del auth ya no alcanza para declararla sana.
 */
describe("checkSeaRates · el auth 200 no basta", () => {
  it("auth OK + CERO tarifas vivas NO puede salir verde", async () => {
    espiarFetch(); // el auth responde 200, como en el corte real
    const salud = await __checkSeaRatesForTests(async () => 0);
    expect(salud.status).toBe("error");
    expect(salud.error).toContain("0 tarifas vivas");
  });

  it("auth OK con tarifas vivas es verde y dice cuántas", async () => {
    espiarFetch();
    const salud = await __checkSeaRatesForTests(async () => 20);
    expect(salud.status).toBe("ok");
    expect(salud.detail).toContain("20");
  });

  it("si la caché no se puede leer NO inventa un rojo", async () => {
    // `null` = sin service_role / DB caída. Degradar a rojo por no poder mirar
    // sería un falso positivo, que entrena al equipo a ignorar el panel.
    espiarFetch();
    const salud = await __checkSeaRatesForTests(async () => null);
    expect(salud.status).toBe("ok");
    expect(salud.detail).toContain("token emitido");
  });

  it("con el auth caído ni siquiera mira la caché", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 403 })),
    );
    const contar = vi.fn(async () => 20);
    const salud = await __checkSeaRatesForTests(contar);
    expect(salud.status).toBe("error");
    expect(contar).not.toHaveBeenCalled();
  });
});
