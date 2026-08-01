import { expect, test } from "@playwright/test";

test.describe("SDD-0224 · contrato Network", () => {
  test("el plano de control recibe JSON, nunca bytes del archivo", async ({ page }) => {
    const apiBodies: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/studio/attachments")) {
        apiBodies.push(request.postData() ?? "");
      }
    });
    await page.goto("/studio/login");
    await page.evaluate(async () => {
      await fetch("/api/studio/attachments/reserve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entityType: "expense",
          entityId: "11111111-1111-4111-8111-111111111111",
          folder: "receipt",
          originalName: "comprobante.pdf",
          declaredMime: "application/pdf",
          declaredSize: 25 * 1024 * 1024,
          idempotencyKey: "22222222-2222-4222-8222-222222222222",
        }),
      });
    });
    expect(apiBodies).toHaveLength(1);
    expect(apiBodies[0].length).toBeLessThan(1024);
    expect(apiBodies[0]).not.toContain("JVBERi0");
  });
});

