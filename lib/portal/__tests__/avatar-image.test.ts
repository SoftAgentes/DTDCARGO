import { describe, expect, it, vi } from "vitest";
import {
  AVATAR_MAX_BYTES,
  AVATAR_MESSAGES,
  fitWithin,
  prepareAvatar,
  type AvatarImageDeps,
} from "@/lib/portal/avatar-image";

const file = (name: string, type: string, size = 3_000_000) =>
  new File([new Uint8Array(size)], name, { type });

function deps(width: number, height: number, sizes: number[]): AvatarImageDeps & {
  encode: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
} {
  const close = vi.fn();
  const encode = vi.fn(async () => new Blob([new Uint8Array(sizes.shift() ?? 1)], { type: "image/jpeg" }));
  return {
    decode: vi.fn(async () => ({ width, height, source: {} as CanvasImageSource, close })),
    encode,
    close,
  };
}

describe("fitWithin", () => {
  it("reduce el lado mayor sin deformar y nunca agranda", () => {
    expect(fitWithin(4032, 3024, 1024)).toEqual({ width: 1024, height: 768 });
    expect(fitWithin(3024, 4032, 1024)).toEqual({ width: 768, height: 1024 });
    expect(fitWithin(640, 480, 1024)).toEqual({ width: 640, height: 480 });
  });
});

describe("prepareAvatar (SDD-0487)", () => {
  it("una foto de teléfono sale JPEG de 1024 px y por debajo del tope", async () => {
    const d = deps(4032, 3024, [250_000]);
    const out = await prepareAvatar(file("IMG_0001.HEIC", "image/heic"), d);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.file.type).toBe("image/jpeg");
    expect(out.file.name).toBe("avatar.jpg");
    expect(out.file.size).toBeLessThanOrEqual(AVATAR_MAX_BYTES);
    expect(d.encode).toHaveBeenCalledWith(expect.anything(), 1024, 768, 0.85);
    expect(d.close).toHaveBeenCalled();
  });

  it("si pesa demasiado, reintenta a 768 px con menos calidad", async () => {
    const d = deps(4000, 4000, [AVATAR_MAX_BYTES + 1, 400_000]);
    const out = await prepareAvatar(file("grande.jpg", "image/jpeg"), d);
    expect(out.ok).toBe(true);
    expect(d.encode).toHaveBeenLastCalledWith(expect.anything(), 768, 768, 0.7);
  });

  it("si ni así entra, lo dice y no sube nada", async () => {
    const d = deps(4000, 4000, [AVATAR_MAX_BYTES + 1, AVATAR_MAX_BYTES + 1]);
    expect(await prepareAvatar(file("enorme.jpg", "image/jpeg"), d)).toEqual({
      ok: false,
      error: AVATAR_MESSAGES.tooLarge,
    });
  });

  it("un HEIC que el navegador no sabe leer (Chrome en Windows) da un mensaje claro", async () => {
    const d = deps(1, 1, []);
    d.decode = vi.fn(async () => {
      throw new DOMException("The source image could not be decoded.", "InvalidStateError");
    });
    expect(await prepareAvatar(file("IMG_0002.heic", ""), d)).toEqual({
      ok: false,
      error: AVATAR_MESSAGES.unreadable,
    });
    // Windows sin la extensión HEIF deja type vacío: igual se intenta leer.
    expect(d.decode).toHaveBeenCalled();
  });

  it.each([
    ["un PDF", file("cedula.pdf", "application/pdf")],
    ["un archivo sin tipo ni extensión de foto", file("notas.txt", "")],
  ])("rechaza %s sin intentar decodificarlo", async (_label, input) => {
    const d = deps(10, 10, [100]);
    expect(await prepareAvatar(input, d)).toEqual({ ok: false, error: AVATAR_MESSAGES.notImage });
    expect(d.decode).not.toHaveBeenCalled();
  });

  it("no intenta decodificar algo de más de 30 MB", async () => {
    const d = deps(10, 10, [100]);
    expect(await prepareAvatar(file("raw.jpg", "image/jpeg", 31 * 1024 * 1024), d)).toEqual({
      ok: false,
      error: AVATAR_MESSAGES.tooLarge,
    });
    expect(d.decode).not.toHaveBeenCalled();
  });
});
