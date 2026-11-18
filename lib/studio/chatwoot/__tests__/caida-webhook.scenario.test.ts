// @vitest-environment node
/**
 * SDD-0585 · paso 2.6 · pruebas de caída del webhook, de punta a punta.
 *
 * Las funciones REALES de TypeScript (`procesarEventoChatwoot`,
 * `reprocesarEventosChatwoot`, `aplicarConversacion`) contra la 0504 REAL en
 * PGlite: el doble de Supabase solo traduce `admin.rpc(nombre, args)` a
 * `select * from public.nombre(p => $1, …)`. Así se prueba el contrato entre las
 * dos mitades, que las pruebas de cada lado por separado no ven.
 *
 *  1. El aviso falla al llegar el webhook → «fallido» → el cron no lo toma antes
 *     de su espera → al vencer, lo reintenta y queda «procesado»; la reentrega
 *     de Chatwoot es «duplicado».
 *  2. Cinco fallos seguidos → «descartado» y el cron ya no lo toma.
 *  3. Webhook perdido (un agente lee sin responder) → la reconciliación corrige
 *     el contador; un dato más viejo no lo pisa.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { interpretarEvento } from "../webhook-events";
import { aplicarConversacion, procesarEventoChatwoot, reprocesarEventosChatwoot, type ManejadorEvento } from "../webhook-procesar";
import { conversacionSintetica, estadoCambiado, mensajeCreado } from "./webhook-fixtures";

vi.mock("@/lib/studio/feature-flags-queries", () => ({ listFeatureFlags: async () => ({}) }));
vi.mock("@/lib/studio/notify/operario-push-outbox", () => ({ enqueueUserPush: vi.fn(), drainOperarioPushOutbox: vi.fn() }));

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const read = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const T1 = "10000000-0000-0000-0000-000000000001";
const SLOW = 180_000;

/** El montaje del contrato de la 0504 (roles, tablas que da por sentadas y datos sintéticos) más la 0504 real. */
function montaje(): string {
  const contrato = read(resolve(ROOT, "supabase/tests/0504_chatwoot_eventos.test.sql"));
  const desde = contrato.indexOf("do $roles$");
  const hasta = contrato.indexOf("create temporary sequence assertion_count;");
  if (desde < 0 || hasta < 0) throw new Error("el contrato de la 0504 cambió de forma");
  return contrato
    .slice(desde, hasta)
    .split("\\ir ../migrations/0504_chatwoot_eventos.sql")
    .join(read(resolve(ROOT, "supabase/migrations/0504_chatwoot_eventos.sql")));
}

/** `admin.rpc` sobre PGlite, con parámetros por nombre. Devuelve la forma de supabase-js. */
function adminSobre(db: PGlite) {
  return {
    rpc: async (nombre: string, args: Record<string, unknown>) => {
      const claves = Object.keys(args);
      const sql = `select * from public.${nombre}(${claves.map((k, i) => `${k} => $${i + 1}`).join(", ")})`;
      try {
        const r = await db.query(sql, claves.map((k) => args[k]));
        const filas = r.rows as Record<string, unknown>[];
        // Una función escalar (`chatwoot_cerrar_evento`) vuelve como una fila con su nombre.
        const unica = filas.length === 1 && Object.keys(filas[0]).length === 1 ? Object.values(filas[0])[0] : undefined;
        return { data: unica !== undefined && Object.keys(filas[0])[0] === nombre ? unica : filas, error: null };
      } catch (e) {
        return { data: null, error: { code: (e as { code?: string }).code ?? "error", message: String(e) } };
      }
    },
  };
}

let db: PGlite;
let admin: ReturnType<typeof adminSobre>;
const ctx = () => ({ admin: admin as never, tenantId: T1 });
const estado = async (clave: string) =>
  (await db.query<{ status: string; attempts: number }>(
    "select status, attempts from public.chatwoot_webhook_events where tenant_id = $1 and event_key = $2",
    [T1, clave],
  )).rows[0];
const vencer = (clave: string) =>
  db.query("update public.chatwoot_webhook_events set next_attempt_at = now() - interval '1 second' where event_key = $1", [clave]);

