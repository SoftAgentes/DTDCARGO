/**
 * ApiIntegrationSection · el token de una key nueva NO va en una región viva.
 *
 * SDD-0603 tramo 4b: el aviso «Copia este token ahora…» es un `<Aviso
 * tono="atencion">`, o sea `role="status"`. Si el token quedara dentro, el
 * lector de pantalla leería en voz alta un secreto efímero al aparecer.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const TOKEN = "dtd_prueba_0000000000000000";

vi.mock("../api-integration-actions", () => ({
  createApiKeyAction: vi.fn(async () => ({ ok: true, token: TOKEN })),
  revokeApiKeyAction: vi.fn(async () => ({})),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));
vi.mock("./WebhookDrawer", () => ({ WebhookDrawer: () => null }));

import { ApiIntegrationSection } from "./ApiIntegrationSection";

async function crearKey() {
  render(<ApiIntegrationSection data={{ apiKeys: [], webhooks: [] }} />);
  fireEvent.change(screen.getByLabelText("Nombre de la key"), { target: { value: "BI" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Crear key" }));
  });
  return screen.findByTestId("api-key-token");
}

describe("ApiIntegrationSection · token recién creado", () => {
  it("muestra el token una vez, con el aviso de atención", async () => {
    const token = await crearKey();
    expect(token).toHaveTextContent(TOKEN);
    const aviso = screen
      .getAllByRole("status")
      .find((el) => el.textContent?.includes("Copia este token ahora"));
    expect(aviso).toBeDefined();
    expect(aviso).toHaveAttribute("data-tono", "atencion");
    expect(aviso).toHaveTextContent("Copia este token ahora — no se vuelve a mostrar.");
  });

  it("el token queda fuera de toda región viva (status, alert o aria-live)", async () => {
    const token = await crearKey();
    expect(token.closest('[role="status"], [role="alert"], [aria-live]')).toBeNull();
    for (const viva of screen.queryAllByRole("status").concat(screen.queryAllByRole("alert"))) {
      expect(viva.textContent).not.toContain(TOKEN);
    }
  });
});
