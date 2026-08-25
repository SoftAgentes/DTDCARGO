/**
 * SDD-0043 Alcance B · tests del parser de webhook de Kommo.
 *
 * Cubre los criterios de aceptación del Alcance B:
 *  - los 4 actions de lead (add/update/status/delete)
 *  - add/update de contact
 *  - multi-entidad en un solo payload
 *  - dedup por (entity,id) con la acción más fuerte (delete>status>update>add)
 *  - subdomain + accountId de account[...]
 *  - basura / ruido se ignora sin romper
 */

import { describe, it, expect } from "vitest";
import {
  formaDelCuerpo,
  parseKommoMessages,
  parseKommoWebhookPayload,
  valoresEnumerados,
} from "../kommo-webhook-parse";

describe("parseKommoWebhookPayload — actions de lead", () => {
  it("parsea lead[add]", () => {
    const r = parseKommoWebhookPayload("leads[add][0][id]=123");
    expect(r.events).toEqual([{ entity: "lead", action: "add", id: 123 }]);
  });

  it("parsea lead[update]", () => {
    const r = parseKommoWebhookPayload("leads[update][0][id]=124");
    expect(r.events).toEqual([{ entity: "lead", action: "update", id: 124 }]);
  });

  it("parsea lead[status]", () => {
    const r = parseKommoWebhookPayload("leads[status][0][id]=125");
    expect(r.events).toEqual([{ entity: "lead", action: "status", id: 125 }]);
  });

  it("parsea lead[delete]", () => {
    const r = parseKommoWebhookPayload("leads[delete][0][id]=126");
    expect(r.events).toEqual([{ entity: "lead", action: "delete", id: 126 }]);
  });
});

describe("parseKommoWebhookPayload — actions de contact", () => {
  it("parsea contact[add]", () => {
    const r = parseKommoWebhookPayload("contacts[add][0][id]=900");
    expect(r.events).toEqual([{ entity: "contact", action: "add", id: 900 }]);
  });

  it("parsea contact[update]", () => {
    const r = parseKommoWebhookPayload("contacts[update][0][id]=901");
    expect(r.events).toEqual([{ entity: "contact", action: "update", id: 901 }]);
  });
});

describe("parseKommoWebhookPayload — multi-entidad", () => {
  it("parsea leads y contacts en un solo payload", () => {
    const body =
      "leads[add][0][id]=1&leads[update][1][id]=2&contacts[add][0][id]=10&contacts[update][1][id]=11";
    const r = parseKommoWebhookPayload(body);
    expect(r.events).toHaveLength(4);
    expect(r.events).toEqual(
      expect.arrayContaining([
        { entity: "lead", action: "add", id: 1 },
        { entity: "lead", action: "update", id: 2 },
        { entity: "contact", action: "add", id: 10 },
        { entity: "contact", action: "update", id: 11 },
      ]),
    );
  });

  it("varios ids del mismo action y entidad (índices distintos)", () => {
    const body = "leads[add][0][id]=1&leads[add][1][id]=2&leads[add][2][id]=3";
    const r = parseKommoWebhookPayload(body);
    expect(r.events).toHaveLength(3);
    expect(r.events.map((e) => e.id).sort()).toEqual([1, 2, 3]);
  });
});

describe("parseKommoWebhookPayload — dedup por acción más fuerte", () => {
  it("delete gana a add/update/status para el mismo id", () => {
    const body =
      "leads[add][0][id]=5&leads[update][1][id]=5&leads[status][2][id]=5&leads[delete][3][id]=5";
    const r = parseKommoWebhookPayload(body);
    expect(r.events).toEqual([{ entity: "lead", action: "delete", id: 5 }]);
  });

  it("status gana a update y add", () => {
    const body = "leads[add][0][id]=7&leads[status][1][id]=7&leads[update][2][id]=7";
    const r = parseKommoWebhookPayload(body);
    expect(r.events).toEqual([{ entity: "lead", action: "status", id: 7 }]);
  });

  it("update gana a add", () => {
    const body = "leads[add][0][id]=8&leads[update][1][id]=8";
    const r = parseKommoWebhookPayload(body);
    expect(r.events).toEqual([{ entity: "lead", action: "update", id: 8 }]);
  });

  it("mismo id en lead y contact NO se deduplican entre sí", () => {
    const body = "leads[add][0][id]=9&contacts[delete][0][id]=9";
    const r = parseKommoWebhookPayload(body);
    expect(r.events).toHaveLength(2);
    expect(r.events).toEqual(
      expect.arrayContaining([
        { entity: "lead", action: "add", id: 9 },
        { entity: "contact", action: "delete", id: 9 },
      ]),
    );
  });
});

