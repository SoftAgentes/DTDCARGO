// @vitest-environment node
import { describe, expect, it } from "vitest";
import { localRedirect } from "../local-redirect";

/** Lo que hace el navegador con un `Location`: lo resuelve contra la URL abierta. */
const enElNavegador = (location: string | null, abierta: string) => new URL(location ?? "", abierta).href;

describe("localRedirect", () => {
  it("responde 307 por defecto, sin cuerpo y con el Location tal cual, sin host", async () => {
    const res = localRedirect("/entrar?error=enlace");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("/entrar?error=enlace");
    expect(await res.text()).toBe("");
  });

  it("respeta el 303 de la baja", () => {
    expect(localRedirect("/email/baja?estado=invalido", 303).status).toBe(303);
  });

  it("el navegador se queda en el dominio con el que llegó, sea cual sea", () => {
    const location = localRedirect("/portal").headers.get("location");
    expect(enElNavegador(location, "https://dtdcargo.test/portal/callback?code=x")).toBe("https://dtdcargo.test/portal");
    expect(enElNavegador(location, "https://prueba.dtdcargo.test/portal/callback")).toBe("https://prueba.dtdcargo.test/portal");
    expect(enElNavegador(location, "http://localhost:3000/portal/callback")).toBe("http://localhost:3000/portal");
  });

  it.each([
    ["una URL absoluta", "https://otro.test/portal"],
    ["la de la petición en el contenedor", "https://0.0.0.0:3000/portal"],
    ["sin barra inicial", "portal"],
    ["vacía", ""],
    ["de protocolo relativo", "//otro.test"],
    ["con barra invertida, que el navegador lee como //", "/\\otro.test"],
    ["con un tab, que el navegador quita antes de resolver", "/\t/otro.test"],
    ["con un salto de línea", "/\n/otro.test"],
  ])("rechaza %s", (_nombre, destino) => {
    expect(() => localRedirect(destino)).toThrow("ruta propia");
  });
});
