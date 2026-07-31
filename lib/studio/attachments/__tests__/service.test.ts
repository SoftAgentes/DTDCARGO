import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/admin", () => ({ createAdminClient: vi.fn() }));

describe("servicio de reservas", () => {
  it("mapea una reserva canónica e idempotente", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{
      intent_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      document_id: "33333333-3333-4333-8333-333333333333",
      bucket_id: "erp-attachments",
      object_key: "11111111-1111-4111-8111-111111111111/expense/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.pdf",
      expires_at: "2026-07-31T12:00:00Z",
    }], error: null });
    const { reserveAttachment } = await import("../service");
    const result = await reserveAttachment({ rpc } as never, {
      entityType: "expense", entityId: "22222222-2222-4222-8222-222222222222",
      folder: "receipt", originalName: "factura.pdf", declaredMime: "application/pdf",
      declaredSize: 20, idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(result.bucketId).toBe("erp-attachments");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

