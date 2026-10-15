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
  cuerpoAceptarEnRecontacto,
  decidirReapertura,
  leadsConMensajeEntrante,
  parseEntradasBandeja,
  procesarEntradasBandeja,
  tokenEntrada,
  tokenVolvio,
  type ClienteResuelto,
  type DepsEntradas,
  type EntradaBandeja,
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

// ── La bandeja: el trato nuevo del cliente que vuelve (`unsorted[add]`) ──────

// Forma real del evento, leída de los logs del webhook el 2026-10-15 (solo las
// claves). Los valores son inventados.
function cuerpoUnsortedAdd(
  filas: Array<{ uid?: string; lead_id?: string; pipeline_id?: string; category?: string }>,
): string {
  const p = new URLSearchParams();
  p.set("account[subdomain]", "dtdcargo");
  p.set("account[id]", "31589859");
  filas.forEach((f, i) => {
    if (f.uid !== undefined) p.set(`unsorted[add][${i}][uid]`, f.uid);
    if (f.lead_id !== undefined) p.set(`unsorted[add][${i}][lead_id]`, f.lead_id);
    if (f.pipeline_id !== undefined) p.set(`unsorted[add][${i}][pipeline_id]`, f.pipeline_id);
    if (f.category !== undefined) p.set(`unsorted[add][${i}][category]`, f.category);
    // Lo que trae el evento y NO se lee: nombre, teléfono y texto del cliente.
    p.set(`unsorted[add][${i}][data][contacts][0][name]`, "Nombre de prueba");
    p.set(`unsorted[add][${i}][data][contacts][0][custom_fields][0][code]`, "PHONE");
    p.set(`unsorted[add][${i}][data][contacts][0][custom_fields][0][values][0][value]`, "+58 412 0000000");
    p.set(`unsorted[add][${i}][source_data][data][0][text]`, "hola, soy yo otra vez");
  });
  return p.toString();
}

describe("parseEntradasBandeja", () => {
  it("lee uid, lead_id, embudo y categoría", () => {
    expect(
      parseEntradasBandeja(
        cuerpoUnsortedAdd([
          { uid: "u-1", lead_id: "23538531", pipeline_id: "14036567", category: "chats" },
        ]),
      ),
    ).toEqual([{ uid: "u-1", leadId: 23538531, pipelineId: 14036567, category: "chats" }]);
  });

  it("no lee nada más del cliente: ni nombre, ni teléfono, ni texto", () => {
    const [e] = parseEntradasBandeja(
      cuerpoUnsortedAdd([{ uid: "u-1", lead_id: "5", pipeline_id: "14036567" }]),
    );
    expect(Object.keys(e).sort()).toEqual(["category", "leadId", "pipelineId", "uid"]);
    expect(JSON.stringify(e)).not.toMatch(/Nombre|412|hola/);
  });

  it("sin uid o sin lead_id válido no hay entrada", () => {
    expect(
      parseEntradasBandeja(
        cuerpoUnsortedAdd([
          { lead_id: "5", pipeline_id: "14036567" },
          { uid: "u-2", lead_id: "0", pipeline_id: "14036567" },
          { uid: "u-3", lead_id: "abc", pipeline_id: "14036567" },
        ]),
      ),
    ).toEqual([]);
  });

  it("el mismo uid dos veces en un POST es una sola entrada", () => {
    const r = parseEntradasBandeja(
      cuerpoUnsortedAdd([
        { uid: "u-1", lead_id: "5", pipeline_id: "14036567" },
        { uid: "u-1", lead_id: "5", pipeline_id: "14036567" },
      ]),
    );
    expect(r).toHaveLength(1);
  });

  it("ignora unsorted[update] y unsorted[delete]: solo la entrada nueva cuenta", () => {
    const p = new URLSearchParams();
    p.set("unsorted[update][0][uid]", "u-9");
    p.set("unsorted[update][0][lead_id]", "9");
    p.set("unsorted[delete][0][uid]", "u-8");
    expect(parseEntradasBandeja(p)).toEqual([]);
  });
});

describe("cuerpoAceptarEnRecontacto", () => {
  const entrada = (pipelineId: number | null): EntradaBandeja => ({
    uid: "u-1",
    leadId: 5,
    pipelineId,
    category: "chats",
  });

  it("mismo embudo → se acepta en la etapa Recontacto", () => {
    expect(cuerpoAceptarEnRecontacto(entrada(14036567), RECONTACTO)).toEqual({
      status_id: 108343835,
    });
  });

  it("otro embudo, sin embudo o sin destino → no se acepta", () => {
    expect(cuerpoAceptarEnRecontacto(entrada(999), RECONTACTO)).toBeNull();
    expect(cuerpoAceptarEnRecontacto(entrada(null), RECONTACTO)).toBeNull();
    expect(cuerpoAceptarEnRecontacto(entrada(14036567), null)).toBeNull();
  });
});

