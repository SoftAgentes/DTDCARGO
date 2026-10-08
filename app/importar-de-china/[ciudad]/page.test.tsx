import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getGeoZona } from "@/lib/geo-zonas";
import ImportarCiudadPage from "./page";

vi.mock("@/components/Nav", () => ({ Nav: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/WhatsAppFAB", () => ({ WhatsAppFAB: () => null }));
vi.mock("@/components/TerminoGlosario", () => ({ ConGlosario: ({ children }: { children: ReactNode }) => <>{children}</> }));

describe("Landing real por ciudad · coherencia de entrega", () => {
  it("Acarigua explica la entrega con tarifa en cuerpo y FAQ visible/JSON-LD", async () => {
    const { container } = render(await ImportarCiudadPage({ params: Promise.resolve({ ciudad: "acarigua" }) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Acarigua");
    expect(getGeoZona("acarigua")?.casco).toBe(false);
    expect(screen.getByText(/En Acarigua, Araure y el resto de Portuguesa/, { selector: "p" })).toHaveTextContent(/se cobra por metro cúbico/);
    const question = screen.getByText("¿El precio incluye la entrega en Acarigua?");
    const answer = question.nextElementSibling!;
    expect(answer).toHaveTextContent(/se cobra por metro cúbico/);
    expect(answer).toHaveTextContent(/se suma al estimado final/);
    const faq = [...container.querySelectorAll('script[type="application/ld+json"]')]
      .map((script) => JSON.parse(script.textContent!))
      .find((data) => data["@type"] === "FAQPage");
    const structuredAnswer = faq.mainEntity.find((item: { name: string }) => item.name === question.textContent).acceptedAnswer.text;
    expect(structuredAnswer).toBe(answer.textContent);
    expect(container).not.toHaveTextContent("En Acarigua la entrega va incluida");
    expect(screen.getByRole("link", { name: /Calcular mi envío/ })).toHaveAttribute("href", "/tarifas");
  });

  it.each(["caracas", "valencia", "maracay", "barquisimeto"])("%s conserva inclusión y respuesta DDP original", async (slug) => {
    render(await ImportarCiudadPage({ params: Promise.resolve({ ciudad: slug }) }));
    const city = getGeoZona(slug)!;
    expect(city.casco).toBe(true);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(city.ciudad);
    expect(screen.getByText(new RegExp(city.notaEntrega.replace(/[.*+?^$()|[\]\\]/g, "\\$&")), { selector: "p" })).toHaveTextContent(/entrega.*incluida|no pagas/i);
    const answer = screen.getByText(`¿El precio incluye la entrega en ${city.ciudad}?`).nextElementSibling!;
    expect(answer).toHaveTextContent(/^Sí\. Con el servicio puerta a puerta/);
  });
});
