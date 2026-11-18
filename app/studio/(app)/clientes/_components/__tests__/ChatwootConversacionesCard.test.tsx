/**
 * SDD-0585 E2-D23 · Tarjeta de conversaciones de Chatwoot en la ficha.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ChatwootConversacionesCard } from "../ChatwootConversacionesCard";

afterEach(cleanup);

describe("ChatwootConversacionesCard (SDD-0585)", () => {
  it("lista número, estado, no leídos y enlaza a la Bandeja en esa conversación", () => {
    render(
      <ChatwootConversacionesCard
        conversaciones={[
          { conversation_id: 12, status: "open", unread_count: 2, last_activity_at: "2026-10-29T15:00:00.000Z" },
          { conversation_id: 9, status: "resolved", unread_count: 0, last_activity_at: null },
        ]}
      />,
    );
    expect(screen.getByText("Conversaciones en la Bandeja")).toBeTruthy();
    expect(screen.getByText("Conversación #12")).toBeTruthy();
    expect(screen.getByText("Abierta")).toBeTruthy();
    expect(screen.getByText("2 sin leer")).toBeTruthy();
    expect(screen.getByText("Resuelta")).toBeTruthy();
    expect(screen.getAllByText(/Última actividad/)).toHaveLength(1);
    const enlaces = screen.getAllByRole("link", { name: "Abrir" }).map((a) => a.getAttribute("href"));
    expect(enlaces).toEqual(["/studio/bandeja?c=12", "/studio/bandeja?c=9"]);
  });

  it("sin conversaciones (o un cruce ambiguo, que no deja client_id): estado vacío, sin adivinar", () => {
    render(<ChatwootConversacionesCard conversaciones={[]} />);
    expect(screen.getByText("Sin conversaciones vinculadas a este cliente.")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
