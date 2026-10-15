// @vitest-environment node
// SDD-0535 · el cliente que vuelve a escribir en un trato cerrado.
//
// Tres capas: la decisión pura, el contrato con el gemelo del Studio
// (`buildTaskPayload`) y el cableado dentro del webhook, leído del fuente porque
// Vitest no puede levantar una Edge Function.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  KOMMO_STATUS_GANADO,
  KOMMO_STATUS_PERDIDO,
  TEXTO_TAREA_VOLVIO,
  buildTareaVolvioPayload,
  decidirReapertura,
  leadsConMensajeEntrante,
  tokenVolvio,
  type LeadCerradoLike,
} from "../kommo-reapertura";
import { readRecontactoTarget } from "../kommo-router";
import { buildTaskPayload } from "@/lib/studio/kommo-writeback";

// Ids reales del embudo `Ventas DTD` (leídos de la cuenta el 2026-10-15).
const RECONTACTO = { pipeline_id: 14036567, status_id: 108343835 };
const CONTACTO_INICIAL = 108343831;
const AHORA = "2026-10-15T14:00:00.000Z";
const AHORA_S = Date.parse(AHORA) / 1000;

const lead = (over: Partial<LeadCerradoLike> = {}): LeadCerradoLike => ({
  id: 23441825,
  status_id: KOMMO_STATUS_PERDIDO,
  closed_at: 1791000000,
  responsible_user_id: 9976747,
  ...over,
});

describe("decidirReapertura", () => {
  it("Perdido → vuelve a Recontacto con una tarea vencida", () => {
    const d = decidirReapertura(lead(), RECONTACTO, AHORA);
    expect(d).toEqual({
      kind: "reabrir",
      etapa: { status_id: 108343835, pipeline_id: 14036567 },
      tarea: {
        text: TEXTO_TAREA_VOLVIO,
        complete_till: AHORA_S,
        entity_id: 23441825,
        entity_type: "leads",
        responsible_user_id: 9976747,
      },
      dedupeToken: "volvio:1791000000",
    });
  });

  it("Ganado → sólo la tarea: una venta no se reabre (SDD-0244 §5)", () => {
    const d = decidirReapertura(lead({ status_id: KOMMO_STATUS_GANADO }), RECONTACTO, AHORA);
    expect(d.kind).toBe("avisar");
    expect(d).not.toHaveProperty("etapa");
    if (d.kind === "avisar") {
      expect(d.tarea.entity_id).toBe(23441825);
      expect(d.dedupeToken).toBe("volvio:1791000000");
    }
  });

  it("un trato abierto no se toca: ya está a la vista", () => {
    for (const status of [CONTACTO_INICIAL, 108343827, 108343835, 108343839, 109855104]) {
      expect(decidirReapertura(lead({ status_id: status }), RECONTACTO, AHORA)).toEqual({
        kind: "nada",
        motivo: "abierto",
      });
    }
  });

  it("sin stage_map.recontacto queda inerte, igual que el enrutador", () => {
    expect(decidirReapertura(lead(), null, AHORA)).toEqual({ kind: "nada", motivo: "sin-destino" });
    // Y el interruptor es el mismo que lee el enrutador de SDD-0244.
    expect(readRecontactoTarget({ sent: {} })).toBeNull();
    expect(readRecontactoTarget({ recontacto: RECONTACTO })).toEqual(RECONTACTO);
  });

  it("sin lead (204, id basura) no hace nada", () => {
    expect(decidirReapertura(null, RECONTACTO, AHORA)).toEqual({ kind: "nada", motivo: "sin-lead" });
    expect(decidirReapertura(lead({ id: 0 }), RECONTACTO, AHORA)).toEqual({
      kind: "nada",
      motivo: "sin-lead",
    });
  });

  it("la tarea nace vencida: complete_till es el momento del mensaje, en SEGUNDOS", () => {
    const d = decidirReapertura(lead(), RECONTACTO, AHORA);
    if (d.kind === "nada") throw new Error("esperaba una tarea");
    const ct = d.tarea.complete_till as number;
    expect(ct).toBe(AHORA_S);
    // 10 dígitos: en milisegundos serían 13 y la tarjeta no se pondría roja nunca.
    expect(String(ct)).toHaveLength(10);
  });

  it("sin responsable no inventa uno: Kommo usa el del trato", () => {
    const d = decidirReapertura(lead({ responsible_user_id: null }), RECONTACTO, AHORA);
    if (d.kind === "nada") throw new Error("esperaba una tarea");
    expect(d.tarea).not.toHaveProperty("responsible_user_id");
  });
});

