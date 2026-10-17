// @vitest-environment node
/**
 * SDD-0547 · lectura del archivo de estado de publicaciones.
 *
 * La pantalla nunca se cae: sin archivo, con una carpeta en su lugar, con un
 * archivo enorme o con JSON roto, el loader devuelve `{ ok: false, motivo }`.
 * Se prueba con archivos reales en una carpeta temporal.
 */
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  MAX_BYTES_ESTADO_PUBLICACIONES,
  RUTA_ESTADO_PUBLICACIONES,
  cargarEstadoPublicaciones,
} from "../publicaciones-loader";

const RELOJ = () => Date.parse("2026-10-17T17:45:00Z");
const VALIDO = JSON.stringify({ version: 1, actualizado: "2026-10-17T17:40:02Z" });

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "dtd-0547-"));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("cargarEstadoPublicaciones", () => {
  it("la ruta por defecto es la del montaje de solo lectura en el contenedor", () => {
    expect(RUTA_ESTADO_PUBLICACIONES).toBe("/var/lib/dtd-cargo/publicacion/publicaciones.json");
  });

  it("archivo válido → ok, con la hora de lectura del reloj", async () => {
    const f = join(dir, "valido.json");
    await writeFile(f, VALIDO);
    const r = await cargarEstadoPublicaciones(f, RELOJ);
    expect(r.ok).toBe(true);
    expect(r.leidoEn).toBe(RELOJ());
    if (r.ok) expect(r.estado.actualizado).toBe(Date.parse("2026-10-17T17:40:02Z"));
  });

  it("sin archivo → sin-archivo", async () => {
    expect(await cargarEstadoPublicaciones(join(dir, "no-existe.json"), RELOJ)).toEqual({
      ok: false,
      motivo: "sin-archivo",
      leidoEn: RELOJ(),
    });
  });

  it("sin la carpeta → sin-archivo", async () => {
    const r = await cargarEstadoPublicaciones(join(dir, "no-hay-carpeta", "publicaciones.json"), RELOJ);
    expect(r).toMatchObject({ ok: false, motivo: "sin-archivo" });
  });

  it("una carpeta donde va el archivo → ilegible", async () => {
    const f = join(dir, "es-carpeta.json");
    await mkdir(f);
    expect(await cargarEstadoPublicaciones(f, RELOJ)).toMatchObject({ ok: false, motivo: "ilegible" });
  });

  it("más grande que el tope → demasiado-grande, sin leerlo", async () => {
    const f = join(dir, "grande.json");
    await writeFile(f, " ".repeat(MAX_BYTES_ESTADO_PUBLICACIONES + 1));
    expect(await cargarEstadoPublicaciones(f, RELOJ)).toMatchObject({ ok: false, motivo: "demasiado-grande" });
  });

  it("justo en el tope se lee", async () => {
    const f = join(dir, "tope.json");
    await writeFile(f, VALIDO.padEnd(MAX_BYTES_ESTADO_PUBLICACIONES, " "));
    expect(await cargarEstadoPublicaciones(f, RELOJ)).toMatchObject({ ok: true });
  });

  it.each([
    ["JSON roto", "{ version: 1"],
    ["vacío", ""],
    ["a medio escribir", VALIDO.slice(0, 20)],
  ])("%s → formato", async (_n, contenido) => {
    const f = join(dir, `roto-${_n.replace(/\s/g, "-")}.json`);
    await writeFile(f, contenido);
    expect(await cargarEstadoPublicaciones(f, RELOJ)).toMatchObject({ ok: false, motivo: "formato" });
  });

  it("otra versión del formato → version", async () => {
    const f = join(dir, "v2.json");
    await writeFile(f, JSON.stringify({ version: 2, actualizado: "2026-10-17T17:40:02Z" }));
    expect(await cargarEstadoPublicaciones(f, RELOJ)).toMatchObject({ ok: false, motivo: "version" });
  });
});