describe("parseKommoWebhookPayload — account", () => {
  it("extrae subdomain y accountId", () => {
    const body =
      "leads[add][0][id]=1&account[subdomain]=doortudoor&account[id]=31234567";
    const r = parseKommoWebhookPayload(body);
    expect(r.subdomain).toBe("doortudoor");
    expect(r.accountId).toBe(31234567);
  });

  it("subdomain vacío → null", () => {
    const r = parseKommoWebhookPayload("account[subdomain]=&leads[add][0][id]=1");
    expect(r.subdomain).toBeNull();
  });

  it("sin account → subdomain/accountId null", () => {
    const r = parseKommoWebhookPayload("leads[add][0][id]=1");
    expect(r.subdomain).toBeNull();
    expect(r.accountId).toBeNull();
  });

  it("acepta URLSearchParams además de string", () => {
    const p = new URLSearchParams();
    p.append("contacts[add][0][id]", "42");
    p.append("account[subdomain]", "doortudoor");
    const r = parseKommoWebhookPayload(p);
    expect(r.events).toEqual([{ entity: "contact", action: "add", id: 42 }]);
    expect(r.subdomain).toBe("doortudoor");
  });
});

describe("parseKommoWebhookPayload — robustez ante basura", () => {
  it("payload vacío → sin eventos", () => {
    const r = parseKommoWebhookPayload("");
    expect(r.events).toEqual([]);
    expect(r.subdomain).toBeNull();
  });

  it("claves no reconocidas se ignoran", () => {
    const body =
      "leads[add][0][id]=1&foo=bar&leads[add][0][name]=Pepe&random[stuff][0][id]=99&events[0][type]=ping";
    const r = parseKommoWebhookPayload(body);
    expect(r.events).toEqual([{ entity: "lead", action: "add", id: 1 }]);
  });

  it("action desconocido (merge) se ignora", () => {
    const r = parseKommoWebhookPayload("leads[merge][0][id]=1&leads[add][1][id]=2");
    expect(r.events).toEqual([{ entity: "lead", action: "add", id: 2 }]);
  });

  it("id no numérico / negativo / cero se ignora", () => {
    const body =
      "leads[add][0][id]=abc&leads[add][1][id]=-5&leads[add][2][id]=0&leads[add][3][id]=77";
    const r = parseKommoWebhookPayload(body);
    expect(r.events).toEqual([{ entity: "lead", action: "add", id: 77 }]);
  });

  it("solo ruido → sin eventos pero no lanza", () => {
    const r = parseKommoWebhookPayload("a=1&b=2&c[d]=3");
    expect(r.events).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SDD-0288 rebanada 0 · `formaDelCuerpo` — medir sin filtrar PII.
// ─────────────────────────────────────────────────────────────────────────────
describe("formaDelCuerpo", () => {
  it("normaliza los índices para que N mensajes no den N patrones", () => {
    const body =
      "message[add][0][id]=1&message[add][1][id]=2&message[add][2][id]=3";
    expect(formaDelCuerpo(body)).toEqual(["message[add][N][id]"]);
  });

  it("🔴 NO devuelve ni un solo VALOR — el body lleva el texto y el teléfono", () => {
    // Éste es el contrato que hace que loguear esto sea aceptable. Si algún día
    // alguien "mejora" la función devolviendo pares clave=valor, el texto de las
    // conversaciones de los clientes termina en los logs de una edge function.
    const body =
      "message[add][N][text]=Hola%20quiero%20cotizar&message[add][N][author][name]=Mar%C3%ADa" +
      "&message[add][N][phone]=584121668021";
    const forma = formaDelCuerpo(body);
    const serializado = JSON.stringify(forma);

    for (const valor of ["Hola", "cotizar", "María", "584121668021"]) {
      expect(serializado).not.toContain(valor);
    }
    expect(forma).toEqual([
      "message[add][N][author][name]",
      "message[add][N][phone]",
      "message[add][N][text]",
    ]);
  });

  it("acota la salida: un body enorme no puede inundar el log", () => {
    const body = Array.from({ length: 500 }, (_, i) => `campo${i}=x`).join("&");
    expect(formaDelCuerpo(body, 10)).toHaveLength(10);
  });

  it("devuelve vacío para un body vacío (no se loguea nada)", () => {
    expect(formaDelCuerpo("")).toEqual([]);
  });

  it("también describe lo que YA sabemos leer, sin inventarlo", () => {
    expect(formaDelCuerpo("leads[status][0][id]=42&account[subdomain]=dtdcargo"))
      .toEqual(["account[subdomain]", "leads[status][N][id]"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SDD-0288 rebanada 0b · `valoresEnumerados` — medir los enums SIN filtrar PII.
// ─────────────────────────────────────────────────────────────────────────────
describe("valoresEnumerados", () => {
  /** Cuerpo realista, con la forma medida en produccion el 2026-08-24/25. */
  const CUERPO_REAL = [
    "account[subdomain]=dtdcargo",
    "message[add][0][id]=abc123",
    "message[add][0][type]=incoming",
    "message[add][0][message_type]=text",
    "message[add][0][origin]=whatsapp",
    "message[add][0][entity_type]=lead",
    "message[add][0][entity_id]=23325167",
    "message[add][0][author][type]=contact",
    "message[add][0][author][id]=99001",
    "message[add][0][author][name]=Mar%C3%ADa%20Rodr%C3%ADguez",
    "message[add][0][text]=Hola%20quiero%20cotizar%20un%20contenedor",
    "message[add][0][contact_id]=584121668021",
  ].join("&");

  it("lee los enumerados que deciden el semáforo", () => {
    const v = valoresEnumerados(CUERPO_REAL);
    expect(v["message[add][N][type]"]).toBe("incoming");
    expect(v["message[add][N][author][type]"]).toBe("contact");
    expect(v["message[add][N][origin]"]).toBe("whatsapp");
    expect(v["message[add][N][message_type]"]).toBe("text");
  });

  it("🔴 NO publica el texto, ni el nombre, ni el teléfono, ni los ids", () => {
    // El contrato que hace aceptable loguear esto. Si alguien "mejora" la
    // funcion pasando de lista blanca a lista negra, esto se pone rojo.
    const serializado = JSON.stringify(valoresEnumerados(CUERPO_REAL));
    for (const secreto of [
      "Hola", "cotizar", "contenedor",   // el texto del cliente
      "María", "Rodríguez",              // su nombre
      "584121668021",                    // su telefono
      "99001", "abc123", "23325167",     // ids
    ]) {
      expect(serializado).not.toContain(secreto);
    }
  });

  it("🔴 una clave NUEVA de Kommo no se publica por omisión", () => {
    // La diferencia entre lista blanca y lista negra, hecha contrato: el dia
    // que Kommo agregue un campo, NO debe salir en el log sin que alguien lo
    // agregue a mano a CLAVES_ENUM.
    const v = valoresEnumerados(
      "message[add][0][campo_nuevo_de_kommo]=dato-sensible-desconocido",
    );
    expect(v).toEqual({});
  });

  it("lee is_read / is_in_work de la conversación, en add y en update", () => {
    const v = valoresEnumerados(
      "talk[add][0][is_read]=0&talk[add][0][is_in_work]=1&talk[add][0][origin]=instagram",
    );
    expect(v["talk[add][N][is_read]"]).toBe("0");
    expect(v["talk[add][N][is_in_work]"]).toBe("1");
    expect(v["talk[add][N][origin]"]).toBe("instagram");

    const u = valoresEnumerados("talk[update][0][is_read]=1");
    expect(u["talk[update][N][is_read]"]).toBe("1");
  });

  it("recorta un valor largo en vez de volcarlo entero", () => {
    // Un enumerado es corto. Si algo llega largo es que la clave no era lo que
    // creiamos — se recorta y se nota, en vez de derramar el contenido.
    const largo = "x".repeat(200);
    const v = valoresEnumerados(`message[add][0][type]=${largo}`);
    expect(v["message[add][N][type]"]).toContain("(recortado)");
    expect(v["message[add][N][type]"]!.length).toBeLessThan(60);
  });

  it("devuelve vacío cuando no hay nada de la lista", () => {
    expect(valoresEnumerados("leads[status][0][id]=42")).toEqual({});
    expect(valoresEnumerados("")).toEqual({});
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SDD-0288 rebanada 1 · `parseKommoMessages` — contra el payload REAL.
// ─────────────────────────────────────────────────────────────────────────────
describe("parseKommoMessages", () => {
  /**
   * Reproduce el mensaje medido en produccion el 2026-08-25 04:34 UTC:
   * type=incoming · author.type=external · entity_type=lead · origin=waba.
   */
  const ENTRANTE_REAL = [
    "account[subdomain]=dtdcargo",
    "message[add][0][id]=abc",
    "message[add][0][entity_id]=23325167",
    "message[add][0][entity_type]=lead",
    "message[add][0][created_at]=1787632487",
    "message[add][0][type]=incoming",
    "message[add][0][author][type]=external",
    "message[add][0][origin]=waba",
    "message[add][0][text]=Hola",
  ].join("&");

  it("lee el mensaje entrante real", () => {
    const [m] = parseKommoMessages(ENTRANTE_REAL);
    expect(m.leadId).toBe(23325167);
    expect(m.entrante).toBe(true);
    expect(m.origin).toBe("waba");
    expect(m.createdAt).toBe(new Date(1787632487 * 1000).toISOString());
  });

  it("🔴 convierte created_at desde SEGUNDOS, no milisegundos", () => {
    // En milisegundos la fecha cae en el ano ~57.000 y el lead quedaria
    // "escribio recien" para siempre. Se cuentan los digitos del ano.
    const [m] = parseKommoMessages(ENTRANTE_REAL);
    expect(m.createdAt!.slice(0, 4)).toBe("2026");
  });

  it("🔴 un mensaje NUESTRO no cuenta como del cliente", () => {
    // El caso que pintaria una tarjeta roja sin que nadie deba nada.
    const salida = ENTRANTE_REAL
      .replace("[type]=incoming", "[type]=outgoing")
      .replace("[author][type]=external", "[author][type]=user");
    expect(parseKommoMessages(salida)[0].entrante).toBe(false);
  });

  it("🔴 un valor DESCONOCIDO de type cae en saliente, no en rojo", () => {
    // El token de saliente no esta medido. La regla pregunta "¿es incoming?",
    // asi que lo que no conocemos falla hacia el lado seguro: como mucho deja
    // de encender una alerta, jamas la enciende de mas.
    const raro = ENTRANTE_REAL.replace("[type]=incoming", "[type]=algo_que_kommo_invente");
    expect(parseKommoMessages(raro)[0].entrante).toBe(false);
  });

  it("🔴 un 'incoming' que NO viene de external tampoco es el cliente", () => {
    // El agente de IA tambien produce mensajes en la conversacion.
    const bot = ENTRANTE_REAL.replace("[author][type]=external", "[author][type]=bot");
    expect(parseKommoMessages(bot)[0].entrante).toBe(false);
  });

  it("ignora lo que no cuelga de un lead", () => {
    const deContacto = ENTRANTE_REAL.replace("[entity_type]=lead", "[entity_type]=contact");
    expect(parseKommoMessages(deContacto)).toEqual([]);
  });

  it("ignora un entity_id invalido en vez de inventar un lead", () => {
    for (const malo of ["0", "-3", "", "abc"]) {
      const roto = ENTRANTE_REAL.replace("[entity_id]=23325167", `[entity_id]=${malo}`);
      expect(parseKommoMessages(roto)).toEqual([]);
    }
  });

  it("lee varios mensajes en un solo webhook, cada uno con su indice", () => {
    const dos = [
      "message[add][0][entity_id]=111", "message[add][0][entity_type]=lead",
      "message[add][0][created_at]=1787632487", "message[add][0][type]=incoming",
      "message[add][0][author][type]=external",
      "message[add][1][entity_id]=222", "message[add][1][entity_type]=lead",
      "message[add][1][created_at]=1787632999", "message[add][1][type]=outgoing",
      "message[add][1][author][type]=user",
    ].join("&");
    const r = parseKommoMessages(dos);
    expect(r).toHaveLength(2);
    expect(r.find((m) => m.leadId === 111)!.entrante).toBe(true);
    expect(r.find((m) => m.leadId === 222)!.entrante).toBe(false);
  });

  it("un cuerpo sin mensajes devuelve vacio", () => {
    expect(parseKommoMessages("leads[status][0][id]=42")).toEqual([]);
    expect(parseKommoMessages("")).toEqual([]);
  });
});
