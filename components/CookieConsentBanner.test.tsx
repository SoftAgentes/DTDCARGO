/**
 * Tests del banner de consentimiento de cookies.
 *
 * Lo que se protege acá es lo único que el usuario percibe: que al tocar un
 * botón el banner SE VAYA y la decisión quede guardada — en las DOS formas de
 * abrirlo, que son caminos de estado distintos:
 *
 *  1. **Automático** en `/entrar` y `/registro` (no hay cookie todavía).
 *  2. **Manual** desde "Preferencias de cookies" del footer, en cualquier ruta.
 *
 * El camino automático es el que se rompió en producción: el banner se cerraba
 * apagando un estado que en ese camino YA estaba apagado, así que React salía
 * por el atajo de "mismo valor" y no re-renderizaba. El usuario tocaba
 * "Aceptar" y el banner se quedaba clavado tapando el formulario de acceso.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CookieConsentBanner } from "./CookieConsentBanner";
import {
  COOKIE_CONSENT_NAME,
  OPEN_COOKIE_PREFS_EVENT,
  readCookieConsent,
} from "@/lib/cookie-consent";

const pathname = vi.hoisted(() => ({ current: "/registro" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

function borrarCookie() {
  document.cookie = `${COOKIE_CONSENT_NAME}=; path=/; max-age=0`;
}

beforeEach(() => {
  pathname.current = "/registro";
  borrarCookie();
  // gtag no existe en jsdom: el banner debe tolerarlo sin reventar.
  delete (window as unknown as Record<string, unknown>).gtag;
});

afterEach(() => {
  cleanup();
  borrarCookie();
});

describe("banner de cookies — apertura automática (login / registro)", () => {
  it.each(["/registro", "/entrar"])(
    "aparece en %s cuando no hay decisión guardada",
    async (ruta) => {
      pathname.current = ruta;
      render(<CookieConsentBanner />);
      expect(
        await screen.findByRole("region", { name: /cookies/i }),
      ).toBeInTheDocument();
    },
  );

  it("no aparece en una ruta cualquiera", () => {
    pathname.current = "/tarifas";
    render(<CookieConsentBanner />);
    expect(screen.queryByRole("region", { name: /cookies/i })).toBeNull();
  });

  it("no aparece si el usuario ya decidió", () => {
    document.cookie = `${COOKIE_CONSENT_NAME}=granted; path=/`;
    render(<CookieConsentBanner />);
    expect(screen.queryByRole("region", { name: /cookies/i })).toBeNull();
  });

  // Sin `waitFor` A PROPÓSITO: el aviso tiene que irse en el MISMO commit del
  // click. Con `waitFor` el test pasaría igual si tardara medio segundo, que es
  // justo la queja del usuario ("le doy y no avanza"). Acá no hay margen.
  it.each([
    ["aceptar", /aceptar/i, "granted"],
    ["rechazar las opcionales", /rechazar/i, "denied"],
  ] as const)("SE CIERRA al instante al %s y guarda la decisión", async (
    _caso,
    boton,
    guardado,
  ) => {
    const user = userEvent.setup();
    render(<CookieConsentBanner />);
    await user.click(await screen.findByRole("button", { name: boton }));

    expect(screen.queryByRole("region", { name: /cookies/i })).toBeNull();
    expect(readCookieConsent()).toBe(guardado);
  });

  // LNK-01 (aprobada 2026-08-20): el aviso vive sobre el formulario de acceso y
  // registro. Leer la política es una CONSULTA — si se lleva la pestaña, se
  // lleva el formulario a medio llenar. Y si abre aparte, hay que avisarlo.
  it("el enlace a la política abre aparte, con noopener y avisado (LNK-01)", async () => {
    render(<CookieConsentBanner />);
    const enlace = await screen.findByRole("link", {
      name: /pol[ií]tica de cookies \(abre en una pesta[ñn]a nueva\)/i,
    });
    expect(enlace).toHaveAttribute("href", "/cookies");
    expect(enlace).toHaveAttribute("target", "_blank");
    expect(enlace.getAttribute("rel")).toContain("noopener");
  });

  it("actualiza el consentimiento de Google con las 4 señales de v2", async () => {
    const gtag = vi.fn();
    (window as unknown as Record<string, unknown>).gtag = gtag;
    const user = userEvent.setup();
    render(<CookieConsentBanner />);
    await user.click(await screen.findByRole("button", { name: /aceptar/i }));

    expect(gtag).toHaveBeenCalledWith("consent", "update", {
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "granted",
    });
  });
});

describe("banner de cookies — apertura manual (footer)", () => {
  it("se abre con el evento global en cualquier ruta y se cierra al decidir", async () => {
    pathname.current = "/tarifas";
    document.cookie = `${COOKIE_CONSENT_NAME}=granted; path=/`;
    const user = userEvent.setup();
    render(<CookieConsentBanner />);
    expect(screen.queryByRole("region", { name: /cookies/i })).toBeNull();

    window.dispatchEvent(new Event(OPEN_COOKIE_PREFS_EVENT));
    await screen.findByRole("region", { name: /cookies/i });

    await user.click(screen.getByRole("button", { name: /rechazar/i }));
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: /cookies/i })).toBeNull(),
    );
    expect(readCookieConsent()).toBe("denied");
  });

  it("puede reabrirse después de haber decidido (cambiar de opinión)", async () => {
    pathname.current = "/tarifas";
    const user = userEvent.setup();
    render(<CookieConsentBanner />);

    window.dispatchEvent(new Event(OPEN_COOKIE_PREFS_EVENT));
    await user.click(await screen.findByRole("button", { name: /aceptar/i }));
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: /cookies/i })).toBeNull(),
    );

    window.dispatchEvent(new Event(OPEN_COOKIE_PREFS_EVENT));
    await user.click(await screen.findByRole("button", { name: /rechazar/i }));
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: /cookies/i })).toBeNull(),
    );
    expect(readCookieConsent()).toBe("denied");
  });
});
