/**
 * SDD-0635 §3.1 · reglas del mapa «Lo que puede hacer» (`estadoModulo`) y
 * chips plegados. La pantalla completa la prueba `AccesoPanel.test.tsx`.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { estadoModulo, fechaCaracas, nivelCorto } from "@/lib/studio/user-module-grants";
import type { UserMembershipWithProfile } from "@/lib/studio/user-types";
import { MapaAcceso } from "./MapaAcceso";

const vigente = (nivel: "view" | "edit") => ({ nivel, vigente: true, expiresAt: null });

describe("estadoModulo", () => {
  it("contabilidad sin extras: CRM se puede dar, Tesorería es del rol y sensible", () => {
    expect(estadoModulo("accounting", "kommo", {}, null)).toMatchObject({ src: "none", view: false, status: { kind: "grantable" } });
    expect(estadoModulo("accounting", "treasury", {}, null)).toMatchObject({ src: "role", edit: true, sensitive: true });
  });

  it("un extra que suma es «grant»; uno que el rol ya cubre «sobra»", () => {
    expect(estadoModulo("accounting", "kommo", {}, vigente("edit"))).toMatchObject({ src: "grant", edit: true, sobra: false });
    expect(estadoModulo("accounting", "rates", {}, vigente("view"))).toMatchObject({ src: "role", sobra: true });
  });

  it("un extra vencido no cuenta", () => {
    expect(estadoModulo("accounting", "kommo", {}, { nivel: "edit", vigente: false, expiresAt: "2026-01-01T00:00:00Z" })).toMatchObject({
      src: "none",
      view: false,
    });
  });

  it("soporte con un extra de ver y editar sigue sin editar", () => {
    expect(estadoModulo("support", "kommo", {}, vigente("edit"))).toMatchObject({ view: true, edit: false, soloVer: true });
  });

  it("lo que la base no acepta queda «blocked»", () => {
    expect(estadoModulo("commercial", "treasury", {}, null)).toMatchObject({ src: "blocked", status: { kind: "blocked", coverage: "money_phase" } });
  });

  it("palabras cortas, sin siglas", () => {
    expect(nivelCorto({ view: true, edit: true })).toBe("Edita");
    expect(nivelCorto({ view: true, edit: false })).toBe("Ve");
    expect(nivelCorto({ view: false, edit: false })).toBeNull();
  });

  it("la fecha de vencimiento se lee en hora de Caracas", () => {
    expect(fechaCaracas("2026-12-31T03:59:59.000Z")).toBe("2026-12-30");
    expect(fechaCaracas(null)).toBeNull();
  });
});

describe("MapaAcceso · plegado", () => {
  const miembro = {
    user_id: "u-1",
    tenant_id: "t-1",
    role: "commercial",
    warehouse_scope: "all",
    disabled_at: null,
    last_login_at: null,
    invited_by: null,
    created_at: "2026-07-03T00:00:00Z",
    email: "p@ejemplo.test",
    profile: null,
  } as unknown as UserMembershipWithProfile;

  it("los que todavía no se pueden dar van plegados por área y se abren", async () => {
    const u = userEvent.setup();
    render(
      <MapaAcceso member={miembro} grants={[]} overrides={{}} pendientes={{}} nombres={{}} bloqueo={null} onElegir={vi.fn()} onSensible={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /^Tesorería:/ })).toBeNull();
    const finanzas = screen.getByText("Finanzas").closest(".perm-area") as HTMLElement;
    await u.click(finanzas.querySelector<HTMLButtonElement>(".perm-more")!);
    expect(screen.getByRole("button", { name: /^Tesorería: sin acceso, todavía no se puede dar como extra/ })).toBeTruthy();
  });
});
