import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { DocumentsClient } from "./DocumentsClient";
afterEach(cleanup);
it("no ofrece abrir un documento sin URL y conserva navegación interna", async () => {
  render(<DocumentsClient docs={[
    {id:"1",docType:"packing",typeLabel:"Packing list",typeShort:"PL",shipmentCode:null,purchaseCode:"DTD-TEST",meta:"Prueba",url:"/portal/compras/DTD-TEST",kind:"abrir"},
    {id:"2",docType:"factura",typeLabel:"Factura",typeShort:"FAC",shipmentCode:"ENV-TEST",meta:"Prueba",url:null},
  ]} />);
  expect(screen.getByRole("link", {name:/Ver Packing list/})).toHaveAttribute("href", "/portal/compras/DTD-TEST");
  expect(screen.queryByRole("link", {name:/Descargar Factura/})).toBeNull();
  expect(screen.getByText("Enlace no disponible")).toBeVisible();
  await userEvent.click(screen.getByRole("button", {name:/^Factura/}));
  expect(screen.getByRole("button", {name:/^Factura/})).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByRole("link")).toBeNull();
  await userEvent.type(screen.getByRole("searchbox"), "inexistente");
  expect(screen.getByText("Ningún documento coincide.")).toBeVisible();
});
