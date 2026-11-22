/**
 * SDD-0654 fase 2 · barra superior del portal.
 *
 * Con el interruptor apagado (el layout no pasa vista) la barra queda idéntica
 * a la de hoy: sin selector y sin «Guía». En la Vista Pro hay selector y no hay
 * «Guía». En la Vista simple, «Guía» abre la guía en el inicio o lleva al inicio
 * con `?guia=1` desde otra pantalla.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EVENTO_ABRIR_GUIA } from "@/lib/portal/simple/eventos";

let pathname = "/portal";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("../actions", () => ({
  signOutAction: vi.fn(),
  markPortalAvisosSeenAction: vi.fn(async () => ({ ok: true })),
  setPortalVistaAction: vi.fn(async () => ({ ok: true })),
  markPortalGuiaVistaAction: vi.fn(async () => ({ ok: true })),
}));

const { PortalTopbar } = await import("./PortalTopbar");

const base = {
  name: "Cliente Demo",
  markbox: "DTD-9999",
  themed: true,
  theme: "light" as const,
  profileComplete: true,
  sailing: null,
  sailingDaysToCutoff: null,
  soporteDot: false,
  avisos: [],
  onOpenMenu: () => {},
};

afterEach(() => {
  cleanup();
  pathname = "/portal";
});

describe("PortalTopbar · SDD-0654", () => {
  it("con el interruptor apagado no hay selector ni «Guía»: la barra de hoy", () => {
    const { container: sinProp } = render(<PortalTopbar {...base} />);
    const htmlSinProp = sinProp.innerHTML;
    cleanup();
    const { container: conNull } = render(<PortalTopbar {...base} vista={null} />);
    expect(conNull.innerHTML).toBe(htmlSinProp);
    expect(screen.queryByRole("group", { name: "Vista del portal" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Guía" })).not.toBeInTheDocument();
  });

  it("en la Vista Pro hay selector y no hay «Guía»", () => {
    render(<PortalTopbar {...base} vista="pro" />);
    expect(screen.getByRole("group", { name: "Vista del portal" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Guía" })).not.toBeInTheDocument();
  });

  it("en la Vista simple, «Guía» en el inicio abre la guía sin navegar", () => {
    const abrir = vi.fn();
    window.addEventListener(EVENTO_ABRIR_GUIA, abrir);
    try {
      render(<PortalTopbar {...base} vista="simple" />);
      const guia = screen.getByRole("link", { name: "Guía" });
      expect(guia).toHaveAttribute("href", "/portal?guia=1");
      const click = new MouseEvent("click", { bubbles: true, cancelable: true });
      guia.dispatchEvent(click);
      expect(click.defaultPrevented).toBe(true);
      expect(abrir).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(EVENTO_ABRIR_GUIA, abrir);
    }
  });

  it("en la Vista simple, desde otra pantalla «Guía» lleva al inicio con ?guia=1", () => {
    pathname = "/portal/envios";
    const abrir = vi.fn();
    window.addEventListener(EVENTO_ABRIR_GUIA, abrir);
    try {
      render(<PortalTopbar {...base} vista="simple" />);
      const guia = screen.getByRole("link", { name: "Guía" });
      expect(guia).toHaveAttribute("href", "/portal?guia=1");
      fireEvent.click(guia);
      expect(abrir).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(EVENTO_ABRIR_GUIA, abrir);
    }
  });
});
