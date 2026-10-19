/**
 * SDD-0558 · El botón «Estado de cuenta» de la ficha solo para quien abre
 * facturación. Antes se pintaba siempre y comercial, operaciones y soporte
 * terminaban rebotados (la pantalla y el PDF exigen el módulo `invoices`).
 * El rol lo decide `puedeVerEstadoDeCuenta` (probado en client-account.test).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@/lib/studio/client-types";

vi.mock("./ClientDrawer", () => ({ ClientDrawer: () => null }));

import { ClientDetailClient } from "./ClientDetailClient";

afterEach(cleanup);

const CLIENTE = { id: "c1", markbox: "DTD-0001", name: "Cliente" } as Client;

describe("ClientDetailClient · Estado de cuenta (SDD-0558)", () => {
  it("sin acceso a facturación no hay enlace (rol comercial)", () => {
    render(
      <ClientDetailClient client={CLIENTE} canViewStatement={false}>
        <p>ficha</p>
      </ClientDetailClient>,
    );
    expect(screen.queryByRole("link", { name: "Estado de cuenta" })).toBeNull();
    expect(screen.getByRole("button", { name: "Editar cliente" })).toBeTruthy();
  });

  it("con acceso, el enlace va al estado de cuenta del cliente", () => {
    render(
      <ClientDetailClient client={CLIENTE} canViewStatement>
        <p>ficha</p>
      </ClientDetailClient>,
    );
    expect(screen.getByRole("link", { name: "Estado de cuenta" }).getAttribute("href")).toBe(
      "/studio/clientes/DTD-0001/estado-de-cuenta",
    );
    expect(screen.getByRole("button", { name: "Editar cliente" })).toBeTruthy();
  });
});
