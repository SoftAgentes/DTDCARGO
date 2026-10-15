/**
 * SDD-0526 · La campana del Portal con su bandeja de avisos.
 *
 * Lo que ve el cliente: el contador (avisos sin leer + la respuesta del asesor),
 * la bandeja vacía, cada aviso con su enlace a la compra o al envío, la marca
 * del asesor que ya existía, y cuándo baja el contador: sólo cuando la base
 * confirmó el «visto».
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PortalAviso } from "@/lib/portal/portal-avisos";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  }) => (
    <a
      href={href}
      {...rest}
      onClick={(e) => {
        e.preventDefault();
        onClick?.(e);
      }}
    >
      {children}
    </a>
  ),
}));
// La server action real no se importa en jsdom: siempre se inyecta un doble.
vi.mock("../../actions", () => ({
  markPortalAvisosSeenAction: () => {
    throw new Error("la prueba debe inyectar marcarVistos");
  },
}));

import { PortalAvisosBell } from "../PortalAvisosBell";

afterEach(cleanup);

function aviso(id: string, over: Partial<PortalAviso> = {}): PortalAviso {
  return {
    id,
    title: `Título ${id}`,
    body: `Texto ${id}`,
    sentAt: "2026-10-15T14:30:00+00:00",
    sentAtLabel: "15 oct 2026 · 10:30",
    eventLabel: "Embarcado",
    channel: "email",
    anchorKind: "envio",
    anchorCode: `ENV-${id}`,
    anchorLabel: "Envío",
    href: `/portal/envios/ENV-${id}`,
    unread: true,
    ...over,
  };
}

const TRES = [
  aviso("n3", { sentAt: "2026-10-15T14:30:00+00:00" }),
  aviso("n2", {
    sentAt: "2026-10-14T13:00:00+00:00",
    sentAtLabel: "14 oct 2026 · 09:00",
    anchorKind: "compra",
    anchorCode: "DTD-0001-1-1",
    anchorLabel: "Compra",
    href: "/portal/compras/DTD-0001-1-1",
  }),
  aviso("n1", { sentAt: "2026-10-13T09:00:00+00:00", unread: false }),
];

function campana() {
  return screen.getByRole("button", { name: /^Avisos/ });
}
function contador(): string | null {
  return screen.queryByTestId("avisos-contador")?.textContent ?? null;
}
function bandeja() {
  return screen.getByRole("region", { name: "Avisos" });
}

/** Una promesa que la prueba resuelve cuando quiere. */
function diferida<T>() {
  let resolver!: (v: T) => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise<T>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

describe("PortalAvisosBell", () => {
  it("sin avisos ni asesor: sin contador, bandeja vacía y no marca nada", async () => {
    const marcar = vi.fn(async () => ({ ok: true }));
    render(<PortalAvisosBell avisos={[]} soporteDot={false} marcarVistos={marcar} />);

    expect(campana()).toHaveAccessibleName("Avisos");
    expect(contador()).toBeNull();
    await userEvent.click(campana());

    expect(within(bandeja()).getByText("Todavía no tienes avisos.")).toBeInTheDocument();
    expect(
      within(bandeja()).getByText("Cuando te enviemos uno sobre tu mercancía, también lo verás aquí."),
    ).toBeInTheDocument();
    expect(within(bandeja()).queryByRole("link")).toBeNull();
    expect(marcar).not.toHaveBeenCalled();
  });

  it("con no leídos: contador, cada aviso con su enlace, y marca hasta el más nuevo", async () => {
    const d = diferida<{ ok: boolean }>();
    const marcar = vi.fn(() => d.promesa);
    render(<PortalAvisosBell avisos={TRES} soporteDot={false} marcarVistos={marcar} />);

    expect(contador()).toBe("2");
    expect(campana()).toHaveAccessibleName("Avisos · 2 sin leer");

    await userEvent.click(campana());
    expect(campana()).toHaveAttribute("aria-expanded", "true");
    const lista = within(bandeja()).getByRole("list", { name: "Avisos enviados" });
    const enlaces = within(lista).getAllByRole("link");
    expect(enlaces.map((a) => a.getAttribute("href"))).toEqual([
      "/portal/envios/ENV-n3",
      "/portal/compras/DTD-0001-1-1",
      "/portal/envios/ENV-n1",
    ]);
    expect(enlaces[0]).toHaveTextContent("Título n3");
    expect(enlaces[0]).toHaveTextContent("Texto n3");
    expect(enlaces[0]).toHaveTextContent("Envío ENV-n3");
    expect(enlaces[0]).toHaveTextContent("15 oct 2026 · 10:30");
    expect(enlaces[1]).toHaveTextContent("Compra DTD-0001-1-1");
    expect(within(enlaces[0]).getByText("Nuevo")).toBeInTheDocument();
    expect(within(enlaces[1]).getByText("Nuevo")).toBeInTheDocument();
    expect(within(enlaces[2]).queryByText("Nuevo")).toBeNull();
    expect(within(bandeja()).getByText("2 nuevos")).toBeInTheDocument();

    expect(marcar).toHaveBeenCalledTimes(1);
    expect(marcar).toHaveBeenCalledWith("2026-10-15T14:30:00+00:00");
    // Hasta que la base confirme, el contador no baja.
    expect(contador()).toBe("2");
    await act(async () => d.resolver({ ok: true }));
    expect(contador()).toBeNull();
    expect(campana()).toHaveAccessibleName("Avisos");
    // Con el panel abierto, los que eran nuevos conservan su marca.
    expect(within(enlaces[0]).getByText("Nuevo")).toBeInTheDocument();

    await userEvent.click(campana()); // cierra
    await userEvent.click(campana()); // reabre
    expect(within(bandeja()).queryByText("Nuevo")).toBeNull();
    expect(marcar).toHaveBeenCalledTimes(1);
  });

  it("si la base no confirma, el contador sigue y se reintenta al volver a abrir", async () => {
    const marcar = vi
      .fn<(hasta: string) => Promise<{ ok: boolean }>>()
      .mockResolvedValueOnce({ ok: false })
      .mockRejectedValueOnce(new Error("red"))
      .mockResolvedValueOnce({ ok: true });
    render(<PortalAvisosBell avisos={TRES} soporteDot={false} marcarVistos={marcar} />);

    await userEvent.click(campana());
    await act(async () => {});
    expect(contador()).toBe("2");
    await userEvent.click(campana());
    await userEvent.click(campana());
    await act(async () => {});
    expect(contador()).toBe("2");
    await userEvent.click(campana());
    await userEvent.click(campana());
    await act(async () => {});
    expect(contador()).toBeNull();
    expect(marcar).toHaveBeenCalledTimes(3);
  });

  it("conserva la marca del asesor: cuenta en el contador y abre Soporte", async () => {
    const marcar = vi.fn(async () => ({ ok: true }));
    render(<PortalAvisosBell avisos={[]} soporteDot marcarVistos={marcar} />);

    expect(contador()).toBe("1");
    expect(campana()).toHaveAccessibleName("Avisos · 1 sin leer");
    await userEvent.click(campana());
    const soporte = within(bandeja()).getByRole("link", { name: /Soporte/ });
    expect(soporte).toHaveAttribute("href", "/portal/soporte");
    expect(soporte).toHaveTextContent("Tu asesor te respondió.");
    expect(within(bandeja()).getByText("Todavía no tienes avisos.")).toBeInTheDocument();
    expect(marcar).not.toHaveBeenCalled();
  });

  it("asesor y avisos suman en el mismo contador; el asesor no baja al marcar avisos", async () => {
    const marcar = vi.fn(async () => ({ ok: true }));
    render(<PortalAvisosBell avisos={TRES} soporteDot marcarVistos={marcar} />);

    expect(contador()).toBe("3");
    await userEvent.click(campana());
    await act(async () => {});
    expect(contador()).toBe("1");
  });

  it("más de nueve dice 9+", () => {
    const muchos = Array.from({ length: 12 }, (_, i) =>
      aviso(`m${i}`, { sentAt: `2026-10-15T${String(10 + (i % 10)).padStart(2, "0")}:0${i % 6}:00Z` }),
    );
    render(<PortalAvisosBell avisos={muchos} soporteDot={false} marcarVistos={vi.fn(async () => ({ ok: true }))} />);
    expect(contador()).toBe("9+");
    expect(campana()).toHaveAccessibleName("Avisos · 12 sin leer");
  });

  it("Escape cierra y devuelve el foco a la campana; tocar un aviso cierra la bandeja", async () => {
    render(<PortalAvisosBell avisos={TRES} soporteDot={false} marcarVistos={vi.fn(async () => ({ ok: true }))} />);

    await userEvent.click(campana());
    const primero = within(bandeja()).getAllByRole("link")[0];
    primero.focus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Avisos" })).toBeNull();
    expect(campana()).toHaveFocus();

    await userEvent.click(campana());
    await userEvent.click(within(bandeja()).getAllByRole("link")[1]);
    expect(screen.queryByRole("region", { name: "Avisos" })).toBeNull();
  });

  it("la × de la hoja cierra y devuelve el foco", async () => {
    render(<PortalAvisosBell avisos={TRES} soporteDot={false} marcarVistos={vi.fn(async () => ({ ok: true }))} />);
    await userEvent.click(campana());
    await userEvent.click(within(bandeja()).getByRole("button", { name: "Cerrar avisos" }));
    expect(screen.queryByRole("region", { name: "Avisos" })).toBeNull();
    expect(campana()).toHaveFocus();
  });

  it("el copy va en tuteo, sin voseo", async () => {
    render(<PortalAvisosBell avisos={[]} soporteDot marcarVistos={vi.fn(async () => ({ ok: true }))} />);
    await userEvent.click(campana());
    // Límites por letra Unicode: \b no corta después de una tilde.
    const voseo = /(?<!\p{L})(vos|tenés|podés|querés|mirá|verás acá)(?!\p{L})/iu;
    expect("Si tenés dudas, mirá acá").toMatch(voseo); // control: la regla detecta
    expect(bandeja().textContent ?? "").not.toMatch(voseo);
  });
});
