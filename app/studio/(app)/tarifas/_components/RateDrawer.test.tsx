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

describe("RateDrawer · tarifa programada (SDD-0478)", () => {
  const programadaBox = () =>
    screen.queryByRole("checkbox", { name: /Programada: reemplaza a la pública/ });
  const control = (container: HTMLElement) =>
    container.querySelector<HTMLInputElement>('input[name="publica_programada_control"]');

  it("sin la ranura (migr 0459 sin aplicar) no ofrece programar ni manda la marca", () => {
    const { container } = render(<RateDrawer mode="create" onClose={vi.fn()} />);
    expect(programadaBox()).toBeNull();
    expect(control(container)).toBeNull();
    // La pública de siempre sigue ahí, intacta.
    expect(screen.getByRole("checkbox", { name: /Tarifa pública del calculador/ })).toBeInTheDocument();
  });

  it("con la ranura la ofrece, explica cuándo entra y manda la marca de control", () => {
    const { container } = render(
      <RateDrawer mode="create" onClose={vi.fn()} programacionDisponible />,
    );
    const box = programadaBox();
    expect(box).not.toBeNull();
    expect(box).not.toBeChecked();
    expect(box).toHaveAccessibleDescription(/00:05 de Venezuela/);
    expect(control(container)?.value).toBe("1");
  });

  it("pública y programada se excluyen al marcar cualquiera de las dos", () => {
    render(<RateDrawer mode="create" onClose={vi.fn()} programacionDisponible />);
    const publica = screen.getByRole("checkbox", { name: /Tarifa pública del calculador/ });
    const programada = programadaBox()!;
    fireEvent.click(publica);
    expect(publica).toBeChecked();
    fireEvent.click(programada);
    expect(programada).toBeChecked();
    expect(publica).not.toBeChecked();
    fireEvent.click(publica);
    expect(publica).toBeChecked();
    expect(programada).not.toBeChecked();
  });

  it("al editar la programada, la casilla llega marcada", () => {
    const rate = {
      id: "r1",
      tenant_id: "t1",
      service: "puerta_a_puerta_DDP",
      origin: "China",
      destination: "Venezuela",
      per_cbm: 900,
      flat_rate: null,
      min_charge: 50,
      transit_days: null,
      valid_from: "2026-11-30",
      valid_until: null,
      is_public: false,
      status: "published",
      notes: null,
      created_at: "2026-09-18T00:00:00Z",
      updated_at: "2026-09-18T00:00:00Z",
      deleted_at: null,
      expiry_warn_sent_at: null,
      expiry_overdue_sent_at: null,
    } as const;
    render(
      <RateDrawer mode="edit" rate={rate} onClose={vi.fn()} programacionDisponible programada />,
    );
    expect(programadaBox()).toBeChecked();
  });

  it("en la lista de un aliado no se ofrece: sólo la casa alimenta el sitio", () => {
    render(
      <RateDrawer
        mode="create"
        onClose={vi.fn()}
        programacionDisponible
        priceBookId="pb-aliado"
        priceBookName="Dynasty Cargo"
        priceBookEsCasa={false}
      />,
    );
    expect(programadaBox()).toBeNull();
  });
});
