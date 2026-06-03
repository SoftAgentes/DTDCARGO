/**
 * Tests de la pestaña Bugs de la torre de control (SDD-0050 Slice A).
 *
 * BugsTab es read-only: lista los bugs que ya vinieron filtrados por RLS y
 * enlaza al módulo completo. Cubrimos: empty state sin bugs, render de la
 * lista con folio/título/estado, y el link al Bug Tracker.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BugsTab } from "../_components/BugsTab";
import type { BugReport } from "@/lib/studio/bug-types";

function makeBug(over: Partial<BugReport> = {}): BugReport {
  return {
    id: "bug-1",
    tenant_id: "t1",
    folio: "BUG-00042",
    reporter_id: "u1",
    category: "error",
    severity: "media",
    state: "nuevo",
    progress_pct: 0,
    title: "El botón no responde",
    description: "...",
    module: "Cotizador",
    url: null,
    build_sha: null,
    browser_info: {},
    duplicate_hash: null,
    duplicate_count: 0,
    duplicate_of_id: null,
    eta_days: null,
    admin_thanks: null,
    commit_url: null,
    taken_by: null,
    taken_at: null,
    resolved_at: null,
    discarded_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  };
}

describe("BugsTab", () => {
  it("muestra empty state cuando no hay bugs", () => {
    render(<BugsTab bugs={[]} isAdmin />);
    expect(screen.getByText(/Sin bugs por ahora/)).toBeInTheDocument();
  });

  it("siempre enlaza al Bug Tracker completo", () => {
    render(<BugsTab bugs={[]} isAdmin />);
    const link = screen.getByRole("link", { name: /Abrir Bug Tracker/ });
    expect(link).toHaveAttribute("href", "/studio/bugs");
  });

  it("renderiza la lista con folio, título y estado del bug", () => {
    render(
      <BugsTab
        bugs={[makeBug({ folio: "BUG-00042", title: "El botón no responde", state: "progreso" })]}
        isAdmin
      />,
    );
    expect(screen.getByText("BUG-00042")).toBeInTheDocument();
    expect(screen.getByText("El botón no responde")).toBeInTheDocument();
    expect(screen.getByText("En progreso")).toBeInTheDocument();
  });

  it("el heading distingue admin (tenant) vs reporter (mis bugs)", () => {
    const { rerender } = render(<BugsTab bugs={[makeBug()]} isAdmin />);
    expect(screen.getByText(/Bugs del tenant/)).toBeInTheDocument();
    rerender(<BugsTab bugs={[makeBug()]} isAdmin={false} />);
    expect(screen.getByText(/Mis bugs/)).toBeInTheDocument();
  });
});
