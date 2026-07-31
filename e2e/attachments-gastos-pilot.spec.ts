import { expect, test } from "@playwright/test";

test.describe("SDD-0224 · piloto Gastos", () => {
  test("el gate apagado no expone la reserva", async ({ request }) => {
    const response = await request.post("/api/studio/attachments/reserve", {
      data: {
        entityType: "expense",
        entityId: "11111111-1111-4111-8111-111111111111",
        folder: "receipt",
        originalName: "comprobante.pdf",
        declaredMime: "application/pdf",
        declaredSize: 10,
        idempotencyKey: "22222222-2222-4222-8222-222222222222",
      },
    });
    expect(response.status()).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "Piloto inactivo." });
  });

  test("todos los handlers quedan detrás del mismo gate", async ({ request }) => {
    const id = "11111111-1111-4111-8111-111111111111";
    const responses = await Promise.all([
      request.post(`/api/studio/attachments/${id}/reauthorize`),
      request.post(`/api/studio/attachments/${id}/finalize`),
      request.get(`/api/studio/attachments/${id}/download`),
      request.post(`/api/studio/attachments/${id}/restore`, { data: { reason: "Prueba E2E" } }),
    ]);
    expect(responses.map((response) => response.status())).toEqual([404, 404, 404, 404]);
  });
});
