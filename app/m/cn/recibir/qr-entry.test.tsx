import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Page from "./page";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { lookupForReceptionAction, receivePrealertaAction } from "./actions";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("@/lib/auth/operario-session", () => ({ getCurrentOperario: vi.fn() }));
vi.mock("./actions", () => ({ lookupForReceptionAction: vi.fn(), receivePrealertaAction: vi.fn() }));
vi.mock("@/app/m/_components/QrScanner", () => ({ QrScanner: () => <p>Escáner</p> }));

beforeEach(() => { vi.mocked(getCurrentOperario).mockResolvedValue({ region: "cn" } as Awaited<ReturnType<typeof getCurrentOperario>>); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("entrada QR de recepción", () => {
  it("conserva la caja normalizada al pedir el PIN, sin consultar datos antes de la sesión", async () => {
    vi.mocked(getCurrentOperario).mockResolvedValue(null);
    await expect(Page({ searchParams: Promise.resolve({ box: "dtd-b-000003" }) })).rejects.toThrow("REDIRECT:/m/cn/login?box=DTD-B-000003");
    expect(lookupForReceptionAction).not.toHaveBeenCalled();
  });
  it.each([
    "La caja no existe.", "La compra no está activa.",
    "No se pudieron consultar las cajas y servicios. Intenta otra vez.",
    "Este lote supera 1000 cajas. Solicita recepción asistida al equipo de operaciones.",
  ])("muestra el error inicial y recuperación: %s", async error => {
    vi.mocked(lookupForReceptionAction).mockResolvedValue({ found: false, error });
    render(await Page({ searchParams: Promise.resolve({ box: "DTD-B-000003" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent(error);
    expect(screen.getByRole("link", { name: "Reintentar consulta" })).toHaveAttribute("href", "/m/cn/recibir?box=DTD-B-000003");
    expect(screen.getByRole("link", { name: "Volver a escanear" })).toHaveAttribute("href", "/m/cn/recibir");
    expect(receivePrealertaAction).not.toHaveBeenCalled();
  });
  it("no expone detalles internos cuando la consulta lanza una excepción", async () => {
    vi.mocked(lookupForReceptionAction).mockRejectedValue(new Error("internal-private-detail"));
    render(await Page({ searchParams: Promise.resolve({ box: "DTD-B-000003" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Revisa la conexión");
    expect(document.body).not.toHaveTextContent("internal-private-detail");
  });
  it("abre la caja correcta con el lote sin recibir automáticamente", async () => {
    vi.mocked(lookupForReceptionAction).mockResolvedValue({ found: true, alreadyReceived: false, boxCode: "DTD-B-000003", prealertaCode: "DTD-0000-1-1", clientMarkbox: "DTD-0000", clientName: null, supplierName: null, pendingCodes: ["DTD-B-000003"], expected: 1, services: [] });
    render(await Page({ searchParams: Promise.resolve({ box: "DTD-B-000003" }) }));
    expect(lookupForReceptionAction).toHaveBeenCalledWith("DTD-B-000003");
    expect(screen.getByRole("button", { name: /Confirmar recepción de 1 caja/ })).toBeInTheDocument();
    expect(receivePrealertaAction).not.toHaveBeenCalled();
  });
  it.each(["", "https://external.example", ["DTD-B-000003", "DTD-B-000004"]])("rechaza contexto inválido o ambiguo sin consulta: %s", async box => {
    render(await Page({ searchParams: Promise.resolve({ box }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Código de caja inválido");
    expect(screen.queryByRole("link", { name: "Reintentar consulta" })).not.toBeInTheDocument();
    expect(lookupForReceptionAction).not.toHaveBeenCalled();
  });
  it("sin contexto abre el escáner normal", async () => {
    render(await Page({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Escáner")).toBeInTheDocument();
    expect(lookupForReceptionAction).not.toHaveBeenCalled();
  });
});
