/**
 * SDD-0598 · Si la acción lanza, como en un corte de red, el formulario sigue ahí con lo escrito.
 *
 * Sin el arreglo, `useActionState` lleva el error a la barrera y el formulario se desmonta. El aviso
 * no puede afirmar qué pasó, porque el envío pudo haberse registrado: dice qué hará el reintento,
 * según la acción tenga candado en la base (SDD-0599), un candado por lectura o sobrescriba.
 */
import { act, cleanup, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, type ReactElement, type ReactNode } from "react";
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
vi.mock("@/app/registro/actions", () => h.modulo());
vi.mock("@/app/portal/(app)/proveedores/actions", () => h.modulo());
vi.mock("@/app/portal/(app)/cotizaciones/actions", () => h.modulo());
vi.mock("@/app/portal/(app)/mensajes/actions", () => h.modulo());
vi.mock("@/app/portal/(app)/perfil/actions", () => h.modulo());
vi.mock("@/app/portal/(app)/perfil/address-actions", () => h.modulo());
vi.mock("@/app/portal/(app)/perfil/billing-actions", () => h.modulo());
vi.mock("@/app/portal/(app)/referidos/actions", () => h.modulo());
vi.mock("@/app/portal/(app)/reclamos/actions", () => h.modulo());
vi.mock("@/components/Analytics", () => ({ trackLead: vi.fn() }));
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
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
import { PortalMessageForm } from "@/app/portal/(app)/mensajes/PortalMessageForm";
import { DataChangeEditor } from "@/app/portal/(app)/perfil/DataChangeEditor";
import { BillingIdentityForm } from "@/app/portal/(app)/perfil/empresa/BillingIdentityForm";
import { PortalAddresses } from "@/app/portal/(app)/perfil/PortalAddresses";
import { SuppliersClient } from "@/app/portal/(app)/proveedores/SuppliersClient";
import { PortalClaims } from "@/app/portal/(app)/reclamos/_components/PortalClaims";
import { ReferralInviteForm } from "@/app/portal/_components/ReferralInviteForm";
import { RegisterForm } from "@/app/registro/RegisterForm";

const PROVEEDOR = { id: "s1", name: "Proveedor Uno", wechat: "wx1", contact: "c", notes: "n", status: "active", prealertas: [], prealertaCount: 0 } as never;
const ADDON = { code: "fotos", name: "Fotos", label: "Fotos", description: "d", price_usd: 1, requires_notes: true, requires_trackings: true, requires_consent: true, active: true, sort_order: 1 } as never;
const DIRECCION = { id: "a1", label: "Casa", line: "Calle 1", city: "Caracas", city_slug: null, state: "DC", reference: "r", is_default: false } as never;
const CUPO = { available: true, remaining: 3, limit: 3, used: 0 } as never;

/** La base tiene el candado o se compara el contenido (SDD-0599): reintentar no duplica. */
const NO_DUPLICA = /Intenta de nuevo: no se (registrará|enviará|guardará) dos veces\./;
/** La acción tiene candado: si ya quedó, el reintento lo dice. */
const CANDADO = /Intenta de nuevo: si ya quedó( activa)?, te lo avisaremos\./;
/** Sobrescribe lo mismo: reintentar no duplica. */
const REPETIBLE = /Lo que escribiste sigue aquí\. Intenta de nuevo\.$/;

