// @vitest-environment node
/**
 * SDD-0652 fase 2 · foto del empleado (UPL-01): validación por contenido,
 * reescalado, WebP **sin EXIF**, ruta por tenant y firma. La imagen de prueba
 * se genera aquí mismo, con datos de ubicación sintéticos, para comprobar que
 * no sobreviven.
 */
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMPLOYEE_PHOTO_BUCKET,
  EMPLOYEE_PHOTO_MAX_BYTES,
  EMPLOYEE_PHOTO_URL_TTL_S,
  detectarTipoImagen,
  esRutaDeFicha,
  firmarFotos,
  procesarFotoEmpleado,
  rutaFotoEmpleado,
  rutasDeFoto,
  validarFoto,
} from "../employee-photo";

const T1 = "10000000-0000-4000-8000-000000000001";
const T2 = "10000000-0000-4000-8000-000000000002";
const E1 = "30000000-0000-4000-8000-000000000001";
const E2 = "30000000-0000-4000-8000-000000000002";
const F1 = "aaaaaaaa-0000-4000-8000-000000000001";

const lienzo = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 120, g: 40, b: 60 } } });

describe("tipo por contenido", () => {
  it("reconoce JPEG, PNG y WebP por sus primeros bytes", async () => {
    expect(detectarTipoImagen(await lienzo(8, 8).jpeg().toBuffer())).toBe("image/jpeg");
    expect(detectarTipoImagen(await lienzo(8, 8).png().toBuffer())).toBe("image/png");
    expect(detectarTipoImagen(await lienzo(8, 8).webp().toBuffer())).toBe("image/webp");
  });

  it("no se fía de la extensión: un texto, un GIF, un SVG o un PDF no pasan", () => {
    const enc = new TextEncoder();
    expect(detectarTipoImagen(enc.encode("no soy una imagen"))).toBeNull();
    expect(detectarTipoImagen(enc.encode("GIF89a........"))).toBeNull();
    expect(detectarTipoImagen(enc.encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(detectarTipoImagen(enc.encode("%PDF-1.7 ......"))).toBeNull();
    expect(detectarTipoImagen(new Uint8Array())).toBeNull();
    // Cabecera RIFF que no es WebP (un WAV).
    expect(detectarTipoImagen(enc.encode("RIFF\0\0\0\0WAVEfmt "))).toBeNull();
  });

  it("validarFoto rechaza vacío, más de 2 MB y lo que no es imagen", () => {
    expect(validarFoto(new Uint8Array())).toEqual({ ok: false, error: "El archivo está vacío." });
    const grande = new Uint8Array(EMPLOYEE_PHOTO_MAX_BYTES + 1);
    grande.set([0xff, 0xd8, 0xff]);
    expect(validarFoto(grande)).toEqual({ ok: false, error: "La foto pesa más de 2 MB." });
    expect(validarFoto(new TextEncoder().encode("hola"))).toEqual({
      ok: false,
      error: "El archivo no es una imagen JPG, PNG o WebP.",
    });
  });
});

describe("procesarFotoEmpleado", () => {
  it("devuelve WebP de 512 × 512 y sin EXIF, aunque la original traiga ubicación", async () => {
    const original = await lienzo(900, 600)
      .jpeg()
      .withExif({
        IFD0: { Copyright: "sintetico", Make: "CamaraSintetica" },
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "10/1 30/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "66/1 55/1 0/1" },
      })
      .toBuffer();
    // La original sí trae EXIF: si no, la prueba no mediría nada.
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const r = await procesarFotoEmpleado(new Uint8Array(original));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const meta = await sharp(r.webp).metadata();
    expect(meta.format).toBe("webp");
    expect([meta.width, meta.height]).toEqual([512, 512]);
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(r.webp.includes(Buffer.from("CamaraSintetica"))).toBe(false);
    expect(r.webp.length).toBeLessThan(EMPLOYEE_PHOTO_MAX_BYTES);
  });

  it("una imagen pequeña también sale de 512 × 512", async () => {
    const r = await procesarFotoEmpleado(new Uint8Array(await lienzo(40, 90).png().toBuffer()));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const meta = await sharp(r.webp).metadata();
    expect([meta.width, meta.height]).toEqual([512, 512]);
  });

  it("un archivo con cabecera de imagen y cuerpo roto se rechaza con un mensaje claro", async () => {
    const roto = new Uint8Array(64);
    roto.set([0xff, 0xd8, 0xff, 0xe0]);
    expect(await procesarFotoEmpleado(roto)).toEqual({ ok: false, error: "No se pudo leer la imagen. Prueba con otra foto." });
  });

  it("lo que no es imagen no llega al procesador", async () => {
    expect(await procesarFotoEmpleado(new TextEncoder().encode("<script>alert(1)</script>"))).toEqual({
      ok: false,
      error: "El archivo no es una imagen JPG, PNG o WebP.",
    });
  });
});

describe("ruta de la foto", () => {
  it("es {tenant}/{ficha}/{uuid}.webp, en minúsculas", () => {
    expect(rutaFotoEmpleado(T1, E1, F1.toUpperCase())).toBe(`${T1}/${E1}/${F1}.webp`);
  });

  it.each([
    ["tenant que no es uuid", "../otro", E1, F1],
    ["ficha con barra", T1, `${E1}/x`, F1],
    ["archivo con puntos", T1, E1, "../../x"],
    ["archivo vacío", T1, E1, ""],
  ])("no arma una ruta con %s", (_caso, tenant, ficha, archivo) => {
    expect(() => rutaFotoEmpleado(tenant, ficha, archivo)).toThrow("ruta de foto inválida");
  });

  it("esRutaDeFicha solo acepta la ruta de ese tenant y esa ficha", () => {
    const ruta = `${T1}/${E1}/${F1}.webp`;
    expect(esRutaDeFicha(ruta, T1, E1)).toBe(true);
    expect(esRutaDeFicha(ruta, T2, E1)).toBe(false);
    expect(esRutaDeFicha(ruta, T1, E2)).toBe(false);
    expect(esRutaDeFicha(`${T1}/${E1}/${F1}.jpg`, T1, E1)).toBe(false);
    expect(esRutaDeFicha(`${T1}/${E1}/../${E2}/${F1}.webp`, T1, E1)).toBe(false);
    expect(esRutaDeFicha(null, T1, E1)).toBe(false);
  });
});

describe("rutasDeFoto y firmarFotos", () => {
  function clienteDeRutas(respuesta: { data: unknown; error: { code?: string } | null }) {
    const filtros: [string, ...unknown[]][] = [];
    const chain: Record<string, unknown> = {
      select: (c: string) => (filtros.push(["select", c]), chain),
      eq: (c: string, v: unknown) => (filtros.push(["eq", c, v]), chain),
      in: (c: string, v: unknown) => (filtros.push(["in", c, v]), chain),
      not: (c: string, op: string, v: unknown) => (filtros.push(["not", c, op, v]), chain),
      then: (ok: (v: unknown) => unknown) => Promise.resolve(respuesta).then(ok),
    };
    return { supabase: { from: () => chain } as unknown as SupabaseClient, filtros };
  }

  it("pide solo id y photo_path, filtrando por tenant y por las fichas dadas", async () => {
    const { supabase, filtros } = clienteDeRutas({ data: [{ id: E1, photo_path: `${T1}/${E1}/${F1}.webp` }], error: null });
    const rutas = await rutasDeFoto(supabase, T1, [E1, E2]);
    expect([...rutas]).toEqual([[E1, `${T1}/${E1}/${F1}.webp`]]);
    expect(filtros).toEqual([
      ["select", "id, photo_path"],
      ["eq", "tenant_id", T1],
      ["in", "id", [E1, E2]],
      ["not", "photo_path", "is", null],
    ]);
  });

  it("una ruta que no es de esa ficha o de ese tenant se descarta: no se firma", async () => {
    const { supabase } = clienteDeRutas({
      data: [
        { id: E1, photo_path: `${T2}/${E1}/${F1}.webp` },
        { id: E2, photo_path: `${T1}/${E1}/${F1}.webp` },
      ],
      error: null,
    });
    expect((await rutasDeFoto(supabase, T1, [E1, E2])).size).toBe(0);
  });

  it("sin la columna (migración en espera) nadie tiene foto y nada se rompe", async () => {
    const { supabase } = clienteDeRutas({ data: null, error: { code: "42703" } });
    expect((await rutasDeFoto(supabase, T1, [E1])).size).toBe(0);
  });

  it("sin fichas no consulta", async () => {
    const supabase = { from: () => { throw new Error("no debe consultar"); } } as unknown as SupabaseClient;
    expect((await rutasDeFoto(supabase, T1, [])).size).toBe(0);
  });

  it("firma en el bucket privado, con vida corta, y omite lo que no se pudo firmar", async () => {
    const llamadas: unknown[] = [];
    const admin = {
      storage: {
        from: (bucket: string) => ({
          createSignedUrls: async (rutas: string[], ttl: number) => {
            llamadas.push([bucket, rutas, ttl]);
            return {
              data: [
                { path: "a.webp", signedUrl: "https://firmada.example.test/a", error: null },
                { path: "b.webp", signedUrl: null, error: "Object not found" },
              ],
              error: null,
            };
          },
        }),
      },
    } as unknown as SupabaseClient;
    const urls = await firmarFotos(admin, ["a.webp", "b.webp", "a.webp"]);
    expect(llamadas).toEqual([[EMPLOYEE_PHOTO_BUCKET, ["a.webp", "b.webp"], EMPLOYEE_PHOTO_URL_TTL_S]]);
    expect(EMPLOYEE_PHOTO_URL_TTL_S).toBeLessThanOrEqual(600);
    expect([...urls]).toEqual([["a.webp", "https://firmada.example.test/a"]]);
  });

  it("si la firma falla entera, no hay URL para nadie", async () => {
    const admin = {
      storage: { from: () => ({ createSignedUrls: async () => ({ data: null, error: { message: "x" } }) }) },
    } as unknown as SupabaseClient;
    expect((await firmarFotos(admin, ["a.webp"])).size).toBe(0);
  });
});
