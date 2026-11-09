// @vitest-environment node
/**
 * Cola durable de avisos a Discord (SDD-0606, A3).
 *
 * Se mide sobre lo que sale (pedidos a Discord) y sobre cómo queda cada fila.
 * El doble de la base aplica de verdad los filtros de cada consulta: un doble
 * que ignora filtros dejaría pasar justo el candado que estas pruebas miden.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ALERT_OUTBOX_MAX_ATTEMPTS,
  drainAlertOutbox,
  enqueueAlert,
  nextAttemptDelayMs,
} from "../alert-outbox";
import { fakeWebhook, mensajeGuardado } from "@/lib/studio/discord/__tests__/webhook-fixture";

type Row = Record<string, unknown>;

/** Doble mínimo con filtros reales para la tabla de la cola. */
function makeDb(rows: Row[]) {
  const table: Row[] = rows.map((r) => ({ ...r }));

  function from(name: string) {
    if (name !== "studio_alert_outbox") throw new Error(`tabla inesperada: ${name}`);
    const filters: Array<(r: Row) => boolean> = [];
    let op: "select" | "update" | "delete" = "select";
    let patch: Row = {};
    let limit = Infinity;
    let returning = false;

    const run = () => {
      const hits = table.filter((r) => filters.every((f) => f(r)));
      if (op === "update") {
        for (const r of hits) Object.assign(r, patch);
        return { data: returning ? hits.map((r) => ({ id: r.id })) : null, error: null };
      }
      if (op === "delete") {
        for (const r of hits) table.splice(table.indexOf(r), 1);
        return { data: returning ? hits.map((r) => ({ id: r.id })) : null, error: null };
      }
      return { data: hits.slice(0, limit).map((r) => ({ ...r })), error: null };
    };

    const chain = {
      select() {
        if (op !== "select") returning = true;
        return chain;
      },
      insert(row: Row) {
        table.push({ id: `nueva-${table.length + 1}`, delivered_at: null, abandoned_at: null, ...row });
        return Promise.resolve({ data: null, error: null });
      },
      update(p: Row) {
        op = "update";
        patch = p;
        return chain;
      },
      delete() {
        op = "delete";
        return chain;
      },
      eq(col: string, val: unknown) {
        filters.push((r) => r[col] === val);
        return chain;
      },
      is(col: string, val: unknown) {
        filters.push((r) => (val === null ? r[col] == null : r[col] === val));
        return chain;
      },
      lte(col: string, val: string) {
        filters.push((r) => String(r[col]) <= val);
        return chain;
      },
      lt(col: string, val: string) {
        filters.push((r) => r[col] != null && String(r[col]) < val);
        return chain;
      },
      order() {
        return chain;
      },
      limit(n: number) {
        limit = n;
        return chain;
      },
      then(ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) {
        return Promise.resolve(run()).then(ok, ko);
      },
    };
    return chain;
  }

  return { admin: { from } as never, table };
}

const TENANT = "00000000-0000-4000-8000-000000000001";
const HOOK_REGISTRO = fakeWebhook(3001);
const HOOK_EQUIPO = fakeWebhook(3005);
const NOW = new Date("2026-11-05T20:00:00.000Z");
const ANTES = "2026-11-05T19:59:00.000Z";
const DESPUES = "2026-11-05T20:30:00.000Z";

const fila = (over: Row = {}): Row => ({
  id: "f1",
  tenant_id: TENANT,
  category: "registro",
  payload: { titulo: "Cliente nuevo", codigo: "DTD-0123", url: "https://dtdcargo.com/studio/clientes/DTD-0123" },
  mention_user_ids: [],
  attempts: 1,
  next_attempt_at: ANTES,
  delivered_at: null,
  abandoned_at: null,
  created_at: "2026-11-05T19:58:00.000Z",
  ...over,
});

let pedidos: string[] = [];
let respuestas: Record<string, number | Error | Response> = {};

beforeEach(() => {
  pedidos = [];
  respuestas = {};
  vi.stubEnv("DISCORD_TENANT_ID", TENANT);
  vi.stubEnv("DISCORD_WEBHOOK_REGISTRO", HOOK_REGISTRO);
  vi.stubEnv("DISCORD_WEBHOOK_EQUIPO", HOOK_EQUIPO);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo | URL) => {
      const u = new URL(String(url));
      const base = `${u.origin}${u.pathname}`;
      pedidos.push(base);
      const r = respuestas[base];
      if (r instanceof Error) throw r;
      if (r instanceof Response) return r;
      if (typeof r === "number") return new Response(null, { status: r });
      return mensajeGuardado(7);
    }),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("enqueueAlert", () => {
  it("guarda sólo el aviso mínimo, con el primer reintento en un minuto", async () => {
    const { admin, table } = makeDb([]);
    const ok = await enqueueAlert(
      admin,
      {
        tenantId: TENANT,
        category: "registro",
        aviso: {
          titulo: "Cliente nuevo",
          codigo: "DTD-0123",
          // Un campo de más no pasa: el tipo no lo admite y payloadOf lo descarta.
          ...({ telegramText: "María Pérez · 0412" } as object),
        } as never,
        mentionUserIds: ["111111111111111111", "everyone"],
        lastError: "Discord respondió HTTP 503",
      },
      NOW,
    );
    expect(ok).toBe(true);
    expect(table).toHaveLength(1);
    expect(table[0].payload).toEqual({ titulo: "Cliente nuevo", codigo: "DTD-0123" });
    expect(JSON.stringify(table[0])).not.toContain("María");
    expect(table[0].mention_user_ids).toEqual(["111111111111111111"]);
    expect(table[0].attempts).toBe(1);
    expect(table[0].next_attempt_at).toBe(new Date(NOW.getTime() + 60_000).toISOString());
  });
});

