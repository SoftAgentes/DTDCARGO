/**
 * SDD-0603 · tramo 5a: en el Dashboard lo que se oprime lleva las clases de
 * botón, lo que se abre lleva la flecha de fila y lo que solo se lee va sin
 * cajón. Sin colores ni CSS nuevos: todo sale de clases existentes.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  ActiveShipmentsWidget,
  NominaResumenWidget,
  QuickActionsWidget,
  UpcomingEtaWidget,
} from "../DashboardWidgets";
import type { ActiveShipmentPreview } from "@/lib/studio/dashboard/dashboard-widget-queries";
import { STATUS_LABELS } from "@/lib/shared/shipment-public";

const ITEMS = [
  { id: "a", code: "S-2026-0001", clientName: "Cliente de prueba", destination: "Valencia", status: "in_transit" },
] as unknown as ActiveShipmentPreview[];

const clases = (el: Element) => el.className.split(" ");

afterEach(cleanup);

describe("DashboardWidgets · claridad de controles (SDD-0603, tramo 5a)", () => {
  it("las acciones rápidas son secundarios con contorno, sin color propio", () => {
    render(<QuickActionsWidget />);
    for (const nombre of ["Nuevo estimado", "Nuevo cliente", "Recepción CN", "Nuevo envío"]) {
      const enlace = screen.getByRole("link", { name: nombre });
      expect(clases(enlace)).toEqual(expect.arrayContaining(["studio-btn", "studio-btn-ghost"]));
      expect(enlace.style.background).toBe("");
      // El color lo pone la clase; si fuera en línea, al invertirse quedaría tinta sobre tinta.
      for (const hijo of enlace.querySelectorAll<HTMLElement>("span")) expect(hijo.style.color).toBe("");
    }
  });

  it("los enlaces de cabecera son secundarios de 32 px", () => {
    render(
      <>
        <ActiveShipmentsWidget items={ITEMS} />
        <UpcomingEtaWidget items={ITEMS} />
      </>,
    );
    for (const nombre of ["Ver todos →", "Calendario →"]) {
      expect(clases(screen.getByRole("link", { name: nombre }))).toEqual(
        expect.arrayContaining(["studio-btn", "studio-btn-ghost", "studio-btn-xs"]),
      );
    }
  });

  it("las filas que abren un embarque llevan la flecha de fila y el estado va con icono, sin cajón", () => {
    const { container } = render(
      <>
        <ActiveShipmentsWidget items={ITEMS} />
        <UpcomingEtaWidget items={ITEMS} />
      </>,
    );
    const filas = container.querySelectorAll<HTMLElement>('a[href="/studio/tracking/a"]');
    expect(filas).toHaveLength(2);
    for (const fila of filas) {
      expect(clases(fila)).toContain("studio-tracking-row");
      expect(fila.style.background).toBe("");
    }
    const estados = screen.getAllByText(STATUS_LABELS.in_transit);
    expect(estados).toHaveLength(2);
    for (const estado of estados) {
      // Badge: el texto va con su icono al lado y sin fondo.
      // Solo el Badge del estado: el icono de barco de la fila no cuenta.
      const badge = estado.closest("span") as HTMLElement;
      expect(badge.querySelector(":scope > svg")).not.toBeNull();
      expect(badge.style.background).toBe("");
      expect(estado.style.background).toBe("");
    }
  });

  it("los números de nómina solo se leen: van sin cajón", () => {
    const v = { value: "1", tone: "neutral" } as const;
    render(<NominaResumenWidget summary={{ neto: v, prestamos: v, ausencias: v, empleados: v }} />);
    const celda = screen.getByText("Neto del corte").parentElement as HTMLElement;
    expect(celda.style.background).toBe("");
    expect(clases(screen.getByRole("link", { name: "Ir a nómina →" }))).toContain("studio-btn-ghost");
  });
});
