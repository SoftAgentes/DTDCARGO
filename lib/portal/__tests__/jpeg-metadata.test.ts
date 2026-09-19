import { describe, expect, it } from "vitest";
import { stripJpegMetadata } from "@/lib/portal/jpeg-metadata";

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

/** Segmento con marcador y longitud (la longitud incluye sus 2 bytes). */
function segment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...payload];
}

const APP0 = segment(0xe0, ascii("JFIF\0\x01\x01\0\0\x01\0\x01\0\0"));
const APP1_EXIF = segment(0xe1, ascii("Exif\0\0GPS 10.4806,-66.9036 iPhone"));
const APP1_XMP = segment(0xe1, ascii("http://ns.adobe.com/xap/1.0/ Carlos"));
const APP2_ICC = segment(0xe2, ascii("ICC_PROFILE\0sRGB"));
const APP13 = segment(0xed, ascii("Photoshop 3.0 IPTC Caracas"));
const COM = segment(0xfe, ascii("tomada en casa de Carlos"));
const DQT = segment(0xdb, [0, ...new Array(64).fill(1)]);
const SOS_AND_DATA = [...segment(0xda, [1, 1, 0, 0, 0x3f, 0]), 0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd9];

function jpeg(...parts: number[][]): Uint8Array {
  return Uint8Array.from([0xff, 0xd8, ...parts.flat()]);
}
const text = (bytes: Uint8Array) => String.fromCharCode(...bytes);

describe("stripJpegMetadata (SDD-0487)", () => {
  const original = jpeg(APP0, APP1_EXIF, APP1_XMP, APP2_ICC, APP13, COM, DQT, SOS_AND_DATA);

  it("control: el original sí trae GPS, autor y comentario", () => {
    expect(text(original)).toMatch(/GPS 10\.4806/);
    expect(text(original)).toMatch(/Carlos/);
  });

  it("quita EXIF, XMP, IPTC y comentarios, y conserva la imagen", () => {
    const out = stripJpegMetadata(original);
    expect(out).not.toBeNull();
    const s = text(out!);
    expect(s).not.toMatch(/GPS|Exif|xap|Photoshop|Carlos|Caracas/);
    expect(s).toMatch(/JFIF/);
    expect(s).toMatch(/ICC_PROFILE/);
    expect(Array.from(out!)).toEqual([0xff, 0xd8, ...APP0, ...APP2_ICC, ...DQT, ...SOS_AND_DATA]);
  });

  it("un JPEG sin metadatos sale idéntico", () => {
    const clean = jpeg(APP0, DQT, SOS_AND_DATA);
    expect(stripJpegMetadata(clean)).toEqual(clean);
  });

  it.each([
    ["no empieza con SOI", Uint8Array.from([0x89, 0x50, 0x4e, 0x47])],
    ["corta a mitad de un segmento", jpeg([0xff, 0xe1, 0x00, 0x40, 0x01])],
    ["no llega nunca a los datos", jpeg(APP0)],
    ["basura entre segmentos", jpeg(APP0, [0x00, 0x11], SOS_AND_DATA)],
    ["longitud imposible", jpeg([0xff, 0xe0, 0x00, 0x01])],
  ])("rechaza un archivo que %s", (_label, bytes) => {
    expect(stripJpegMetadata(bytes)).toBeNull();
  });
});
