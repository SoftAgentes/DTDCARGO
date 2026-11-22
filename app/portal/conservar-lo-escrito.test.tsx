/**
 * SDD-0596 · Una respuesta con errores no borra lo que el cliente escribió.
 *
 * React 19 vacía los campos sin estado de un `<form action={...}>` al terminar la acción,
 * aunque esta devuelva un error. Cada formulario se llena, recibe un error y debe conservar
 * sus campos: es lo que pide FRM-01 («Cambios sin guardar se conservan»).
 */
import { act, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Con la suite entera, un envío puede seguir en curso más de 1 s, que es lo que `findBy` y `waitFor` esperan por defecto.
configure({ asyncUtilTimeout: 5_000 });

const h = vi.hoisted(() => {
  const accion = vi.fn();
  // Un módulo de acciones de mentira que responde a cualquier nombre de acción.
  const modulo = () =>
    new Proxy(
      {},
      {
        has: () => true,
        get: (_t, p) => (p === "then" || p === "__esModule" ? undefined : (...a: unknown[]) => accion(...a)),
      },
    );
  return { accion, modulo };
});
vi.mock("@/app/entrar/actions", () => h.modulo());
vi.mock("@/app/portal/actions", () => h.modulo());
vi.mock("@/app/invitar/[token]/actions", () => h.modulo());
vi.mock("@/app/portal/(app)/proveedores/actions", () => h.modulo());
vi.mock("@/app/portal/(app)/cotizaciones/actions", () => h.modulo());
vi.mock("@/app/portal/(app)/facturas/[code]/aceptar/actions", () => h.modulo());
vi.mock("@/app/portal/(app)/mensajes/actions", () => h.modulo());
vi.mock("@/app/portal/(app)/perfil/address-actions", () => h.modulo());
vi.mock("@/app/portal/(app)/reclamos/actions", () => h.modulo());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh() {}, push() {}, replace() {}, prefetch() {} }),
  usePathname: () => "/portal",
  useSearchParams: () => new URLSearchParams(),
}));

import { EntrarForm } from "@/app/entrar/EntrarForm";
import { AcceptInvitationForm } from "@/app/invitar/[token]/_components/AcceptInvitationForm";
import { PrealertaServiceSection } from "@/app/portal/(app)/compras/[code]/etiquetas/ServiceSection";
import { NewPurchaseForm } from "@/app/portal/(app)/compras/nueva/NewPurchaseForm";
import { NewPurchaseWizard } from "@/app/portal/(app)/compras/nueva/NewPurchaseWizard";
import { PurchaseStepDetalle } from "@/app/portal/(app)/compras/nueva/PurchaseStepDetalle";
import { CotizacionRequestForm } from "@/app/portal/(app)/cotizaciones/CotizacionRequestForm";
import { AcceptanceForm } from "@/app/portal/(app)/facturas/[code]/aceptar/AcceptanceForm";
import { PortalMessageForm } from "@/app/portal/(app)/mensajes/PortalMessageForm";
import { PortalAddresses } from "@/app/portal/(app)/perfil/PortalAddresses";
import { SuppliersClient } from "@/app/portal/(app)/proveedores/SuppliersClient";
import { PortalClaims } from "@/app/portal/(app)/reclamos/_components/PortalClaims";

const MSG = "Respuesta de error de prueba.";
const PROVEEDOR = { id: "s1", name: "Proveedor Uno", wechat: "wx1", contact: "c", notes: "n", status: "active", prealertas: [], prealertaCount: 0 } as never;
const ADDON = { code: "fotos", name: "Fotos", label: "Fotos", description: "d", price_usd: 1, requires_notes: true, requires_trackings: true, requires_consent: true, active: true, sort_order: 1 } as never;
const COPY = { title: "t", body: "b", readLinkLabel: "l", readLinkHref: "/x", checkbox1: "c1", checkbox2: "c2", submitLabel: "s", backLabel: "v", legalFooter: "f" } as never;
const DIRECCION = { id: "a1", label: "Casa", line: "Calle 1", city: "Caracas", city_slug: null, state: "DC", reference: "r", is_default: false } as never;

