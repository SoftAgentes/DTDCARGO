/**
 * SDD-0592 · useDialogA11y: el foco no se sale del modal.
 *
 * El navegador suelta el foco a `body` cuando el botón enfocado se deshabilita
 * durante el envío, y desde ahí Tab llevaba a controles detrás del modal. jsdom no
 * hace eso: el foco se queda en el botón, así que `soltarFoco` lo hace a mano.
 * Medido en un navegador real en la spec; aquí se fija el comportamiento.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DrawerShell } from "./DrawerShell";
import { useDialogA11y } from "./useDialogA11y";

vi.mock("@/lib/i18n", () => ({ useT: () => (key: string) => key }));

// La trampa filtra por `offsetParent`, que en jsdom siempre es null.
const originalOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetParent");
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get() {
      return document.body;
    },
  });
});
afterAll(() => {
  if (originalOffsetParent) Object.defineProperty(HTMLElement.prototype, "offsetParent", originalOffsetParent);
});

type Props = {
  pending?: boolean;
  invalido?: boolean;
  sinBoton?: boolean;
  bloqueado?: boolean;
  enabled?: boolean;
  inicioEnNombre?: boolean;
};

function Panel({ pending = false, invalido = false, sinBoton = false, bloqueado = false, enabled, inicioEnNombre }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const nombre = useRef<HTMLInputElement>(null);
  useDialogA11y(ref, { onClose: () => {}, pending, enabled, initialFocusRef: inicioEnNombre ? nombre : undefined });
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Panel" tabIndex={-1}>
      <input ref={nombre} aria-label="Nombre" />
      <input aria-label="Correo" aria-invalid={invalido ? true : undefined} />
      {!sinBoton && (
        <button type="button" disabled={pending || bloqueado}>
          Guardar
        </button>
      )}
    </div>
  );
}

function Pagina(props: Props & { encima?: boolean }) {
  const { encima, ...panel } = props;
  return (
    <>
      <button type="button">Detrás antes</button>
      <Panel {...panel} />
      <button type="button">Detrás después</button>
      {encima && <div role="dialog" aria-modal="true" aria-label="Encima" tabIndex={-1} />}
    </>
  );
}

const boton = (nombre: string) => screen.getByRole("button", { name: nombre });
const campo = (nombre: string) => screen.getByRole("textbox", { name: nombre });
const panel = () => screen.getByRole("dialog", { name: "Panel" });
// jsdom ignora `blur()` en un control deshabilitado: se habilita sólo para soltarlo.
const soltarFoco = () => {
  const activo = document.activeElement as HTMLButtonElement;
  const deshabilitado = activo.disabled;
  activo.disabled = false;
  activo.blur();
  activo.disabled = deshabilitado;
};

/** Abre, pulsa Guardar y deja el envío en curso. */
async function enviar(props: Props = {}) {
  const user = userEvent.setup();
  const vista = render(<Pagina {...props} />);
  await user.click(boton("Guardar"));
  vista.rerender(<Pagina {...props} pending />);
  return { user, vista };
}

describe("Tab con el foco perdido", () => {
  it("durante el envío va al primer control del panel y no a la página de detrás", async () => {
    const { user } = await enviar();
    soltarFoco();
    expect(document.body).toHaveFocus();
    await user.tab();
    expect(campo("Nombre")).toHaveFocus();
  });

  it("con Mayús va al último control habilitado del panel", async () => {
    const { user } = await enviar();
    soltarFoco();
    await user.tab({ shift: true });
    expect(campo("Correo")).toHaveFocus();
  });

  it("tampoco sale si el navegador deja el foco en el botón deshabilitado", async () => {
    const { user } = await enviar();
    expect(boton("Guardar")).toHaveFocus();
    await user.tab();
    expect(campo("Nombre")).toHaveFocus();
  });
});

