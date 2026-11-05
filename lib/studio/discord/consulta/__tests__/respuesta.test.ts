// @vitest-environment node
/**
 * SDD-0608 · Texto de la respuesta: nombres hostiles, largo de Discord y
 * definición del comando que se registra.
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COMANDO_CLIENTE, leerComandoCliente, DTD_DISCORD_GUILD_ID } from "../comando";
import { LARGO_MAXIMO, mensajeDeResultados, textoSeguro } from "../respuesta";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");

describe("textoSeguro", () => {
  it("un enlace disfrazado en el nombre no queda como enlace", () => {
    const t = textoSeguro("[Haz clic](https://phish.test)");
    expect(t).not.toMatch(/(^|[^\\])\[/);
    expect(t).not.toMatch(/(^|[^\\])\(/);
    expect(t).not.toContain("://");
  });

  it("una mención o formato en el nombre queda escapado", () => {
    expect(textoSeguro("@everyone <@123456789012345678> **x** `y`")).toBe(
      "\\@everyone \\<\\@123456789012345678> \\*\\*x\\*\\* \\`y\\`",
    );
  });

  it("los saltos de línea no parten la respuesta y el nombre largo se corta", () => {
    expect(textoSeguro("Ana\nMaría")).toBe("Ana María");
    expect(textoSeguro("x".repeat(80))).toHaveLength(50);
  });
});

describe("mensajeDeResultados", () => {
  it("nunca pasa de 2.000 caracteres aunque los nombres sean hostiles", () => {
    const hostiles = Array.from({ length: 11 }, (_, i) => ({
      markbox: `DTD-${"9".repeat(15)}${i}`,
      name: "*_`[](<@>)".repeat(20),
    }));
    const texto = mensajeDeResultados("x".repeat(60), hostiles, "https://dtdcargo.com");
    expect(texto.length).toBeLessThanOrEqual(LARGO_MAXIMO);
    expect(texto).toMatch(/Hay más coincidencias/);
  });
});

describe("comando /cliente", () => {
  it("se registra solo en servidores, oculto por defecto y con el término acotado", () => {
    expect(COMANDO_CLIENTE.name).toBe("cliente");
    expect(COMANDO_CLIENTE.contexts).toEqual([0]);
    expect(COMANDO_CLIENTE.default_member_permissions).toBe("0");
    expect(COMANDO_CLIENTE.options).toEqual([
      expect.objectContaining({ name: "nombre", type: 3, required: true, min_length: 2, max_length: 60 }),
    ]);
    expect(JSON.stringify(COMANDO_CLIENTE)).not.toMatch(/MARKBOX/i);
  });

  it("el script de registro manda exactamente esa definición al servidor de DTD Cargo", () => {
    const r = spawnSync(process.execPath, ["scripts/discord/registrar-comando-cliente.mjs", "--dry-run"], {
      cwd: ROOT,
      encoding: "utf8",
      env: { PATH: process.env.PATH ?? "" },
    });
    expect(r.status).toBe(0);
    const [primera, ...resto] = r.stdout.split("\n");
    expect(primera).toBe(
      `PUT https://discord.com/api/v10/applications/<APPLICATION_ID>/guilds/${DTD_DISCORD_GUILD_ID}/commands`,
    );
    expect(JSON.parse(resto.join("\n"))).toEqual([COMANDO_CLIENTE]);
  });

  it("normaliza espacios del término", () => {
    const l = leerComandoCliente({
      type: 2,
      guild_id: DTD_DISCORD_GUILD_ID,
      member: { user: { id: "123456789012345678" } },
      data: { name: "cliente", options: [{ name: "nombre", value: "  Pedro \n  Pérez " }] },
    });
    expect(l).toEqual({ ok: true, discordUserId: "123456789012345678", termino: "Pedro Pérez" });
  });
});
