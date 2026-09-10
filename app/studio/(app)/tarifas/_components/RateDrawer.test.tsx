import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("../actions", () => ({
  archiveRateAction: vi.fn(),
  createRate: vi.fn(async () => ({})),
  publishRateAction: vi.fn(),
  softDeleteRate: vi.fn(),
  updateRate: vi.fn(async () => ({})),
}));

vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn() }),
}));

vi.mock("@/app/studio/_components/ui/drawer/DrawerShell", () => ({
  DrawerShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/app/studio/_components/ui/SplitActionButton", () => ({
  SplitActionButton: ({ onError }: { onError: (message: string) => void }) => (
    <button type="button" onClick={() => onError("No se pudo guardar la tarifa.")}>
      Simular error general
    </button>
  ),
}));

import { RateDrawer } from "./RateDrawer";

afterEach(cleanup);

describe("RateDrawer · error general", () => {
  it("acompaña el mensaje con el mismo icono danger de los errores de campo", () => {
    render(<RateDrawer mode="create" onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Simular error general" }));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("No se pudo guardar la tarifa.");
    expect(alert.querySelector('path[d="m8 8 8 8m0-8-8 8"]')).not.toBeNull();
  });
});
