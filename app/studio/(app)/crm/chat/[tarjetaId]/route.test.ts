/**
 * SDD-0648 §4 · GET /studio/crm/chat/[tarjetaId]: a dónde manda a quien no
 * puede, y que con una tarjeta inválida no toca la base.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.fn();
const getStudioAccess = vi.fn();
const puedeAbrirBandeja = vi.fn();

vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ from }) }));
vi.mock("@/lib/studio/rbac-guard", () => ({ getStudioAccess: (s: unknown) => getStudioAccess(s) }));
vi.mock("@/lib/studio/crm-chat-acceso", () => ({ puedeAbrirBandeja: (s: unknown) => puedeAbrirBandeja(s) }));
vi.mock("@/lib/studio/chatwoot/config", () => ({ chatwootRouterConfig: () => null }));
vi.mock("@/lib/studio/chatwoot/router-api", () => ({ listarConversacionesContacto: vi.fn() }));

const { GET } = await import("./route");

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const pedir = (tarjetaId: string) => GET(new Request("http://x/"), { params: Promise.resolve({ tarjetaId }) });
const destino = (r: Response) => r.headers.get("Location");

const COMERCIAL = { role: "commercial", overrides: {}, grants: {}, tenantId: "tn-1" };

beforeEach(() => {
  from.mockReset();
  getStudioAccess.mockReset();
  puedeAbrirBandeja.mockReset();
});

describe("ruta del chat de una tarjeta (SDD-0648 §4)", () => {
  it("sin sesión: al inicio con ?denied=kommo, sin leer nada", async () => {
    getStudioAccess.mockResolvedValue({ role: null, overrides: {}, grants: {}, tenantId: null });
    const r = await pedir(ID);
    expect(r.status).toBe(307);
    expect(destino(r)).toBe("/studio/dashboard?denied=kommo");
    expect(puedeAbrirBandeja).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("sin el módulo del CRM: lo mismo que requireModuleView", async () => {
    getStudioAccess.mockResolvedValue({ ...COMERCIAL, role: "warehouse" });
    const r = await pedir(ID);
    expect(destino(r)).toBe("/studio/dashboard?denied=kommo");
    expect(from).not.toHaveBeenCalled();
  });

  it("con CRM pero sin Bandeja: vuelve al tablero con el aviso, no al inicio", async () => {
    getStudioAccess.mockResolvedValue(COMERCIAL);
    puedeAbrirBandeja.mockResolvedValue(false);
    const r = await pedir(ID);
    expect(destino(r)).toBe("/studio/crm?tab=embudos&chat=sin_bandeja");
    expect(from).not.toHaveBeenCalled();
  });

  it("con un id que no es UUID: «sin chat» y no consulta la base", async () => {
    getStudioAccess.mockResolvedValue(COMERCIAL);
    puedeAbrirBandeja.mockResolvedValue(true);
    const r = await pedir("no-es-uuid");
    expect(destino(r)).toBe("/studio/crm?tab=embudos&chat=sin");
    expect(from).not.toHaveBeenCalled();
  });
});
