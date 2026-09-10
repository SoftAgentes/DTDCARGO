import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Page from "./page";
import { signInOperarioAction } from "./actions";
import { signInWithPin } from "@/lib/auth/operario-session";
const dispatch = vi.hoisted(() => vi.fn());
const initialState = vi.hoisted(() => ({}));
vi.mock("react", async importOriginal => ({ ...await importOriginal<typeof import("react")>(), useActionState: () => [initialState, dispatch, false] }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("@/lib/auth/operario-session", () => ({ signInWithPin: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); window.history.replaceState({}, "", "/"); });
function form(box?: string) { const fd = new FormData(); fd.set("pin", "1234"); if (box !== undefined) fd.set("box", box); return fd; }

describe("PIN con contexto QR", () => {
  it("transmite la caja desde la URL al enviar el PIN", () => {
    window.history.replaceState({}, "", "/m/cn/login?box=DTD-B-000003");
    render(<Page />);
    for (const digit of ["1", "2", "3", "4"]) fireEvent.click(screen.getByRole("button", { name: digit }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect((dispatch.mock.calls[0][0] as FormData).get("box")).toBe("DTD-B-000003");
  });
  it("después del PIN retorna exactamente a esa caja", async () => {
    vi.mocked(signInWithPin).mockResolvedValue({ region: "cn" } as Awaited<ReturnType<typeof signInWithPin>>);
    await expect(signInOperarioAction({}, form("dtd-b-000003"))).rejects.toThrow("REDIRECT:/m/cn/recibir?box=DTD-B-000003");
  });
  it.each([undefined, "", "https://external.example", "//external.example", "DTD-B-000003&next=https://external.example", "DTD-B-000003\n/evil"])("ignora destino inválido %s y returnTo externo", async box => {
    vi.mocked(signInWithPin).mockResolvedValue({ region: "cn" } as Awaited<ReturnType<typeof signInWithPin>>);
    const fd = form(box); fd.set("returnTo", "https://external.example");
    await expect(signInOperarioAction({}, fd)).rejects.toThrow(/^REDIRECT:\/m\/cn$/);
  });
  it("rechaza contexto ambiguo con múltiples valores", async () => {
    vi.mocked(signInWithPin).mockResolvedValue({ region: "cn" } as Awaited<ReturnType<typeof signInWithPin>>);
    const fd = form("DTD-B-000003"); fd.append("box", "DTD-B-000004");
    await expect(signInOperarioAction({}, fd)).rejects.toThrow(/^REDIRECT:\/m\/cn$/);
  });
  it("un PIN incorrecto no redirige ni pierde el mensaje", async () => {
    vi.mocked(signInWithPin).mockResolvedValue(null);
    expect(await signInOperarioAction({}, form("DTD-B-000003"))).toEqual({ error: "PIN incorrecto o operario inactivo." });
  });
  it.each(["?box=DTD-B-000003&box=DTD-B-000004", "?box=https://external.example", "?returnTo=https://external.example"])("no transmite contexto ambiguo o externo de la URL %s", query => {
    window.history.replaceState({}, "", `/m/cn/login${query}`);
    render(<Page />);
    for (const digit of ["1", "2", "3", "4"]) fireEvent.click(screen.getByRole("button", { name: digit }));
    expect((dispatch.mock.calls[0][0] as FormData).has("box")).toBe(false);
  });
  it("no acepta un archivo como identificador de caja", async () => {
    vi.mocked(signInWithPin).mockResolvedValue({ region: "cn" } as Awaited<ReturnType<typeof signInWithPin>>);
    const fd = form(); fd.set("box", new File(["DTD-B-000003"], "box.txt"));
    await expect(signInOperarioAction({}, fd)).rejects.toThrow(/^REDIRECT:\/m\/cn$/);
  });
});