describe("al terminar el envío con el foco perdido", () => {
  it("va al primer campo con error", async () => {
    const { vista } = await enviar();
    soltarFoco();
    vista.rerender(<Pagina invalido />);
    expect(campo("Correo")).toHaveFocus();
  });

  it("sin campos con error vuelve a donde estaba la persona", async () => {
    const { vista } = await enviar();
    soltarFoco();
    vista.rerender(<Pagina />);
    expect(boton("Guardar")).toHaveFocus();
  });

  it("si nadie movió el foco desde que abrió, vuelve al foco inicial", () => {
    const vista = render(<Pagina inicioEnNombre />);
    expect(campo("Nombre")).toHaveFocus();
    vista.rerender(<Pagina inicioEnNombre pending />);
    soltarFoco();
    vista.rerender(<Pagina inicioEnNombre />);
    expect(campo("Nombre")).toHaveFocus();
  });

  it("si ese control ya no está, va al panel", async () => {
    const { vista } = await enviar();
    soltarFoco();
    vista.rerender(<Pagina sinBoton />);
    expect(panel()).toHaveFocus();
  });

  it("si ese control sigue deshabilitado, va al panel", async () => {
    const { vista } = await enviar();
    soltarFoco();
    vista.rerender(<Pagina bloqueado />);
    expect(boton("Guardar")).toBeDisabled();
    expect(panel()).toHaveFocus();
  });
});

describe("no le quita el foco a nadie", () => {
  it("mientras dura el envío no lo mueve", async () => {
    const user = userEvent.setup();
    const vista = render(<Pagina invalido />);
    await user.click(boton("Guardar"));
    soltarFoco();
    vista.rerender(<Pagina invalido pending />);
    expect(document.body).toHaveFocus();
  });

  it("si la persona está en otro campo del panel, se queda ahí aunque haya errores", async () => {
    const { user, vista } = await enviar();
    await user.click(campo("Nombre"));
    vista.rerender(<Pagina invalido />);
    expect(campo("Nombre")).toHaveFocus();
  });

  it("si el foco está en un control fuera del panel, como un menú en un portal, no lo toca", async () => {
    const { vista } = await enviar();
    boton("Detrás después").focus();
    vista.rerender(<Pagina invalido />);
    expect(boton("Detrás después")).toHaveFocus();
  });

  it("si otro diálogo está encima, no se lo disputa", async () => {
    const { vista } = await enviar({ encima: true } as Props);
    soltarFoco();
    vista.rerender(<Pagina encima invalido />);
    expect(document.body).toHaveFocus();
  });

  it("con el hook apagado no hace nada", async () => {
    const { vista } = await enviar({ enabled: false });
    soltarFoco();
    vista.rerender(<Pagina enabled={false} invalido />);
    expect(document.body).toHaveFocus();
  });
});

describe("el aviso del panel gana", () => {
  const AVISO = "No se pudo guardar.";

  function ConDrawerShell({ pending, error }: { pending: boolean; error?: string }) {
    const aviso = useRef<HTMLParagraphElement>(null);
    useEffect(() => {
      if (!pending && error) aviso.current?.focus();
    }, [pending, error]);
    return (
      <DrawerShell title="Panel" onClose={() => {}} pending={pending}>
        <input aria-label="Correo" aria-invalid="true" />
        <button type="button" disabled={pending}>
          Guardar
        </button>
        {error && (
          <p ref={aviso} role="alert" tabIndex={-1}>
            {error}
          </p>
        )}
      </DrawerShell>
    );
  }

  function ConHookDirecto({ pending, error }: { pending: boolean; error?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const aviso = useRef<HTMLParagraphElement>(null);
    // Declarado antes que el hook: en el mismo componente, este efecto corre primero.
    useEffect(() => {
      if (!pending && error) aviso.current?.focus();
    }, [pending, error]);
    useDialogA11y(ref, { onClose: () => {}, pending });
    return (
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Panel" tabIndex={-1}>
        <input aria-label="Correo" aria-invalid="true" />
        <button type="button" disabled={pending}>
          Guardar
        </button>
        {error && (
          <p ref={aviso} role="alert" tabIndex={-1}>
            {error}
          </p>
        )}
      </div>
    );
  }

  it.each([
    ["dentro de DrawerShell, donde el hook corre antes", ConDrawerShell],
    ["con el hook directo, donde el hook corre después", ConHookDirecto],
  ])("%s", async (_nombre, Componente) => {
    const user = userEvent.setup();
    const vista = render(<Componente pending={false} />);
    await user.click(boton("Guardar"));
    vista.rerender(<Componente pending />);
    soltarFoco();
    vista.rerender(<Componente pending={false} error={AVISO} />);
    expect(screen.getByRole("alert")).toHaveFocus();
  });
});
