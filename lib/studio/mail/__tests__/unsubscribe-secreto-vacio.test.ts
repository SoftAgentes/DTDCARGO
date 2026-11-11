// @vitest-environment node
/**
 * SDD-0523 — `EMAIL_UNSUBSCRIBE_SECRET` vacía no puede quedar como clave.
 *
 * El 2026-10-15 el servidor propio la tenía definida y vacía. Con `??` el secreto
 * quedaba en `""`: la ruta lo descartaba con `!secret` y respondía error a TODO
 * enlace, también a los legítimos sellados con el service role. Con sólo
 * espacios era peor: `"   "` pasaba como clave y cualquiera podía sellar un
 * enlace válido. Estas pruebas fijan que vacía o con sólo espacios cuenta como
 * ausente y que, sin ningún secreto, la baja falla cerrada.
 */
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  signUnsubscribeToken,
  unsubscribeSecret,
  unsubscribeSecretSource,
} from "../unsubscribe-token";

const updates: Array<{ table: string; values: Record<string, unknown> }> = [];

function makeAdmin() {
  return {
    from(table: string) {
      const chain = {
        update(values: Record<string, unknown>) {
          updates.push({ table, values });
          return chain;
        },
        eq() {
          return chain;
        },
        ilike() {
          return chain;
        },
        then(resolve: (value: { error: null }) => unknown) {
          return Promise.resolve({ error: null }).then(resolve);
        },
      };
      return chain;
    },
  };
}

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => makeAdmin(),
}));

import { GET as getPath } from "@/app/api/email/unsubscribe/[token]/route";
import { POST as postLegacy } from "@/app/api/email/unsubscribe/route";

const DEDICADO = "secreto-dedicado-de-baja";
const SERVICE_ROLE = "service-role-de-prueba";
const PAYLOAD = { email: "cliente@ejemplo.com", tenantId: "tenant-1", audience: "newsletter" as const };

type Env = { dedicated: string | undefined; serviceRole: string | undefined };

function stubSecrets({ dedicated, serviceRole }: Env) {
  vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET", dedicated);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", serviceRole);
}

