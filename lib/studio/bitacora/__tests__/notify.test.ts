/**
 * SDD-0146 Fase 5 · máscara de canales de Bitácora + funciones puras del digest.
 *
 * Criterios: (d) máscara — email SIEMPRE OFF, in-app SIEMPRE ON, push/telegram
 * según el flag del user (default OFF). (f) digest — agrupación 1-push-por-persona,
 * "empieza por la más urgente", sin tareas = sin push (map vacío), idempotencia
 * por tag+fecha (digestTag determinista), formato del mensaje.
 */
import { describe, it, expect } from "vitest";
import {
  computeBitacoraChannelDecision,
  groupDigestByPerson,
  pickMostUrgent,
  buildDigestMessage,
  digestTag,
  bitacoraTaskDeepLink,
  type DigestTask,
} from "../notify";

describe("computeBitacoraChannelDecision · máscara explícita V1", () => {
  it("sin prefs → in-app ON, email OFF, push OFF, telegram OFF", () => {
    for (const type of ["bitacora_task", "bitacora_digest"] as const) {
      expect(computeBitacoraChannelDecision(null, type)).toEqual({
        inapp: true,
        email: false,
        push: false,
        telegram: false,
      });
    }
  });

  it("email SIEMPRE OFF (aunque el user tenga todo activo)", () => {
    const d = computeBitacoraChannelDecision(
      { channel_push: true, channel_telegram: true },
      "bitacora_task",
    );
    expect(d.email).toBe(false);
    expect(d.inapp).toBe(true);
  });

  it("push según channel_push (OFF = solo campanita)", () => {
    expect(
      computeBitacoraChannelDecision(
        { channel_push: false, channel_telegram: false },
        "bitacora_digest",
      ).push,
    ).toBe(false);
    expect(
      computeBitacoraChannelDecision(
        { channel_push: true, channel_telegram: false },
        "bitacora_digest",
      ).push,
    ).toBe(true);
  });

  it("telegram según channel_telegram", () => {
    expect(
      computeBitacoraChannelDecision(
        { channel_push: false, channel_telegram: true },
        "bitacora_task",
      ).telegram,
    ).toBe(true);
  });
});

describe("bitacoraTaskDeepLink · siempre la URL neutra /ir", () => {
  it("apunta al redirector neutro", () => {
    expect(bitacoraTaskDeepLink("abc")).toBe("/ir/bitacora/tarea/abc");
  });
});

const task = (over: Partial<DigestTask>): DigestTask => ({
  id: "t1",
  titulo: "Tarea",
  prioridad: "media",
  due_date: "2026-07-04",
  ...over,
});

describe("groupDigestByPerson · 1 entrada por persona", () => {
  it("input vacío → map vacío (sin tareas = sin push)", () => {
    expect(groupDigestByPerson([]).size).toBe(0);
  });

  it("una tarea con 2 dueños cae en las 2 personas", () => {
    const map = groupDigestByPerson([
      { ...task({ id: "t1" }), assignees: [{ user_id: "u1" }, { user_id: "u2" }] },
    ]);
    expect(map.size).toBe(2);
    expect(map.get("u1")).toHaveLength(1);
    expect(map.get("u2")).toHaveLength(1);
  });

  it("agrupa varias tareas de la misma persona", () => {
    const map = groupDigestByPerson([
      { ...task({ id: "t1" }), assignees: [{ user_id: "u1" }] },
      { ...task({ id: "t2" }), assignees: [{ user_id: "u1" }] },
    ]);
    expect(map.get("u1")).toHaveLength(2);
  });
});

describe("pickMostUrgent · atrasada primero, luego prioridad", () => {
  it("la de due_date más temprana gana", () => {
    const u = pickMostUrgent([
      task({ id: "a", due_date: "2026-07-04" }),
      task({ id: "b", due_date: "2026-07-01" }),
    ]);
    expect(u?.id).toBe("b");
  });

  it("a igual fecha, prioridad alta gana", () => {
    const u = pickMostUrgent([
      task({ id: "a", due_date: "2026-07-04", prioridad: "baja" }),
      task({ id: "b", due_date: "2026-07-04", prioridad: "alta" }),
    ]);
    expect(u?.id).toBe("b");
  });

  it("lista vacía → null", () => {
    expect(pickMostUrgent([])).toBeNull();
  });
});

describe("buildDigestMessage · 'empieza por la más urgente'", () => {
  it("cuenta total + atrasadas + arranca por la más urgente", () => {
    const { label, body } = buildDigestMessage(
      [
        task({ id: "a", titulo: "Llamar proveedor", due_date: "2026-07-01", prioridad: "alta" }),
        task({ id: "b", titulo: "Revisar factura", due_date: "2026-07-04" }),
      ],
      "2026-07-04",
    );
    expect(label).toBeTruthy();
    expect(body).toContain("Tienes 2 tareas pendientes");
    expect(body).toContain("1 atrasada");
    expect(body).toContain("Empieza por: Llamar proveedor");
  });

  it("singular '1 tarea pendiente' + sin atrasadas no muestra el segmento", () => {
    const { body } = buildDigestMessage(
      [task({ id: "a", titulo: "Sola", due_date: "2026-07-04" })],
      "2026-07-04",
    );
    expect(body).toContain("Tienes 1 tarea pendiente");
    expect(body).not.toContain("atrasada");
    expect(body).toContain("Empieza por: Sola");
  });
});

describe("digestTag · idempotencia por fecha", () => {
  it("determinista por fecha (dos corridas del mismo día = mismo tag)", () => {
    expect(digestTag("2026-07-04")).toBe("recordatorio-bitacora-2026-07-04");
    expect(digestTag("2026-07-04")).toBe(digestTag("2026-07-04"));
    expect(digestTag("2026-07-05")).not.toBe(digestTag("2026-07-04"));
  });
});
