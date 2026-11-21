// @vitest-environment node
/**
 * SDD-0701 (hijo de SDD-0626) · Un enlace del CLIENTE escala. Hallazgo de la conversación 6 de la etapa 1: el
 * cliente mandó un enlace y salió una respuesta normal, porque la regla `enlace` solo mira el texto del agente.
 */
import { describe, expect, it } from "vitest";

import { GUIONES_SOPORTE } from "../guiones-soporte";
import { clienteMandoEnlace, tieneEnlace } from "../tema-enlace";

const cliente = (texto: string) => [{ rol: "cliente" as const, texto }];

describe("tema-enlace · ¿el cliente mandó un enlace?", () => {
  it.each([
    "Mi pago está aquí https://pagos-dtd.example/comprobante",
    "Entra a http://192.168.0.10/login",
    "HTTPS://BIT.LY/ABC",
    "Mira www.algo-raro.net",
    "Te mandé el archivo por ftp://archivos.example.org/f.zip",
  ])("con esquema o www: «%s» es enlace", (texto) => {
    expect(clienteMandoEnlace(cliente(texto))).toBe(true);
  });

  it.each([
    "Revisa bit.ly/abc123",
    "Mi guía: rastreo-envios.xyz/123",
    "Escríbeme por t.me/alguien",
    "seguimiento.com.ve",
    "Ya lo subí a drive.google.com/file/d/1",
    "(ver paquetes-miami.shop)",
  ])("sin esquema, con un TLD de la lista: «%s» es enlace", (texto) => {
    expect(clienteMandoEnlace(cliente(texto))).toBe(true);
  });

  it.each([
    "youtu.be/abc",
    "amzn.to/x",
    "linktr.ee/tienda",
    "rb.gy/x",
    "shorturl.at/x",
    "s.id/x",
    "bit.do/x",
    "instagr.am/p/x",
    "algo.es/x",
    "BIT.LY/ABC",
    "Mi pedido: Tienda.Com/pedido/9",
  ])("sin esquema y con ruta, cualquier TLD de letras: «%s» es enlace (revisión M1)", (texto) => {
    expect(tieneEnlace(texto)).toBe(true);
  });

  it.each(["premio.ml", "pagos.ga", "cuenta.cf", "banco.gq", "seguro.ml/login", "PAGOS.COM", "linktr.ee"])(
    "TLD gratuitos de phishing y otros de la lista, sin ruta: «%s» es enlace (revisión M1)",
    (texto) => {
      expect(tieneEnlace(texto)).toBe(true);
    },
  );

  it.each(["Gracias.Me avisas", "Ok.Ve a la oficina", "Hola.Com permiso", "Dpto.Info", "Listo.Gracias"])(
    "un punto sin espacio antes de una palabra con mayúscula: «%s» no es enlace (revisión B1)",
    (texto) => {
      expect(tieneEnlace(texto)).toBe(false);
    },
  );

  it("«hxxp://» y otros esquemas sí cuentan", () => {
    expect(tieneEnlace("hxxp://estafa.example/x")).toBe(true);
    expect(tieneEnlace("abre hxxps://pago.example")).toBe(true);
  });

  it.each([
    "Mira dtdcargo.com/rastreo",
    "https://dtdcargo.com/portal",
    "dtdcargo.com.otro.io",
  ])("un dominio propio también cuenta (no se juzga si es nuestro): «%s»", (texto) => {
    expect(tieneEnlace(texto)).toBe(true);
  });

  it.each([
    "Hola, quiero saber cómo enviar una caja desde Miami",
    "ok.gracias",
    "Llegó.Mañana paso a buscarla",
    "Pesa 1.500 kg y mide 0.5 m",
    "Gracias...nos vemos",
    "Voy.pa la oficina",
    "Lo necesito.Es urgente",
    "Escribo desde DTD Cargo",
    "mi correo es ana@gmail.com",
    "S.A. y C.A. son sociedades",
  ])("un punto que no es URL: «%s» no es enlace", (texto) => {
    expect(clienteMandoEnlace(cliente(texto))).toBe(false);
  });

  it("solo mira al cliente: un enlace del agente lo revisa `eval-automatico` (regla `enlace`)", () => {
    expect(clienteMandoEnlace([{ rol: "agente", texto: "Ve a https://otro.example" }])).toBe(false);
    expect(clienteMandoEnlace([{ rol: "agente", texto: "hola" }, { rol: "cliente", texto: "bit.ly/x" }])).toBe(true);
  });

  it("los guiones de la etapa 1 no traen enlaces (si el cliente los copia, no escala)", () => {
    for (const g of GUIONES_SOPORTE) expect(tieneEnlace(g.texto)).toBe(false);
  });
});