type Caso = [nombre: string, ui: ReactElement, abrir?: RegExp];
const CASOS: Caso[] = [
  ["EntrarForm", <EntrarForm key="a" notice={null} authedNotBound={false} />],
  ["PrealertaServiceSection", <PrealertaServiceSection key="b" prealertaCode="P-1" prealertaReceived={false} requests={[]} addons={[ADDON]} />, /Pedir un servicio/],
  ["NewPurchaseForm", <NewPurchaseForm key="c" suppliers={[PROVEEDOR]} addons={[ADDON]} preselected={PROVEEDOR} />],
  ["NewPurchaseWizard", <NewPurchaseWizard key="d" suppliers={[PROVEEDOR]} addons={[ADDON]} preselected={PROVEEDOR} />],
  ["PurchaseStepDetalle", <PurchaseStepDetalle key="e" code="P-1" modo="suelto" guardado={{ description: "Guardada", boxes: 2, estValueUsd: 10, trackingCn: "T1" }} />],
  ["CotizacionRequestForm", <CotizacionRequestForm key="f" defaultDestination="Caracas" />],
  ["PortalMessageForm", <PortalMessageForm key="h" />],
  ["PortalAddresses, agregar", <PortalAddresses key="i" addresses={[]} cities={[]} />, /Agregar/],
  ["PortalAddresses, editar", <PortalAddresses key="j" addresses={[DIRECCION]} cities={[]} />, /^Editar/],
  ["SuppliersClient, agregar", <SuppliersClient key="k" suppliers={[]} markbox="DTD-1" addons={[]} />, /Agregar|Nuevo|proveedor/i],
  ["SuppliersClient, editar", <SuppliersClient key="l" suppliers={[PROVEEDOR]} markbox="DTD-1" addons={[]} />, /Editar/],
  ["PortalClaims", <PortalClaims key="m" claims={[]} shipments={[{ id: "e1", code: "S-1" }]} evidence={{}} />],
];

type Campo = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const campos = (form: HTMLFormElement): Campo[] =>
  (Array.from(form.elements) as Campo[]).filter(
    (el) => ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName) && !el.disabled && !!el.name && !["hidden", "file", "radio"].includes(el.type),
  );

const valor = (el: Campo) => (el.type === "checkbox" ? String((el as HTMLInputElement).checked) : el.value);

/** Le escribe a cada campo un valor distinto del inicial. */
function llenar(form: HTMLFormElement) {
  for (const el of campos(form)) {
    if (el.type === "checkbox") fireEvent.click(el);
    else if (el.tagName === "SELECT") {
      const opciones = Array.from((el as HTMLSelectElement).options).filter((o) => !o.disabled && o.value && o.value !== el.value);
      if (opciones.length) fireEvent.change(el, { target: { value: opciones[opciones.length - 1].value } });
    } else if (el.type === "number") fireEvent.change(el, { target: { value: "123" } });
    else if (el.type === "date") fireEvent.change(el, { target: { value: "2026-03-15" } });
    else if (el.type === "email") fireEvent.change(el, { target: { value: "ana@example.test" } });
    else fireEvent.change(el, { target: { value: "Texto de prueba" } });
  }
}

/** El formulario con más campos de la vista: los de una sola acción no tienen. */
const elFormulario = (raiz: HTMLElement) =>
  Array.from(raiz.querySelectorAll("form")).sort((a, b) => campos(b).length - campos(a).length)[0] as HTMLFormElement;

const foto = (form: HTMLFormElement) => campos(form).map((el) => [el.name, valor(el)]);

beforeEach(() => {
  h.accion.mockReset();
  h.accion.mockResolvedValue({ error: MSG });
});

describe("una respuesta con errores conserva lo escrito", () => {
  it.each(CASOS)("%s", async (_nombre, ui, abrir) => {
    const { container } = render(ui);
    if (abrir) fireEvent.click(screen.getAllByRole("button", { name: abrir })[0]);
    const form = elFormulario(container);
    llenar(form);
    const escrito = foto(form);
    expect(escrito.length).toBeGreaterThan(0);

    fireEvent.submit(form);
    await waitFor(() => expect(h.accion).toHaveBeenCalledOnce());
    expect(await screen.findByText(MSG)).toBeInTheDocument();
    await act(async () => {});

    expect(foto(elFormulario(container))).toEqual(escrito);
  });

});

