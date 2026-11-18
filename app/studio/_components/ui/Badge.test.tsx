import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";

type BadgeHasDot = "dot" extends keyof ComponentProps<typeof Badge> ? true : false;

describe("Badge · API sin dot", () => {
  it("retira dot del contrato público", () => {
    const badgeHasDot: BadgeHasDot = false;
    expect(badgeHasDot).toBe(false);
  });

  it("conserva un único icono semántico incondicional", () => {
    const markup = renderToStaticMarkup(<Badge tone="success">Activo</Badge>);

    expect(markup.match(/<svg/g)).toHaveLength(1);
    expect(markup).toContain('d="m7 12 3 3 7-7"');
  });

  it("es texto con icono, sin cajón: no debe parecer un botón", () => {
    const markup = renderToStaticMarkup(<Badge tone="danger" size="md">Alerta</Badge>);
    expect(markup).not.toMatch(/background|padding|border-radius/);
  });
});
