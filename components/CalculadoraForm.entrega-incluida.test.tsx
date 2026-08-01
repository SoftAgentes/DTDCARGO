/**
 * Tests del bloque "Entrega incluida" de la calculadora (SDD-0237).
 *
 * Lo que se protege: que la lista salga DEL CATÁLOGO y no de una constante
 * escrita a mano. Es la promesa más fácil de desincronizar del motor —una
 * ciudad de más acá es entrega gratis que el precio no cumple— y la única forma
 * de que no pase es que la lista no exista como dato aparte.
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import type { Ciudad } from "@/lib/calculadora";
import { CalculadoraForm } from "./CalculadoraForm";

const CIUDADES: Ciudad[] = [
  { id: "valencia", label: "Valencia (sede)", km: 0, casco: true, ventaCbm: 105.94, cubierta: true, estado: "Carabobo" },
  { id: "caracas", label: "Caracas", km: 150, casco: true, ventaCbm: 105.94, cubierta: true, estado: "Caracas" },
  { id: "maracaibo", label: "Maracaibo", km: 410, casco: false, ventaCbm: 123.6, cubierta: true, estado: "Zulia" },
  { id: "cariaco", label: "Cariaco", km: 0, casco: false, ventaCbm: null, cubierta: false, cercana: "maracaibo", estado: "Sucre" },
];

const bloque = () =>
  screen.queryByRole("region", { name: /entrega incluida/i });

afterEach(() => cleanup());

describe("Entrega incluida", () => {
  it("lista SOLO las ciudades en zona sin costo", () => {
    render(<CalculadoraForm ciudades={CIUDADES} />);

    const items = within(bloque()!).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      "Valencia (sede)",
      "Caracas",
    ]);
  });

  it("no anuncia como gratis una ciudad que sí se cobra", () => {
    render(<CalculadoraForm ciudades={CIUDADES} />);
    const lista = within(bloque()!).getByRole("list");

    // Maracaibo cobra $123,60/m³ y Cariaco ni siquiera tiene cobertura. Que
    // cualquiera de las dos aparezca acá es una promesa que el motor no cumple.
    expect(within(lista).queryByText(/Maracaibo/)).toBeNull();
    expect(within(lista).queryByText(/Cariaco/)).toBeNull();
  });

  it("sigue al catálogo cuando cambia la zona sin costo", () => {
    // El founder marca Maracaibo como zona sin costo desde el Admin. Sin
    // deploy, el bloque tiene que reflejarlo: por eso la lista se deriva.
    const conMaracaibo = CIUDADES.map((c) =>
      c.id === "maracaibo" ? { ...c, casco: true } : c,
    );
    render(<CalculadoraForm ciudades={conMaracaibo} />);

    const items = within(bloque()!).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toContain("Maracaibo");
    expect(items).toHaveLength(3);
  });

  it("dice que el resto se cobra por m³, no por distancia", () => {
    render(<CalculadoraForm ciudades={CIUDADES} />);
    expect(bloque()).toHaveTextContent(/por metro cúbico/i);
    expect(bloque()).toHaveTextContent(/no según la distancia/i);
  });

  it("no habla de 'casco central' en ninguna parte", () => {
    render(<CalculadoraForm ciudades={CIUDADES} />);
    expect(document.body.textContent).not.toMatch(/casco central/i);
  });

  it("no se monta en el consolidado (ahí no hay ciudad que entregar)", () => {
    render(<CalculadoraForm ciudades={CIUDADES} modo="consolidado" />);
    expect(bloque()).toBeNull();
  });

  it("no se monta si el catálogo no trae ninguna en cero", () => {
    const sinCasco = CIUDADES.map((c) => ({ ...c, casco: false }));
    render(<CalculadoraForm ciudades={sinCasco} />);
    // Mejor no mostrar nada que mostrar un encabezado con la lista vacía.
    expect(bloque()).toBeNull();
  });
});
