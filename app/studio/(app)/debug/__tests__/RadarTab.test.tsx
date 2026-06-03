/**
 * Tests del RadarTab · pestaña Radar de la torre de control (SDD-0050 Slice C).
 *
 * Cubre los criterios de la spec para esta slice:
 *  - Renderiza el informe (partA findings + partB counts/barra) cuando hay artefacto.
 *  - Banner de limitación OBLIGATORIO (requisito no-negociable del founder),
 *    MODE-AWARE según el entorno:
 *      · web (preview/prod) → prominente (warning): "no es funcional en la web",
 *        muestra el último informe local, "no se actualiza acá".
 *      · local              → suave (neutral): "Último informe local", cómo regenerar.
 *  - Maneja el caso SIN artefacto (`report={null}`) sin romper: solo banner +
 *    cómo generarlo.
 */
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { RadarTab } from "../_components/RadarTab";
import type { RadarReport } from "@/lib/studio/radar-types";

const REPORT: RadarReport = {
  generatedAt: "2026-06-03",
  norteVersion: "v2.4",
  partA: {
    findings: [
      {
        id: "perms-obsoletos",
        title: "Permisos obsoletos podados",
        severity: "media",
        action: "Se removieron refs al path viejo y se acotaron wildcards.",
        top: true,
      },
      {
        id: "agents-drift",
        title: "Drift de AGENTS.md resuelto",
        severity: "media",
        action: "El puntero del Norte quedó alineado a v2.4.",
      },
    ],
    estimatedTokenSavings: "~8%",
  },
  partB: {
    counts: { built: 11, partial: 8, missing: 3, total: 22 },
    blocks: [{ name: "Bloque 3 · Fiscal", remaining: "60%" }],
  },
};

describe("RadarTab · informe presente", () => {
  it("renderiza los hallazgos de la Parte A", () => {
    render(<RadarTab report={REPORT} env="local" />);
    expect(screen.getByText(/Parte A · Workspace/)).toBeInTheDocument();
    expect(screen.getByText(/Permisos obsoletos podados/)).toBeInTheDocument();
    expect(screen.getByText(/Drift de AGENTS\.md resuelto/)).toBeInTheDocument();
    // El ahorro estimado de tokens aparece.
    expect(screen.getByText(/~8%/)).toBeInTheDocument();
  });

  it("renderiza los counts de la Parte B + la barra de reconciliación", () => {
    render(<RadarTab report={REPORT} env="local" />);
    expect(screen.getByText(/Parte B · Modelo de datos/)).toBeInTheDocument();
    // Completitud = 11/22 = 50%.
    expect(screen.getByText(/50%/)).toBeInTheDocument();
    // La barra es accesible y describe el desglose.
    const bar = screen.getByRole("img", { name: /Modelo de datos/ });
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute(
      "aria-label",
      expect.stringContaining("11 construido"),
    );
  });

  it("muestra la versión del Norte y la fecha de generación", () => {
    render(<RadarTab report={REPORT} env="local" />);
    expect(screen.getByText(/Norte v2\.4/)).toBeInTheDocument();
    expect(screen.getAllByText(/2026-06-03/).length).toBeGreaterThan(0);
  });

  it("lista los bloques del roadmap cuando vienen", () => {
    render(<RadarTab report={REPORT} env="local" />);
    expect(screen.getByText(/Bloque 3 · Fiscal/)).toBeInTheDocument();
    expect(screen.getByText(/falta 60%/)).toBeInTheDocument();
  });
});

describe("RadarTab · banner de limitación OBLIGATORIO (mode-aware)", () => {
  it("siempre renderiza un banner role=status", () => {
    render(<RadarTab report={REPORT} env="local" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("en web (production) avisa que NO es funcional en la web y que no se actualiza", () => {
    render(<RadarTab report={REPORT} env="production" />);
    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("data-radar-mode", "web");
    expect(
      within(banner).getByText(/no es funcional en la web/),
    ).toBeInTheDocument();
    expect(within(banner).getByText(/no se actualiza acá/)).toBeInTheDocument();
    // Menciona la fecha del último informe generado en local.
    expect(within(banner).getByText(/2026-06-03/)).toBeInTheDocument();
  });

  it("en web (preview) también es modo web", () => {
    render(<RadarTab report={REPORT} env="preview" />);
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-radar-mode",
      "web",
    );
  });

  it("en local el banner es suave (último informe local, cómo regenerar)", () => {
    render(<RadarTab report={REPORT} env="local" />);
    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("data-radar-mode", "local");
    expect(within(banner).getByText(/Último informe local/)).toBeInTheDocument();
    // En local NO se muestra la advertencia "no es funcional en la web".
    expect(within(banner).queryByText(/no es funcional en la web/)).toBeNull();
  });

  it("el banner menciona /radar (cómo generar/regenerar) en ambos modos", () => {
    const { rerender } = render(<RadarTab report={REPORT} env="production" />);
    expect(within(screen.getByRole("status")).getByText("/radar")).toBeInTheDocument();
    rerender(<RadarTab report={REPORT} env="local" />);
    expect(within(screen.getByRole("status")).getByText("/radar")).toBeInTheDocument();
  });
});

describe("RadarTab · sin artefacto (edge: report=null)", () => {
  it("no rompe: muestra el banner + cómo generarlo, sin informe", () => {
    render(<RadarTab report={null} env="local" />);
    // El banner sigue presente.
    expect(screen.getByRole("status")).toBeInTheDocument();
    // Estado vacío con instrucción de cómo generarlo.
    expect(
      screen.getByText(/Todavía no hay un informe del Radar/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("/radar").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/public\/api\/radar-report\.json/),
    ).toBeInTheDocument();
    // No se renderizan secciones del informe.
    expect(screen.queryByText(/Parte A · Workspace/)).toBeNull();
    expect(screen.queryByText(/Parte B · Modelo de datos/)).toBeNull();
  });

  it("en web sin artefacto, el banner sigue siendo el de 'no funcional acá'", () => {
    render(<RadarTab report={null} env="production" />);
    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("data-radar-mode", "web");
    expect(
      within(banner).getByText(/no es funcional en la web/),
    ).toBeInTheDocument();
  });
});
