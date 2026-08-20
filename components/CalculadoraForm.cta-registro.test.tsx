/**
 * SDD-0276 · el CTA de cuenta de la calculadora, y el embed que NO debe traerlo.
 *
 * Contexto medido el 2026-08-20: `/tarifas` monta la calculadora con
 * `directWhatsApp`, y el CTA de registro que ya existía estaba condicionado a
 * `savedEstimateCode` — que en ese modo nunca hay. Resultado: la calculadora
 * pública no ofrecía crear cuenta en ningún momento, justo en el instante de más
 * intención del sitio.
 *
 * 🔴 Lo que este archivo protege de verdad es el LADO APAGADO. El mismo
 * componente lo montan `/tarifas` y `/tarifas/embed`, y el embed se incrusta en
 * sitios de terceros —incluidos aliados white-label—, donde un "crear mi cuenta
 * con DTD Cargo" rompería el acuerdo. Por eso la bandera nace en `false`: si
 * alguien la invierte por comodidad, este test se pone rojo.
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { Ciudad } from "@/lib/calculadora";
import { CalculadoraForm } from "./CalculadoraForm";

const CIUDADES: Ciudad[] = [
  { id: "valencia", label: "Valencia (sede)", km: 0, casco: true, ventaCbm: 105.94, cubierta: true, estado: "Carabobo" },
  { id: "maracaibo", label: "Maracaibo", km: 410, casco: false, ventaCbm: 123.6, cubierta: true, estado: "Zulia" },
];

const cta = () => screen.queryByRole("link", { name: /crear mi cuenta/i });

afterEach(() => cleanup());

describe("calculadora · CTA de cuenta", () => {
  it("NO aparece por defecto — ése es el camino del embed", () => {
    render(<CalculadoraForm ciudades={CIUDADES} directWhatsApp />);

    expect(cta()).toBeNull();
  });

  it("tampoco aparece en el consolidado del embed", () => {
    render(
      <CalculadoraForm ciudades={CIUDADES} directWhatsApp modo="consolidado" />,
    );

    expect(cta()).toBeNull();
  });

  it("aparece cuando la página lo enciende, y lleva a /registro", () => {
    render(
      <CalculadoraForm ciudades={CIUDADES} directWhatsApp showRegisterCta />,
    );

    expect(cta()?.getAttribute("href")).toBe("/registro");
  });

  it("va DESPUÉS del estimado — la tarifa nunca se gatea", () => {
    render(
      <CalculadoraForm ciudades={CIUDADES} directWhatsApp showRegisterCta />,
    );

    // `docs/marketing/adquisicion.md` desaconseja el patrón "regístrate para ver
    // el precio". La nota al pie del estimado es lo último de la tarjeta de
    // cálculo: si el CTA quedara antes, estaría interrumpiendo el resultado.
    const nota = screen.getByText(/Este estimado es aproximado/i);
    const boton = cta()!;
    expect(
      nota.compareDocumentPosition(boton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
