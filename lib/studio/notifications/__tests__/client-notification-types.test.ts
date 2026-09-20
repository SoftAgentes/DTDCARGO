// @vitest-environment node
/**
 * SDD-0156 · funciones puras del motor de notificaciones al cliente.
 * Copy (precedencia override→template→default→genérico), offset, catálogo.
 */
import { describe, it, expect } from "vitest";
import {
  resolveNotifCopy,
  formatOffset,
  statusEvent,
  journeyEventLabel,
  DEFAULT_EVENT_COPY,
  TEMPLATE_COPY,
  CLIENT_JOURNEY_EVENTS,
  CLIENT_JOURNEY_EVENT_KEYS,
} from "../client-notification-types";
import { DEFAULT_SEED_EVENTS } from "../client-notification-rules-queries";

describe("statusEvent", () => {
  it("prefija 'status:'", () => {
    expect(statusEvent("shipped")).toBe("status:shipped");
    expect(statusEvent("in_customs")).toBe("status:in_customs");
  });
});

describe("resolveNotifCopy · precedencia", () => {
  it("usa el default del evento cuando no hay override ni template", () => {
    const copy = resolveNotifCopy({ event: "status:shipped" });
    expect(copy).toEqual(DEFAULT_EVENT_COPY["status:shipped"]);
  });

  it("un template_key gana al default del evento", () => {
    const copy = resolveNotifCopy({
      event: "status:in_customs",
      templateKey: "cobro_anticipado",
    });
    expect(copy).toEqual(TEMPLATE_COPY.cobro_anticipado);
  });

  it("el texto propio (custom) gana a template y default, campo por campo", () => {
    const copy = resolveNotifCopy({
      event: "status:shipped",
      templateKey: "va_llegando",
      customTitle: "Título mío",
      customBody: "",
    });
    // custom title override; body cae al template (custom vacío).
    expect(copy.title).toBe("Título mío");
    expect(copy.body).toBe(TEMPLATE_COPY.va_llegando.body);
  });

  it("evento sin default cae a copy genérico por label de status", () => {
    const copy = resolveNotifCopy({ event: "status:delayed_warehouse" });
    expect(copy.title).toContain("Bodegaje");
  });

  it("evento totalmente desconocido cae a texto neutro", () => {
    const copy = resolveNotifCopy({ event: "loquesea" });
    expect(copy.title).toBe("Actualización de tu envío");
  });

  it("los eventos Slice D tienen copy propio (no genérico) — F0/Motor", () => {
    for (const evt of ["consolidated", "eta_set", "received_ve"] as const) {
      const copy = resolveNotifCopy({ event: evt });
      expect(copy).toEqual(DEFAULT_EVENT_COPY[evt]);
      expect(copy.title).not.toBe("Actualización de tu envío");
    }
  });
});

describe("formatOffset", () => {
  it("cero = al instante", () => {
    expect(formatOffset(0)).toBe("al instante");
  });
  it("días con signo", () => {
    expect(formatOffset(7200)).toBe("+5 día(s)");
    expect(formatOffset(-2880)).toBe("−2 día(s)");
  });
  it("horas y minutos", () => {
    expect(formatOffset(120)).toBe("+2 h");
    expect(formatOffset(-45)).toBe("−45 min");
  });
});

describe("catálogo de eventos", () => {
  it("todos los eventos del seed default están en el catálogo", () => {
    for (const evt of DEFAULT_SEED_EVENTS) {
      expect(CLIENT_JOURNEY_EVENT_KEYS.has(evt)).toBe(true);
    }
  });

  it("el seed = los 4 hitos de status (Slice A) + received_ve (Slice D canónico)", () => {
    for (const evt of DEFAULT_SEED_EVENTS) {
      const def = CLIENT_JOURNEY_EVENTS.find((e) => e.key === evt);
      const expected = evt === "received_ve" ? "D" : "A";
      expect(def?.slice).toBe(expected);
    }
    expect(DEFAULT_SEED_EVENTS).toContain("received_ve");
  });
  it("journeyEventLabel devuelve la etiqueta o la clave cruda", () => {
    expect(journeyEventLabel("status:in_customs")).toBe("En aduana");
    expect(journeyEventLabel("desconocido")).toBe("desconocido");
  });
  it("Slice D incluye la ancla ETA (va llegando)", () => {
    const etaEvent = CLIENT_JOURNEY_EVENTS.find((e) => e.key === "eta_set");
    expect(etaEvent?.slice).toBe("D");
  });
});
