/**
 * SDD-0654 fase 2 · bloque 5 (AC-13, AC-14).
 *
 * El mensaje es el MISMO texto que «Mis compras» (`ChinaSupplierClip`), con el
 * próximo código que calcula `summarizeSuppliers`. Solo se ofrecen proveedores
 * de la cuenta: no hay campo para escribir un número. Junto a «Copiar» dice que
 * copiar no registra la compra.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTACT } from "@/lib/design-tokens";
import { buildChinaSupplierClipText } from "@/components/ChinaSupplierClip";
import { summarizeSuppliers } from "@/lib/studio/prealertas/types";
import { armarProveedores } from "@/lib/portal/simple/bloques";
import { EVENTO_ABRIR_TUTORIAL } from "@/lib/portal/simple/eventos";
import { BloqueProveedor } from "../BloqueProveedor";

const views = summarizeSuppliers(
  "DTD-9999",
  [
    { id: "s1", supplier_seq: 1, name: "Muebles Ejemplo", wechat: null, city: null, contact: null, notes: null },
    { id: "s2", supplier_seq: 2, name: "Repuestos Ejemplo", wechat: null, city: null, contact: null, notes: null },
  ],
  { s2: 1 },
);
const proveedores = armarProveedores(views);

let writeText: ReturnType<typeof vi.fn>;
beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});
afterEach(cleanup);

describe("buildChinaSupplierClipText", () => {
  it("es el mismo texto que armaba «Mis compras» antes de extraerlo", () => {
    const cn = CONTACT.cn;
    const antes = `仓库地址：${cn.addressCjk}
联系人：${cn.supplierContactCjk}（${cn.supplierContactEs}）：${cn.phoneCjk}
微信（WeChat）：${cn.wechatId}
收货时间：${cn.hoursCjk}
客户编码（请写在每个箱子上）：DTD-9999`;
    expect(buildChinaSupplierClipText("DTD-9999")).toBe(antes);
  });
});

describe("BloqueProveedor", () => {
  it("muestra solo los proveedores de la cuenta y no deja escribir un número (AC-14)", () => {
    const { container } = render(<BloqueProveedor proveedores={proveedores} markbox="DTD-9999" />);
    expect(container.querySelector("input, textarea, select")).toBeNull();
    const lista = screen.getByRole("list", { name: "Tus proveedores" });
    expect(lista.querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByText(/Copiar no registra tu compra/)).toBeInTheDocument();
  });

  it("el mensaje es el de «Mis compras» con el próximo código del proveedor elegido (AC-13)", async () => {
    render(<BloqueProveedor proveedores={proveedores} markbox="DTD-9999" />);
    fireEvent.click(screen.getByRole("button", { name: /Repuestos Ejemplo/ }));
    const codigo = views.find((v) => v.id === "s2")!.nextCode;
    expect(codigo).toBe("DTD-9999-2-2");
    const esperado = buildChinaSupplierClipText(codigo);
    expect(screen.getByText((_, el) => el?.tagName === "PRE" && el.textContent === esperado)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copiar mensaje" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(esperado));
    expect(await screen.findByText("Copiado.")).toBeInTheDocument();
  });

  it("explica cada parte del código con los datos del cliente; la selección va con aria-pressed", () => {
    render(<BloqueProveedor proveedores={proveedores} markbox="DTD-9999" />);
    fireEvent.click(screen.getByRole("button", { name: /Repuestos Ejemplo/ }));
    const prov = screen.getByRole("button", { name: /Repuestos Ejemplo/ });
    expect(prov).toHaveAttribute("aria-pressed", "true");
    const codigo = screen.getByRole("group", { name: "Código DTD-9999-2-2" });
    const partes = codigo.querySelectorAll("button");
    expect([...partes].map((b) => b.textContent)).toEqual(["DTD", "9999", "2", "2"]);
    fireEvent.click(partes[2]);
    expect(screen.getByText("2 · tu proveedor: es Repuestos Ejemplo.")).toBeInTheDocument();
    fireEvent.click(partes[3]);
    expect(screen.getByText("2 · la compra: ya le compraste 1 vez; esta es la número 2.")).toBeInTheDocument();
    expect(partes[3]).toHaveAttribute("aria-pressed", "true");
  });

  it("sin proveedores lleva a registrarlo primero y no muestra ningún código", () => {
    render(<BloqueProveedor proveedores={[]} markbox="DTD-9999" />);
    expect(screen.getByText(/Todavía no tienes proveedores registrados/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copiar mensaje" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /regístralo primero/ })).toHaveAttribute("href", "/portal/proveedores");
  });

  it("«Ver el tutorial del código» abre el tutorial", () => {
    const abrir = vi.fn();
    window.addEventListener(EVENTO_ABRIR_TUTORIAL, abrir);
    try {
      render(<BloqueProveedor proveedores={proveedores} markbox="DTD-9999" />);
      fireEvent.click(screen.getByRole("button", { name: /Ver el tutorial del código/ }));
      expect(abrir).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(EVENTO_ABRIR_TUTORIAL, abrir);
    }
  });
});
