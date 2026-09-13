import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Receivable } from "@/lib/studio/payment-queries";
import { contextoDeEnvio } from "../recordatorios-queries";

function cola(): Receivable[] {
  return [
    {
      invoice: {
        id: "10000000-0000-0000-0000-000000000001",
        invoice_code: "F-2026-0001",
        client_markbox: "DTD-0001",
      },
    },
    {
      invoice: {
        id: "10000000-0000-0000-0000-000000000002",
        invoice_code: "F-2026-0002",
        client_markbox: "DTD-0002",
      },
    },
  ] as unknown as Receivable[];
}

describe("contextoDeEnvio", () => {
  it("consume sólo la RPC minimizada y reconstruye los tres conjuntos", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          invoice_id: "10000000-0000-0000-0000-000000000001",
          client_markbox: "DTD-0001",
          has_email: true,
          complained: true,
          last_reminder_on: "2026-08-30",
        },
        {
          invoice_id: "10000000-0000-0000-0000-000000000002",
          client_markbox: "DTD-0002",
          has_email: false,
          complained: false,
          last_reminder_on: null,
        },
      ],
      error: null,
    });
    const client = { rpc } as unknown as SupabaseClient;

    const result = await contextoDeEnvio(client, cola());

    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("collections_mail_context", {
      p_invoice_ids: [
        "10000000-0000-0000-0000-000000000001",
        "10000000-0000-0000-0000-000000000002",
      ],
    });
    expect([...result.conCorreo]).toEqual(["DTD-0001"]);
    expect([...result.marcaronSpam]).toEqual(["DTD-0001"]);
    expect([...result.ultimoRecordatorio]).toEqual([["F-2026-0001", "2026-08-30"]]);
  });

  it("no consulta la base cuando la cola está vacía", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as SupabaseClient;

    const result = await contextoDeEnvio(client, []);

    expect(rpc).not.toHaveBeenCalled();
    expect(result.conCorreo.size).toBe(0);
    expect(result.marcaronSpam.size).toBe(0);
    expect(result.ultimoRecordatorio.size).toBe(0);
  });

  it("falla cerrado si la RPC no puede calcular el contexto", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "denied" } }),
    } as unknown as SupabaseClient;

    await expect(contextoDeEnvio(client, cola())).rejects.toThrow("denied");
  });
});
