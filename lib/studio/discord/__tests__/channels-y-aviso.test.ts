// @vitest-environment node
/**
 * Canales por categoría y armado del aviso mínimo (SDD-0606).
 */

import { describe, it, expect } from "vitest";
import { TELEGRAM_ALERT_CATEGORIES } from "@/lib/studio/telegram/alert-routing";
import {
  DISCORD_CHANNELS,
  DISCORD_ENV_VARS,
  discordCategoryStatus,
  resolveDiscordFallbackTarget,
  resolveDiscordTarget,
} from "../channels";
import { buildDiscordContent } from "../minimal-alert";

const hook = (n: number) => `https://discord.com/api/webhooks/${n}/token-${n}`;
const USER = "111111111111111111";

describe("canales de Discord", () => {
  it("cada categoría del Studio tiene su canal y su variable, sin repetir", () => {
    expect(Object.keys(DISCORD_CHANNELS).sort()).toEqual(
      [...TELEGRAM_ALERT_CATEGORIES].sort(),
    );
    expect(new Set(DISCORD_ENV_VARS).size).toBe(TELEGRAM_ALERT_CATEGORIES.length);
    const canales = Object.values(DISCORD_CHANNELS).map((c) => c.canal);
    expect(new Set(canales).size).toBe(canales.length);
  });

  it("una categoría con dirección va a su canal propio", () => {
    const env = { DISCORD_WEBHOOK_BUGS: hook(1), DISCORD_WEBHOOK_EQUIPO: hook(2) };
    expect(resolveDiscordTarget("bugs", env)).toEqual({
      url: hook(1),
      canal: "#bugs",
      esRespaldo: false,
    });
  });

  it("una categoría SIN dirección cae al canal de respaldo, no calla", () => {
    const env = { DISCORD_WEBHOOK_EQUIPO: hook(2) };
    expect(resolveDiscordTarget("registro", env)).toEqual({
      url: hook(2),
      canal: "#avisos-equipo",
      esRespaldo: true,
    });
  });

  it("una dirección inválida o vacía cuenta como ausente", () => {
    const env = {
      DISCORD_WEBHOOK_REGISTRO: "https://evil.example/api/webhooks/1/abc",
      DISCORD_WEBHOOK_BUGS: "   ",
      DISCORD_WEBHOOK_EQUIPO: hook(2),
    };
    expect(resolveDiscordTarget("registro", env)?.esRespaldo).toBe(true);
    expect(resolveDiscordTarget("bugs", env)?.esRespaldo).toBe(true);
  });

  it("sin ninguna dirección Discord no está configurado", () => {
    expect(resolveDiscordTarget("registro", {})).toBeNull();
    expect(resolveDiscordFallbackTarget({})).toBeNull();
  });

  it("en el entorno de prueba Discord queda apagado aunque haya direcciones", () => {
    const env = {
      APP_ENV: "staging",
      DISCORD_WEBHOOK_BUGS: hook(1),
      DISCORD_WEBHOOK_EQUIPO: hook(2),
    };
    expect(resolveDiscordTarget("bugs", env)).toBeNull();
    expect(resolveDiscordFallbackTarget(env)).toBeNull();
    expect(
      discordCategoryStatus(TELEGRAM_ALERT_CATEGORIES, env).every(
        (s) => s.state === "apagado",
      ),
    ).toBe(true);
  });

  it("el estado para la pantalla distingue propio, respaldo, sin Discord e inválida", () => {
    const env = {
      DISCORD_WEBHOOK_BUGS: hook(1),
      DISCORD_WEBHOOK_REGISTRO: "no-es-una-url",
      DISCORD_WEBHOOK_EQUIPO: hook(2),
    };
    const byCat = Object.fromEntries(
      discordCategoryStatus(TELEGRAM_ALERT_CATEGORIES, env).map((s) => [s.category, s]),
    );
    expect(byCat.bugs).toMatchObject({ state: "propio", invalida: false, canal: "#bugs" });
    expect(byCat.registro).toMatchObject({ state: "respaldo", invalida: true });
    expect(byCat.reportes).toMatchObject({ state: "respaldo", invalida: false });
    expect(byCat.equipo).toMatchObject({ state: "propio" });

    const sinNada = discordCategoryStatus(TELEGRAM_ALERT_CATEGORIES, {});
    expect(sinNada.every((s) => s.state === "sin-discord")).toBe(true);
  });

  it("el estado nunca incluye la dirección del webhook", () => {
    const env = { DISCORD_WEBHOOK_BUGS: hook(1), DISCORD_WEBHOOK_EQUIPO: hook(2) };
    const json = JSON.stringify(discordCategoryStatus(TELEGRAM_ALERT_CATEGORIES, env));
    expect(json).not.toContain("token-");
    expect(json).not.toContain("discord.com");
  });
});

describe("buildDiscordContent", () => {
  it("arma título, código y enlace sin vista previa", () => {
    expect(
      buildDiscordContent({
        titulo: "Cliente nuevo",
        codigo: "DTD-0123",
        url: "https://dtdcargo.com/studio/clientes/abc",
      }),
    ).toBe("**Cliente nuevo** · `DTD-0123`\n<https://dtdcargo.com/studio/clientes/abc>");
  });

  it("funciona sin código y sin enlace", () => {
    expect(buildDiscordContent({ titulo: "Reporte diario listo" })).toBe(
      "**Reporte diario listo**",
    );
  });

  it("pone las menciones válidas primero y descarta las inválidas", () => {
    const out = buildDiscordContent(
      { titulo: "Mensaje nuevo del portal", codigo: "CONV-7" },
      { mentionUserIds: [USER, "everyone", USER] },
    );
    expect(out.split("\n")[0]).toBe(`<@${USER}>`);
    expect(out).not.toContain("everyone");
  });

  it("marca de qué categoría venía un aviso que cayó al respaldo", () => {
    const out = buildDiscordContent(
      { titulo: "Cliente nuevo", codigo: "DTD-0123" },
      { respaldoDe: "Registro de clientes" },
    );
    expect(out).toContain("Sin canal propio · Registro de clientes");
  });

  it("deja el código en una sola línea y sin romper el formato", () => {
    const out = buildDiscordContent({ titulo: "Aviso", codigo: "A`B\nC" });
    expect(out).toBe("**Aviso** · `A'B C`");
  });

  it("descarta un enlace que no es http(s) o trae espacios", () => {
    expect(buildDiscordContent({ titulo: "Aviso", url: "javascript:alert(1)" })).toBe(
      "**Aviso**",
    );
    expect(buildDiscordContent({ titulo: "Aviso", url: "https://a.b/x y" })).toBe(
      "**Aviso**",
    );
  });
});
