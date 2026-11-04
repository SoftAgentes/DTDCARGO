/**
 * SDD-0598 · Si la acción lanza, el formulario sigue ahí con un aviso honesto. Si redirige, redirige.
 *
 * React y `next/navigation` son reales: el error de redirección es el que recibe el cliente.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { redirect, notFound } from "next/navigation";
import { Component, type ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { UnrecognizedActionError } from "next/dist/client/components/unrecognized-action-error";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OUTDATED_PAGE_MESSAGE, useActionKeepingDraft } from "../use-action-keeping-draft";

type State = { ok?: boolean; error?: string };
const accion = vi.fn<(state: State, formData: FormData) => Promise<State>>();
const AVISO = "No pudimos confirmar el envío. Lo que escribiste sigue aquí.";

function Formulario() {
  const [state, formProps, pending] = useActionKeepingDraft(accion, {}, AVISO);
  return (
    <form {...formProps}>
      <input name="nota" defaultValue="" aria-label="Nota" />
      <button type="submit">Enviar</button>
      {pending && <p>Enviando</p>}
      {state.error && <p role="alert">{state.error}</p>}
      {state.ok && <p role="status">Listo</p>}
    </form>
  );
}

class Barrera extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return <p>Barrera: {String((this.state.error as { digest?: string }).digest)}</p>;
  }
}

const errorDe = (lanzar: () => never) => {
  try {
    return lanzar();
  } catch (error) {
    return error;
  }
};

function escribirYEnviar(texto: string) {
  const nota = screen.getByLabelText("Nota") as HTMLInputElement;
  fireEvent.change(nota, { target: { value: texto } });
  fireEvent.submit(nota.form!);
  return nota;
}

beforeEach(() => {
  accion.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("cuando la acción lanza", () => {
  it("un corte de red deja el formulario, lo escrito y el aviso", async () => {
    accion.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<Barrera><Formulario /></Barrera>);
    const nota = escribirYEnviar("200 sillas");

    expect(await screen.findByRole("alert")).toHaveTextContent(AVISO);
    expect(screen.queryByText(/^Barrera/)).toBeNull();
    expect(nota.isConnected).toBe(true);
    expect(nota.value).toBe("200 sillas");
  });

  it("un error inesperado del servidor se trata igual: no se puede confirmar qué pasó", async () => {
    accion.mockRejectedValue(Object.assign(new Error("An error occurred in the Server Components render"), { digest: "123" }));
    render(<Barrera><Formulario /></Barrera>);
    escribirYEnviar("200 sillas");

    expect(await screen.findByRole("alert")).toHaveTextContent(AVISO);
  });

  it("una página de una versión anterior avisa que no se registró y que hay que recargar", async () => {
    accion.mockRejectedValue(new UnrecognizedActionError("Server Action not found"));
    render(<Barrera><Formulario /></Barrera>);
    const nota = escribirYEnviar("200 sillas");

    expect(await screen.findByRole("alert")).toHaveTextContent(OUTDATED_PAGE_MESSAGE);
    expect(nota.value).toBe("200 sillas");
  });

  it("lleva el foco al aviso, también si vuelve a lanzar", async () => {
    accion.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<Barrera><Formulario /></Barrera>);
    const nota = escribirYEnviar("200 sillas");
    // El foco lo pone un efecto, que puede correr después de que el aviso aparezca.
    await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());

    nota.focus();
    fireEvent.submit(nota.form!);
    await waitFor(() => expect(accion).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
  });

  it("el reintento vuelve a llamar a la acción con lo mismo y limpia el aviso si sale bien", async () => {
    accion.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ ok: true });
    render(<Barrera><Formulario /></Barrera>);
    const nota = escribirYEnviar("200 sillas");
    await screen.findByRole("alert");

    fireEvent.submit(nota.form!);

    expect(await screen.findByRole("status")).toHaveTextContent("Listo");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(accion).toHaveBeenCalledTimes(2);
    expect(accion.mock.calls[1][1].get("nota")).toBe("200 sillas");
  });

  it("no envía dos veces mientras la primera sigue en curso", async () => {
    let rechazar!: (e: unknown) => void;
    accion.mockImplementationOnce(() => new Promise((_, r) => { rechazar = r; }));
    render(<Barrera><Formulario /></Barrera>);
    const nota = escribirYEnviar("200 sillas");
    await screen.findByText("Enviando");

    fireEvent.submit(nota.form!);
    await act(async () => rechazar(new TypeError("Failed to fetch")));

    expect(accion).toHaveBeenCalledOnce();
  });
});

describe("lo que no es un fallo sigue su camino", () => {
  it("redirect() llega a la barrera de Next, sin aviso", async () => {
    accion.mockRejectedValue(errorDe(() => redirect("/portal")));
    render(<Barrera><Formulario /></Barrera>);
    escribirYEnviar("200 sillas");

    expect(await screen.findByText(/^Barrera: NEXT_REDIRECT/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("notFound() llega a la barrera de Next, sin aviso", async () => {
    accion.mockRejectedValue(errorDe(() => notFound()));
    render(<Barrera><Formulario /></Barrera>);
    escribirYEnviar("200 sillas");

    expect(await screen.findByText(/^Barrera: NEXT_HTTP_ERROR_FALLBACK/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("una respuesta con error se muestra tal cual", async () => {
    accion.mockResolvedValue({ error: "Tu sesión expiró." });
    render(<Barrera><Formulario /></Barrera>);
    escribirYEnviar("200 sillas");

    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent("Tu sesión expiró.");
    expect(aviso).not.toHaveFocus();
  });
});

describe("el identificador del intento", () => {
  function ConIntento({ requestId = true }: { requestId?: boolean }) {
    const [state, formProps] = useActionKeepingDraft(accion, {}, AVISO, { requestId });
    return (
      <form {...formProps}>
        <input name="nota" defaultValue="" aria-label="Nota" />
        {state.error && <p role="alert">{state.error}</p>}
        {state.ok && <p role="status">Listo</p>}
      </form>
    );
  }
  const idDe = (llamada: number) => accion.mock.calls[llamada][1].get("request_id");

  it("se repite en cada reintento, también si la persona cambió el texto", async () => {
    accion.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ error: "Tu sesión expiró." });
    render(<ConIntento />);
    const nota = escribirYEnviar("200 sillas");
    await screen.findByText(AVISO);

    fireEvent.change(nota, { target: { value: "300 sillas" } });
    fireEvent.submit(nota.form!);
    await screen.findByText("Tu sesión expiró.");

    expect(idDe(0)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(idDe(1)).toBe(idDe(0));
    expect(accion.mock.calls[1][1].get("nota")).toBe("300 sillas");
  });

  it("cambia después de ok: un formulario que queda a la vista no choca consigo mismo", async () => {
    accion.mockResolvedValue({ ok: true });
    render(<ConIntento />);
    const nota = escribirYEnviar("primero");
    await screen.findByRole("status");

    fireEvent.submit(nota.form!);
    await waitFor(() => expect(accion).toHaveBeenCalledTimes(2));

    expect(idDe(1)).not.toBe(idDe(0));
  });

  it("sin pedirlo, el envío no lleva identificador", async () => {
    accion.mockResolvedValue({ ok: true });
    render(<ConIntento requestId={false} />);
    escribirYEnviar("primero");
    await screen.findByRole("status");

    expect(idDe(0)).toBeNull();
  });
});

describe("antes de hidratar", () => {
  /**
   * Lo que una Server Action trae para servir sin JavaScript. `useActionState` la liga con `bind`,
   * y su `bind` conserva `$$FORM_ACTION`; el de una función común lo pierde.
   */
  function conReferencia(fn: typeof accion) {
    const formAction = () => ({ name: "$ACTION_ID_prueba", method: "POST", encType: "multipart/form-data", data: null });
    const original = fn.bind;
    return Object.assign(fn, {
      $$FORM_ACTION: formAction,
      bind(...args: Parameters<typeof original>) {
        return Object.assign(original.apply(fn, args), { $$FORM_ACTION: formAction });
      },
    });
  }

  it("el HTML del servidor envía por POST, sin datos en la URL, y sin el envoltorio", () => {
    conReferencia(accion);
    const html = renderToString(<Formulario />);

    expect(html).toMatch(/<form[^>]*method="POST"/i);
    expect(html).toContain("$ACTION_ID_prueba");
    expect(html).not.toContain("javascript:");
  });

  it("hidrata sin diferencias, y después el envío pasa por el envoltorio", async () => {
    conReferencia(accion);
    const raiz = document.createElement("div");
    document.body.appendChild(raiz);
    raiz.innerHTML = renderToString(<Formulario />);
    const diferencias = vi.fn();

    await act(async () => {
      hydrateRoot(raiz, <Formulario />, { onRecoverableError: diferencias });
    });
    expect(diferencias).not.toHaveBeenCalled();

    accion.mockRejectedValue(new TypeError("Failed to fetch"));
    fireEvent.submit(raiz.querySelector("form")!);
    await waitFor(() => expect(raiz.querySelector('[role="alert"]')).toHaveTextContent(AVISO));
    raiz.remove();
  });
});
