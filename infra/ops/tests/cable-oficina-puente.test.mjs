// @vitest-environment node
/**
 * SDD-0626 Paso 2b · puente interno de prueba: infra/ops/cable-oficina/puente-prueba.mjs.
 *
 * Lo que tiene que cumplir y se prueba acá contra el código REAL del ERP (no contra una copia):
 *   - la firma que pone el puente la acepta `verificarFirmaChatwoot` (la del webhook del cable);
 *   - el cuerpo lo interpreta `interpretarEvento` como un message_created entrante de la cuenta 2 y
 *     la bandeja 11, y `procesarWebhookOficina` lo guarda con su referencia y su prioridad;
 *   - el cuerpo NO lleva el texto del mensaje ni datos del contacto, y el log tampoco;
 *   - a Chatwoot solo se le piden GET;
 *   - fuera de prueba, con otra cuenta, otra bandeja, otro destino, otro puerto u otro Chatwoot, no arranca;
 *   - ni el token ni el secreto salen en el log.
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BANDEJA,
  CUENTA,
  ConfigInvalida,
  cuerpoMessageCreated,
  esNuevoEntrante,
  firmar,
  guardarCursor,
  leerConfig,
  leerCursor,
  vuelta,
} from "../cable-oficina/puente-prueba.mjs";
import { interpretarEvento } from "../../../lib/studio/chatwoot/webhook-events";
import { verificarFirmaChatwoot } from "../../../lib/studio/chatwoot/webhook-signature";
import { configWebhookOficina } from "../../../lib/studio/oficina/config";
import { procesarWebhookOficina } from "../../../lib/studio/oficina/webhook-chatwoot";

const SECRETO = "secreto-de-mentira-0123456789abcdef0123456789";
const TOKEN = "token-de-mentira-0123456789";
const TEXTO = "Hola, quiero saber de mi envío (texto inventado)";
const BASE_ENV = { PUENTE_ENTORNO: "prueba", CHATWOOT_API_TOKEN: TOKEN, OFICINA_WEBHOOK_SECRET: SECRETO };

const CONV = {
  id: 7,
  account_id: 2,
  inbox_id: 11,
  status: "open",
  unread_count: 1,
  labels: ["factura"],
  last_activity_at: 1763250000,
  meta: { sender: { name: "Persona Inventada", phone_number: "+58 412 0000000" }, assignee: null },
};
const mensaje = (id, extra = {}) => ({
  id,
  inbox_id: 11,
  conversation_id: 7,
  message_type: 0,
  private: false,
  content: TEXTO,
  created_at: 1763250000,
  sender: { name: "Persona Inventada", email: "persona@ejemplo.invalid" },
  ...extra,
});

describe("leerConfig: solo prueba", () => {
  it("acepta la configuración de prueba con los valores por defecto", () => {
    const c = leerConfig(BASE_ENV);
    expect(c.erp).toBe("http://dtd-cargo-staging-web-1:3000/api/oficina/webhook-chatwoot");
    expect(c.chatwoot).toBe("http://rails:3000");
    expect(c.cursor).toBe("/estado/cursor");
  });
  it.each([
    [{ PUENTE_ENTORNO: "" }, /PUENTE_ENTORNO/],
    [{ PUENTE_ENTORNO: "produccion" }, /PUENTE_ENTORNO/],
    [{ PUENTE_CUENTA: "1" }, /PUENTE_CUENTA/],
    [{ PUENTE_BANDEJA: "2" }, /PUENTE_BANDEJA/],
    [{ CHATWOOT_API_TOKEN: "" }, /CHATWOOT_API_TOKEN/],
    [{ OFICINA_WEBHOOK_SECRET: "corto" }, /OFICINA_WEBHOOK_SECRET/],
    [{ PUENTE_ERP_URL: "https://dtdcargo.com/api/oficina/webhook-chatwoot" }, /web de prueba/],
    [{ PUENTE_ERP_URL: "http://dtd-cargo-web-1:3000/api/oficina/webhook-chatwoot" }, /web de prueba/],
    [{ PUENTE_ERP_URL: "http://dtd-cargo-staging-web-1:3000/api/chatwoot/webhook" }, /web de prueba/],
    [{ PUENTE_ERP_URL: "http://web:3000/api/oficina/webhook-chatwoot" }, /web de prueba/],
    [{ PUENTE_ERP_URL: "http://dtd-cargo-staging-web-1:8080/api/oficina/webhook-chatwoot" }, /web de prueba/],
    [{ PUENTE_ERP_URL: "http://dtd-cargo-staging-web-1/api/oficina/webhook-chatwoot" }, /web de prueba/],
    [{ PUENTE_ERP_URL: "http://dtd-cargo-staging-web-1:3000/api/oficina/webhook-chatwoot?x=1" }, /web de prueba/],
    [{ CHATWOOT_API_URL: "http://chatwoot.dtdcargo.com:3000" }, /rails de Chatwoot/],
    [{ CHATWOOT_API_URL: "https://rails:3000" }, /rails de Chatwoot/],
    [{ CHATWOOT_API_URL: "http://rails:8080" }, /rails de Chatwoot/],
    [{ CHATWOOT_API_URL: "http://rails:3000/otra" }, /rails de Chatwoot/],
    [{ CHATWOOT_API_URL: "http://dtd-cargo-staging-web-1:3000" }, /rails de Chatwoot/],
    [{ PUENTE_ERP_URL: "https://prueba.dtdcargo.com/api/oficina/webhook-chatwoot" }, /web de prueba/],
    [{ PUENTE_INTERVALO_MS: "10" }, /INTERVALO/],
  ])("rechaza %o", (cambio, error) => {
    expect(() => leerConfig({ ...BASE_ENV, ...cambio })).toThrow(ConfigInvalida);
    expect(() => leerConfig({ ...BASE_ENV, ...cambio })).toThrow(error);
  });
  it("la cuenta y la bandeja están fijas en 2 y 11", () => {
    expect([CUENTA, BANDEJA]).toEqual([2, 11]);
  });
});

describe("el formato y la firma los acepta el ERP real", () => {
  const cuerpo = JSON.stringify(cuerpoMessageCreated(CONV, mensaje(41)));

  it("sin texto ni datos del contacto", () => {
    expect(cuerpo).not.toContain(TEXTO);
    expect(cuerpo).not.toContain("Persona Inventada");
    expect(cuerpo).not.toContain("0000000");
    expect(cuerpo).not.toContain("ejemplo.invalid");
    expect(cuerpo).not.toMatch(/"content"|"sender"|"contact"/);
  });

  it("verificarFirmaChatwoot acepta la firma", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    expect(verificarFirmaChatwoot({ cuerpo, timestamp: ts, firma: firmar(SECRETO, ts, cuerpo), secreto: SECRETO })).toBe("ok");
    expect(verificarFirmaChatwoot({ cuerpo, timestamp: ts, firma: firmar("otro", ts, cuerpo), secreto: SECRETO })).toBe("invalida");
  });

  it("interpretarEvento lo lee como message_created entrante de la cuenta 2 y la bandeja 11", () => {
    const e = interpretarEvento(JSON.parse(cuerpo));
    expect(e).toMatchObject({ evento: "message_created", accountId: 2, mensajeId: 41, avisar: true });
    expect(e.conversacion).toMatchObject({ id: 7, inboxId: 11, etiquetas: ["factura"], telefonoUltimos10: null });
  });

  it("procesarWebhookOficina lo guarda con su referencia y prioridad dinero (3)", async () => {
    const filas = [];
    const ts = String(Math.floor(Date.now() / 1000));
    const req = new Request("http://web:3000/api/oficina/webhook-chatwoot", {
      method: "POST",
      headers: { "x-chatwoot-timestamp": ts, "x-chatwoot-signature": firmar(SECRETO, ts, cuerpo) },
      body: cuerpo,
    });
    const config = configWebhookOficina({
      OFICINA_WEBHOOK_ACTIVO: "1",
      OFICINA_WEBHOOK_SECRET: SECRETO,
      OFICINA_CHATWOOT_INBOX_PRUEBA: "11",
      CHATWOOT_ACCOUNT_ID: "2",
      CHATWOOT_INBOX_PORTAL_ID: "9",
      CHATWOOT_INBOX_CLIENTES_ID: "7",
      CHATWOOT_INBOX_LEADS_ID: "6",
    });
    const r = await procesarWebhookOficina(req, {
      config,
      crearAlmacen: () => ({ guardar: async (f) => (filas.push(f), "guardado") }),
      registrar: () => {},
    });
    expect(r).toEqual({ status: 200, cuerpo: { ok: true, resultado: "guardado" } });
    expect(filas).toEqual([
      {
        tipo: "chatwoot.message_created",
        origen: "chatwoot",
        clave_dedupe: "chatwoot:conv:7:msg:41",
        prioridad: 3,
        payload_ref: "chatwoot:conversations/7/messages/41",
      },
    ]);
  });
});

describe("qué mensajes entrega", () => {
  it("solo entrantes, no privados, de la bandeja 11 y más nuevos que el cursor", () => {
    expect(esNuevoEntrante(mensaje(41), 40)).toBe(true);
    expect(esNuevoEntrante(mensaje(40), 40)).toBe(false);
    expect(esNuevoEntrante(mensaje(42, { message_type: 1 }), 0)).toBe(false);
    expect(esNuevoEntrante(mensaje(43, { message_type: 2 }), 0)).toBe(false);
    expect(esNuevoEntrante(mensaje(44, { private: true }), 0)).toBe(false);
    expect(esNuevoEntrante(mensaje(45, { inbox_id: 6 }), 0)).toBe(false);
  });
});

describe("una vuelta contra un Chatwoot y un ERP de mentira", () => {
  const abiertos = [];
  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(abiertos.splice(0).map((s) => new Promise((r) => s.close(() => r()))));
  });
  const escuchar = (s) =>
    new Promise((r) => {
      abiertos.push(s);
      s.listen(0, "127.0.0.1", () => r(`http://127.0.0.1:${s.address().port}`));
    });

  async function montar(statusErp = 200) {
    const metodos = [];
    const chatwoot = createServer((req, res) => {
      metodos.push(`${req.method} ${req.url}`);
      if (req.headers.api_access_token !== TOKEN) return res.writeHead(401).end();
      res.setHeader("Content-Type", "application/json");
      if (req.url.startsWith("/api/v1/accounts/2/conversations?")) {
        return res.end(JSON.stringify({ data: { payload: [CONV, { ...CONV, id: 8, inbox_id: 6 }] } }));
      }
      if (req.url === "/api/v1/accounts/2/conversations/7/messages") {
        return res.end(
          JSON.stringify({
            payload: [mensaje(39), mensaje(40, { message_type: 1 }), mensaje(41), mensaje(42, { private: true }), mensaje(43)],
          }),
        );
      }
      res.writeHead(404).end();
    });
    const recibidos = [];
    const erp = createServer((req, res) => {
      let b = "";
      req.on("data", (c) => (b += c));
      req.on("end", () => {
        recibidos.push({
          cuerpo: b,
          firma: verificarFirmaChatwoot({
            cuerpo: b,
            timestamp: req.headers["x-chatwoot-timestamp"],
            firma: req.headers["x-chatwoot-signature"],
            secreto: SECRETO,
          }),
        });
        res.writeHead(statusErp, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true, resultado: "guardado" }));
      });
    });
    const cfg = { token: TOKEN, secreto: SECRETO, chatwoot: await escuchar(chatwoot), erp: `${await escuchar(erp)}/api/oficina/webhook-chatwoot` };
    return { cfg, metodos, recibidos };
  }

  it("entrega 41 y 43 en orden, firmados, sin texto; avanza el cursor; a Chatwoot solo GET", async () => {
    const log = [];
    vi.spyOn(process.stdout, "write").mockImplementation((s) => (log.push(String(s)), true));
    const { cfg, metodos, recibidos } = await montar();
    const r = await vuelta(cfg, 40);
    expect(r).toMatchObject({ cursor: 43, entregados: 2, conversaciones: 1 });
    expect(recibidos.map((x) => [JSON.parse(x.cuerpo).id, x.firma])).toEqual([[41, "ok"], [43, "ok"]]);
    expect(recibidos.every((x) => !x.cuerpo.includes(TEXTO))).toBe(true);
    expect(metodos.every((m) => m.startsWith("GET "))).toBe(true);
    expect(metodos.some((m) => m.includes("/conversations/8/"))).toBe(false);
    expect(log.join("")).not.toContain(TEXTO);
    expect(log.join("")).not.toContain("Persona");
    expect(log.join("")).toMatch(/entrega conv=7 msg=41 → 200 guardado/);
  });

  it("ni el token ni el secreto salen en el log (entrega, 4xx y errores)", async () => {
    const log = [];
    vi.spyOn(process.stdout, "write").mockImplementation((s) => (log.push(String(s)), true));
    vi.spyOn(process.stderr, "write").mockImplementation((s) => (log.push(String(s)), true));
    const ok = await montar();
    await vuelta(ok.cfg, 40);
    const con4xx = await montar(401);
    await vuelta(con4xx.cfg, 40);
    await vuelta({ ...ok.cfg, token: `${TOKEN}-malo` }, 40).catch((e) => log.push(String(e?.message)));
    const todo = log.join("");
    expect(todo).not.toContain(TOKEN);
    expect(todo).not.toContain(SECRETO);
  });

  it("con 5xx del ERP no avanza el cursor (se reintenta)", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const { cfg } = await montar(503);
    const r = await vuelta(cfg, 40);
    expect(r.cursor).toBe(40);
  });

  it("el cursor en disco es solo un número", () => {
    const ruta = join(mkdtempSync(join(tmpdir(), "puente-")), "cursor");
    expect(leerCursor(ruta)).toBeNull();
    guardarCursor(ruta, 43);
    expect(readFileSync(ruta, "utf8")).toBe("43\n");
    expect(leerCursor(ruta)).toBe(43);
  });
});
