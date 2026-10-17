import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

const name = "Fotos de nuestro equipo y operación";
const mainVideoBase = "/videos/equipo-cargando-contenedor-dtd-cargo-puerta-a-puerta-china-venezuela";
const shippingMarkBase = "/videos/shipping-mark-dtd-pallets-dtd-cargo-puerta-a-puerta-china-venezuela";
const retiredVideoBase = "/videos/cinta-embalaje-doortudoor-dtd-cargo-puerta-a-puerta-china-venezuela";

test("manual controls, full traversal, focus, keyboard, stable frame and retained videos", async ({ page }) => {
  await page.goto("/");
  const gallery = page.getByRole("region", { name });
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery.getByText("1 de 8")).toBeVisible();
  const frame = gallery.getByTestId("company-photo-frame");
  const initial = await frame.boundingBox();
  const previous = gallery.getByRole("button", { name: "Foto anterior" });
  await previous.focus();
  await previous.press("Enter");
  await expect(gallery.getByText("8 de 8")).toBeVisible();
  await expect(previous).toBeFocused();
  await previous.press("Home");
  await expect(gallery.getByText("1 de 8")).toBeVisible();
  for (let index = 2; index <= 8; index++) {
    await gallery.getByRole("button", { name: "Foto siguiente" }).click();
    await expect(gallery.getByText(index + " de 8")).toBeVisible();
    const current = await frame.boundingBox();
    expect(current?.height).toBe(initial?.height);
  }
  await gallery.getByRole("button", { name: "Foto siguiente" }).press("ArrowRight");
  await expect(gallery.getByText("1 de 8")).toBeVisible();
  await gallery.getByRole("button", { name: /Ver foto 5:/ }).click();
  await expect(gallery.getByText("Manejo de carga en el puerto")).toBeVisible();
  await expect(gallery.getByRole("button", { name: /Ver foto 5:/ })).toHaveAttribute("aria-pressed", "true");
  await expect(frame.locator("img")).toHaveCSS("object-fit", "contain");
  for (const button of await gallery.getByRole("button").all()) {
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await gallery.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  for (const videoFrame of await page.locator("#operacion .work-band-frame").all()) await videoFrame.scrollIntoViewIfNeeded();
  const operation = page.locator("#operacion");
  await expect(operation.locator("video")).toHaveCount(2);
  for (const base of [mainVideoBase, shippingMarkBase]) {
    await expect(operation.locator('video source[src="' + base + '.mp4"]')).toHaveCount(1);
    await expect(operation.locator('video source[src="' + base + '.webm"]')).toHaveCount(1);
    await expect(operation.locator('video[poster="' + base + '-poster.webp"]')).toHaveCount(1);
  }
  await expect(page.locator('[src*="' + retiredVideoBase + '"], [poster*="' + retiredVideoBase + '"], [style*="' + retiredVideoBase + '"]')).toHaveCount(0);
  await expect(operation.getByText("Cinta de DTD Cargo en cada bulto", { exact: true })).toHaveCount(0);
  await expect(operation.getByText("Tu Shipping Mark en cada pallet", { exact: true })).toBeVisible();
  const schema = await operation.locator('script[type="application/ld+json"]').textContent();
  const videoObject = JSON.parse(schema!);
  expect(videoObject.name).toContain("Yiwu");
  expect(videoObject).toMatchObject({
    "@type": "VideoObject",
    contentUrl: "https://dtdcargo.com" + mainVideoBase + ".mp4",
    thumbnailUrl: ["https://dtdcargo.com" + mainVideoBase + "-poster.jpg"],
  });
  await page.waitForTimeout(1500);
  await expect(gallery.getByText("5 de 8")).toBeVisible();
});

test("horizontal swipe keeps vertical gestures and reduced motion usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const gallery = page.getByRole("region", { name });
  const frame = gallery.getByTestId("company-photo-frame");
  await gallery.scrollIntoViewIfNeeded();
  await frame.evaluate((el) => el.dispatchEvent(Object.assign(new Event("touchstart", { bubbles: true }), { touches: [{ clientX: 250, clientY: 100 }] })));
  await frame.evaluate((el) => el.dispatchEvent(Object.assign(new Event("touchend", { bubbles: true }), { changedTouches: [{ clientX: 80, clientY: 110 }] })));
  await expect(gallery.getByText("2 de 8")).toBeVisible();
  await frame.evaluate((el) => el.dispatchEvent(Object.assign(new Event("touchstart", { bubbles: true }), { touches: [{ clientX: 250, clientY: 100 }] })));
  await frame.evaluate((el) => el.dispatchEvent(Object.assign(new Event("touchend", { bubbles: true }), { changedTouches: [{ clientX: 200, clientY: 300 }] })));
  await expect(gallery.getByText("2 de 8")).toBeVisible();
  await gallery.getByRole("button", { name: "Foto siguiente" }).click();
  await expect(gallery.getByText("3 de 8")).toBeVisible();
});

test("initial photo and caption are useful without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(baseURL!);
    const gallery = page.getByRole("region", { name });
    await gallery.scrollIntoViewIfNeeded();
    await expect(gallery.getByText("Atención y planificación")).toBeVisible();
    await expect(gallery.getByText("1 de 8")).toBeVisible();
    expect(await gallery.getByTestId("company-photo-frame").locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  } finally { await context.close(); }
});

test("visual evidence at 390 and 1440 pixels", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Captures use explicit desktop and mobile widths once.");
  mkdirSync("outputs/retirar-video-cinta-0503", { recursive: true });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    const gallery = page.getByRole("region", { name });
    await gallery.scrollIntoViewIfNeeded();
    await expect(gallery.getByTestId("company-photo-frame").locator("img")).toBeVisible();
    for (const videoFrame of await page.locator("#operacion .work-band-frame").all()) await videoFrame.scrollIntoViewIfNeeded();
    await expect(page.locator("#operacion video")).toHaveCount(2);
    const shippingFrame = page.locator('#operacion .work-band-frame').filter({ has: page.locator('video source[src="' + shippingMarkBase + '.mp4"]') });
    const clip = await shippingFrame.boundingBox();
    const clipBlock = await shippingFrame.locator("..").locator("..").boundingBox();
    expect(clip!.width).toBeLessThanOrEqual(300);
    expect(clipBlock!.width).toBeCloseTo(clip!.width, 1);
    await page.screenshot({ path: "outputs/retirar-video-cinta-0503/home-" + width + ".png", fullPage: true });
    await page.locator("#operacion").screenshot({ path: "outputs/retirar-video-cinta-0503/operation-" + width + ".png" });
    await gallery.screenshot({ path: "outputs/retirar-video-cinta-0503/gallery-" + width + ".png" });
    await gallery.getByRole("button", { name: /Ver foto 5:/ }).click();
    await expect(gallery.getByText("5 de 8")).toBeVisible();
    await gallery.getByTestId("company-photo-frame").locator("img").evaluate((img: HTMLImageElement) => img.decode());
    await gallery.screenshot({ path: "outputs/retirar-video-cinta-0503/gallery-portrait-" + width + ".png" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
