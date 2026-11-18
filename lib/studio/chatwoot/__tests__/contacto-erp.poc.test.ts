// @vitest-environment node
/**
 * SDD-0649 · Smoke contra un Chatwoot 4.19.1 REAL y efímero, antes de encender CHATWOOT_ATRIBUTOS_CONTACTO.
 *
 * Solo corre dentro de infra/chatwoot/pruebas/portal/prueba-portal-poc.sh (GitHub Actions:
 * .github/workflows/chatwoot-portal-poc.yml). Sin la instancia, se salta; en ese workflow es obligatoria.
 * Usa el cliente real de Studio (router-api.ts), sin dobles de red, y datos inventados «SINT-…».
 *
 * Mide las dos condiciones previas al encendido que pidió el Director General (2026-11-17, OK de Sam «Sí, mídelo»):
 *
 *   S1  El GET de Studio lee los custom_attributes del contacto con la forma real de 4.19.1 (`payload`).
 *   S2  El PATCH de Studio escribe los dos atributos y NO pisa otros atributos ni el nombre, el correo ni el
 *       identifier del contacto.
 *   S3  Pasar a «sin ficha» deja el Shipping Mark vacío y la regla de Studio lo lee como sin código.
 *   S4  Se revierte: destroy_custom_attributes quita los dos y deja el resto como estaba.
 *   A1  Un usuario con rol AGENTE, sin ser miembro de ninguna bandeja, ve el contacto y sus custom_attributes
 *       (por id y por el buscador), pero NO ve la conversación del contacto en una bandeja ajena.
 *   A2  Ese agente también puede escribir los custom_attributes del contacto.
 *
 * Las definiciones de los dos atributos se crean como en el paso D1 de producción (lista y texto), para que el
 * smoke use la misma configuración que se va a encender.
 */
import { describe, expect, it } from "vitest";

import { atributosPorEscribir, SIN_FICHA } from "../contacto-erp";
import { escribirAtributosContacto, leerAtributosContacto } from "../router-api";

const ORIGEN = process.env.CHATWOOT_POC_ORIGIN ?? "";
const CUENTA = Number(process.env.CHATWOOT_POC_CUENTA ?? "0");
const BANDEJA = Number(process.env.CHATWOOT_POC_BANDEJA ?? "0");
const TOKEN = process.env.CHATWOOT_POC_TOKEN ?? "";
const TOKEN_AGENTE = process.env.CHATWOOT_POC_TOKEN_AGENTE ?? "";
const CFG = { origin: ORIGEN, token: TOKEN, accountId: CUENTA };
const CFG_AGENTE = { origin: ORIGEN, token: TOKEN_AGENTE, accountId: CUENTA };
const LARGO = 60_000;
const HAY_INSTANCIA = Boolean(ORIGEN && TOKEN && TOKEN_AGENTE && CUENTA && BANDEJA);

