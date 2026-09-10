import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("./actions", () => ({ createSupplierAction: vi.fn(), updateSupplierAction: vi.fn(), deleteSupplierAction: vi.fn() }));
import { SuppliersClient } from "./SuppliersClient";
afterEach(cleanup);
it("proveedores y alta preceden a ayuda plegada; recompra conserva proveedor", () => {
 const { container } = render(<SuppliersClient markbox="DTD-TEST" addons={[]} suppliers={[{id:"supplier-test",supplierSeq:1,name:"Proveedor de prueba",wechat:null,city:null,contact:null,notes:null,orderCount:1,nextCode:"DTD-TEST-1-2"}]} />);
 const link = screen.getByRole("link", {name:/Nueva compra con este proveedor/});
 expect(link).toHaveAttribute("href", "/portal/compras/nueva?proveedor=supplier-test");
 const help = container.querySelector("details")!;
 expect(help).not.toHaveAttribute("open");
 expect(link.compareDocumentPosition(help) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(screen.getByRole("button", {name:"Agregar proveedor"}).compareDocumentPosition(help) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
