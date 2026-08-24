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
  parseKommoWebhookPayload,
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