async function api(token: string, ruta: string, init: RequestInit = {}): Promise<{ status: number; json: unknown }> {
  const r = await fetch(`${ORIGEN}/api/v1/accounts/${CUENTA}/${ruta}`, {
    ...init,
    headers: {
      api_access_token: token,
      Accept: "application/json",
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}

type ContactoCrudo = { id: number; name?: string; email?: string | null; identifier?: string | null; custom_attributes?: Record<string, unknown> };
async function contactoCrudo(token: string, id: number): Promise<{ status: number; contacto: ContactoCrudo | null }> {
  const r = await api(token, `contacts/${id}`);
  return { status: r.status, contacto: ((r.json as { payload?: ContactoCrudo } | null)?.payload ?? null) as ContactoCrudo | null };
}

describe.runIf(process.env.CHATWOOT_POC_REQUERIDA === "1")("el smoke de la 0649 es obligatorio en su workflow", () => {
  it("encuentra la instancia efímera y el token del agente", () => {
    expect({ origen: Boolean(ORIGEN), token: Boolean(TOKEN), agente: Boolean(TOKEN_AGENTE), cuenta: CUENTA > 0, bandeja: BANDEJA > 0 }).toEqual({
      origen: true,
      token: true,
      agente: true,
      cuenta: true,
      bandeja: true,
    });
  });
});

describe.skipIf(!HAY_INSTANCIA)("SDD-0649 · custom_attributes del contacto contra Chatwoot 4.19.1 efímero", () => {
  const sufijo = crypto.randomUUID().slice(0, 8);
  const identificador = `sint-0649-${sufijo}`;
  const correo = `sint-0649-${sufijo}@example.test`;
  const CODIGO = `SINT-${sufijo.toUpperCase()}`;
  let contactoId = 0;

  it(
    "preparación: las dos definiciones como en D1 y un contacto inventado con un atributo ajeno",
    async () => {
      for (const def of [
        {
          attribute_display_name: "Segmento DTD",
          attribute_key: "dtd_segmento",
          attribute_display_type: "list",
          attribute_model: "contact_attribute",
          attribute_values: ["cliente", "lead_registrado", "lead_nuevo"],
        },
        { attribute_display_name: "Shipping Mark", attribute_key: "dtd_shipping_mark", attribute_display_type: "text", attribute_model: "contact_attribute" },
      ]) {
        const r = await api(TOKEN, "custom_attribute_definitions", { method: "POST", body: JSON.stringify({ custom_attribute_definition: def }) });
        expect(r.status, JSON.stringify(r.json)).toBe(200);
      }
      // El agente no puede crear definiciones: solo un administrador (custom_attribute_definition_policy.rb).
      const intento = await api(TOKEN_AGENTE, "custom_attribute_definitions", {
        method: "POST",
        body: JSON.stringify({ custom_attribute_definition: { attribute_display_name: "SINT", attribute_key: "sint_x", attribute_display_type: "text", attribute_model: "contact_attribute" } }),
      });
      expect(intento.status).toBe(401);

      const r = await api(TOKEN, "contacts", {
        method: "POST",
        body: JSON.stringify({ name: "SINT-Contacto 0649", email: correo, identifier: identificador, custom_attributes: { sint_ajeno: "se conserva" } }),
      });
      expect(r.status, JSON.stringify(r.json)).toBe(200);
      contactoId = Number((r.json as { payload?: { contact?: { id?: number } } })?.payload?.contact?.id);
      expect(contactoId).toBeGreaterThan(0);
    },
    LARGO,
  );

  it("S1: el GET de Studio lee los custom_attributes con la forma real de 4.19.1", async () => {
    const r = await leerAtributosContacto(CFG, contactoId);
    expect(r).toEqual({ ok: true, data: { sint_ajeno: "se conserva" } });
  });

  it(
    "S2: el PATCH de Studio escribe los dos atributos y no pisa el ajeno ni nombre, correo o identifier",
    async () => {
      const nuevos = atributosPorEscribir({ sint_ajeno: "se conserva" }, { segmento: "cliente", shippingMark: CODIGO });
      expect(nuevos).not.toBeNull();
      const w = await escribirAtributosContacto(CFG, contactoId, nuevos ?? {});
      expect(w).toEqual({ ok: true, data: null });

      const { status, contacto } = await contactoCrudo(TOKEN, contactoId);
      expect(status).toBe(200);
      expect(contacto?.custom_attributes).toEqual({ sint_ajeno: "se conserva", dtd_segmento: "cliente", dtd_shipping_mark: CODIGO });
      expect({ name: contacto?.name, email: contacto?.email, identifier: contacto?.identifier }).toEqual({
        name: "SINT-Contacto 0649",
        email: correo,
        identifier: identificador,
      });

      // Con los valores ya escritos, la regla de Studio no vuelve a escribir.
      const leidos = await leerAtributosContacto(CFG, contactoId);
      expect(leidos.ok && atributosPorEscribir(leidos.data, { segmento: "cliente", shippingMark: CODIGO })).toBeNull();
    },
    LARGO,
  );

  it(
    "S3: pasar a sin ficha deja el Shipping Mark vacío, y la regla lo lee como sin código",
    async () => {
      const w = await escribirAtributosContacto(CFG, contactoId, atributosPorEscribir({}, SIN_FICHA) ?? {});
      expect(w.ok).toBe(true);
      const leidos = await leerAtributosContacto(CFG, contactoId);
      expect(leidos.ok).toBe(true);
      if (!leidos.ok) return;
      expect(leidos.data.dtd_segmento).toBe("lead_nuevo");
      expect(leidos.data.dtd_shipping_mark ?? null).toBeNull();
      expect(leidos.data.sint_ajeno).toBe("se conserva");
      expect(atributosPorEscribir(leidos.data, SIN_FICHA)).toBeNull();
    },
    LARGO,
  );

  it(
    "A1: un AGENTE sin bandejas ve el contacto y sus atributos, pero no su conversación en una bandeja ajena",
    async () => {
      // Una conversación del contacto en la bandeja de la PoC, de la que el agente no es miembro.
      const fuente = await api(TOKEN, `contacts/${contactoId}/contact_inboxes`, {
        method: "POST",
        body: JSON.stringify({ inbox_id: BANDEJA, source_id: `sint-0649-${sufijo}` }),
      });
      expect(fuente.status, JSON.stringify(fuente.json)).toBe(200);
      const conv = await api(TOKEN, "conversations", {
        method: "POST",
        body: JSON.stringify({ inbox_id: BANDEJA, contact_id: contactoId, source_id: `sint-0649-${sufijo}` }),
      });
      expect(conv.status, JSON.stringify(conv.json)).toBe(200);

      const porId = await contactoCrudo(TOKEN_AGENTE, contactoId);
      expect(porId.status).toBe(200);
      expect(porId.contacto?.custom_attributes?.dtd_segmento).toBe("lead_nuevo");

      const busqueda = await api(TOKEN_AGENTE, `contacts/search?q=${encodeURIComponent(identificador)}`);
      expect(busqueda.status).toBe(200);
      const ids = ((busqueda.json as { payload?: { id: number }[] })?.payload ?? []).map((c) => c.id);
      expect(ids).toContain(contactoId);

      // Control: el administrador sí ve la conversación; el agente, no.
      const delAdmin = await api(TOKEN, `contacts/${contactoId}/conversations`);
      const delAgente = await api(TOKEN_AGENTE, `contacts/${contactoId}/conversations`);
      expect(delAdmin.status).toBe(200);
      expect(delAgente.status).toBe(200);
      const cuantas = (j: unknown) => ((j as { payload?: unknown[] })?.payload ?? []).length;
      expect(cuantas(delAdmin.json)).toBe(1);
      expect(cuantas(delAgente.json)).toBe(0);
      console.log(`MEDIDA A1 — agente sin bandejas: ve el contacto por id y por el buscador; conversaciones visibles: admin ${cuantas(delAdmin.json)}, agente ${cuantas(delAgente.json)}`);
    },
    LARGO,
  );

  it(
    "A2: el agente también puede escribir los custom_attributes del contacto",
    async () => {
      const w = await escribirAtributosContacto(CFG_AGENTE, contactoId, { dtd_shipping_mark: "SINT-AGENTE" });
      expect(w).toEqual({ ok: true, data: null });
      const leidos = await leerAtributosContacto(CFG, contactoId);
      expect(leidos.ok && leidos.data.dtd_shipping_mark).toBe("SINT-AGENTE");
      console.log("MEDIDA A2 — un agente puede escribir dtd_shipping_mark; Studio lo corrige en el siguiente mensaje entrante");
    },
    LARGO,
  );

  it(
    "S4: se revierte con destroy_custom_attributes, sin tocar el atributo ajeno",
    async () => {
      const r = await api(TOKEN, `contacts/${contactoId}/destroy_custom_attributes`, {
        method: "POST",
        body: JSON.stringify({ custom_attributes: ["dtd_segmento", "dtd_shipping_mark"] }),
      });
      expect(r.status, JSON.stringify(r.json)).toBe(200);
      const leidos = await leerAtributosContacto(CFG, contactoId);
      expect(leidos).toEqual({ ok: true, data: { sint_ajeno: "se conserva" } });

      // Limpieza: la instancia es efímera, pero el contacto inventado no se deja.
      const fin = await api(TOKEN, `contacts/${contactoId}`, { method: "DELETE" });
      expect([200, 204]).toContain(fin.status);
    },
    LARGO,
  );
});
