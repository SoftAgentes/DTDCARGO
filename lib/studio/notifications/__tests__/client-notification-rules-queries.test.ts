/**
 * SDD-0156 · validación de reglas de notificación (validateRuleInput).
 */
import { describe, it, expect } from "vitest";
import {
  validateRuleInput,
  type UpsertRuleInput,
} from "../client-notification-rules-queries";

function base(): UpsertRuleInput {
  return {
    trigger_event: "status:shipped",
    channel: "email",
    anchor: "event",
    offset_minutes: 0,
    visible_in_portal: true,
    active: true,
  };
}

describe("validateRuleInput", () => {
  it("acepta una regla válida y la sanea", () => {
    const res = validateRuleInput({
      ...base(),
      client_id: "  c-1  ",
      template_key: "  cobro_anticipado  ",
      custom_title: "  ",
    });
    expect("ok" in res && res.ok).toBe(true);
    if ("ok" in res) {
      expect(res.value.client_id).toBe("c-1");
      expect(res.value.template_key).toBe("cobro_anticipado");
      expect(res.value.custom_title).toBeNull(); // blanco → null
    }
  });

  it("rechaza evento fuera del catálogo", () => {
    const res = validateRuleInput({ ...base(), trigger_event: "status:xxx" });
    expect("error" in res).toBe(true);
  });

  it("rechaza canal inválido", () => {
    const res = validateRuleInput({ ...base(), channel: "sms" });
    expect("error" in res).toBe(true);
  });

  it("rechaza ancla inválida", () => {
    const res = validateRuleInput({ ...base(), anchor: "moon" });
    expect("error" in res).toBe(true);
  });

  it("rechaza offset no entero", () => {
    const res = validateRuleInput({ ...base(), offset_minutes: 1.5 });
    expect("error" in res).toBe(true);
  });

  it("rechaza offset fuera de rango (>120 días)", () => {
    const res = validateRuleInput({ ...base(), offset_minutes: 200 * 24 * 60 });
    expect("error" in res).toBe(true);
  });

  it("acepta offset negativo (antes del ancla)", () => {
    const res = validateRuleInput({ ...base(), offset_minutes: -7200, anchor: "eta" });
    expect("ok" in res && res.ok).toBe(true);
    if ("ok" in res) expect(res.value.offset_minutes).toBe(-7200);
  });

  it("client_id vacío → null (regla default del tenant)", () => {
    const res = validateRuleInput({ ...base(), client_id: "   " });
    expect("ok" in res && res.ok).toBe(true);
    if ("ok" in res) expect(res.value.client_id).toBeNull();
  });
});