/** Token HMAC histórico `<payload>.<firma>`, como los de correos viejos. */
function legacyToken(secret: string): string {
  const body = Buffer.from(
    JSON.stringify({ e: PAYLOAD.email, t: PAYLOAD.tenantId, a: PAYLOAD.audience }),
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

async function visit(token: string) {
  const request = new NextRequest(
    `https://preview.example/api/email/unsubscribe/${encodeURIComponent(token)}`,
  );
  const response = await getPath(request, { params: Promise.resolve({ token }) });
  return response.headers.get("location");
}

beforeEach(() => {
  updates.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("unsubscribeSecret: vacía cuenta como ausente", () => {
  const casos: Array<[string, Env, string | null, ReturnType<typeof unsubscribeSecretSource>]> = [
    ["dedicada vacía → service role", { dedicated: "", serviceRole: SERVICE_ROLE }, SERVICE_ROLE, "service_role"],
    ["dedicada con espacios → service role", { dedicated: "  \t ", serviceRole: SERVICE_ROLE }, SERVICE_ROLE, "service_role"],
    ["dedicada sin definir → service role", { dedicated: undefined, serviceRole: SERVICE_ROLE }, SERVICE_ROLE, "service_role"],
    ["dedicada definida → dedicada", { dedicated: DEDICADO, serviceRole: SERVICE_ROLE }, DEDICADO, "dedicated"],
    ["dedicada definida sin service role → dedicada", { dedicated: DEDICADO, serviceRole: undefined }, DEDICADO, "dedicated"],
    ["las dos vacías → null", { dedicated: "", serviceRole: "" }, null, null],
    ["las dos con espacios → null", { dedicated: " ", serviceRole: "\n" }, null, null],
    ["las dos sin definir → null", { dedicated: undefined, serviceRole: undefined }, null, null],
  ];

  it.each(casos)("%s", (_nombre, env, secreto, fuente) => {
    stubSecrets(env);
    expect(unsubscribeSecret()).toBe(secreto);
    expect(unsubscribeSecretSource()).toBe(fuente);
  });

  it("usa el secreto dedicado tal cual, sin recortarlo", () => {
    stubSecrets({ dedicated: ` ${DEDICADO} `, serviceRole: SERVICE_ROLE });
    expect(unsubscribeSecret()).toBe(` ${DEDICADO} `);
  });
});

describe("ruta de baja con EMAIL_UNSUBSCRIBE_SECRET vacía", () => {
  it.each([
    ["vacía", ""],
    ["con espacios", "   "],
  ])("rechaza un token sellado con el valor de la variable (%s)", async (_nombre, dedicated) => {
    stubSecrets({ dedicated, serviceRole: SERVICE_ROLE });
    const falsificado = signUnsubscribeToken(PAYLOAD, dedicated);

    expect(await visit(falsificado)).toBe("/email/baja?estado=invalido");
    expect(updates).toHaveLength(0);
  });

  it("rechaza un token HMAC histórico firmado con la clave vacía", async () => {
    stubSecrets({ dedicated: "", serviceRole: SERVICE_ROLE });

    expect(await visit(legacyToken(""))).toBe("/email/baja?estado=invalido");
    expect(updates).toHaveLength(0);
  });

  it("acepta el token sellado con el service role, que es el respaldo", async () => {
    stubSecrets({ dedicated: "", serviceRole: SERVICE_ROLE });
    const token = signUnsubscribeToken(PAYLOAD, SERVICE_ROLE);

    expect(await visit(token)).toBe("/email/baja?estado=actualidad");
    expect(updates).toHaveLength(1);
  });

  it("acepta un token HMAC histórico firmado con el service role", async () => {
    stubSecrets({ dedicated: "  ", serviceRole: SERVICE_ROLE });

    expect(await visit(legacyToken(SERVICE_ROLE))).toBe(
      "/email/baja?estado=actualidad",
    );
    expect(updates).toHaveLength(1);
  });

  it("con el dedicado definido, sigue usándolo y no el service role", async () => {
    stubSecrets({ dedicated: DEDICADO, serviceRole: SERVICE_ROLE });

    expect(await visit(signUnsubscribeToken(PAYLOAD, SERVICE_ROLE))).toBe(
      "/email/baja?estado=invalido",
    );
    expect(await visit(signUnsubscribeToken(PAYLOAD, DEDICADO))).toBe(
      "/email/baja?estado=actualidad",
    );
    expect(updates).toHaveLength(1);
  });

  it("el log dice de dónde salió el secreto que se usó de verdad", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubSecrets({ dedicated: "   ", serviceRole: SERVICE_ROLE });

    await visit(signUnsubscribeToken(PAYLOAD, ""));

    expect(warn).toHaveBeenCalledTimes(1);
    const entrada = JSON.parse(String(warn.mock.calls[0][0]));
    expect(entrada).toMatchObject({ event: "email_unsubscribe_invalid", secretSource: "service_role" });
  });
});

describe("sin ningún secreto la baja falla cerrada", () => {
  it.each<[string, Env]>([
    ["las dos vacías", { dedicated: "", serviceRole: "" }],
    ["las dos con espacios", { dedicated: " ", serviceRole: "\t" }],
    ["las dos sin definir", { dedicated: undefined, serviceRole: undefined }],
  ])("no acepta un token sellado con el valor de la variable (%s)", async (_nombre, env) => {
    stubSecrets(env);
    const clave = env.dedicated ?? "";

    expect(await visit(signUnsubscribeToken(PAYLOAD, clave))).toBe(
      "/email/baja?estado=error",
    );
    expect(await visit(legacyToken(clave))).toBe("/email/baja?estado=error");

    const token = signUnsubscribeToken(PAYLOAD, clave);
    const post = await postLegacy(
      new NextRequest(`https://preview.example/api/email/unsubscribe?token=${encodeURIComponent(token)}`, {
        method: "POST",
      }),
    );
    expect(post.status).toBe(500);
    expect(updates).toHaveLength(0);
  });
});
