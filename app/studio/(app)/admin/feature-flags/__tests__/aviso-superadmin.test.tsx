/**
 * SDD-0633 · El interruptor de un módulo siempre dice por qué no cambió.
 *
 * QUÉ DEFIENDE. Antes la denegación de superadmin y el catch devolvían
 * `{ error }` sin `flagKey`, y la tarjeta solo pintaba el error si
 * `state.flagKey === flagKey`: el interruptor «no hacía nada». Ahora:
 *   1. la acción pone `flagKey` en la denegación, en el catch y en el éxito;
 *   2. «no eres superadministrador» sale solo cuando la base contestó que no; si
 *      la RPC falló (el 403 de la 0211), el aviso dice que no se pudo comprobar;
 *   3. la tarjeta pulsada pinta su error aunque venga sin `flagKey`, como alerta,
 *      y las demás tarjetas no.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FEATURE_FLAG_KEYS, FEATURE_FLAG_LABELS } from "@/lib/studio/feature-flags-types";
import { SUPERADMIN_CHECK_FAILED, SUPERADMIN_DENIAL } from "@/lib/studio/platform-admin";

const KEY = FEATURE_FLAG_KEYS[0];
const OTRA = FEATURE_FLAG_KEYS[1];

describe("toggleFeatureFlagAction", () => {
  const rpc = vi.fn();
  const executeD1 = vi.fn();
  const revalidate = vi.fn();

  async function accion() {
    vi.resetModules();
    vi.doMock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidate(...a) }));
    vi.doMock("@/lib/db/server", () => ({ createClient: async () => ({ rpc }) }));
    vi.doMock("@/lib/studio/audit/d1-access-config-adapters", async (importOriginal) => ({
      ...(await importOriginal<Record<string, unknown>>()),
      executeD1Operation: (...a: unknown[]) => executeD1(...a),
    }));
    return (await import("../actions")).toggleFeatureFlagAction;
  }
  const form = (enabled: string) => {
    const fd = new FormData();
    fd.set("key", KEY);
    fd.set("enabled", enabled);
    return fd;
  };

  beforeEach(() => {
    rpc.mockReset();
    executeD1.mockReset();
    revalidate.mockReset();
  });

  it("la base dice que no: «no eres superadministrador», con flagKey, y no escribe", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const r = await (await accion())({}, form("on"));
    expect(r).toEqual({ error: SUPERADMIN_DENIAL, flagKey: KEY });
    expect(r.error).toMatch(/^No eres superadministrador\./);
    expect(rpc).toHaveBeenCalledWith("is_platform_admin");
    expect(executeD1).not.toHaveBeenCalled();
  });

  it("la RPC falla (403): no acusa a nadie, dice que no se pudo comprobar, con flagKey", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied" } });
    const r = await (await accion())({}, form("on"));
    expect(r).toEqual({ error: SUPERADMIN_CHECK_FAILED, flagKey: KEY });
    expect(r.error).not.toMatch(/No eres/);
    expect(executeD1).not.toHaveBeenCalled();
  });

  it("la RPC lanza: igual, no se pudo comprobar", async () => {
    rpc.mockRejectedValue(new Error("red"));
    expect(await (await accion())({}, form("on"))).toEqual({ error: SUPERADMIN_CHECK_FAILED, flagKey: KEY });
  });

  it("el guardado falla: error con flagKey y sin revalidar", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    executeD1.mockRejectedValue(new Error("query_failed"));
    const r = await (await accion())({}, form("on"));
    expect(r.flagKey).toBe(KEY);
    expect(r.error).toMatch(/No se pudo guardar/);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("SDD-0634: la base niega (42501 → permission_denied): el mismo aviso de superadmin", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    // Después de `accion()`: tras resetModules, la clase es la que ve la acción.
    const toggle = await accion();
    const { D1OperationError } = await import("@/lib/studio/audit/d1-access-config-adapters");
    executeD1.mockRejectedValue(new D1OperationError("permission_denied",
      "Solo el superadministrador puede encender o apagar módulos"));
    const r = await toggle({}, form("on"));
    expect(r).toEqual({ error: SUPERADMIN_DENIAL, flagKey: KEY });
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("SDD-0634: superadmin que no es admin del equipo (audit_d1_admin_tenant): no le dice «no eres superadministrador»", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const toggle = await accion();
    const { D1OperationError } = await import("@/lib/studio/audit/d1-access-config-adapters");
    executeD1.mockRejectedValue(new D1OperationError("permission_denied", "permission_denied"));
    const r = await toggle({}, form("on"));
    expect(r.flagKey).toBe(KEY);
    expect(r.error).toMatch(/tienes que ser también su administrador/);
    expect(r.error).not.toMatch(/No eres superadministrador/);
  });

  it("SDD-0634: el adaptador real conserva el mensaje de la base para distinguir las dos causas", async () => {
    const real = await vi.importActual<typeof import("@/lib/studio/audit/d1-access-config-adapters")>(
      "@/lib/studio/audit/d1-access-config-adapters");
    const db = (message: string) => ({
      rpc: async () => ({ data: null, error: { code: "42501", message } }),
    }) as never;
    const err = await real.executeD1Operation(
      db("Solo el superadministrador puede encender o apagar módulos"),
      { operationType: "feature_flag.toggle", input: {} },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(real.D1OperationError);
    expect((err as InstanceType<typeof real.D1OperationError>).code).toBe("permission_denied");
    expect((err as InstanceType<typeof real.D1OperationError>).dbMessage).toMatch(/^Solo el superadministrador/);
    expect((err as Error).message).toBe("permission_denied");
  });

  it("éxito del superadmin: guarda lo pedido y revalida", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    executeD1.mockResolvedValue({ entity_id: "f1" });
    expect(await (await accion())({}, form(""))).toEqual({ ok: true, flagKey: KEY });
    expect(executeD1).toHaveBeenCalledWith(expect.anything(), {
      operationType: "feature_flag.toggle",
      input: { key: KEY, enabled: false },
    });
    expect(revalidate).toHaveBeenCalledWith("/studio", "layout");
  });
});

describe("FeatureFlagsClient · el aviso sale en la tarjeta pulsada", () => {
  const toggle = vi.fn();
  const refresh = vi.fn();

  async function pantalla() {
    vi.resetModules();
    vi.doMock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
    vi.doMock("../actions", () => ({ toggleFeatureFlagAction: (...a: unknown[]) => toggle(...a) }));
    const { FeatureFlagsClient } = await import("../_components/FeatureFlagsClient");
    const flags = Object.fromEntries(FEATURE_FLAG_KEYS.map((k) => [k, false])) as never;
    render(<FeatureFlagsClient flags={flags} />);
  }
  const tarjeta = (key: string) =>
    screen.getByRole("button", { name: `Encender ${FEATURE_FLAG_LABELS[key as typeof KEY]}` }).closest("form")!;

  beforeEach(() => {
    toggle.mockReset();
    refresh.mockReset();
  });

  it("un error SIN flagKey (la forma vieja) también se ve, como alerta, solo en esa tarjeta", async () => {
    toggle.mockResolvedValue({ error: SUPERADMIN_DENIAL });
    await pantalla();
    await userEvent.click(within(tarjeta(KEY)).getByRole("button"));
    expect(await within(tarjeta(KEY)).findByRole("alert")).toHaveTextContent(SUPERADMIN_DENIAL);
    expect(within(tarjeta(OTRA)).queryByRole("alert")).toBeNull();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("el error de la acción, con flagKey, se ve igual", async () => {
    toggle.mockResolvedValue({ error: SUPERADMIN_CHECK_FAILED, flagKey: KEY });
    await pantalla();
    await userEvent.click(within(tarjeta(KEY)).getByRole("button"));
    expect(await within(tarjeta(KEY)).findByRole("alert")).toHaveTextContent(SUPERADMIN_CHECK_FAILED);
  });

  it("éxito: sin alerta y refresca", async () => {
    toggle.mockResolvedValue({ ok: true, flagKey: KEY });
    await pantalla();
    await userEvent.click(within(tarjeta(KEY)).getByRole("button"));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