type Caso = [nombre: string, ui: ReactElement, clase: RegExp, abrir?: RegExp];
const CASOS: Caso[] = [
  ["EntrarForm", <EntrarForm key="a" notice={null} authedNotBound={false} />, /Revisa tu bandeja y, si no llegó, pídelo de nuevo\./],
  ["PrealertaServiceSection", <PrealertaServiceSection key="b" prealertaCode="P-1" prealertaReceived={false} requests={[]} addons={[ADDON]} />, CANDADO, /Pedir un servicio/],
  ["NewPurchaseForm", <NewPurchaseForm key="c" suppliers={[PROVEEDOR]} addons={[ADDON]} preselected={PROVEEDOR} />, NO_DUPLICA],
  ["NewPurchaseWizard", <NewPurchaseWizard key="d" suppliers={[PROVEEDOR]} addons={[ADDON]} preselected={PROVEEDOR} />, NO_DUPLICA],
  ["PurchaseStepDetalle", <PurchaseStepDetalle key="e" code="P-1" modo="suelto" guardado={{ description: "Guardada", boxes: 2, estValueUsd: 10, trackingCn: "T1" }} />, REPETIBLE],
  ["CotizacionRequestForm", <CotizacionRequestForm key="f" defaultDestination="Caracas" />, NO_DUPLICA],
  ["PortalMessageForm", <PortalMessageForm key="h" />, NO_DUPLICA],
  ["PortalAddresses, agregar", <PortalAddresses key="i" addresses={[]} cities={[]} />, NO_DUPLICA, /Agregar/],
  ["PortalAddresses, editar", <PortalAddresses key="j" addresses={[DIRECCION]} cities={[]} />, REPETIBLE, /^Editar/],
  ["SuppliersClient, agregar", <SuppliersClient key="k" suppliers={[]} markbox="DTD-1" addons={[]} />, CANDADO, /Agregar|Nuevo|proveedor/i],
  ["SuppliersClient, editar", <SuppliersClient key="l" suppliers={[PROVEEDOR]} markbox="DTD-1" addons={[]} />, REPETIBLE, /Editar/],
  ["PortalClaims", <PortalClaims key="m" claims={[]} shipments={[{ id: "e1", code: "S-1" }]} evidence={{}} />, NO_DUPLICA],
  ["DataChangeEditor", <DataChangeEditor key="n" isEmpresa={false} current={{ name: "Ana", doc: "V1", phone: "0" }} openRequest={null} lastRejected={null} quota={CUPO} />, REPETIBLE, /Editar mis datos/],
  ["BillingIdentityForm", <BillingIdentityForm key="o" kind={"persona" as never} markbox="DTD-1" current={null} />, REPETIBLE],
  ["ReferralInviteForm", <ReferralInviteForm key="p" />, CANDADO],
];

class Barrera extends Component<{ children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false };
  static getDerivedStateFromError() {
    return { fallo: true };
  }
  render() {
    return this.state.fallo ? <p>Pantalla de error</p> : this.props.children;
  }
}

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

const sinPantallaDeError = () => expect(screen.queryByText("Pantalla de error")).toBeNull();

