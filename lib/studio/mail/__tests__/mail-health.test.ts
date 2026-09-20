// @vitest-environment node
/**
 * mail-health · clasificación de correos que no llegaron.
 *
 * Lo que se prueba, y por qué cada caso existe:
 *   1. `queued` viejo → 'nunca_salio'. Es el bug real: 8 filas atascadas en prod,
 *      la más vieja del 2026-05-29.
 *   2. `queued` reciente → null. Un correo de hace 2 minutos puede estar en
 *      vuelo; avisar de él sería ruido y entrenaría al equipo a ignorar el aviso.
 *   3. bounced/failed/complained → 'no_llego' sin importar la edad.
 *   4. ⚠️ ANTI-BUCLE: los correos del propio aviso (`source: 'mail-health'`) se
 *      ignoran SIEMPRE. Sin esto, un aviso que se queda en queued genera un
 *      aviso sobre el aviso, para siempre.
 *   5. Ya avisado (`health_alerted_at`) → null. El aviso es una vez, no un
 *      recordatorio cada 30 minutos.
 */
import { describe, it, expect } from "vitest";
import {
  buildSupersedeIndex,
  classifyMailFailure,
  collectFailures,
  supersedeKey,
  ALERTED_KEY,
  MAIL_HEALTH_SOURCE,
  STUCK_MINUTES,
  type MailHealthRow,
} from "../mail-health";

const NOW = Date.parse("2026-08-05T22:00:00.000Z");

function row(over: Partial<MailHealthRow> = {}): MailHealthRow {
  return {
    id: "log-1",
    to_email: "cliente@ejemplo.com",
    subject: "Bienvenido a DTD Cargo",
    status: "queued",
    template_slug: "welcome_markbox",
    created_at: "2026-06-07T06:37:47.000Z", // muy viejo
    metadata: {},
    ...over,
  };
}

describe("classifyMailFailure", () => {
  it("marca 'nunca_salio' un queued más viejo que la ventana", () => {
    expect(classifyMailFailure(row(), NOW)).toBe("nunca_salio");
  });

  it("NO marca un queued recién creado (puede estar en vuelo)", () => {
    const reciente = row({
      created_at: new Date(NOW - 2 * 60_000).toISOString(),
    });
    expect(classifyMailFailure(reciente, NOW)).toBeNull();
  });

  it("respeta el borde exacto de la ventana", () => {
    const justoAntes = row({
      created_at: new Date(NOW - (STUCK_MINUTES - 1) * 60_000).toISOString(),
    });
    const justoDespues = row({
      created_at: new Date(NOW - STUCK_MINUTES * 60_000).toISOString(),
    });
    expect(classifyMailFailure(justoAntes, NOW)).toBeNull();
    expect(classifyMailFailure(justoDespues, NOW)).toBe("nunca_salio");
  });

  it.each(["bounced", "failed", "complained"])(
    "marca 'no_llego' el status %s aunque sea recién creado",
    (status) => {
      const r = row({ status, created_at: new Date(NOW).toISOString() });
      expect(classifyMailFailure(r, NOW)).toBe("no_llego");
    },
  );

  it("ignora statuses sanos", () => {
    expect(classifyMailFailure(row({ status: "delivered" }), NOW)).toBeNull();
    expect(classifyMailFailure(row({ status: "sent" }), NOW)).toBeNull();
  });

  it("⚠️ NUNCA avisa de los correos del propio aviso — corta el bucle", () => {
    const propio = row({
      status: "queued",
      metadata: { source: MAIL_HEALTH_SOURCE },
    });
    // Sin este guard, este mismo correo generaría otro aviso, y así al infinito.
    expect(classifyMailFailure(propio, NOW)).toBeNull();

    // Y tampoco cuando rebota, que es el caso que de verdad se realimenta.
    const propioRebotado = row({
      status: "bounced",
      metadata: { source: MAIL_HEALTH_SOURCE },
    });
    expect(classifyMailFailure(propioRebotado, NOW)).toBeNull();
  });

  it("no repite un fallo ya avisado", () => {
    const avisado = row({
      metadata: { [ALERTED_KEY]: "2026-08-05T21:00:00.000Z" },
    });
    expect(classifyMailFailure(avisado, NOW)).toBeNull();
  });

  it("tolera metadata null y fecha ilegible sin inventar un fallo", () => {
    expect(classifyMailFailure(row({ metadata: null }), NOW)).toBe("nunca_salio");
    expect(
      classifyMailFailure(row({ created_at: "no-es-fecha" }), NOW),
    ).toBeNull();
  });
});

describe("collectFailures", () => {
  it("devuelve solo los fallos, conservando la fila para el aviso", () => {
    const rows = [
      row({ id: "viejo-queued" }),
      row({ id: "sano", status: "delivered" }),
      row({ id: "rebotado", status: "bounced" }),
      row({ id: "propio", metadata: { source: MAIL_HEALTH_SOURCE } }),
    ];

    const out = collectFailures(rows, NOW);

    expect(out.map((f) => f.row.id)).toEqual(["viejo-queued", "rebotado"]);
    expect(out.map((f) => f.kind)).toEqual(["nunca_salio", "no_llego"]);
  });

  it("devuelve vacío cuando no hay nada roto", () => {
    expect(collectFailures([row({ status: "delivered" })], NOW)).toEqual([]);
  });
});

