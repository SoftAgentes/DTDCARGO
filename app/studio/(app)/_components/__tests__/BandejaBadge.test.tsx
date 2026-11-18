/**
 * SDD-0585 E2-D21 · Badge de la Bandeja: cuenta abiertas con no leídos y se
 * suscribe a chatwoot_conversations del tenant.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ opciones: null as unknown, data: [] as unknown[] }));
vi.mock("@/lib/studio/hooks/use-realtime-table", () => ({
  useRealtimeTable: (opciones: { initial: unknown[] }) => {
    m.opciones = opciones;
    return { data: m.data.length ? m.data : opciones.initial, status: "live" };
  },
}));

import { BandejaBadge } from "../BandejaBadge";

const T = "10000000-0000-4000-8000-000000000001";
const fila = (id: number, unread: number, status = "open") => ({ id: String(id), conversation_id: id, unread_count: unread, status });

afterEach(() => {
  cleanup();
  m.data = [];
});

describe("BandejaBadge (SDD-0585)", () => {
  it("se suscribe a chatwoot_conversations del tenant y cuenta solo abiertas con no leídos", () => {
    render(<BandejaBadge tenantId={T} initial={[fila(1, 2), fila(2, 0), fila(3, 1, "resolved"), fila(4, 5)]} />);
    expect(m.opciones).toMatchObject({ table: "chatwoot_conversations", filter: `tenant_id=eq.${T}` });
    expect(screen.getByLabelText("2 sin leer").textContent).toBe("2");
  });

  it("cuando Realtime trae los cambios, el número se mueve; en 0 no pinta nada", () => {
    m.data = [fila(1, 0), fila(4, 0)];
    const { container } = render(<BandejaBadge tenantId={T} initial={[fila(1, 2)]} />);
    expect(container.textContent).toBe("");
  });

  it("más de 99 → 99+", () => {
    render(<BandejaBadge tenantId={T} initial={Array.from({ length: 120 }, (_, i) => fila(i + 1, 1))} />);
    expect(screen.getByLabelText("120 sin leer").textContent).toBe("99+");
  });
});
