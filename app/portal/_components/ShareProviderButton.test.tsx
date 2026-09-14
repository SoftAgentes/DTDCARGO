/**
 * SDD-0468 · Enlace del proveedor en el portal.
 *
 * Lo que no se puede romper: «Copiar enlace» sigue copiando SOLO la URL, en un
 * clic (restricción del rediseño). Lo nuevo: copiar con el mensaje en chino,
 * WhatsApp con ese mismo mensaje y un aviso cuando el portapapeles falla.
 *
 * `fireEvent` y no `userEvent`: user-event instala su propio portapapeles falso
 * y taparía el espía de `navigator.clipboard`.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildProviderLinkMessage } from "@/lib/portal/provider-link-message";
import { ShareProviderButton } from "./ShareProviderButton";

const TOKEN = "tok_demo_123";
let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});
afterEach(cleanup);

describe("ShareProviderButton", () => {
  const url = () => `${window.location.origin}/p/${TOKEN}`;

  it("muestra el enlace y «Copiar enlace» copia solo la URL, en un clic", async () => {
    render(<ShareProviderButton token={TOKEN} />);

    expect(screen.getByLabelText("Enlace para tu proveedor")).toHaveValue(url());
    fireEvent.click(screen.getByRole("button", { name: "Copiar enlace" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(url()));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: /Enlace copiado/ })).toBeVisible();
  });

  it("deja una sola acción principal; las alternativas no son botones .btn", () => {
    render(<ShareProviderButton token={TOKEN} />);
    const principales = document.querySelectorAll(".btn");
    expect(principales).toHaveLength(1);
    expect(principales[0]).toHaveTextContent("Copiar enlace");
  });

  it("«Copiar con mensaje en chino» copia el mensaje bilingüe con la URL", async () => {
    render(<ShareProviderButton token={TOKEN} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar con mensaje en chino" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(buildProviderLinkMessage(url())),
    );
    expect(await screen.findByRole("button", { name: /Mensaje copiado/ })).toBeVisible();
  });

  it("WhatsApp lleva el mismo mensaje", () => {
    render(<ShareProviderButton token={TOKEN} />);
    const wa = screen.getByRole("link", { name: /Enviar por WhatsApp/ });
    expect(wa).toHaveAttribute(
      "href",
      `https://wa.me/?text=${encodeURIComponent(buildProviderLinkMessage(url()))}`,
    );
  });

  it("si el portapapeles falla, selecciona el enlace y lo dice", async () => {
    writeText.mockRejectedValueOnce(new Error("denegado"));
    render(<ShareProviderButton token={TOKEN} />);
    const input = screen.getByLabelText<HTMLInputElement>("Enlace para tu proveedor");

    fireEvent.click(screen.getByRole("button", { name: "Copiar enlace" }));

    expect(await screen.findByText(/No se pudo copiar\. El enlace/)).toBeVisible();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(url().length);
  });

  it("si falla copiar el mensaje, no finge que lo copió: ofrece el enlace", async () => {
    writeText.mockRejectedValueOnce(new Error("denegado"));
    render(<ShareProviderButton token={TOKEN} />);
    const input = screen.getByLabelText<HTMLInputElement>("Enlace para tu proveedor");

    fireEvent.click(screen.getByRole("button", { name: "Copiar con mensaje en chino" }));

    expect(await screen.findByText(/No se pudo copiar el mensaje/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Mensaje copiado/ })).toBeNull();
    expect(input.selectionEnd).toBe(url().length);
  });

  it("las acciones de texto tienen área táctil de 44px (min-h-11)", () => {
    render(<ShareProviderButton token={TOKEN} />);
    expect(screen.getByRole("button", { name: "Copiar con mensaje en chino" })).toHaveClass("min-h-11");
    expect(screen.getByRole("link", { name: /Enviar por WhatsApp/ })).toHaveClass("min-h-11");
  });
});