describe("tokenEntrada · una tarea por entrada de la bandeja", () => {
  it("el evento repetido de la misma entrada comparte token", () => {
    expect(tokenEntrada("u-1")).toBe(tokenEntrada("u-1"));
  });
  it("otra entrada, otro token; y no choca con el de los tratos cerrados", () => {
    expect(tokenEntrada("u-1")).not.toBe(tokenEntrada("u-2"));
    expect(tokenEntrada("1791000000")).not.toBe(tokenVolvio(1791000000));
  });
});

describe("procesarEntradasBandeja · con dobles", () => {
  type Llamada = [string, ...unknown[]];

  function dobles(
    over: Partial<DepsEntradas> & { clientes?: Record<number, ClienteResuelto> } = {},
  ) {
    const llamadas: Llamada[] = [];
    const clientes = over.clientes ?? {
      5: { esCliente: true, contactId: 77, markbox: "DTD-9311" },
    };
    const deps: DepsEntradas = {
      destino: RECONTACTO,
      escribe: true,
      resolverCliente: async (leadId) => {
        llamadas.push(["resolver", leadId]);
        return clientes[leadId] ?? { esCliente: false, contactId: 99, markbox: null };
      },
      aceptar: async (uid, cuerpo) => {
        llamadas.push(["aceptar", uid, cuerpo]);
      },
      encolarMarcas: async (leadId, contactId, markbox) => {
        llamadas.push(["marcas", leadId, contactId, markbox]);
      },
      encolarTarea: async (leadId, tarea, token) => {
        llamadas.push(["tarea", leadId, tarea, token]);
      },
      ahoraIso: () => AHORA,
      ...over,
    };
    return { deps, llamadas };
  }
  const entrada = (uid: string, leadId = 5, pipelineId: number | null = 14036567): EntradaBandeja => ({
    uid,
    leadId,
    pipelineId,
    category: "chats",
  });
  const nombres = (ls: Llamada[]) => ls.map((l) => l[0]);

  it("cliente que ya pasó → se acepta en Recontacto, y después marca y tarea vencida", async () => {
    const { deps, llamadas } = dobles();
    const r = await procesarEntradasBandeja([entrada("u-1")], deps);

    expect(r).toMatchObject({ revisadas: 1, aceptadas: 1, desconocidas: 0, fallidas: 0 });
    expect(nombres(llamadas)).toEqual(["resolver", "aceptar", "marcas", "tarea"]);
    expect(llamadas[1]).toEqual(["aceptar", "u-1", { status_id: 108343835 }]);
    expect(llamadas[2]).toEqual(["marcas", 5, 77, "DTD-9311"]);
    const [, leadId, tarea, token] = llamadas[3];
    expect(leadId).toBe(5);
    expect(token).toBe("volvio:entrada:u-1");
    expect(tarea).toMatchObject({ entity_id: 5, entity_type: "leads", complete_till: AHORA_S });
  });

  it("🔴 cliente nuevo de verdad → se queda en Leads Entrantes: ni accept ni tarea", async () => {
    const { deps, llamadas } = dobles();
    const r = await procesarEntradasBandeja([entrada("u-nuevo", 404040)], deps);

    expect(r).toMatchObject({ aceptadas: 0, desconocidas: 1 });
    expect(nombres(llamadas)).toEqual(["resolver"]);
  });

  it("🔴 entrada repetida o ya aceptada → el accept da 404, no rompe y no duplica la tarea", async () => {
    let aceptadas = 0;
    const { deps, llamadas } = dobles({
      aceptar: async (uid) => {
        llamadas.push(["aceptar", uid]);
        // Kommo: aceptada una vez, la entrada ya no existe.
        if (aceptadas++ > 0) throw Object.assign(new Error("Kommo 404"), { status: 404 });
      },
    });

    const primera = await procesarEntradasBandeja([entrada("u-1")], deps);
    const repetida = await procesarEntradasBandeja([entrada("u-1")], deps);

    expect(primera).toMatchObject({ aceptadas: 1, yaNoEstaban: 0 });
    expect(repetida).toMatchObject({ aceptadas: 0, yaNoEstaban: 1, fallidas: 0 });
    // Una sola tarea en total, la del accept que funcionó.
    expect(llamadas.filter((l) => l[0] === "tarea")).toHaveLength(1);
  });

  it("accept rechazado (400) → se cuenta, no hay tarea y sigue con la siguiente", async () => {
    const { deps, llamadas } = dobles({
      clientes: {
        5: { esCliente: true, contactId: 77, markbox: "DTD-9311" },
        6: { esCliente: true, contactId: 78, markbox: "DTD-9312" },
      },
      aceptar: async (uid) => {
        llamadas.push(["aceptar", uid]);
        if (uid === "u-1") throw Object.assign(new Error("Kommo 400"), { status: 400 });
      },
    });
    const r = await procesarEntradasBandeja([entrada("u-1", 5), entrada("u-2", 6)], deps);

    expect(r).toMatchObject({ rechazadas: 1, aceptadas: 1 });
    expect(llamadas.filter((l) => l[0] === "tarea").map((l) => l[3])).toEqual([
      "volvio:entrada:u-2",
    ]);
  });

  it("Kommo caído (sin status) → fallida, sin tarea y sin lanzar", async () => {
    const { deps, llamadas } = dobles({
      aceptar: async () => {
        throw new Error("fetch failed");
      },
    });
    await expect(procesarEntradasBandeja([entrada("u-1")], deps)).resolves.toMatchObject({
      fallidas: 1,
      aceptadas: 0,
    });
    expect(nombres(llamadas)).not.toContain("tarea");
  });

  it("si resolver el cliente revienta, la entrada cuenta como fallida y sigue", async () => {
    const { deps } = dobles({
      resolverCliente: async (leadId) => {
        if (leadId === 5) throw new Error("Kommo 500");
        return { esCliente: true, contactId: 78, markbox: null };
      },
    });
    const r = await procesarEntradasBandeja([entrada("u-1", 5), entrada("u-2", 6)], deps);
    expect(r).toMatchObject({ fallidas: 1, aceptadas: 1 });
  });

  it("gate apagado (dry-run) → se reconoce al cliente pero no se acepta nada", async () => {
    const { deps, llamadas } = dobles({ escribe: false });
    const r = await procesarEntradasBandeja([entrada("u-1")], deps);
    expect(r).toMatchObject({ enEnsayo: 1, aceptadas: 0 });
    expect(nombres(llamadas)).toEqual(["resolver"]);
  });

  it("sin stage_map.recontacto → inerte: ni siquiera se resuelve al cliente", async () => {
    const { deps, llamadas } = dobles({ destino: null });
    const r = await procesarEntradasBandeja([entrada("u-1")], deps);
    expect(r.inerte).toBeTruthy();
    expect(llamadas).toEqual([]);
  });

  it("entrada de otro embudo → no se toca", async () => {
    const { deps, llamadas } = dobles();
    const r = await procesarEntradasBandeja([entrada("u-1", 5, 999)], deps);
    expect(r).toMatchObject({ otroEmbudo: 1, aceptadas: 0 });
    expect(llamadas).toEqual([]);
  });

  it("cliente sin Shipping Mark → se acepta y lleva la tarea, sin marcas", async () => {
    const { deps, llamadas } = dobles({
      clientes: { 5: { esCliente: true, contactId: 77, markbox: "  " } },
    });
    await procesarEntradasBandeja([entrada("u-1")], deps);
    expect(nombres(llamadas)).toEqual(["resolver", "aceptar", "tarea"]);
  });
});