beforeEach(() => {
  cleanup();
  h.accion.mockReset();
  h.accion.mockRejectedValue(new TypeError("Failed to fetch"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  global.fetch = vi.fn(async () => new Response(JSON.stringify({ exists: false }))) as never;
});

describe("la acción lanza: el formulario sigue, con lo escrito y un aviso honesto", () => {
  it.each(CASOS)("%s", async (_nombre, ui, clase, abrir) => {
    const { container } = render(<Barrera>{ui}</Barrera>);
    if (abrir) fireEvent.click(screen.getAllByRole("button", { name: abrir })[0]);
    const form = elFormulario(container);
    llenar(form);
    const escrito = foto(form);
    expect(escrito.length).toBeGreaterThan(0);

    fireEvent.submit(form);
    await waitFor(() => expect(h.accion).toHaveBeenCalledOnce());
    const aviso = await screen.findByText(/No pudimos confirmar/);
    await act(async () => {});

    sinPantallaDeError();
    expect(aviso).toHaveTextContent(/sigue aquí/i);
    expect(aviso.textContent).toMatch(clase);
    // El foco lo pone un efecto, que puede correr después de que el aviso aparezca.
    await waitFor(() => expect(aviso.closest('[role="alert"]')).toHaveFocus());
    expect(foto(elFormulario(container))).toEqual(escrito);
  });

  it("AcceptInvitationForm conserva el nombre, vacía la clave y lo dice", async () => {
    const { container } = render(<Barrera><AcceptInvitationForm token="t" email="a@example.test" role={"staff" as never} /></Barrera>);
    const form = elFormulario(container);
    llenar(form);

    fireEvent.submit(form);
    const aviso = await screen.findByText(/No pudimos confirmar/);
    await act(async () => {});

    sinPantallaDeError();
    expect(aviso).toHaveTextContent(/la clave hay que escribirla otra vez/);
    expect(aviso.textContent).toMatch(CANDADO);
    // La clave la vacía un efecto, que puede correr después de que el aviso aparezca.
    await waitFor(() => expect(Object.fromEntries(foto(elFormulario(container))).password).toBe(""));
    const despues = Object.fromEntries(foto(elFormulario(container)));
    expect(despues.first_name).toBe("Texto de prueba");
    expect(despues.last_name).toBe("Texto de prueba");
  });

  it("RegisterForm conserva los cuatro pasos y sigue en Confirmar", async () => {
    const { container } = render(<Barrera><RegisterForm /></Barrera>);
    const form = container.querySelector("form") as HTMLFormElement;
    const visibles = () =>
      Array.from(form.querySelectorAll<HTMLInputElement>('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="file"]), textarea')).filter(
        (e) => e.name !== "empresa_web" && !e.disabled,
      );
    for (let paso = 0; paso < 4; paso++) {
      for (const e of visibles()) if (!e.value) fireEvent.change(e, { target: { value: e.type === "email" ? "ana@example.test" : "12345678" } });
      const seguir = screen.queryByRole("button", { name: /Continuar/ });
      if (!seguir) break;
      fireEvent.click(seguir);
      await act(async () => {});
    }
    const ocultos = () => Array.from(form.querySelectorAll<HTMLInputElement>('input[type="hidden"]')).map((e) => [e.name, e.value]);
    const antes = ocultos();
    expect(Object.fromEntries(antes).email).toBe("ana@example.test");

    fireEvent.submit(form);
    await waitFor(() => expect(h.accion).toHaveBeenCalledOnce());
    const aviso = await screen.findByText(/No pudimos confirmar/);
    await act(async () => {});

    sinPantallaDeError();
    expect(aviso).toHaveTextContent(/Tus datos siguen aquí/);
    expect(aviso.textContent).toMatch(CANDADO);
    expect(form.isConnected).toBe(true);
    expect(ocultos()).toEqual(antes);
    expect(screen.getByRole("button", { name: /crear cuenta/i })).toBeInTheDocument();
  });

  it("SupplierPicker conserva la ficha del proveedor nuevo", async () => {
    const user = userEvent.setup();
    render(<Barrera><NewPurchaseWizard suppliers={[]} addons={[ADDON]} preselected={null} /></Barrera>);
    await user.type(screen.getByRole("combobox", { name: /^Proveedor$/i }), "Proveedor Nuevo");
    await user.click(screen.getByRole("option", { name: /\+ Crear/i }));

    await user.click(screen.getByRole("button", { name: /Guardar proveedor/i }));
    const aviso = await screen.findByText(/No pudimos confirmar/);

    sinPantallaDeError();
    expect(aviso.textContent).toMatch(CANDADO);
    expect(screen.getByText(/Se creará/)).toHaveTextContent("Proveedor Nuevo");
  });

  it("MagicRequested: un corte al pedir otro enlace tampoco tumba la pantalla", async () => {
    h.accion.mockResolvedValueOnce({ requested: true, requests: 1, email: "ana@example.test" });
    const { container } = render(<Barrera><EntrarForm notice={null} authedNotBound={false} /></Barrera>);
    const form = elFormulario(container);
    fireEvent.change(form.querySelector('[name="email"]')!, { target: { value: "ana@example.test" } });
    fireEvent.submit(form);
    await screen.findByText(/revisa tu correo/);

    h.accion.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fireEvent.submit(screen.getByRole("button", { name: /Pedir otro enlace/ }).closest("form")!);
    const aviso = await screen.findByText(/No pudimos confirmar/);

    sinPantallaDeError();
    expect(aviso).toHaveTextContent(/Tu correo sigue aquí/);
    expect(h.accion).toHaveBeenCalledTimes(2);
    // Lo que el aviso promete: volvió al formulario, con el correo que ya se había usado.
    expect(container.querySelector<HTMLInputElement>('input[name="email"]:not([type="hidden"])')?.value).toBe("ana@example.test");
  });
});

describe("SDD-0599 · el identificador del intento", () => {
  const INTENTO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const enviado = () => (h.accion.mock.calls[0].at(-1) as FormData).get("request_id");

  // Lo llevan las acciones con candado en la base. La pantalla sigue el mismo camino en el reintento.
  it.each([
    ["NewPurchaseForm", <NewPurchaseForm key="a" suppliers={[PROVEEDOR]} addons={[ADDON]} preselected={PROVEEDOR} />],
    ["NewPurchaseWizard", <NewPurchaseWizard key="b" suppliers={[PROVEEDOR]} addons={[ADDON]} preselected={PROVEEDOR} />],
    ["CotizacionRequestForm", <CotizacionRequestForm key="c" defaultDestination="Caracas" />],
    ["PortalClaims", <PortalClaims key="d" claims={[]} shipments={[{ id: "e1", code: "S-1" }]} evidence={{}} />],
    ["PortalMessageForm", <PortalMessageForm key="e" />],
  ] as [string, ReactElement][])("%s lo envía", async (_nombre, ui) => {
    h.accion.mockResolvedValue({ error: "Tu sesión expiró." });
    const { container } = render(<Barrera>{ui}</Barrera>);
    fireEvent.submit(elFormulario(container));
    await waitFor(() => expect(h.accion).toHaveBeenCalledOnce());

    expect(enviado()).toMatch(INTENTO);
  });

  it("agregar dirección no lo necesita: compara el contenido", async () => {
    h.accion.mockResolvedValue({ error: "Tu sesión expiró." });
    const { container } = render(<Barrera><PortalAddresses addresses={[]} cities={[]} /></Barrera>);
    fireEvent.click(screen.getAllByRole("button", { name: /Agregar/ })[0]);
    fireEvent.submit(elFormulario(container));
    await waitFor(() => expect(h.accion).toHaveBeenCalledOnce());

    expect(enviado()).toBeNull();
  });
});

describe("SDD-0599 · si el primer envío ya había llegado, la pantalla lo dice", () => {
  const YA_ESTABA = /Ya estaba registrad[ao] desde tu primer envío\. Si cambiaste algo después, escríbele a tu asesor\./;
  const yaEstaba = () => screen.findByText(YA_ESTABA);

  it("CotizacionRequestForm", async () => {
    h.accion.mockResolvedValue({ ok: true, createdCode: "EST-1", replayed: true });
    const { container } = render(<Barrera><CotizacionRequestForm defaultDestination="Caracas" /></Barrera>);
    fireEvent.submit(elFormulario(container));

    expect(await yaEstaba()).toBeInTheDocument();
  });

  it("NewPurchaseForm", async () => {
    h.accion.mockResolvedValue({ ok: true, prealertaCode: "P-1", replayed: true });
    const { container } = render(<Barrera><NewPurchaseForm suppliers={[PROVEEDOR]} addons={[ADDON]} preselected={PROVEEDOR} /></Barrera>);
    fireEvent.submit(elFormulario(container));

    expect(await yaEstaba()).toBeInTheDocument();
  });

  it("NewPurchaseWizard", async () => {
    h.accion.mockResolvedValue({ ok: true, prealertaCode: "P-1", replayed: true });
    const { container } = render(<Barrera><NewPurchaseWizard suppliers={[PROVEEDOR]} addons={[ADDON]} preselected={PROVEEDOR} /></Barrera>);
    fireEvent.submit(elFormulario(container));

    expect(await yaEstaba()).toBeInTheDocument();
  });

  it("PortalClaims", async () => {
    h.accion.mockResolvedValue({ ok: true, createdCode: "RC-1", replayed: true });
    const { container } = render(<Barrera><PortalClaims claims={[]} shipments={[{ id: "e1", code: "S-1" }]} evidence={{}} /></Barrera>);
    fireEvent.submit(elFormulario(container));

    expect(await yaEstaba()).toBeInTheDocument();
  });

  it("PortalMessageForm", async () => {
    h.accion.mockResolvedValue({ ok: true, replayed: true });
    const { container } = render(<Barrera><PortalMessageForm /></Barrera>);
    fireEvent.submit(elFormulario(container));

    expect(await screen.findByText(/Tu mensaje ya había llegado en tu primer envío\./)).toBeInTheDocument();
  });

  it("sin replayed, no lo dice", async () => {
    h.accion.mockResolvedValue({ ok: true, createdCode: "EST-1" });
    const { container } = render(<Barrera><CotizacionRequestForm defaultDestination="Caracas" /></Barrera>);
    fireEvent.submit(elFormulario(container));

    expect(await screen.findByText(/Pedimos tu cotización/)).toBeInTheDocument();
    expect(screen.queryByText(YA_ESTABA)).toBeNull();
  });
});

describe("lo que no cambia", () => {
  it("una respuesta con error se muestra igual que siempre", async () => {
    h.accion.mockResolvedValue({ error: "Tu sesión expiró. Vuelve a entrar e intenta de nuevo." });
    const { container } = render(<Barrera><CotizacionRequestForm defaultDestination="Caracas" /></Barrera>);
    fireEvent.submit(elFormulario(container));

    expect(await screen.findByText("Tu sesión expiró. Vuelve a entrar e intenta de nuevo.")).toBeInTheDocument();
    expect(screen.queryByText(/No pudimos confirmar/)).toBeNull();
  });
});
