import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { PortalAlertasHub, type DocPresence } from "./PortalAlertasHub";
import type { AlertItem } from "@/lib/portal/alertas";
afterEach(cleanup);
const item: AlertItem = { key: "p-1", code: "DTD-TEST-1", stage: "prealerta", title: "Proveedor de prueba", meta: "2 cajas", sortAt: "2026-09-05", shipmentId: null, prealertaId: "p1" };
function mount(docs: DocPresence = { packing: false, factura: false, foto: false }) {
  render(<PortalAlertasHub items={[item]} docs={{ "p-1": docs }} trackGroups={[]} banner={null} markbox="DTD-TEST" />);
}
it("separa contador y control; abre y cierra con teclado sin descargas pendientes", async () => {
  mount(); const user = userEvent.setup();
  const button = screen.getByRole("button", { name: "Ver documentos de DTD-TEST-1" });
  expect(screen.getByText("Documentos: 0/3 disponibles").closest("button")).toBeNull();
  const panel = document.getElementById(button.getAttribute("aria-controls")!);
  expect(panel).not.toBeVisible(); button.focus(); await user.keyboard("{Enter}");
  expect(button).toHaveAttribute("aria-expanded", "true"); expect(panel).toBeVisible();
  expect(screen.getAllByText("Pendiente")).toHaveLength(3);
  expect(screen.queryByRole("link", { name: /consultar|descargar/i })).toBeNull();
  expect(screen.getByRole("link", { name: /gestionar documentos/i })).toHaveAttribute("href", "/portal/compras/DTD-TEST-1/etiquetas");
  await user.keyboard(" "); expect(button).toHaveAttribute("aria-expanded", "false");
  expect(panel).not.toBeVisible(); expect(button).toHaveFocus();
});
it("sólo ofrece consulta con destino y distingue recibido de pendiente", async () => {
  mount({ packing: true, factura: true, foto: false });
  await userEvent.click(screen.getByRole("button", { name: /^Ver documentos/ }));
  expect(screen.getByRole("link", { name: /Packing list\s*Consultar/ })).toHaveAttribute("href", "/portal/compras/DTD-TEST-1");
  expect(screen.getByText("Recibido")).toBeVisible(); expect(screen.getByText("Pendiente")).toBeVisible();
});
it("anuncia filtro seleccionado y recupera lista desde un estado vacío", async () => {
  mount(); await userEvent.click(screen.getByRole("button", { name: /^Recibidos/ }));
  expect(screen.getByRole("button", { name: /^Recibidos/ })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("No hay ítems en esta etapa.")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: /^Todas/ }));
  expect(screen.getByRole("button", { name: /^Ver documentos/ })).toBeVisible();
});