describe("lo que no debe conservarse", () => {
  it("AcceptInvitationForm conserva nombre y apellido, y vacía la clave", async () => {
    const { container } = render(<AcceptInvitationForm token="t" email="a@example.test" role={"staff" as never} />);
    const form = elFormulario(container);
    llenar(form);
    fireEvent.submit(form);
    expect(await screen.findByText(MSG)).toBeInTheDocument();
    // La clave la vacía un efecto, que puede correr después de que el aviso aparezca.
    await waitFor(() => expect(Object.fromEntries(foto(elFormulario(container))).password).toBe(""));

    const despues = Object.fromEntries(foto(elFormulario(container)));
    expect(despues.first_name).toBe("Texto de prueba");
    expect(despues.last_name).toBe("Texto de prueba");
  });

  it("AcceptanceForm vuelve a pedir las dos casillas: cada intento de aceptar es un acto explícito", async () => {
    const { container } = render(<AcceptanceForm invoiceCode="F-1" copy={COPY} />);
    const form = elFormulario(container);
    llenar(form);
    expect(foto(form)).toEqual([["accept_docs", "true"], ["accept_merchant", "true"]]);
    fireEvent.submit(form);
    expect(await screen.findByText(MSG)).toBeInTheDocument();
    await act(async () => {});

    expect(foto(elFormulario(container))).toEqual([["accept_docs", "false"], ["accept_merchant", "false"]]);
  });

  it.each(CASOS)("%s no tiene campos de clave ni de código de un solo uso", (_nombre, ui, abrir) => {
    const { container } = render(ui);
    if (abrir) fireEvent.click(screen.getAllByRole("button", { name: abrir })[0]);
    const sensibles = container.querySelectorAll('input[type="password"], input[autocomplete="one-time-code"], input[name*="password" i], input[name*="otp" i]');
    expect(sensibles).toHaveLength(0);
  });
});

describe("el envío sigue igual", () => {
  it("la acción recibe lo escrito en el FormData", async () => {
    const { container } = render(<CotizacionRequestForm defaultDestination="Caracas" />);
    const form = elFormulario(container);
    fireEvent.change(form.querySelector('[name="description"]')!, { target: { value: "200 sillas" } });
    fireEvent.submit(form);
    await waitFor(() => expect(h.accion).toHaveBeenCalledOnce());
    const datos = h.accion.mock.calls[0].at(-1) as FormData;
    expect(datos.get("description")).toBe("200 sillas");
    expect(datos.get("destination")).toBe("Caracas");
  });

  it("no envía dos veces mientras la primera sigue en curso", async () => {
    let responder!: (v: unknown) => void;
    h.accion.mockImplementationOnce(() => new Promise((r) => { responder = r; }));
    const { container } = render(<PortalMessageForm />);
    const form = elFormulario(container);
    fireEvent.submit(form);
    await waitFor(() => expect(h.accion).toHaveBeenCalledOnce());
    await act(async () => {});
    fireEvent.submit(form);
    await act(async () => responder({ error: MSG }));
    expect(h.accion).toHaveBeenCalledOnce();
  });

  it("un formulario que queda a la vista se limpia al enviar bien", async () => {
    h.accion.mockResolvedValueOnce({ ok: true });
    const { container } = render(<PortalMessageForm />);
    const form = elFormulario(container);
    const cuerpo = form.querySelector<HTMLTextAreaElement>('[name="body"]')!;
    fireEvent.change(cuerpo, { target: { value: "Hola" } });
    fireEvent.submit(form);
    await waitFor(() => expect(cuerpo.value).toBe(""));
  });

  it("el formulario de reclamos también se limpia al enviar bien", async () => {
    h.accion.mockResolvedValueOnce({ ok: true, createdCode: "RC-1" });
    const { container } = render(<PortalClaims claims={[]} shipments={[{ id: "e1", code: "S-1" }]} evidence={{}} />);
    const form = elFormulario(container);
    const descripcion = form.querySelector<HTMLTextAreaElement>('[name="description"]')!;
    fireEvent.change(descripcion, { target: { value: "Llegó una caja abierta" } });
    fireEvent.submit(form);
    await waitFor(() => expect(descripcion.value).toBe(""));
  });
});
