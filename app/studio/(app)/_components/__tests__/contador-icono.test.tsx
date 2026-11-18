/** El contador rojo del topbar cuelga de la esquina del botón y no tapa el icono. */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/studio/hooks/use-realtime-table", () => ({
  useRealtimeTable: ({ initial }: { initial: unknown[] }) => ({ data: initial }),
}));

const { ConversationsIndicator } = await import("../ConversationsIndicator");

afterEach(cleanup);

describe("ConversationsIndicator · contador", () => {
  it("usa la clase de esquina (sin top/right en línea que lo pongan sobre el sobre)", () => {
    render(
      <ConversationsIndicator
        tenantId="t"
        initial={[
          { id: "a", unread_count: 2 },
          { id: "b", unread_count: 1 },
          { id: "c", unread_count: 0 },
        ]}
      />,
    );
    const enlace = screen.getByRole("link", { name: "Conversaciones · 2 sin leer" });
    const contador = enlace.querySelector(".studio-contador-icono") as HTMLElement;
    expect(contador.textContent).toBe("2");
    expect(contador.style.top).toBe("");
    expect(contador.style.right).toBe("");
    expect(contador.getAttribute("aria-hidden")).toBe("true");
  });

  it("sin no leídas no pinta contador", () => {
    render(<ConversationsIndicator tenantId="t" initial={[{ id: "a", unread_count: 0 }]} />);
    expect(document.querySelector(".studio-contador-icono")).toBeNull();
  });
});
