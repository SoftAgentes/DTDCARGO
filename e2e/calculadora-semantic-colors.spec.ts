import { test, expect } from "@playwright/test";
import { escribir } from "./_helpers/escribir";

for (const theme of ["light", "dark"]) {
  test(`SDD-0441 · recargo y derivación sin error en ${theme}`, async ({ page }) => {
    await page.goto(`/tarifas/embed?theme=${theme}`);
    const panel = page.locator("#panel-ddp");
    const cbm = panel.locator('input[placeholder="12"]');
    const peso = panel.locator('input[placeholder="4800"]');
    await escribir(cbm, "1");
    await escribir(peso, "1500");
    const notice = panel.getByRole("status").filter({ hasText: /el estimado incluye su recargo/i });
    await expect(notice).toBeVisible();
    await expect(peso).toHaveAttribute("aria-describedby", await notice.getAttribute("id") ?? "");
    await expect(peso).not.toHaveAttribute("aria-invalid", "true");
    await expect(peso).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(panel.getByRole("combobox")).toHaveCSS("color", "rgb(255, 255, 255)");
    await escribir(peso, "30000");
    const warning = panel.getByRole("status").filter({ hasText: /consulta a tu asesor/i });
    await expect(warning).toBeVisible();
    const expected = await peso.evaluate(e => getComputedStyle(e).getPropertyValue("--color-status-warning").trim());
    const svgColor = await warning.locator("svg").evaluate(e => getComputedStyle(e).color);
    const tokenColor = await page.evaluate(color => { const el=document.createElement("span"); el.style.color=color; document.body.append(el); const resolved=getComputedStyle(el).color; el.remove(); return resolved; }, expected);
    expect(svgColor).toBe(tokenColor);
    await expect(warning).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(panel.getByRole("link", {name: "Consultar con un asesor"})).toHaveCSS("color", "rgb(15, 30, 61)");
    await expect(peso).not.toHaveAttribute("aria-invalid", "true");
    await escribir(peso, "500");
    await expect(peso).not.toHaveAttribute("aria-describedby");
    await expect(panel.getByRole("status").filter({hasText:/consulta a tu asesor/i})).toHaveCount(0);
  });
}

for (const theme of ["light", "dark"]) {
  test(`SDD-0441 · aviso terrestre accesible en ${theme}`, async ({ page }) => {
    await page.goto("/calculadora-terrestre");
    await page.evaluate(t => document.documentElement.setAttribute("data-portal-theme", t), theme);
    const peso = page.getByRole("textbox", { name: /Peso \(kg\)/ });
    await escribir(peso, "30000");
    const notice = page.getByRole("status").filter({hasText:/peso permitido por contenedor/});
    await expect(notice).toBeVisible();
    await expect(peso).toHaveAttribute("aria-describedby", await notice.getAttribute("id") ?? "");
    await expect(peso).not.toHaveAttribute("aria-invalid", "true");
    const ink = await notice.evaluate(e => getComputedStyle(e).getPropertyValue("--color-ink").trim());
    expect(await notice.evaluate(e => getComputedStyle(e).color)).toBe(await page.evaluate(c => {const e=document.createElement("span");e.style.color=c;document.body.append(e);const v=getComputedStyle(e).color;e.remove();return v;},ink));
    await escribir(peso, "100");
    await expect(peso).not.toHaveAttribute("aria-describedby");
  });
}

// SDD-0360 + SDD-0441: comprobar comportamiento y presentación juntos.
for (const theme of ["light", "dark"]) {
  test(`Selector combinado: teclado, Escape, clic y cursor en ${theme}`, async ({ page }) => {
    await page.goto(`/tarifas/embed?theme=${theme}`);
    const combo = page.locator("#panel-ddp").getByRole("combobox");
    await combo.click();
    await combo.pressSequentially("mara", { delay: 10 });
    await expect(combo).toHaveValue("mara");
    await combo.press("ArrowDown");
    await expect(combo).toHaveAttribute("aria-activedescendant", /.+/);
    await combo.press("Enter");
    await expect(combo).toHaveAttribute("aria-expanded", "false");
    const selected = await combo.inputValue();
    expect(selected).not.toBe("mara");
    await combo.fill("caracas");
    await combo.press("Escape");
    await expect(combo).toHaveValue(selected);
    await combo.fill("maracay");
    await page.getByRole("option").filter({ hasText: "Maracay" }).first().click();
    await expect(combo).toHaveValue(/Maracay/);
    await combo.fill("maracaibo");
    await combo.press("Home");
    await combo.press("ArrowRight");
    await combo.pressSequentially("X");
    await expect(combo).toHaveValue("mXaracaibo");
    await expect(combo).toHaveCSS("color", "rgb(255, 255, 255)");
    expect(await combo.evaluate(e => getComputedStyle(e).boxShadow)).not.toBe("none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
