// @vitest-environment node
/**
 * SDD-0650 F2 · Smoke contra un Chatwoot 4.19.1 REAL y efímero: la lectura del panel de la ficha.
 *
 * Solo corre dentro de infra/chatwoot/pruebas/portal/prueba-portal-poc.sh (GitHub Actions:
 * .github/workflows/chatwoot-portal-poc.yml). Sin la instancia, se salta; en ese workflow es obligatoria.
 * Usa el cliente real de Studio (router-api.ts) y las reglas reales (ficha-conversaciones.ts), sin dobles de
 * red, con datos inventados «SINT-…».
 *
 *   F1  `GET /contacts/{id}/conversations` trae, con la forma real, el último mensaje, su autor, la bandeja,
 *       el estado y la fecha; Studio corta el texto a 160 caracteres.
 *   F2  Una nota interna posterior: Studio dice «nota interna» y no saca su texto.
 *   F3  «Nombre en el chat»: el nombre del contacto, nunca el teléfono.
 *   M   MEDIDA de la spec (§F2, «medir antes de construir»): cuánto tarda la lectura (mediana de 5). El panel
 *       carga aparte (Suspense) siempre; la medida queda en el log del workflow.
 */
import { describe, expect, it } from "vitest";

import { resumirConversacion } from "../ficha-conversaciones";
import { leerConversacionesDeContacto } from "../router-api";

/** SINT: imposible en Venezuela (ningún código de área empieza por 0); E.164 válido para Chatwoot. */
const TELEFONO_SINT = "+580000000650";
const ORIGEN = process.env.CHATWOOT_POC_ORIGIN ?? "";
const CUENTA = Number(process.env.CHATWOOT_POC_CUENTA ?? "0");
const BANDEJA = Number(process.env.CHATWOOT_POC_BANDEJA ?? "0");
const TOKEN = process.env.CHATWOOT_POC_TOKEN ?? "";
const CFG = { origin: ORIGEN, token: TOKEN, accountId: CUENTA };
const LARGO = 60_000;
const HAY_INSTANCIA = Boolean(ORIGEN && TOKEN && CUENTA && BANDEJA);

async function api(ruta: string, init: RequestInit = {}): Promise<{ status: number; json: unknown }> {
  const r = await fetch(`${ORIGEN}/api/v1/accounts/${CUENTA}/${ruta}`, {
    ...init,
    headers: { api_access_token: TOKEN, Accept: "application/json", ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}

describe.runIf(process.env.CHATWOOT_POC_REQUERIDA === "1")("el smoke de la 0650 F2 es obligatorio en su workflow", () => {
  it("encuentra la instancia efímera", () => {
    expect({ origen: Boolean(ORIGEN), token: Boolean(TOKEN), cuenta: CUENTA > 0, bandeja: BANDEJA > 0 }).toEqual({
      origen: true,
      token: true,
      cuenta: true,
      bandeja: true,
    });
  });
});

describe.skipIf(!HAY_INSTANCIA)("SDD-0650 F2 · lectura del panel de la ficha contra Chatwoot 4.19.1 efímero", () => {
  const sufijo = crypto.randomUUID().slice(0, 8);
  const TEXTO = `SINT-0650-${sufijo} ${"pedido de prueba ".repeat(15)}`;
  let contactoId = 0;
  let conversacionId = 0;

  it(
    "preparación: contacto, conversación en la bandeja de la PoC y un mensaje entrante",
    async () => {
      const c = await api("contacts", {
        method: "POST",
        body: JSON.stringify({ name: "SINT Contacto 0650", phone_number: TELEFONO_SINT, identifier: `sint-0650-${sufijo}` }),
      });
      expect(c.status, JSON.stringify(c.json)).toBe(200);
      contactoId = Number((c.json as { payload?: { contact?: { id?: number } } })?.payload?.contact?.id);
      expect(contactoId).toBeGreaterThan(0);

      const fuente = await api(`contacts/${contactoId}/contact_inboxes`, {
        method: "POST",
        body: JSON.stringify({ inbox_id: BANDEJA, source_id: `sint-0650-${sufijo}` }),
      });
      expect(fuente.status, JSON.stringify(fuente.json)).toBe(200);
      const conv = await api("conversations", {
        method: "POST",
        body: JSON.stringify({ inbox_id: BANDEJA, contact_id: contactoId, source_id: `sint-0650-${sufijo}` }),
      });
      expect(conv.status, JSON.stringify(conv.json)).toBe(200);
      conversacionId = Number((conv.json as { id?: number })?.id);

      const m = await api(`conversations/${conversacionId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: TEXTO, message_type: "incoming" }),
      });
      expect(m.status, JSON.stringify(m.json)).toBe(200);
    },
    LARGO,
  );

  it(
    "F1 y F3: último mensaje, autor, bandeja, estado, fecha y nombre, con el texto cortado",
    async () => {
      const r = await leerConversacionesDeContacto(CFG, contactoId);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const resumen = r.data.map(resumirConversacion).find((c) => c?.conversationId === conversacionId);
      expect(resumen).toBeTruthy();
      expect(resumen?.inboxId).toBe(BANDEJA);
      expect(resumen?.estado).toBe("open");
      expect(resumen?.autor).toBe("cliente");
      expect(resumen?.fechaMensaje).not.toBeNull();
      expect(Array.from(resumen?.texto ?? "")).toHaveLength(160);
      expect(resumen?.texto?.startsWith(`SINT-0650-${sufijo}`)).toBe(true);
      expect(resumen?.nombreContacto).toBe("SINT Contacto 0650");
    },
    LARGO,
  );

  it(
    "F2: una nota interna posterior se nombra sin su texto",
    async () => {
      const nota = await api(`conversations/${conversacionId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: `SINT-NOTA-${sufijo}`, message_type: "outgoing", private: true }),
      });
      expect(nota.status, JSON.stringify(nota.json)).toBe(200);
      const r = await leerConversacionesDeContacto(CFG, contactoId);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const resumen = r.data.map(resumirConversacion).find((c) => c?.conversationId === conversacionId);
      expect(resumen?.autor).toBe("nota_interna");
      expect(JSON.stringify(resumen)).not.toContain(`SINT-NOTA-${sufijo}`);
    },
    LARGO,
  );

  it(
    "M: cuánto tarda la lectura de un contacto",
    async () => {
      const tiempos: number[] = [];
      for (let i = 0; i < 5; i += 1) {
        const t0 = performance.now();
        const r = await leerConversacionesDeContacto(CFG, contactoId);
        tiempos.push(performance.now() - t0);
        expect(r.ok).toBe(true);
      }
      tiempos.sort((a, b) => a - b);
      console.log(
        `MEDIDA 0650-F2 — GET /contacts/{id}/conversations: mediana ${Math.round(tiempos[2])} ms, máx ${Math.round(tiempos[4])} ms (umbral de la spec 400 ms; el panel carga aparte igual)`,
      );
    },
    LARGO,
  );
});