describe("tokenVolvio · una tarea por episodio de cierre", () => {
  it("la ráfaga de mensajes de un mismo cierre comparte token", () => {
    expect(tokenVolvio(1791000000)).toBe(tokenVolvio(1791000000));
  });

  it("un cierre nuevo es un episodio nuevo", () => {
    expect(tokenVolvio(1791000000)).not.toBe(tokenVolvio(1791999999));
  });

  it("sin closed_at cae en un token fijo, no en uno distinto por mensaje", () => {
    expect(tokenVolvio(null)).toBe("volvio:sin-cierre");
    expect(tokenVolvio(undefined)).toBe("volvio:sin-cierre");
    expect(tokenVolvio(0)).toBe("volvio:sin-cierre");
  });
});

describe("leadsConMensajeEntrante", () => {
  it("sólo los mensajes del cliente, sin repetir el lead", () => {
    expect(
      leadsConMensajeEntrante([
        { leadId: 10, entrante: true },
        { leadId: 10, entrante: true },
        { leadId: 20, entrante: false }, // saliente: nuestro o del bot
        { leadId: 30, entrante: true },
      ]),
    ).toEqual([10, 30]);
  });

  it("ignora ids inválidos", () => {
    expect(
      leadsConMensajeEntrante([
        { leadId: 0, entrante: true },
        { leadId: -4, entrante: true },
        { leadId: Number.NaN, entrante: true },
      ]),
    ).toEqual([]);
  });
});

describe("contrato · buildTareaVolvioPayload es gemelo de buildTaskPayload", () => {
  // El bundle de la Edge Function no puede importar `lib/`. Si una copia cambia
  // la forma de la tarea y la otra no, este test lo nota.
  it.each([
    { leadId: 23441825, responsibleUserId: 9976747 },
    { leadId: 23441825, responsibleUserId: null },
    { leadId: 7, responsibleUserId: 0 },
  ])("misma salida para %o", ({ leadId, responsibleUserId }) => {
    expect(
      buildTareaVolvioPayload({ leadId, completeTillIso: AHORA, responsibleUserId }),
    ).toEqual(
      buildTaskPayload({ leadId, texto: TEXTO_TAREA_VOLVIO, completeTillIso: AHORA, responsibleUserId }),
    );
  });

  it("los dos rechazan lo mismo", () => {
    expect(buildTareaVolvioPayload({ leadId: 0, completeTillIso: AHORA })).toBeNull();
    expect(buildTareaVolvioPayload({ leadId: 5, completeTillIso: "no es fecha" })).toBeNull();
  });
});

describe("cableado en kommo-webhook (leído del fuente)", () => {
  const code = readFileSync(
    join(process.cwd(), "supabase/functions/kommo-webhook/index.ts"),
    "utf8",
  );
  const cuerpo = code.slice(
    code.indexOf("async function reabrirTratosCerrados("),
    code.indexOf("function despertarDrenaje("),
  );

  it("la reapertura corre DESPUÉS de estampar el mensaje", () => {
    const estampa = code.indexOf('supabase.rpc("kommo_touch_lead_message"');
    const reabre = code.indexOf("await reabrirTratosCerrados(");
    expect(estampa).toBeGreaterThan(-1);
    expect(reabre).toBeGreaterThan(estampa);
  });

  it("sólo mira los leads con mensaje ENTRANTE", () => {
    expect(code).toContain("leadsConMensajeEntrante(mensajes)");
  });

  it("la tarea viaja con dedupe_token: una por episodio, nunca una por mensaje", () => {
    expect(cuerpo).toContain('p_op: "add_task"');
    expect(cuerpo).toContain("p_dedupe_token: decision.dedupeToken");
  });

  it("el cambio de etapa va SIN snapshot: cada mensaje le sube el updated_at al trato", () => {
    const etapa = cuerpo.slice(cuerpo.indexOf('p_op: "patch_stage"'));
    expect(etapa.slice(0, 200)).toContain("p_kommo_updated_at: null");
  });

  it("sólo encola: no le escribe a Kommo directo (el gate es el del drenaje)", () => {
    expect(cuerpo).not.toMatch(/method:\s*"(PATCH|POST)"/);
    expect(cuerpo).not.toContain("kommoWrite");
  });
});