// ── Superados: el fallo que un reintento posterior ya resolvió ───────────────
//
// Caso real (prod, 2026-07-11): una invitación al portal falló 16:22 y salió
// bien 21:11 el MISMO día. El aviso seguía reportando la de las 16:22 como
// "nunca salió". De los 12 correos que listaba, 3 ya estaban atendidos.
describe("supersede · no reportar lo que ya se resolvió", () => {
  const INVITE = {
    to_email: "cliente@ejemplo.com",
    template_slug: null,
    subject: "Te damos acceso a tu portal · DTD Cargo",
  };

  it("calla el fallo cuando el MISMO correo salió después", () => {
    const fallo = row({ created_at: "2026-07-11T16:22:30.000Z" });
    const index = buildSupersedeIndex([
      {
        to_email: fallo.to_email,
        subject: fallo.subject,
        template_slug: fallo.template_slug,
        created_at: "2026-07-11T21:11:18.000Z",
      },
    ]);
    expect(
      classifyMailFailure(fallo, NOW, STUCK_MINUTES, index.get(supersedeKey(fallo)) ?? null),
    ).toBeNull();
  });

  it("SIGUE avisando si el envío exitoso es ANTERIOR al fallo", () => {
    const fallo = row({ created_at: "2026-07-11T16:22:30.000Z" });
    const index = buildSupersedeIndex([
      {
        to_email: fallo.to_email,
        subject: fallo.subject,
        template_slug: fallo.template_slug,
        created_at: "2026-07-10T09:00:00.000Z",
      },
    ]);
    expect(
      classifyMailFailure(fallo, NOW, STUCK_MINUTES, index.get(supersedeKey(fallo)) ?? null),
    ).toBe("nunca_salio");
  });

  it("⚠️ NO calla la bienvenida porque al cliente le llegó OTRA cosa después", () => {
    // El riesgo de aflojar la clave: a un cliente le llegan diez facturas y su
    // bienvenida sigue sin salir. La clave es destinatario + QUÉ correo.
    const bienvenida = row({ created_at: "2026-06-07T06:37:47.000Z" });
    const index = buildSupersedeIndex([
      {
        to_email: bienvenida.to_email,
        subject: "Tu factura de julio",
        template_slug: "invoice_issued",
        created_at: "2026-07-20T10:00:00.000Z",
      },
    ]);
    expect(
      classifyMailFailure(
        bienvenida,
        NOW,
        STUCK_MINUTES,
        index.get(supersedeKey(bienvenida)) ?? null,
      ),
    ).toBe("nunca_salio");
  });

  it("empareja por asunto cuando la fila no guardó plantilla", () => {
    const fallo = row({ ...INVITE, created_at: "2026-07-11T16:22:30.000Z" });
    const index = buildSupersedeIndex([
      { ...INVITE, created_at: "2026-07-11T21:11:18.000Z" },
    ]);
    expect(index.get(supersedeKey(fallo))).toBeDefined();
  });

  it("se queda con el envío exitoso MÁS NUEVO", () => {
    const index = buildSupersedeIndex([
      { ...INVITE, created_at: "2026-07-11T21:11:18.000Z" },
      { ...INVITE, created_at: "2026-07-17T08:00:00.000Z" },
      { ...INVITE, created_at: "2026-07-01T08:00:00.000Z" },
    ]);
    expect(index.get(supersedeKey(INVITE))).toBe(
      Date.parse("2026-07-17T08:00:00.000Z"),
    );
  });

  it("ignora fechas ilegibles sin romper el índice", () => {
    const index = buildSupersedeIndex([{ ...INVITE, created_at: "no-es-fecha" }]);
    expect(index.size).toBe(0);
  });

  it("collectFailures filtra los superados del lote", () => {
    const superado = row({ id: "ya-resuelto", created_at: "2026-07-11T16:22:30.000Z" });
    const pendiente = row({
      id: "sigue-roto",
      to_email: "otro@ejemplo.com",
      created_at: "2026-06-07T06:37:47.000Z",
    });
    const index = buildSupersedeIndex([
      {
        to_email: superado.to_email,
        subject: superado.subject,
        template_slug: superado.template_slug,
        created_at: "2026-07-11T21:11:18.000Z",
      },
    ]);

    const out = collectFailures([superado, pendiente], NOW, STUCK_MINUTES, index);
    expect(out.map((f) => f.row.id)).toEqual(["sigue-roto"]);
  });

  it("sin índice se comporta como antes (avisa de todo)", () => {
    const out = collectFailures([row()], NOW, STUCK_MINUTES);
    expect(out).toHaveLength(1);
  });
});
