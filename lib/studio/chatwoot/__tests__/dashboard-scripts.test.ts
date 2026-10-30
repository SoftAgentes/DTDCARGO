// @vitest-environment node
/**
 * SDD-0585 · paso 2.7 (E2-D13) · el script del panel de Chatwoot
 * (`infra/chatwoot/panel/dashboard-scripts.html`, va en `DASHBOARD_SCRIPTS`).
 *
 * Se corre el texto REAL del archivo con una ventana y un documento falsos: lo
 * que se prueba es lo que se pegará en el Super Admin. Solo acepta el pedido de
 * Studio y de la ventana que lo enmarca; llama al logout de Chatwoot con las
 * credenciales de la cookie y avisa a Studio.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const HTML = readFileSync(resolve(ROOT, "infra/chatwoot/panel/dashboard-scripts.html"), "utf8");
const SCRIPT = HTML.slice(HTML.indexOf("<script>") + "<script>".length, HTML.indexOf("</script>"));

const SESION = { "access-token": "acc-sintetico", client: "cli-sintetico", uid: "ana@example.test", expiry: "1" };

function montar(opciones: { cookie?: string; enmarcada?: boolean } = {}) {
  let escuchar: ((e: { origin: string; source: unknown; data: unknown }) => void) | null = null;
  const escritas: string[] = [];
  const padre = { postMessage: vi.fn() };
  const ventana: Record<string, unknown> = {
    addEventListener: (tipo: string, fn: typeof escuchar) => {
      if (tipo === "message") escuchar = fn;
    },
  };
  ventana.parent = opciones.enmarcada === false ? ventana : padre;
  const documento = {
    get cookie() {
      return opciones.cookie ?? `otra=1; cw_d_session_info=${encodeURIComponent(JSON.stringify(SESION))}`;
    },
    set cookie(v: string) {
      escritas.push(v);
    },
  };
  const fetchFalso = vi.fn(async () => new Response(null, { status: 200 }));
  new Function("window", "document", "fetch", SCRIPT)(ventana, documento, fetchFalso);
  const enviar = (origin: string, data: unknown, source: unknown = ventana.parent) => escuchar!({ origin, source, data });
  const esperar = () => new Promise((r) => setTimeout(r, 0));
  return { padre, fetchFalso, escritas, enviar, esperar };
}

const PEDIDO = JSON.stringify({ evento: "dtd:cerrar-sesion" });

describe("DASHBOARD_SCRIPTS · cierre de sesión pedido por Studio", () => {
  let p: ReturnType<typeof montar>;
  beforeEach(() => {
    p = montar();
  });

  it("de Studio y del marco padre: logout de Chatwoot con la cookie, borra las cookies y avisa", async () => {
    p.enviar("https://dtdcargo.com", PEDIDO);
    await p.esperar();
    expect(p.fetchFalso).toHaveBeenCalledWith("/auth/sign_out", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "access-token": "acc-sintetico", client: "cli-sintetico", uid: "ana@example.test" },
    });
    expect(p.escritas).toEqual([
      "cw_d_session_info=; Max-Age=0; path=/",
      "auth_data=; Max-Age=0; path=/",
      "user=; Max-Age=0; path=/",
    ]);
    expect(p.padre.postMessage).toHaveBeenCalledWith(JSON.stringify({ evento: "dtd:sesion-cerrada" }), "https://dtdcargo.com");
  });

  it("también acepta el pedido como objeto, y desde www", async () => {
    p.enviar("https://www.dtdcargo.com", { evento: "dtd:cerrar-sesion" });
    await p.esperar();
    expect(p.fetchFalso).toHaveBeenCalledTimes(1);
    expect(p.padre.postMessage).toHaveBeenCalledWith(expect.any(String), "https://www.dtdcargo.com");
  });

  it.each([
    ["otro origen", "https://malo.example.test", PEDIDO],
    ["un subdominio parecido", "https://dtdcargo.com.malo.test", PEDIDO],
    ["el propio chat", "https://chat.dtdcargo.com", PEDIDO],
    ["otro evento", "https://dtdcargo.com", JSON.stringify({ evento: "otra-cosa" })],
    ["JSON roto", "https://dtdcargo.com", "{no"],
    ["nada", "https://dtdcargo.com", null],
  ])("ignora %s", async (_n, origen, datos) => {
    p.enviar(origen, datos);
    await p.esperar();
    expect(p.fetchFalso).not.toHaveBeenCalled();
    expect(p.escritas).toEqual([]);
    expect(p.padre.postMessage).not.toHaveBeenCalled();
  });

  it("ignora un mensaje de Studio que no viene del marco padre (otra pestaña o ventana)", async () => {
    p.enviar("https://dtdcargo.com", PEDIDO, { otra: true });
    await p.esperar();
    expect(p.fetchFalso).not.toHaveBeenCalled();
  });

  it("sin marco (el panel abierto directo) no hace nada", async () => {
    const q = montar({ enmarcada: false });
    q.enviar("https://dtdcargo.com", PEDIDO);
    await q.esperar();
    expect(q.fetchFalso).not.toHaveBeenCalled();
  });

  it("sin cookie de sesión: no llama al logout, pero borra y avisa", async () => {
    const q = montar({ cookie: "otra=1" });
    q.enviar("https://dtdcargo.com", PEDIDO);
    await q.esperar();
    expect(q.fetchFalso).not.toHaveBeenCalled();
    expect(q.padre.postMessage).toHaveBeenCalledTimes(1);
  });

  it("si el logout falla, igual borra las cookies y avisa", async () => {
    p.fetchFalso.mockRejectedValueOnce(new TypeError("fetch failed"));
    p.enviar("https://dtdcargo.com", PEDIDO);
    await p.esperar();
    await p.esperar();
    expect(p.escritas).toHaveLength(3);
    expect(p.padre.postMessage).toHaveBeenCalledTimes(1);
  });

  it("el script no usa globales fuera de window, document y fetch (no rompe el panel)", () => {
    expect(SCRIPT).not.toMatch(/localStorage|sessionStorage|eval\(|innerHTML|XMLHttpRequest/);
    expect(SCRIPT).not.toMatch(/console\./);
  });
});
