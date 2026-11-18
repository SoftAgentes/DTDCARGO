/**
 * SDD-0603 · menores del Studio: «Atención requerida» del Dashboard (BD-037).
 *
 * Cada pendiente es una franja plana con icono: sin contorno, texto en tinta y
 * el tono en el fondo suave y en la forma del icono. No es una región viva: es
 * una lista fija del tablero, y con `role="alert"` interrumpiría al lector
 * cada vez que se abre. Lo que se pulsa es «Abrir», un secundario con contorno.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AlertsWidget, type AlertItem } from "../DashboardWidgets";

afterEach(cleanup);

const ALERTAS: AlertItem[] = [
  { tone: "danger", title: "3 factura(s) vencida(s)", meta: "Gestionar cobranza", href: "/studio/cobranzas" },
  { tone: "warning", title: "2 embarques con alerta", meta: "Revisar en tracking", href: "/studio/tracking" },
  { tone: "info", title: "1 recepción sin asignar", meta: "Almacén CN" },
];

describe("AlertsWidget · Atención requerida (SDD-0603)", () => {
  it("cada pendiente es una franja plana: fondo de su tono, sin contorno y texto en tinta", () => {
    render(<AlertsWidget alerts={ALERTAS} />);
    const franjas = screen.getAllByRole("listitem");
    expect(franjas).toHaveLength(3);
    const fondos = ["var(--danger-bg)", "var(--warning-bg)", "var(--info-bg)"];
    franjas.forEach((franja, i) => {
      expect(franja.style.background).toBe(fondos[i]);
      expect(franja.getAttribute("style")).not.toMatch(/border-(?:left|right|top|bottom)|border:|box-shadow|outline/);
      expect(within(franja).getByText(ALERTAS[i].title).style.color).toBe("var(--ink)");
    });
  });

  it("el estado se distingue por la forma del icono, no solo por el color", () => {
    const { container } = render(<AlertsWidget alerts={ALERTAS} />);
    const iconos = Array.from(container.querySelectorAll("li > svg"));
    expect(iconos).toHaveLength(3);
    for (const icono of iconos) expect(icono).toHaveAttribute("aria-hidden", "true");
    expect(new Set(iconos.map((i) => i.innerHTML)).size).toBe(3);
    // Atención: el icono va en tinta; el dorado no llega a 3:1 sobre su franja en claro.
    expect((iconos[1] as SVGElement).style.color).toBe("var(--ink)");
    expect((iconos[0] as SVGElement).style.color).toBe("var(--danger-text)");
  });

  it("no abre ninguna región viva: ni alert ni status", () => {
    const { container } = render(<AlertsWidget alerts={ALERTAS} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  it("lo que se pulsa es «Abrir», secundario con contorno y nombre propio; la franja no es un enlace", () => {
    render(<AlertsWidget alerts={ALERTAS} />);
    const enlaces = screen.getAllByRole("link");
    expect(enlaces).toHaveLength(2);
    const abrir = screen.getByRole("link", { name: "Abrir: 3 factura(s) vencida(s)" });
    expect(abrir).toHaveAttribute("href", "/studio/cobranzas");
    expect(abrir).toHaveClass("studio-btn", "studio-btn-ghost", "studio-btn-xs");
    expect(abrir.style.background).toBe("");
    expect(abrir.style.color).toBe("");
    // El pendiente sin destino no ofrece nada que pulsar.
    const sinDestino = screen.getAllByRole("listitem")[2];
    expect(within(sinDestino).queryByRole("link")).toBeNull();
    expect(screen.getAllByRole("listitem")[0].closest("a")).toBeNull();
  });

  it("sin pendientes dice que todo está en orden, sin lista", () => {
    render(<AlertsWidget alerts={[]} />);
    expect(screen.getByText("Todo en orden. Sin pendientes críticos.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
