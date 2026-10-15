// @vitest-environment node
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
 * 🔴 SDD-0291 · el falso verde.
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

/**
 * 🔴 SDD-0527 · la llave borrada que salía verde.
 *
 * `GET /domains` responde 401 a dos llaves muy distintas: la «Sending access»
 * (`name: "restricted_api_key"`), que existe y envía, y la borrada o inválida
 * («API key is invalid»), que no envía nada. El chequeo viejo daba por sana
 * cualquier 401/403, así que /studio/debug no podía decir si la llave de un
 * entorno había muerto. El 2026-10-15 se borraron dos llaves por error y el
 * panel no lo podía mostrar.
 *
 * Se prueba por `checkAllIntegrations`, la misma entrada que usan
 * /studio/debug y /api/debug/health, y por eso estos casos también corren
 * contra el código anterior (el control rojo).
 */
describe("checkResend · el cuerpo del 401 decide", () => {
  const LLAVE = "re_prueba_NO_DEBE_SALIR_0527";
  const URL_DOMINIOS = "https://api.resend.com/domains";

  /** Responde `/domains` con lo dado; el resto de las URLs, 200 vacío. */
  function responderDominios(respuesta: () => Response | Promise<Response>) {
    const llamadas: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown, init?: RequestInit) => {
        const url = String(input);
        llamadas.push({ url, init });
        if (url === URL_DOMINIOS) return respuesta();
        return new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );
    return llamadas;
  }

  const json = (status: number, cuerpo: unknown) => () =>
    new Response(JSON.stringify(cuerpo), {
      status,
      headers: { "content-type": "application/json" },
    });

  const saludResend = async () =>
    (await checkAllIntegrations({ skipMetered: true })).resend;

  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", LLAVE);
    // Sin secret, el chequeo del webhook queda fuera y no pega a la API.
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "");
  });

  it("200: sana con acceso completo y cuenta sólo los dominios verificados", async () => {
    responderDominios(
      json(200, {
        data: [
          { name: "dtdcargo.com", status: "verified" },
          { name: "envios.dtdcargo.com", status: "verified" },
          { name: "pendiente.dtdcargo.com", status: "pending" },
        ],
      }),
    );
    const salud = await saludResend();
    expect(salud.status).toBe("ok");
    expect(salud.error).toBeNull();
    expect(salud.detail).toBe("acceso completo · 2 dominio(s) verificado(s)");
  });

  it("401 restricted_api_key: sana, pero sólo envía y avisa que el correo entrante no funciona", async () => {
    responderDominios(
      json(401, {
        statusCode: 401,
        name: "restricted_api_key",
        message: "This API key is restricted to only send emails",
      }),
    );
    const salud = await saludResend();
    expect(salud.status).toBe("ok");
    expect(salud.error).toBeNull();
    expect(salud.detail).toContain("solo de envío");
    expect(salud.detail).toContain("correo entrante de Conversaciones");
  });

  it("401 «API key is invalid»: rojo, llave inválida o borrada", async () => {
    responderDominios(
      json(401, {
        statusCode: 401,
        name: "validation_error",
        message: "API key is invalid",
      }),
    );
    const salud = await saludResend();
    expect(salud.status).toBe("error");
    expect(salud.error).toBe("llave inválida o borrada · HTTP 401");
  });

  it("403 sin restricted_api_key: también rojo (antes salía verde)", async () => {
    responderDominios(
      json(403, {
        statusCode: 403,
        name: "invalid_api_key",
        message: "API key is invalid",
      }),
    );
    const salud = await saludResend();
    expect(salud.status).toBe("error");
    expect(salud.error).toBe("llave inválida o borrada · HTTP 403");
  });

  it("401 sin cuerpo legible: rojo, no se presume que sea de sólo envío", async () => {
    responderDominios(() => new Response("Unauthorized", { status: 401 }));
    const salud = await saludResend();
    expect(salud.status).toBe("error");
    expect(salud.error).toBe("llave inválida o borrada · HTTP 401");
  });

  it("restricted_api_key tiene que venir en `name`, no basta con que lo diga el mensaje", async () => {
    responderDominios(
      json(401, {
        statusCode: 401,
        name: "validation_error",
        message: "restricted_api_key",
      }),
    );
    const salud = await saludResend();
    expect(salud.status).toBe("error");
  });

  it("otro error (500) es rojo y no culpa a la llave", async () => {
    responderDominios(
      json(500, { statusCode: 500, name: "internal_server_error", message: "boom" }),
    );
    const salud = await saludResend();
    expect(salud.status).toBe("error");
    expect(salud.error).toBe("HTTP 500");
  });

  it("sin red: rojo con el motivo", async () => {
    responderDominios(() => Promise.reject(new Error("fetch failed")));
    const salud = await saludResend();
    expect(salud.status).toBe("error");
    expect(salud.error).toBe("fetch failed");
  });

  it("nunca expone ni registra la llave, aunque Resend la devuelva en el cuerpo", async () => {
    const consolas = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const escenarios = [
      json(200, { data: [{ name: LLAVE, status: "verified" }] }),
      json(401, { statusCode: 401, name: "restricted_api_key", message: `Key ${LLAVE} restricted` }),
      json(401, { statusCode: 401, name: LLAVE, message: `API key ${LLAVE} is invalid` }),
      json(500, { statusCode: 500, name: LLAVE, message: LLAVE }),
    ];
    for (const escenario of escenarios) {
      const llamadas = responderDominios(escenario);
      const salud = await saludResend();
      // La llave sí viajó, en el header y sólo ahí: si no, la prueba no prueba nada.
      const dominios = llamadas.find((l) => l.url === URL_DOMINIOS);
      expect(new Headers(dominios?.init?.headers).get("authorization")).toBe(`Bearer ${LLAVE}`);
      expect(JSON.stringify(salud)).not.toContain(LLAVE);
    }
    for (const espia of consolas) {
      expect(JSON.stringify(espia.mock.calls)).not.toContain(LLAVE);
    }
  });
});
