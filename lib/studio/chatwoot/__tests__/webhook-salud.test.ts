// @vitest-environment node
/**
 * SDD-0586 (10.5, PR 1b) · la salud del webhook de cuenta (el riesgo del webhook).
 *
 * Chatwoot 4.19.1 no entrega a un host sin IP pública y no reintenta los webhooks de cuenta. Sin
 * el webhook, la vuelta del portal se queda muda: la salud lo tiene que ver. La lista de IP
 * privadas sigue la de la gema `ssrf_filter` que usa Chatwoot.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const red = vi.hoisted(() => ({ obtenerTokenAgente: vi.fn(), listarWebhooksCuenta: vi.fn() }));
vi.mock("../platform-api", () => ({ obtenerTokenAgente: red.obtenerTokenAgente }));
vi.mock("../router-api", () => ({ listarWebhooksCuenta: red.listarWebhooksCuenta }));

import type { SaludBandeja } from "../agentes-salud";
import type { WebhookCuenta } from "../router-api";
import { esIpPublica, evaluarWebhooks, revisarWebhookCuenta, sumarAlertasWebhook, type Resolver } from "../webhook-salud";

const CFG = { origin: "https://chat.ejemplo.test", token: "tok-plataforma", accountId: 1 };
const URL_STUDIO = "https://studio.ejemplo.test/api/chatwoot/webhook";
const publico: Resolver = async () => ["93.184.216.34"];
const privado: Resolver = async () => ["10.0.0.5", "fd00::1"];
const nada: Resolver = async () => [];
const w = (extra: Partial<WebhookCuenta> = {}): WebhookCuenta => ({ url: URL_STUDIO, eventos: ["message_created"], deBandeja: false, ...extra });

afterEach(() => vi.clearAllMocks());

describe("esIpPublica", () => {
  it.each([
    "93.184.216.34", "8.8.8.8", "172.32.0.1", "100.128.0.1", "192.169.0.1", "2606:4700::6810:84e5", "2a00:1450:4001:82a::200e",
    "::ffff:93.184.216.34",
  ])("%s es pública", (ip) => expect(esIpPublica(ip)).toBe(true));

  it.each([
    "10.1.2.3", "127.0.0.1", "0.0.0.0", "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.168.1.1", "100.64.0.1",
    "192.0.2.10", "198.18.0.1", "198.51.100.7", "203.0.113.9", "224.0.0.1", "240.0.0.1", "255.255.255.255",
    "::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "2001:db8::1", "::ffff:10.0.0.1", "::ffff:127.0.0.1",
    "64:ff9b::a00:1", "100::1", "2002:c000:0204::1", "no-es-ip", "1.2.3", "300.1.1.1",
  ])("%s no es pública", (ip) => expect(esIpPublica(ip)).toBe(false));
});

describe("evaluarWebhooks", () => {
  it("el de Studio con message_created y host público: sin alertas", async () => {
    expect(await evaluarWebhooks([w()], publico)).toEqual([]);
    // La barra final también vale.
    expect(await evaluarWebhooks([w({ url: `${URL_STUDIO}/` })], publico)).toEqual([]);
  });

  it("sin webhooks, con uno a otra ruta o solo de bandeja: falta", async () => {
    expect(await evaluarWebhooks([], publico)).toEqual(["webhook_falta"]);
    expect(await evaluarWebhooks([w({ url: "https://studio.ejemplo.test/api/otro" })], publico)).toEqual(["webhook_falta"]);
    expect(await evaluarWebhooks([w({ deBandeja: true })], publico)).toEqual(["webhook_falta"]);
    expect(await evaluarWebhooks([w({ url: "no es url" })], publico)).toEqual(["webhook_falta"]);
  });

  it("sin message_created: no le llegan los mensajes", async () => {
    expect(await evaluarWebhooks([w({ eventos: ["conversation_status_changed"] })], publico)).toEqual(["webhook_sin_mensajes"]);
  });

  it("un host privado o que no resuelve: sin IP pública (Chatwoot no le entrega)", async () => {
    expect(await evaluarWebhooks([w()], privado)).toEqual(["webhook_sin_ip_publica"]);
    expect(await evaluarWebhooks([w()], nada)).toEqual(["webhook_sin_ip_publica"]);
  });

  it("basta una IP pública entre las del host, y basta uno de los webhooks de Studio", async () => {
    expect(await evaluarWebhooks([w()], async () => ["10.0.0.1", "93.184.216.34"])).toEqual([]);
    const porHost: Resolver = async (h) => (h === "bueno.ejemplo.test" ? ["93.184.216.34"] : ["10.0.0.1"]);
    expect(
      await evaluarWebhooks([w({ url: "http://receptor:8080/api/chatwoot/webhook" }), w({ url: "https://bueno.ejemplo.test/api/chatwoot/webhook" })], porHost),
    ).toEqual([]);
  });

  it("una IP literal entre corchetes se mira como tal", async () => {
    const eco: Resolver = async (h) => [h];
    expect(await evaluarWebhooks([w({ url: "http://[::1]:3000/api/chatwoot/webhook" })], eco)).toEqual(["webhook_sin_ip_publica"]);
    expect(await evaluarWebhooks([w({ url: "http://127.0.0.1:3000/api/chatwoot/webhook" })], eco)).toEqual(["webhook_sin_ip_publica"]);
  });
});

describe("revisarWebhookCuenta", () => {
  it("lee los webhooks con el token del usuario de servicio", async () => {
    red.obtenerTokenAgente.mockResolvedValue({ ok: true, data: "tok-servicio" });
    red.listarWebhooksCuenta.mockResolvedValue({ ok: true, data: [w()] });
    expect(await revisarWebhookCuenta(CFG, 2, publico)).toEqual([]);
    expect(red.obtenerTokenAgente).toHaveBeenCalledWith(2, CFG);
    expect(red.listarWebhooksCuenta).toHaveBeenCalledWith({ origin: CFG.origin, accountId: 1, token: "tok-servicio" });
  });

  it("sin usuario de servicio, sin su token o sin la lista: no medido (y avisa)", async () => {
    expect(await revisarWebhookCuenta(CFG, null, publico)).toEqual(["webhook_no_medido"]);
    red.obtenerTokenAgente.mockResolvedValueOnce({ ok: false, error: "no_autorizado" });
    expect(await revisarWebhookCuenta(CFG, 2, publico)).toEqual(["webhook_no_medido"]);
    red.obtenerTokenAgente.mockResolvedValueOnce({ ok: true, data: "tok-servicio" });
    red.listarWebhooksCuenta.mockResolvedValueOnce({ ok: false, error: "red" });
    expect(await revisarWebhookCuenta(CFG, 2, publico)).toEqual(["webhook_no_medido"]);
    red.obtenerTokenAgente.mockRejectedValueOnce(new Error("boom"));
    expect(await revisarWebhookCuenta(CFG, 2, publico)).toEqual(["webhook_no_medido"]);
  });
});

describe("sumarAlertasWebhook", () => {
  const salud = (alertas: SaludBandeja["alertas"]): SaludBandeja => ({ alertas: [...alertas], adminsHumanos: 1, vinculosFueraDeCuenta: [] });

  it("suma sin repetir", () => {
    const s = salud(["sin_admin_humano"]);
    sumarAlertasWebhook(s, ["webhook_falta", "webhook_falta"]);
    expect(s.alertas).toEqual(["sin_admin_humano", "webhook_falta"]);
  });

  it("si Chatwoot no responde, «no medido» es la misma causa y no se repite", () => {
    const s = salud(["chatwoot_no_responde"]);
    sumarAlertasWebhook(s, ["webhook_no_medido"]);
    expect(s.alertas).toEqual(["chatwoot_no_responde"]);
    const t = salud([]);
    sumarAlertasWebhook(t, ["webhook_no_medido"]);
    expect(t.alertas).toEqual(["webhook_no_medido"]);
  });
});
