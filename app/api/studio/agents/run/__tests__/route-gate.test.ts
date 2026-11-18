// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SDD-0624 · Correr un agente exige el módulo Admin.
 *
 * Antes bastaba la sesión: cualquier rol del tenant podía invocar
 * `POST /api/studio/agents/run` directo y gastar presupuesto de LLM. Ahora
 * `moduleEditDenial(supabase, "admin")` responde 403 ANTES de crear el cliente
 * admin o tocar el orquestador.
 */
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(async () => ({ data: { user: { id: "u-1" } } })),
  moduleEditDenial: vi.fn(async () => null as string | null),
  createAdminClient: vi.fn(() => ({})),
  runAgent: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: mocks.moduleEditDenial }));
vi.mock("@/lib/studio/agents/runtime/orchestrator", () => ({ runAgent: mocks.runAgent }));
vi.mock("@/lib/studio/agents/runtime/llm-client-factory", () => ({ createLLMClient: vi.fn(() => ({})) }));

import { POST } from "../route";

function pedido(): Request {
  return new Request("http://localhost/api/studio/agents/run", {
    method: "POST",
    body: JSON.stringify({ agent_id: "agente-1", input: {} }),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/studio/agents/run · gate de Admin (SDD-0624)", () => {
  it("sin el módulo Admin → 403 y no toca el runtime", async () => {
    mocks.moduleEditDenial.mockResolvedValueOnce("No tienes permiso para realizar esta acción.");
    const res = await POST(pedido());
    expect(res.status).toBe(403);
    expect(mocks.moduleEditDenial).toHaveBeenCalledWith(expect.anything(), "admin");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.runAgent).not.toHaveBeenCalled();
  });

  it("sin sesión → 401 antes del gate", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } } as never);
    const res = await POST(pedido());
    expect(res.status).toBe(401);
    expect(mocks.runAgent).not.toHaveBeenCalled();
  });

  it("con el módulo Admin sigue al runtime", async () => {
    await POST(pedido());
    expect(mocks.moduleEditDenial).toHaveBeenCalledTimes(1);
    expect(mocks.createAdminClient).toHaveBeenCalled();
  });
});