describe("cableado de la bandeja en kommo-webhook (leído del fuente)", () => {
  const code = readFileSync(
    join(process.cwd(), "supabase/functions/kommo-webhook/index.ts"),
    "utf8",
  );
  const acepta = code.slice(
    code.indexOf("async function aceptarClientesEntrantes("),
    code.indexOf("Deno.serve("),
  );

  it("un POST con solo `unsorted[add]` ya no se descarta en la salida temprana", () => {
    expect(code).toContain("const entradas = parseEntradasBandeja(crudo);");
    expect(code).toContain(
      "if (parsed.events.length === 0 && mensajes.length === 0 && entradas.length === 0)",
    );
  });

  it("el accept respeta el gate de la cola y el interruptor stage_map.recontacto", () => {
    expect(code).toContain("writeback_enabled, writeback_dry_run");
    expect(acepta).toContain(
      "escribe: conn.writeback_enabled === true && conn.writeback_dry_run === false",
    );
    expect(acepta).toContain("destino: readRecontactoTarget(conn.stage_map)");
  });

  it("acepta por el endpoint de la bandeja, no con PATCH", () => {
    expect(acepta).toContain("`/api/v4/leads/unsorted/${encodeURIComponent(uid)}/accept`");
    expect(acepta).toContain('"POST"');
  });

  it("la tarea viaja con dedupe_token", () => {
    expect(acepta).toContain('p_op: "add_task"');
    expect(acepta).toContain("p_dedupe_token: dedupeToken");
  });

  it("el enrutador de leads[add] sigue moviendo y estampando con los helpers compartidos", () => {
    const enruta = code.slice(
      code.indexOf("async function routeNewLeads("),
      code.indexOf("async function reabrirTratosCerrados("),
    );
    expect(enruta).toContain("resolverCliente(supabase, baseUrl, token, conn, leadId, cargarPorClaves)");
    expect(enruta).toContain('p_op: "patch_stage"');
    expect(enruta).toContain("await encolarMarcas(");
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
