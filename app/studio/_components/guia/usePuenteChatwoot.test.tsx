/**
 * usePuenteChatwoot (SDD-0589, 9.4): la Bandeja le pide al script del panel que
 * mida solo con la guía abierta, acepta respuestas solo de su marco y del origen
 * del chat, y le entrega al motor las cajas en coordenadas de la página.
 */
import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pedidoMirar, PEDIDO_PARAR } from "@/lib/studio/guia/puente-chatwoot";
import type { GuiaRecorrido } from "@/lib/studio/guia/tipos";
import { ubicarRemota } from "@/lib/studio/guia/ubicadores";
import { cerrarGuia, GuiaMotor, iniciarGuia } from "./GuiaMotor";
import { origenDe, usePuenteChatwoot } from "./usePuenteChatwoot";

vi.mock("next/navigation", () => ({
  usePathname: () => "/studio/bandeja",
  useSearchParams: () => new URLSearchParams(""),
}));

const CHAT = "https://chat.dtdcargo.com";
const BANDEJA: GuiaRecorrido = {
  id: "bandeja",
  ruta: "/studio/bandeja",
  pasos: [{ id: "B1", ancla: "bandeja.composer", clave: "guide.inbox.reply", respaldo: "bandeja.marco" }],
};

let marco: HTMLIFrameElement | null = null;

function Bandeja({ origen = CHAT }: { origen?: string | null }) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  usePuenteChatwoot(ref, origen);
  return (
    <iframe
      title="chat"
      data-guia="bandeja.marco"
      ref={(el) => {
        ref.current = el;
        marco = el;
        if (!el) return;
        el.getBoundingClientRect = () =>
          ({ top: 100, left: 50, width: 802, height: 602, x: 50, y: 100, right: 852, bottom: 702, toJSON() {} }) as DOMRect;
        Object.defineProperty(el, "clientTop", { value: 1, configurable: true });
        Object.defineProperty(el, "clientLeft", { value: 1, configurable: true });
        Object.defineProperty(el, "clientWidth", { value: 800, configurable: true });
        Object.defineProperty(el, "clientHeight", { value: 600, configurable: true });
      }}
    />
  );
}

function montar(origen?: string | null) {
  const r = render(
    <>
      <Bandeja origen={origen} />
      <GuiaMotor catalogo={[BANDEJA]} />
    </>,
  );
  const enviados = vi.spyOn(marco!.contentWindow!, "postMessage");
  return { ...r, enviados };
}

function delPanel(data: unknown, opciones: { origin?: string; source?: unknown } = {}) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: typeof data === "string" ? data : JSON.stringify(data),
        origin: opciones.origin ?? CHAT,
        source: (opciones.source ?? marco!.contentWindow) as MessageEventSource,
      }),
    );
  });
}

const CAJAS = { evento: "dtd:guia:cajas", cajas: { "bandeja.composer": { top: 10, left: 20, width: 300, height: 100 } } };
const MIRAR = JSON.stringify(pedidoMirar());

beforeEach(() => {
  marco = null;
});
afterEach(() => {
  act(() => cerrarGuia());
});

describe("usePuenteChatwoot", () => {
  it("sin guía abierta no le pide al panel que mida", () => {
    const { enviados } = montar();
    delPanel({ evento: "dtd:guia:listo" });
    expect(enviados.mock.calls.filter(([m]) => m === MIRAR)).toHaveLength(0);
  });

  it("al abrir la guía pide medir, al origen del chat; al cerrarla pide parar", () => {
    const { enviados } = montar();
    act(() => iniciarGuia("bandeja"));
    expect(enviados).toHaveBeenCalledWith(MIRAR, CHAT);
    act(() => cerrarGuia());
    expect(enviados).toHaveBeenLastCalledWith(JSON.stringify(PEDIDO_PARAR), CHAT);
  });

  it("si el panel recarga con la guía abierta («listo»), repite el pedido", () => {
    const { enviados } = montar();
    act(() => iniciarGuia("bandeja"));
    enviados.mockClear();
    delPanel({ evento: "dtd:guia:listo" });
    expect(enviados).toHaveBeenCalledWith(MIRAR, CHAT);
  });

  it("pasa la caja del marco a la página, sumando el borde", () => {
    montar();
    act(() => iniciarGuia("bandeja"));
    delPanel(CAJAS);
    expect(ubicarRemota("bandeja.composer")?.caja).toEqual({ top: 111, left: 71, width: 300, height: 100 });
  });

  it("una caja fuera de la vista del marco se conoce, pero sin caja; una ancla en null no se conoce", () => {
    montar();
    act(() => iniciarGuia("bandeja"));
    delPanel({ evento: "dtd:guia:cajas", cajas: { "bandeja.composer": { top: 900, left: 0, width: 10, height: 10 }, "bandeja.buscar": null } });
    expect(ubicarRemota("bandeja.composer")).toMatchObject({ caja: null });
    expect(ubicarRemota("bandeja.buscar")).toBeNull();
  });

  it.each([
    ["otro origen", { origin: "https://malo.example.test" }],
    ["el origen de Studio", { origin: "https://dtdcargo.com" }],
    ["otra ventana con el origen del chat", { source: window }],
  ])("ignora %s", (_n, opciones) => {
    montar();
    act(() => iniciarGuia("bandeja"));
    delPanel(CAJAS, opciones);
    expect(ubicarRemota("bandeja.composer")).toBeNull();
  });

  it("al cerrar la guía olvida las cajas", () => {
    montar();
    act(() => iniciarGuia("bandeja"));
    delPanel(CAJAS);
    expect(ubicarRemota("bandeja.composer")).not.toBeNull();
    act(() => cerrarGuia());
    expect(ubicarRemota("bandeja.composer")).toBeNull();
  });

  it("«mostrar» viaja al panel con la preferencia de movimiento", () => {
    const { enviados } = montar();
    act(() => iniciarGuia("bandeja"));
    delPanel(CAJAS);
    ubicarRemota("bandeja.composer")!.ubicador.mostrar!("bandeja.composer", { suave: false });
    expect(enviados).toHaveBeenLastCalledWith(
      JSON.stringify({ evento: "dtd:guia:mostrar", ancla: "bandeja.composer", suave: false }),
      CHAT,
    );
  });

  it("sin origen del chat (Bandeja sin configurar) no registra nada ni manda nada", () => {
    const { enviados, unmount } = montar(null);
    act(() => iniciarGuia("bandeja"));
    delPanel(CAJAS);
    expect(enviados).not.toHaveBeenCalled();
    expect(ubicarRemota("bandeja.composer")).toBeNull();
    unmount();
  });

  it("al desmontar quita su ubicador", () => {
    const { unmount } = montar();
    act(() => iniciarGuia("bandeja"));
    delPanel(CAJAS);
    unmount();
    expect(ubicarRemota("bandeja.composer")).toBeNull();
  });

  it("origenDe", () => {
    expect(origenDe("https://chat.dtdcargo.com/app/accounts/1/dashboard")).toBe(CHAT);
    expect(origenDe("no es url")).toBeNull();
    expect(origenDe(null)).toBeNull();
  });
});
