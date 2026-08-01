import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();
const lookupMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), info: vi.fn() }),
}));
vi.mock("@/app/studio/_components/ui/drawer/DrawerShell", () => ({
  DrawerShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerFooter: ({
    formId,
    canSubmit,
    submitLabel,
  }: {
    formId: string;
    canSubmit: boolean;
    submitLabel: string;
  }) => (
    <button type="submit" form={formId} disabled={!canSubmit}>
      {submitLabel}
    </button>
  ),
}));
vi.mock("../actions", () => ({
  createClubMemberAction: (...args: unknown[]) => createMock(...args),
  updateClubMemberAction: vi.fn(),
  lookupMemberCiAction: (...args: unknown[]) => lookupMock(...args),
}));

import { ClubMemberDrawer } from "./ClubMemberDrawer";

beforeEach(() => {
  vi.clearAllMocks();
  lookupMock.mockResolvedValue({
    status: "new",
    normalized: "V-18452110",
  });
  createMock.mockResolvedValue({ ok: true, createdId: "club-1" });
});

afterEach(cleanup);

describe("ClubMemberDrawer validación progresiva", () => {
  it("no regaña durante la primera escritura y valida al salir", async () => {
    const user = userEvent.setup();
    render(<ClubMemberDrawer onClose={() => {}} />);

    const ci = screen.getByLabelText("Documento (cédula)");
    await user.type(ci, "V-12");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.tab();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Cédula con formato inválido",
    );
    expect(ci).toHaveAttribute("aria-invalid", "true");
  });

  it("después del error revalida en vivo y resuelve apenas el formato es válido", async () => {
    const user = userEvent.setup();
    render(<ClubMemberDrawer onClose={() => {}} />);

    const ci = screen.getByLabelText("Documento (cédula)");
    await user.type(ci, "V-12");
    await user.tab();
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await user.click(ci);
    await user.clear(ci);
    await user.type(ci, "V-18452110");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Formato correcto");
    expect(ci).toHaveAttribute("aria-invalid", "false");
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("blur válido verifica identidad y anuncia el resultado", async () => {
    const user = userEvent.setup();
    render(<ClubMemberDrawer onClose={() => {}} />);

    const ci = screen.getByLabelText("Documento (cédula)");
    await user.type(ci, "V-18452110");
    await user.tab();

    await waitFor(() =>
      expect(lookupMock).toHaveBeenCalledWith("V-18452110"),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Persona nueva",
    );
  });

  it("submit inválido enfoca cédula y no llama al servidor", async () => {
    const user = userEvent.setup();
    render(<ClubMemberDrawer onClose={() => {}} />);

    await user.type(screen.getByLabelText("Nombre del miembro"), "María");
    const ci = screen.getByLabelText("Documento (cédula)");
    await user.type(ci, "V-12");
    await user.click(screen.getByRole("button", { name: "Crear miembro" }));

    expect(ci).toHaveFocus();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });
});
