import { test, expect } from "@playwright/test";
import { requiereSupabase } from "./_helpers/supabase";

/**
 * SDD-0585 · paso 2.6 · QA de navegadores de la Ficha DTD (`/studio/ficha-chat`),
 * la Dashboard App que Chatwoot enmarca al lado de cada conversación.
 *
 * Sin sesión de Studio, que es lo que tiene el e2e local:
 *  - el proxy NO la manda al login (E2-D29): el login no se deja enmarcar y el
 *    marco quedaría en blanco;
 *  - pinta «Inicia sesión en Studio», con un enlace que abre otra pestaña;
 *  - solo el chat la puede enmarcar (E2-D28): `frame-ancestors` con el origen
 *    del chat y sin `X-Frame-Options`. Desde otro origen el navegador la bloquea.
 *
 * Corre en chromium, mobile-chrome y mobile-safari (WebKit). Firefox no está
 * instalado en este equipo: NO DISPONIBLE.
 */

test.describe("SDD-0585 · Ficha DTD en el navegador", () => {
  test("sin sesión: no redirige, avisa y ofrece abrir Studio en otra pestaña", async ({ page }) => {
    requiereSupabase();
    const respuesta = await page.goto("/studio/ficha-chat");
    expect(respuesta?.status()).toBe(200);
    await expect(page).toHaveURL(/\/studio\/ficha-chat$/);
    await expect(page.getByRole("heading", { name: "Inicia sesión en Studio" })).toBeVisible();
    const abrir = page.getByRole("link", { name: "Abrir Studio" });
    await expect(abrir).toHaveAttribute("target", "_blank");
    await expect(abrir).toHaveAttribute("href", "/studio/login");
  });

  test("cabeceras: solo el chat la enmarca, sin X-Frame-Options", async ({ request }) => {
    requiereSupabase();
    const r = await request.get("/studio/ficha-chat", { maxRedirects: 0 });
    expect(r.status()).toBe(200);
    const csp = r.headers()["content-security-policy"] ?? "";
    expect(csp).toMatch(/frame-ancestors https?:\/\/[^\s;']+/);
    expect(csp).not.toContain("frame-ancestors 'none'");
    expect(r.headers()["x-frame-options"]).toBeUndefined();
  });

  test("enmarcada desde otro origen: el navegador no la muestra", async ({ page, baseURL }) => {
    requiereSupabase();
    // Una página que no es el chat intenta enmarcarla.
    await page.setContent(`<iframe id="ajeno" src="${baseURL}/studio/ficha-chat" style="width:600px;height:400px"></iframe>`);
    await page.waitForTimeout(3000);
    const marco = page.frameLocator("#ajeno");
    await expect(marco.getByRole("heading", { name: "Inicia sesión en Studio" })).toHaveCount(0);
  });
});