beforeAll(async () => {
  db = await pgliteLimpio();
  await db.exec(montaje());
  admin = adminSobre(db);
}, SLOW);
afterAll(async () => {
  await db?.close();
});

describe("caída del webhook de punta a punta (SDD-0585, 2.6)", () => {
  it("1 · el aviso falla, el cron espera, reintenta y la reentrega es duplicado", async () => {
    const evento = interpretarEvento(mensajeCreado({ id: 9001, conversation: conversacionSintetica({ id: 41 }) }))!;
    let caido = true;
    const aviso: ManejadorEvento = async () => {
      if (caido) throw new Error("push caído");
    };

    expect((await procesarEventoChatwoot(ctx(), evento, [aviso])).estado).toBe("fallido");
    expect(await estado(evento.clave)).toEqual({ status: "fallido", attempts: 1 });

    // Antes de que venza la espera, el cron no lo toma.
    expect((await reprocesarEventosChatwoot(admin as never, [aviso])).tomados).toBe(0);

    caido = false;
    await vencer(evento.clave);
    expect(await reprocesarEventosChatwoot(admin as never, [aviso])).toEqual({ tomados: 1, procesados: 1, fallidos: 0 });
    expect(await estado(evento.clave)).toEqual({ status: "procesado", attempts: 2 });

    // Chatwoot no reintenta, pero si alguien reenvía el mismo mensaje no se avisa dos veces.
    expect((await procesarEventoChatwoot(ctx(), evento, [aviso])).estado).toBe("duplicado");
  }, SLOW);

  it("2 · cinco fallos seguidos lo dejan descartado y el cron ya no lo toma", async () => {
    const evento = interpretarEvento(mensajeCreado({ id: 9002, conversation: conversacionSintetica({ id: 42 }) }))!;
    const siempreFalla: ManejadorEvento = async () => {
      throw new Error("push caído");
    };
    await procesarEventoChatwoot(ctx(), evento, [siempreFalla]);
    for (let i = 0; i < 4; i += 1) {
      await vencer(evento.clave);
      await reprocesarEventosChatwoot(admin as never, [siempreFalla]);
    }
    expect(await estado(evento.clave)).toEqual({ status: "descartado", attempts: 5 });
    await vencer(evento.clave);
    expect((await reprocesarEventosChatwoot(admin as never, [siempreFalla])).tomados).toBe(0);
  }, SLOW);

  it("3 · webhook perdido: la reconciliación corrige el contador y un dato viejo no lo pisa", async () => {
    const leer = async () =>
      (await db.query<{ unread_count: number; status: string }>(
        "select unread_count, status from public.chatwoot_conversations where tenant_id = $1 and conversation_id = 43",
        [T1],
      )).rows[0];

    // Llega un mensaje: 2 no leídos.
    const evento = interpretarEvento(mensajeCreado({ id: 9003, conversation: conversacionSintetica({ id: 43, unread_count: 2, updated_at: 1_761_760_000 }) }))!;
    await procesarEventoChatwoot(ctx(), evento, []);
    expect(await leer()).toEqual({ unread_count: 2, status: "open" });

    // El agente lo lee en Chatwoot sin responder: no hay webhook. Al abrir la Bandeja, la reconciliación.
    const leida = interpretarEvento(estadoCambiado({ id: 43, status: "open", unread_count: 0, updated_at: 1_761_760_050 }))!.conversacion;
    await aplicarConversacion(ctx(), leida, null);
    expect(await leer()).toEqual({ unread_count: 0, status: "open" });

    // Una entrega atrasada, más vieja, no vuelve a subir el contador.
    const vieja = interpretarEvento(estadoCambiado({ id: 43, status: "open", unread_count: 2, updated_at: 1_761_760_010 }))!.conversacion;
    await aplicarConversacion(ctx(), vieja, null);
    expect(await leer()).toEqual({ unread_count: 0, status: "open" });

    // La reconciliación no deja eventos que el cron reintente.
    const eventos = await db.query<{ n: number }>("select count(*)::int as n from public.chatwoot_webhook_events where conversation_id = 43");
    expect(eventos.rows[0].n).toBe(1);
  }, SLOW);
});
