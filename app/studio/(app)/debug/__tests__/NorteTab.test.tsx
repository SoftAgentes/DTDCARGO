/**
 * Tests del NorteTab · pestaña Norte de la torre de control (SDD-0050 Slice B).
 *
 * Cubre los criterios de la spec para esta slice:
 *  - Embebe el snapshot en un <iframe src="/norte.html"> (el HTML horneado en build).
 *  - Banner de limitación OBLIGATORIO (requisito no-negociable del founder),
 *    MODE-AWARE según el entorno:
 *      · web (preview/prod) → ámbar (warning): "Snapshot del último deploy",
 *        links "Abrir ↗" no funcionan en la web.
 *      · local              → verde (success): snapshot local, cómo regenerar.
 */
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NorteTab } from "../_components/NorteTab";

describe("NorteTab · iframe del snapshot", () => {
  it("embebe el snapshot horneado en /norte.html", () => {
    const { container } = render(<NorteTab env="production" />);
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe).toHaveAttribute("src", "/norte.html");
    expect(iframe).toHaveAttribute("title", "Norte visual · snapshot");
  });
});

describe("NorteTab · banner de limitación OBLIGATORIO (mode-aware)", () => {
  it("siempre renderiza un banner role=status", () => {
    render(<NorteTab env="local" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("en web (production) avisa snapshot + links 'Abrir ↗' no funcionan", () => {
    render(<NorteTab env="production" />);
    const banner = screen.getByRole("status");
    expect(banner.closest("[data-norte-mode]")).toHaveAttribute("data-norte-mode", "web");
    expect(banner).toHaveAttribute("data-tono", "atencion");
    expect(within(banner).getByText(/Snapshot del último deploy/)).toBeInTheDocument();
    expect(within(banner).getByText(/no funcionan/)).toBeInTheDocument();
  });

  it("en web (preview) también es modo web (snapshot)", () => {
    render(<NorteTab env="preview" />);
    expect(screen.getByRole("status").closest("[data-norte-mode]")).toHaveAttribute("data-norte-mode", "web");
  });

  it("en local el banner es suave (snapshot local, regenerar)", () => {
    render(<NorteTab env="local" />);
    const banner = screen.getByRole("status");
    expect(banner.closest("[data-norte-mode]")).toHaveAttribute("data-norte-mode", "local");
    expect(banner).toHaveAttribute("data-tono", "info");
    expect(within(banner).getByText(/Snapshot local/)).toBeInTheDocument();
    // En local NO se muestra la advertencia de links rotos (eso es solo web).
    expect(within(banner).queryByText(/no funcionan/)).toBeNull();
  });

  it("el banner menciona node scripts/norte.mjs (cómo regenerar/vivo) en ambos modos", () => {
    const { rerender } = render(<NorteTab env="production" />);
    expect(screen.getByText(/node scripts\/norte\.mjs/)).toBeInTheDocument();
    rerender(<NorteTab env="local" />);
    expect(screen.getByText(/node scripts\/norte\.mjs/)).toBeInTheDocument();
  });
});