describe("drainAlertOutbox", () => {
  it("entrega una fila vencida y guarda el ID del mensaje", async () => {
    const { admin, table } = makeDb([fila()]);
    const r = await drainAlertOutbox(admin, NOW);

    expect(r).toMatchObject({ processed: 1, delivered: 1, retried: 0 });
    expect(pedidos).toEqual([HOOK_REGISTRO]);
    expect(table[0].delivered_at).toBe(NOW.toISOString());
    expect(table[0].discord_message_id).toMatch(/^13\d{17}$/);
  });

  it("no toca una fila que todavía no vence", async () => {
    const { admin, table } = makeDb([fila({ next_attempt_at: DESPUES })]);
    const r = await drainAlertOutbox(admin, NOW);
    expect(r.processed).toBe(0);
    expect(pedidos).toHaveLength(0);
    expect(table[0].delivered_at).toBeNull();
  });

  it("si Discord sigue sin guardarlo, reprograma con espera creciente", async () => {
    respuestas[HOOK_REGISTRO] = 503;
    respuestas[HOOK_EQUIPO] = 503;
    const { admin, table } = makeDb([fila({ attempts: 2 })]);
    const r = await drainAlertOutbox(admin, NOW);

    expect(r).toMatchObject({ processed: 1, retried: 1, delivered: 0 });
    expect(table[0].attempts).toBe(3);
    expect(table[0].next_attempt_at).toBe(
      new Date(NOW.getTime() + nextAttemptDelayMs(3)).toISOString(),
    );
    expect(table[0].last_error).toContain("503");
    expect(table[0].delivered_at).toBeNull();
  });

  it("al llegar al máximo de intentos la deja abandonada, con su error", async () => {
    respuestas[HOOK_REGISTRO] = 503;
    respuestas[HOOK_EQUIPO] = 503;
    const { admin, table } = makeDb([fila({ attempts: ALERT_OUTBOX_MAX_ATTEMPTS - 1 })]);
    const r = await drainAlertOutbox(admin, NOW);

    expect(r.abandoned).toBe(1);
    expect(table[0].abandoned_at).toBe(NOW.toISOString());
    expect(table[0].last_error).toContain("503");
  });

  it("M2: una entrega incierta cierra la fila sin repetir", async () => {
    respuestas[HOOK_REGISTRO] = new DOMException("timed out", "TimeoutError") as unknown as Error;
    const { admin, table } = makeDb([fila()]);
    const r = await drainAlertOutbox(admin, NOW);

    expect(r).toMatchObject({ uncertain: 1, delivered: 0 });
    expect(pedidos).toEqual([HOOK_REGISTRO]);
    expect(table[0].delivered_at).toBe(NOW.toISOString());
    expect(table[0].last_error).toContain("incierto");
  });

  it("M1: si Discord pide esperar demasiado, frena el lote", async () => {
    const largo = () =>
      new Response(JSON.stringify({ retry_after: 60 }), { status: 429 });
    respuestas[HOOK_REGISTRO] = largo();
    respuestas[HOOK_EQUIPO] = largo();
    const { admin, table } = makeDb([
      fila({ id: "a", created_at: "2026-11-05T19:00:00.000Z" }),
      fila({ id: "b", created_at: "2026-11-05T19:01:00.000Z" }),
    ]);
    const r = await drainAlertOutbox(admin, NOW);

    expect(r.throttled).toBe(true);
    expect(r.processed).toBe(1);
    expect(table.find((t) => t.id === "b")?.next_attempt_at).toBe(ANTES);
  });

  it("dos drenados a la vez no mandan la misma fila dos veces", async () => {
    const { admin } = makeDb([fila()]);
    await Promise.all([drainAlertOutbox(admin, NOW), drainAlertOutbox(admin, NOW)]);
    expect(pedidos).toEqual([HOOK_REGISTRO]);
  });

  it("A5: una fila de otro tenant no sale a Discord", async () => {
    const { admin, table } = makeDb([fila({ tenant_id: "00000000-0000-4000-8000-000000000002" })]);
    const r = await drainAlertOutbox(admin, NOW);
    expect(pedidos).toHaveLength(0);
    expect(r.retried).toBe(1);
    expect(table[0].last_error).toContain("no configurado");
  });

  it("una fila con un aviso inválido se abandona sin mandar nada", async () => {
    const { admin, table } = makeDb([fila({ payload: { codigo: "sin título" } })]);
    const r = await drainAlertOutbox(admin, NOW);
    expect(r.abandoned).toBe(1);
    expect(pedidos).toHaveLength(0);
    expect(table[0].abandoned_at).toBe(NOW.toISOString());
  });

  it("borra las filas cerradas de más de 30 días y deja las recientes", async () => {
    const viejo = "2026-09-01T00:00:00.000Z";
    const { admin, table } = makeDb([
      fila({ id: "vieja-entregada", delivered_at: viejo, next_attempt_at: viejo }),
      fila({ id: "vieja-abandonada", abandoned_at: viejo, next_attempt_at: viejo }),
      fila({ id: "reciente", delivered_at: ANTES }),
    ]);
    const r = await drainAlertOutbox(admin, NOW);
    expect(r.purged).toBe(2);
    expect(table.map((t) => t.id)).toEqual(["reciente"]);
  });

  it("si la tabla no existe, no lanza", async () => {
    const roto = {
      from() {
        throw new Error('relation "studio_alert_outbox" does not exist');
      },
    } as never;
    await expect(drainAlertOutbox(roto, NOW)).resolves.toMatchObject({ processed: 0 });
  });
});
