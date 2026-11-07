/**
 * Estado de los canales de Discord en Ajustes (SDD-0606).
 *
 * La pantalla existe para que una categoría sin canal no pase inadvertida.
 * Se mide lo que una persona lee, no la estructura del componente.
 */
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DiscordChannelsStatus } from "../_components/DiscordChannelsStatus";
import { TELEGRAM_ALERT_CATEGORIES } from "@/lib/studio/telegram/alert-routing";
import { discordCategoryStatus } from "@/lib/studio/discord/channels";

import { fakeWebhook as hook } from "@/lib/studio/discord/__tests__/webhook-fixture";

const TENANT = "00000000-0000-4000-8000-000000000001";

/** Pinta el estado de TENANT; Discord asignado a TENANT salvo que el caso lo cambie. */
function pintar(env: Record<string, string>, tenantId: string = TENANT) {
  return render(
    <DiscordChannelsStatus
      statuses={discordCategoryStatus(TELEGRAM_ALERT_CATEGORIES, tenantId, {
        DISCORD_TENANT_ID: TENANT,
        ...env,
      })}
      canalRespaldo="#avisos-equipo"
    />,
  );
}

describe("DiscordChannelsStatus", () => {
  it("lista las cinco categorías con su canal cuando todas tienen dirección", () => {
    pintar({
      DISCORD_WEBHOOK_REGISTRO: hook(1),
      DISCORD_WEBHOOK_CONVERSACIONES: hook(2),
      DISCORD_WEBHOOK_BUGS: hook(3),
      DISCORD_WEBHOOK_REPORTES: hook(4),
      DISCORD_WEBHOOK_EQUIPO: hook(5),
    });

    const filas = screen.getAllByRole("listitem");
    expect(filas).toHaveLength(5);
    expect(within(filas[0]).getByText("Registro de clientes")).toBeTruthy();
    expect(within(filas[0]).getByText("Sale a #registro-clientes")).toBeTruthy();
    expect(screen.queryByText(/Sin canal propio todavía/)).toBeNull();
    expect(screen.queryByText(/todavía no está configurado/)).toBeNull();
  });

  it("dice en voz alta qué categorías caen al canal de respaldo", () => {
    pintar({ DISCORD_WEBHOOK_BUGS: hook(3), DISCORD_WEBHOOK_EQUIPO: hook(5) });

    const aviso = screen.getByRole("status");
    expect(aviso.textContent).toContain("Sin canal propio todavía:");
    expect(aviso.textContent).toContain("Registro de clientes");
    expect(aviso.textContent).toContain("Conversaciones del portal");
    expect(aviso.textContent).toContain("Reporte diario de operaciones");
    expect(aviso.textContent).not.toContain("Bugs reportados");
    expect(screen.getAllByText("Sin canal propio · cae a #avisos-equipo")).toHaveLength(3);
    expect(screen.getByText("Sale a #bugs")).toBeTruthy();
  });

  it("nombra la variable cuya dirección no tiene forma de webhook, sin mostrar el valor", () => {
    const { container } = pintar({
      DISCORD_WEBHOOK_REGISTRO: "https://evil.example/prueba-secreta-9",
      DISCORD_WEBHOOK_EQUIPO: hook(5),
    });

    expect(screen.getByRole("status").textContent).toContain("DISCORD_WEBHOOK_REGISTRO");
    expect(container.textContent).not.toContain("prueba");
    expect(container.textContent).not.toContain("evil.example");
    expect(container.textContent).not.toContain("discord.com");
  });

  it("sin ninguna dirección avisa que no hay mensajería: sólo correo y campana", () => {
    pintar({});
    expect(screen.getByText(/Discord todavía no está configurado/)).toBeTruthy();
    expect(screen.getAllByText("Sin Discord · sin mensajería")).toHaveLength(5);
    expect(document.body.textContent?.replace(/\s+/g, " ")).toContain("sólo llegan por correo y a la campana");
    expect(document.body.textContent).not.toContain("Telegram");
  });

  it("A5: a otra empresa le dice que Discord no es suyo y que no hay mensajería", () => {
    pintar({ DISCORD_WEBHOOK_EQUIPO: hook(5) }, "00000000-0000-4000-8000-000000000002");
    expect(screen.getAllByText("Discord no está asignado a esta empresa · sin mensajería")).toHaveLength(5);
    expect(screen.getByText(/DISCORD_TENANT_ID/)).toBeTruthy();
  });

  it("en el entorno de prueba lo muestra apagado", () => {
    pintar({ APP_ENV: "staging", DISCORD_WEBHOOK_EQUIPO: hook(5) });
    expect(screen.getAllByText("Apagado en el entorno de prueba")).toHaveLength(5);
    expect(screen.queryByText(/todavía no está configurado/)).toBeNull();
  });
});
