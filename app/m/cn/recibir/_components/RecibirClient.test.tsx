import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
  receive: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/i18n", () => ({
  useT: () => (key: string) => key,
}));

vi.mock("@/app/m/_components/QrScanner", () => ({
  QrScanner: ({
    hint,
    onDetected,
  }: {
    hint?: string;
    onDetected: (code: string, source: "manual") => void;
  }) => (
    <div>
      <span data-testid="scanner-hint">{hint}</span>
      <button
        type="button"
        onClick={() => onDetected("DTD-B-000123", "manual")}
      >
        Simular escaneo
      </button>
    </div>
  ),
}));

vi.mock("../actions", () => ({
  lookupForReceptionAction: (...args: unknown[]) => mocks.lookup(...args),
  receivePrealertaAction: (...args: unknown[]) => mocks.receive(...args),
}));

import { RecibirClient } from "./RecibirClient";

const lookup = {
  found: true as const,
  alreadyReceived: false,
  boxCode: "DTD-B-000123",
  prealertaCode: "DTD-5532-1-1",
  clientMarkbox: "DTD-5532",
  clientName: null,
  supplierName: "Yiwu Standard",
  expected: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.lookup.mockResolvedValue(lookup);
  mocks.receive.mockResolvedValue({
    ok: true,
    receiptCode: "WR-2026-0001",
    prealertaCode: lookup.prealertaCode,
    clientMarkbox: lookup.clientMarkbox,
    received: 2,
    remaining: 0,
  });
});

afterEach(cleanup);

describe("RecibirClient · recuperación ante rechazo de acciones", () => {
  it("libera la búsqueda y conserva el escáner usable si el lookup rechaza", async () => {
    const user = userEvent.setup();
    mocks.lookup.mockRejectedValueOnce(new Error("network down"));

    render(<RecibirClient initialLang="es" />);
    await user.click(screen.getByRole("button", { name: "Simular escaneo" }));

    expect(
      await screen.findByText(
        "No se pudo buscar la caja por un problema temporal. Intenta de nuevo.",
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("scanner-hint")).toHaveTextContent(
        "Escanea el QR de la etiqueta.",
      ),
    );
    expect(
      screen.getByRole("button", { name: "Simular escaneo" }),
    ).toBeEnabled();
  });

  it("vuelve al escáner e informa el rechazo inesperado al recibir", async () => {
    const user = userEvent.setup();
    mocks.receive.mockRejectedValueOnce(new Error("server action rejected"));

    render(<RecibirClient initialLang="es" />);
    await user.click(screen.getByRole("button", { name: "Simular escaneo" }));
    await user.click(await screen.findByRole("button", { name: "Recibir" }));

    expect(
      await screen.findByText(
        "No se pudo confirmar la recepción por un problema temporal. Vuelve a escanear e intenta de nuevo.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Simular escaneo" }),
    ).toBeEnabled();
  });

  it("muestra en chino el fallo permanente y no invita a reintentar", async () => {
    const user = userEvent.setup();
    mocks.receive.mockResolvedValueOnce({
      error:
        "La recepción no está disponible. Avisa al responsable; no la intentes de nuevo.",
      failureKind: "permanent",
    });

    render(<RecibirClient initialLang="cn" />);
    await user.click(screen.getByRole("button", { name: "Simular escaneo" }));
    await user.click(await screen.findByRole("button", { name: "接收" }));

    expect(
      await screen.findByText("收货功能不可用。请通知负责人，不要重试。"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/重试/)).toHaveTextContent("不要重试");
    expect(
      screen.getByRole("button", { name: "Simular escaneo" }),
    ).toBeEnabled();
  });
});
